const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Konfigurace
const PHOTOS_DIR = path.join(__dirname, '..', 'public', 'photos');
const CLOUD_UPLOAD_URL = 'https://cvak.up.railway.app/api/media/upload';

console.log('🔄 ZAČÍNÁM SYNCHRONIZACI GALERIE...');
console.log(`📂 Složka: ${PHOTOS_DIR}`);

if (!fs.existsSync(PHOTOS_DIR)) {
    console.error('❌ Složka public/photos neexistuje!');
    process.exit(1);
}

const files = fs.readdirSync(PHOTOS_DIR).filter(f => f.match(/\.(jpg|png)$/i));
console.log(`📸 Nalezeno ${files.length} fotek.`);

let current = 0;

function uploadNext() {
    if (current >= files.length) {
        console.log('\n✅ HOTOVO! Všechny fotky jsou zpět na Cloudu.');
        // Necháme okno chvíli otevřené
        setTimeout(() => process.exit(0), 5000);
        return;
    }

    const filename = files[current];
    const filePath = path.join(PHOTOS_DIR, filename);

    process.stdout.write(`[${current + 1}/${files.length}] Nahrávám ${filename}... `);

    // Použijeme cURL pro upload (stejně jako Bridge)
    const curlCmd = `curl -X POST -F "type=PHOTO" -F "file=@${filePath};filename=${filename}" -F "localPath=${filePath}" ${CLOUD_UPLOAD_URL}`;

    exec(curlCmd, (error, stdout) => {
        if (error) {
            console.log('❌ CHYBA');
        } else {
            console.log('✅ OK');
        }
        current++;
        uploadNext();
    });
}

uploadNext();
