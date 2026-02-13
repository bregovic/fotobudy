
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clean() {
    try {
        console.log('🧹 Připojuji se k DB a mažu staré fotky...');

        // Smazat všechny záznamy o fotkách (Media)
        // Ponecháme Události (Events), smažeme jen fotky/otisky
        const { count } = await prisma.media.deleteMany({
            where: {
                // Můžeme filtrovat, ale pro "čistý start" je lepší smazat vše v Media
            }
        });

        console.log(`✅ ÚSPĚŠNĚ SMAZÁNO: ${count} záznamů z databáze.`);
        console.log('   Nyní je DB čistá a připravena na nové (cloud) fotky.');

    } catch (e) {
        console.error('❌ Chyba při mazání:', e);
    } finally {
        await prisma.$disconnect();
    }
}

clean();
