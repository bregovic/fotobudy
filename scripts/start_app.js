const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

// KONFIGURACE CEST
const DIGICAM_PATH = 'C:\\Program Files (x86)\\digiCamControl\\CameraControl.exe';
const CHROME_PATH_1 = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const CHROME_PATH_2 = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';

// LOKÁLNÍ URL
const LOCAL_PORT = 3000;
const BRIDGE_PORT = 5555;
const KIOSK_URL = `http://localhost:${LOCAL_PORT}/kiosk`;

console.log('');
console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║       🎯 BLICK & CVAK - LOKÁLNÍ APLIKACE                 ║');
console.log('╚══════════════════════════════════════════════════════════╝');
console.log('');

// 1. Spustit DigicamControl (Kamera)
console.log('📷 [1/5] Startuji DigicamControl...');
if (fs.existsSync(DIGICAM_PATH)) {
    spawn(DIGICAM_PATH, [], { detached: true, stdio: 'ignore' }).unref();
    console.log('      ✅ DigicamControl spuštěn');
} else {
    console.log('      ℹ️  DigicamControl nenalezen (možná již běží)');
}

// 2. Spustit Bridge Server (Live Stream + Cloud Sync)
console.log('🌉 [2/5] Startuji Bridge server (port ' + BRIDGE_PORT + ')...');
const bridgePath = path.join(process.cwd(), 'local-service', 'server.js');
if (fs.existsSync(bridgePath)) {
    const bridge = spawn('node', [bridgePath], {
        stdio: 'ignore',
        detached: true,
        cwd: process.cwd()
    });
    bridge.unref();
    console.log('      ✅ Bridge server spuštěn (live stream + cloud sync)');
} else {
    console.log('      ⚠️  Bridge server nenalezen: ' + bridgePath);
}

// 3. Spustit File Watcher (Hlídač nových fotek)
console.log('👀 [3/5] Startuji hlídače nových fotek...');
const watcherPath = path.join(process.cwd(), 'scripts', 'watch_folder.js');
if (fs.existsSync(watcherPath)) {
    const watcher = spawn('node', [watcherPath], {
        stdio: 'ignore',
        detached: true,
        cwd: process.cwd()
    });
    watcher.unref();
    console.log('      ✅ File watcher spuštěn');
} else {
    console.log('      ⚠️  File watcher nenalezen');
}

// 4. Spustit Lokální Server (Next.js)
console.log('🧠 [4/5] Startuji Next.js server (port ' + LOCAL_PORT + ')...');
const server = spawn('cmd.exe', ['/c', 'npx next dev -p ' + LOCAL_PORT], {
    stdio: 'inherit',
    cwd: process.cwd()
});

// 5. Počkat až server naběhne a pak spustit Kiosk
console.log('⏳ [5/5] Čekám na nastartování serveru...');

let serverReady = false;
function checkServer() {
    if (serverReady) return;

    http.get(KIOSK_URL, (res) => {
        if (res.statusCode === 200 && !serverReady) {
            serverReady = true;
            console.log('');
            console.log('✅ Server běží! Otevírám Kiosk...');
            openChromeApp();
        } else if (!serverReady) {
            setTimeout(checkServer, 1000);
        }
    }).on('error', () => {
        if (!serverReady) setTimeout(checkServer, 1000);
    });
}
setTimeout(checkServer, 3000);


function openChromeApp() {
    const chromePath = fs.existsSync(CHROME_PATH_1) ? CHROME_PATH_1 :
        (fs.existsSync(CHROME_PATH_2) ? CHROME_PATH_2 : null);

    if (chromePath) {
        console.log('🚀 Spouštím Chrome Kiosk...');
        const args = [
            `--app=${KIOSK_URL}`,
            '--start-maximized',
            '--kiosk',
            '--autoplay-policy=no-user-gesture-required',
            '--disable-infobars',
            '--user-data-dir=C:\\Temp\\BlickCvakKiosk'
        ];

        spawn(chromePath, args, { detached: true, stdio: 'ignore' }).unref();

        console.log('');
        console.log('╔══════════════════════════════════════════════════════════╗');
        console.log('║   🎉 APLIKACE BĚŽÍ!                                      ║');
        console.log('║                                                          ║');
        console.log('║   📍 Kiosk:  http://localhost:' + LOCAL_PORT + '/kiosk                 ║');
        console.log('║   📍 Bridge: http://localhost:' + BRIDGE_PORT + '/stream.mjpg           ║');
        console.log('║                                                          ║');
        console.log('║   💡 Pro ukončení zavřete toto okno.                     ║');
        console.log('╚══════════════════════════════════════════════════════════╝');
        console.log('');
    } else {
        console.error('❌ Chrome nenalezen! Otevřete ručně: ' + KIOSK_URL);
    }
}

// Cleanup on exit
process.on('SIGINT', () => {
    console.log('\n👋 Ukončuji aplikaci...');
    process.exit();
});
