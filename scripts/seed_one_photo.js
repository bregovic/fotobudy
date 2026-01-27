
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
    const filename = 'DSC_0024.jpg';
    const filePath = path.join(__dirname, '../public/photos', filename);

    console.log(`📸 Načítám fotku: ${filePath}`);

    if (!fs.existsSync(filePath)) {
        console.error('❌ Soubor neexistuje!');
        return;
    }

    const fileBuffer = fs.readFileSync(filePath);

    // Simulujeme URL, jakou by vygeneroval upload script
    const cloudUrl = `https://cvak.up.railway.app/api/view/photo_${Date.now()}_${filename}`;

    try {
        await prisma.media.create({
            data: {
                type: 'IMAGE',
                url: cloudUrl,
                data: fileBuffer // Uložíme binární data přímo do DB
            }
        });
        console.log(`✅ Fotka ${filename} úspěšně nahrána do databáze!`);
        console.log(`🔗 URL: ${cloudUrl}`);
    } catch (e) {
        console.error('❌ Chyba při vkládání:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
