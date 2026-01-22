
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const count = await prisma.shiftReport.count();
    console.log(`Total Shift Reports: ${count}`);

    const reports = await prisma.shiftReport.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, createdAt: true, storeId: true }
    });
    console.log('Recent Reports:', reports);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
