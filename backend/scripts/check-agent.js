// Quick diagnostic script to check agent state
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('=== Agent API Keys ===');
    const apiKeys = await prisma.agentApiKey.findMany();
    console.log(`Found ${apiKeys.length} API keys:`);
    apiKeys.forEach(k => {
        console.log(`  - ${k.deviceName}: ${k.keyPrefix}... (Status: ${k.status})`);
    });

    console.log('\n=== Agent Uploads ===');
    const uploads = await prisma.agentUpload.findMany({
        orderBy: { uploadedAt: 'desc' },
        take: 10
    });
    console.log(`Found ${uploads.length} recent uploads:`);
    uploads.forEach(u => {
        console.log(`  - ${u.fileName}: ${u.status} (${u.uploadedAt})`);
    });

    console.log('\n=== Setup PINs ===');
    const pins = await prisma.agentSetupPin.findMany({
        where: { usedAt: null }
    });
    console.log(`Found ${pins.length} unused PINs:`);
    pins.forEach(p => {
        console.log(`  - PIN: ${p.pin}, Expires: ${p.expiresAt}`);
    });
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
