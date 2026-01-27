
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('🧹 Začínám úklid galerie...');
    try {
        const deleted = await prisma.media.deleteMany({});
        console.log(`✅ Smazáno ${deleted.count} fotek. Galerie je prázdná.`);
    } catch (e) {
        console.error('Chyba při mazání:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
