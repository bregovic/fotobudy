const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

// KONFIGURACE CEST
const DIGICAM_PATH = 'C:\\Program Files (x86)\\digiCamControl\\CameraControl.exe';
const CHROME_PATH_1 = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const CHROME_PATH_2 = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';

// LOKÁLNÍ URL (Už ne Railway!)
const LOCAL_PORT = 3000;
const KIOSK_URL = `http://localhost:${LOCAL_PORT}/kiosk`;

console.log('🚀 Startuji FotoBuddy LOCAL APP...');

// 1. Spustit DigicamControl (Kamera)
if (fs.existsSync(DIGICAM_PATH)) {
    console.log('📷 Startuji DigicamControl...');
    spawn(DIGICAM_PATH, [], { detached: true, stdio: 'ignore' }).unref();
} else {
    console.log('ℹ️ DigicamControl nenalezen (možná běží?).');
}

// 2. Spustit Lokální Server (Next.js)
console.log('🧠 Startuji lokální mozek aplikace (Server)...');
const server = spawn('cmd.exe', ['/c', 'npx next dev -p ' + LOCAL_PORT], {
    stdio: 'inherit', // Aby bylo vidět co server vypisuje
    cwd: process.cwd()
});

// 3. Počkat až server naběhne a pak spustit Okno
console.log('⏳ Čekám na nastartování serveru...');

function checkServer() {
    http.get(KIOSK_URL, (res) => {
        if (res.statusCode === 200) {
            console.log('✅ Server běží! Otevírám aplikaci...');
            openChromeApp();
        } else {
            setTimeout(checkServer, 1000);
        }
    }).on('error', () => {
        setTimeout(checkServer, 1000);
    });
}
// Začít kontrolovat za 2s
setTimeout(checkServer, 2000);


function openChromeApp() {
    const chromePath = fs.existsSync(CHROME_PATH_1) ? CHROME_PATH_1 : (fs.existsSync(CHROME_PATH_2) ? CHROME_PATH_2 : null);

    if (chromePath) {
        // --app=URL udělá z webu "aplikaci" bez lišt
        const args = [
            `--app=${KIOSK_URL}`,
            '--start-maximized',
            '--kiosk', // Fullscreen mód
            '--autoplay-policy=no-user-gesture-required',
            '--user-data-dir=C:\\Temp\\ChromeKioskData' // Oddělený profil, aby se nepletl s běžným prohlížením
        ];

        spawn(chromePath, args, { detached: true, stdio: 'ignore' }).unref();
    } else {
        console.error('❌ Chrome nenalezen! Otevřete ručně: ' + KIOSK_URL);
    }
}

console.log('💡 TIP: Pro ukončení zavřete toto okno.');
