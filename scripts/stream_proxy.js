const axios = require('axios');
const fs = require('fs');

// KONFIGURACE
const CAMERA_IP = '127.0.0.1'; // IP adresa PC kde běží DigicamControl
const CLOUD_URL = 'https://cvak.up.railway.app/api/stream/snapshot';
const POLL_INTERVAL = 100; // ms (100ms = 10 FPS). Pokud to síť zvládne, snižte na 50ms.

async function streamLoop() {
    while (true) {
        const start = Date.now();
        try {
            // 1. Stáhnout z kamery (stream serveru)
            // Port 5521 pro LiveView window v DigicamControlu, nebo 5513/liveview.jpg pro webserver
            const response = await axios.get(`http://${CAMERA_IP}:5521/live`, {
                responseType: 'arraybuffer',
                timeout: 2000
            });

            // 2. Odeslat na Cloud
            await axios.post(CLOUD_URL, response.data, {
                headers: { 'Content-Type': 'image/jpeg' },
                timeout: 2000
            });

            // console.log('.'); // Heartbeat (uncomment for debug)

        } catch (e) {
            // Ignorujeme chyby (aby se stream nezastavil při výpadku)
            console.error('Chyba streamu:', e.message);
            await new Promise(r => setTimeout(r, 1000)); // Při chybě počkáme déle
        }

        // Výpočet čekání pro dodržení intervalu
        const duration = Date.now() - start;
        const wait = Math.max(0, POLL_INTERVAL - duration);
        await new Promise(r => setTimeout(r, wait));
    }
}

// Spustit taky listener pro příkazy (SHOOT)?
// To by chtělo další smyčku pollingu na /api/command

console.log(`🚀 Spouštím Stream Proxy`);
console.log(`📷 Kamera: ${CAMERA_IP}`);
console.log(`☁️ Cloud: ${CLOUD_URL}`);
console.log(`⏱️ Interval: ${POLL_INTERVAL}ms`);

streamLoop();
