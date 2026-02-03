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

// 0. CLEANUP: Kill zombie processes on ports 3000 & 5555
console.log('🧹 [0/4] Čištění portů (3000, 5555)...');
const killScript = `
        $ports = @(3000, 5555);
        $global:ErrorActionPreference = 'SilentlyContinue'; # Suppress all errors in this scope
        
        foreach ($port in $ports) {
            $pids = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique;
            if ($pids) { 
                Stop-Process -Id $pids -Force -ErrorAction SilentlyContinue; 
                Write-Host "Killed process on port $port"; 
            }
        }
        
        # Kill stuck CameraControl
        Get-Process -Name "CameraControl" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue;
        
        # Clear DCC Cache to fix startup hangs
        $cachePath = "C:\\ProgramData\\DigiCamControl\\Cache";
        if (Test-Path $cachePath) {
            try { Remove-Item -Path "$cachePath\\*" -Recurse -Force -ErrorAction SilentlyContinue; } catch {}
        }

        exit 0; # Always exit success to prevent JS error
    `;
// Use stdio: 'pipe' to capture output but not throw on stderr output unless exit code is non-zero
try {
    require('child_process').execSync(`powershell -Command "${killScript.replace(/\r?\n/g, ' ')}"`, { stdio: 'ignore' });
    console.log('      ✅ Porty vyčištěny');
} catch (e) {
    // Ignorujeme chybu, pravděpodobně nebylo co čistit
}

// 1. Spustit DigicamControl (jediné oddělené okno)
console.log('📷 [1/4] Startuji DigicamControl...');
if (fs.existsSync(DIGICAM_PATH)) {
    const dcc = spawn(DIGICAM_PATH, [], {
        detached: true,
        stdio: 'ignore',
        windowsHide: false
    });
    dcc.unref();

    console.log('      ✅ DigicamControl spuštěn (okno by se mělo objevit)');

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

// Spustit Next.js server pomocí npm (spolehlivější než npx)
const serverProcess = require('child_process').spawn('cmd.exe', ['/c', 'npm run dev -- -p ' + LOCAL_PORT], {
    stdio: 'inherit',
    cwd: process.cwd(),
    windowsHide: false
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
            console.log('✅ VŠE BĚŽÍ! Server je připraven.');
            console.log('   -> Kiosk: http://localhost:' + LOCAL_PORT + '/kiosk');
            console.log('   -> Remote: http://localhost:' + LOCAL_PORT + '/remote');
            openChromeApp(); // Re-enabled as app appears 'broken' without it
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
        console.log('');
        console.log('🚀 OTEVÍRÁM KIOSK (Chrome)...');
        spawn(chromePath, [
            `--app=${KIOSK_URL}`,
            '--start-maximized',
            '--kiosk',
            '--autoplay-policy=no-user-gesture-required',
            '--disable-infobars',
            '--user-data-dir=C:\\Temp\\BlickCvakKiosk'
        ], {
            detached: true,
            stdio: 'ignore'
        }).unref();

        console.log('╔══════════════════════════════════════════════════════════╗');
        console.log('║   🎉 BLICK & CVAK BĚŽÍ                                   ║');
        console.log('║   💡 Toto okno nechte otevřené.                          ║');
        console.log('╚══════════════════════════════════════════════════════════╝');
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
