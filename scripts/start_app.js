const { spawn, exec, fork } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

// KONFIGURACE
const DIGICAM_PATH = 'C:\\Program Files (x86)\\digiCamControl\\CameraControl.exe';
const CHROME_PATH_1 = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const CHROME_PATH_2 = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const LOCAL_PORT = 3000;
const KIOSK_URL = `http://localhost:${LOCAL_PORT}/kiosk`;

console.log('');
console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║       🎯 BLICK & CVAK - UNIFIED LAUNCHER                 ║');
console.log('╚══════════════════════════════════════════════════════════╝');
console.log('');

// 1. Spustit DigicamControl (jediné oddělené okno)
console.log('📷 [1/4] Startuji DigicamControl...');
if (fs.existsSync(DIGICAM_PATH)) {
    spawn(DIGICAM_PATH, [], {
        detached: true,
        stdio: 'ignore',
        windowsHide: false  // DCC potřebuje své okno
    }).unref();
    console.log('      ✅ DigicamControl spuštěn');
} else {
    console.log('      ℹ️  DigicamControl nenalezen (možná již běží)');
}

// 2. Spustit Bridge Server (SKRYTĚ - v tomto procesu)
console.log('🌉 [2/4] Startuji Bridge server...');
const bridgePath = path.join(process.cwd(), 'local-service', 'server.js');
if (fs.existsSync(bridgePath)) {
    // Fork místo spawn - sdílí stdout s tímto procesem
    const bridge = fork(bridgePath, [], {
        cwd: process.cwd(),
        silent: false  // Bude vypisovat do naší konzole
    });

    bridge.on('error', (err) => {
        console.error('      ⚠️  Bridge error:', err.message);
    });

    console.log('      ✅ Bridge server běží na portu 5555');
} else {
    console.log('      ⚠️  Bridge nenalezen');
}

// 3. Spustit File Watcher (SKRYTĚ - v tomto procesu)
console.log('👀 [3/4] Startuji hlídače fotek...');
const watcherPath = path.join(process.cwd(), 'scripts', 'watch_folder.js');
if (fs.existsSync(watcherPath)) {
    const watcher = fork(watcherPath, [], {
        cwd: process.cwd(),
        silent: true  // Nepotřebujeme jeho logy
    });

    watcher.on('error', (err) => {
        console.error('      ⚠️  Watcher error:', err.message);
    });

    console.log('      ✅ File watcher běží');
} else {
    console.log('      ⚠️  File watcher nenalezen');
}

// 4. Spustit Next.js Server (v tomto okně - hlavní proces)
console.log('🧠 [4/4] Startuji Next.js server (port ' + LOCAL_PORT + ')...');
console.log('');
console.log('─────────────────────────────────────────────────────────────');
console.log('');

// Spustit Next.js pomocí exec (lépe zvládá .cmd na Windows)
const { execSync, exec: execCallback } = require('child_process');

// Spustit Next.js server
const serverProcess = require('child_process').spawn('cmd.exe', ['/c', 'npx next dev -p ' + LOCAL_PORT], {
    stdio: 'inherit',
    cwd: process.cwd(),
    windowsHide: false  // Musí být false aby fungovalo stdio: inherit
});

serverProcess.on('error', (err) => {
    console.error('❌ Server error:', err.message);
});

// Čekání na server a spuštění Chrome
let serverReady = false;
function checkServer() {
    if (serverReady) return;

    http.get(KIOSK_URL, (res) => {
        if (res.statusCode === 200 && !serverReady) {
            serverReady = true;
            console.log('');
            console.log('─────────────────────────────────────────────────────────────');
            console.log('');
            console.log('✅ VŠE BĚŽÍ!');
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

        spawn(chromePath, [
            `--app=${KIOSK_URL}`,
            '--start-maximized',
            '--kiosk',
            '--autoplay-policy=no-user-gesture-required',
            '--disable-infobars',
            '--user-data-dir=C:\\Temp\\BlickCvakKiosk'
        ], {
            detached: true,
            stdio: 'ignore',
            windowsHide: true
        }).unref();

        console.log('');
        console.log('╔══════════════════════════════════════════════════════════╗');
        console.log('║   🎉 BLICK & CVAK BĚŽÍ                                   ║');
        console.log('║                                                          ║');
        console.log('║   📍 Kiosk:  http://localhost:' + LOCAL_PORT + '/kiosk                 ║');
        console.log('║   📍 Bridge: http://localhost:5555                       ║');
        console.log('║                                                          ║');
        console.log('║   💡 Toto okno nechte otevřené.                          ║');
        console.log('║   💡 Pro ukončení stiskněte Ctrl+C nebo zavřete okno.    ║');
        console.log('╚══════════════════════════════════════════════════════════╝');
        console.log('');
    } else {
        console.error('❌ Chrome nenalezen! Otevřete: ' + KIOSK_URL);
    }
}

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Ukončuji vše...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n👋 Ukončuji vše...');
    process.exit(0);
});
