
import { PrismaClient } from '@prisma/client';
import { AgentService } from '../services/AgentService';

const prisma = new PrismaClient();

async function main() {
    const stores = await prisma.store.findMany();

    if (stores.length === 0) {
        console.log('No stores found!');
        return;
    }

    const store = stores[0];
    console.log(`Generating PIN for store: ${store.name} (ID: ${store.id})`);

    const pin = await AgentService.generateSetupPin(store.id);
    console.log('\n================================');
    console.log(`  SETUP PIN: ${pin.pin}`);
    console.log(`  EXPIRES:   ${pin.expiresAt.toLocaleTimeString()}`);
    console.log('================================\n');
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
