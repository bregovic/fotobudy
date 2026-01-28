const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// KONFIGURACE CEST (Upravte, pokud máte nainstalováno jinam)
const DIGICAM_PATH = 'C:\\Program Files (x86)\\digiCamControl\\CameraControl.exe';
const CHROME_PATH_1 = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const CHROME_PATH_2 = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';

const KIOSK_URL = 'https://cvak.up.railway.app/kiosk';

console.log('🚀 Startuji FotoBuddy System...');

// 1. Start DigicamControl
if (fs.existsSync(DIGICAM_PATH)) {
    console.log('📷 Startuji DigicamControl...');
    // Spustíme detached, aby nezablokoval skript
    spawn(DIGICAM_PATH, [], { detached: true, stdio: 'ignore' }).unref();
} else {
    console.log('⚠️ DigicamControl nenalezen na standardní cestě. Ujistěte se, že běží.');
}

// 2. Start Proxy (na pozadí)
console.log('bridge Startuji Bridge (Proxy)...');
const proxy = spawn('node', ['scripts/stream_proxy.js'], { stdio: 'inherit' });

// 3. Start Prohlížeče v Kiosk módu s povoleným Mixed Content
// Tím obejdeme problém, že HTTPS web nemůže číst HTTP kameru.
const chromePath = fs.existsSync(CHROME_PATH_1) ? CHROME_PATH_1 : (fs.existsSync(CHROME_PATH_2) ? CHROME_PATH_2 : null);

if (chromePath) {
    console.log('🖥️ Otevírám Kiosk interface...');

    // --kiosk: Fullscreen bez lišt
    // --allow-running-insecure-content: POVOLÍ načítání HTTP kamery do HTTPS webu (Klíčová věc!)
    // --autoplay-policy=no-user-gesture-required: Povolí video hned
    const args = [
        '--new-window',
        '--allow-running-insecure-content',
        '--autoplay-policy=no-user-gesture-required',
        '--start-maximized',
        // '--kiosk', // Odkomentujte pro finální produkční mód (nejde z něj vyskočit myší)
        KIOSK_URL
    ];

    spawn(chromePath, args, { detached: true, stdio: 'ignore' }).unref();
} else {
    console.error('❌ Google Chrome nenalezen! Otevřete prosím ručně: ' + KIOSK_URL);
}

console.log('✅ Vše spuštěno! Tento terminál nechte běžet pro komunikaci s cloudem.');
console.log('   (Pro ukončení stiskněte Ctrl+C)');
