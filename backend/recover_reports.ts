/**
 * Recovery script to re-process agent uploads that have no shift report
 * Run with: npx ts-node recover_reports.ts
 */

import { PrismaClient } from '@prisma/client';
import { S3Service } from './src/services/S3Service';
import { XMLParserService } from './src/services/XMLParserService';

const prisma = new PrismaClient();
const xmlParser = new XMLParserService();

async function recoverReports() {
    console.log('Finding orphaned agent uploads...');

    // Find uploads that have no associated shift report
    const orphanedUploads = await prisma.agentUpload.findMany({
        where: {
            shiftReportId: null,
            status: 'PROCESSED'
        },
        include: {
            store: true
        }
    });

    console.log(`Found ${orphanedUploads.length} orphaned uploads to recover`);

    for (const upload of orphanedUploads) {
        try {
            console.log(`\nRecovering: ${upload.fileName}`);

            // Download from S3
            if (!upload.s3Key) {
                console.log(`  ❌ No S3 key, skipping`);
                continue;
            }

            console.log(`  📥 Downloading from S3: ${upload.s3Key}`);
            const xmlBuffer = await S3Service.downloadFile(upload.s3Key);
            const xmlContent = xmlBuffer.toString('utf-8');

            if (!xmlContent) {
                console.log(`  ❌ Failed to download from S3`);
                continue;
            }

            // Parse XML
            console.log(`  🔍 Parsing XML...`);
            const result = await xmlParser.parseShiftXML(xmlContent);
            const { parsedJson, kvPairs, summary, vendorType, metadata, legacy } = result;

            // Create new shift report
            const receiptHash = `recovered_${upload.id}_${Date.now()}`;

            const shiftReport = await prisma.shiftReport.create({
                data: {
                    storeId: upload.storeId,
                    receiptHash,

                    // KV Explorer columns (cast to any for Prisma JSON)
                    parsedJson: parsedJson as any,
                    kvPairs: kvPairs as any,
                    summary: summary as any,
                    vendorType,

                    // Metadata
                    businessDate: metadata.businessDate,
                    shiftId: metadata.shiftId,
                    timezone: metadata.xmlTimezone || upload.store?.timezone || 'America/New_York',

                    registerId: legacy.registerId,
                    operatorId: legacy.operatorId,
                    reportDate: legacy.startAt ? new Date(legacy.startAt) : new Date(),
                    shiftStart: legacy.startAt ? new Date(legacy.startAt) : null,
                    shiftEnd: legacy.endAt ? new Date(legacy.endAt) : null,

                    // Summary fields
                    grossSales: summary.grossSales,
                    netSales: summary.netSales,
                    refunds: summary.refunds,
                    discounts: summary.discounts,
                    taxTotal: summary.taxTotal,
                    totalTransactions: summary.totalTransactions,
                    fuelSales: summary.fuelSales,
                    fuelGallons: summary.fuelGallons,
                    insideSales: summary.insideSales,
                    cashVariance: summary.cashVariance,

                    rawText: xmlContent.substring(0, 5000),
                    extractionMethod: 'recovered_agent_xml',
                    extractionConfidence: 1.0,

                    departments: {
                        create: legacy.departments.map(d => ({
                            departmentName: d.departmentName,
                            amount: d.amount,
                        }))
                    },
                }
            });

            // Update agent upload to link to new shift report
            await prisma.agentUpload.update({
                where: { id: upload.id },
                data: { shiftReportId: shiftReport.id }
            });

            console.log(`  ✅ Recovered! New ShiftReport ID: ${shiftReport.id}`);
        } catch (error: any) {
            console.error(`  ❌ Failed to recover ${upload.fileName}:`, error.message);
        }
    }

    console.log('\n✅ Recovery complete!');
}

recoverReports()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Recovery failed:', error);
        process.exit(1);
    });
