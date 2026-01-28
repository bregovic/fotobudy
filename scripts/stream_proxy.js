const axios = require('axios');
const fs = require('fs');

// KONFIGURACE
const CAMERA_IP = '127.0.0.1'; // IP adresa PC kde běží DigicamControl
const CLOUD_URL = 'https://cvak.up.railway.app/api/stream/snapshot';
const POLL_INTERVAL = 100; // ms (100ms = 10 FPS).

// Seznam portů k vyzkoušení (podle priority)
// 5514: MJPEG Stream (z vašeho nastavení)
// 5520: Webserver snapshot (z vašeho nastavení)
// 5521: Live View Window (default)
// 5513: Webserver (default)
const PORTS_TO_TRY = [5514, 5520, 5521, 5513];

async function streamLoop() {
    let portIndex = 0;
    let currentPort = PORTS_TO_TRY[0];
    let retryCount = 0;

    console.log(`🚀 Spouštím Stream Proxy`);
    console.log(`📷 Kamera: ${CAMERA_IP}`);
    console.log(`☁️ Cloud: ${CLOUD_URL}`);
    console.log(`🎯 Porty k testování: ${PORTS_TO_TRY.join(', ')}`);

    while (true) {
        const start = Date.now();
        try {
            // 1. Zjistit URL podle portu
            let url = `http://${CAMERA_IP}:${currentPort}/live`;
            // Webserver porty vrací obrázek na /liveview.jpg
            if (currentPort === 5520 || currentPort === 5513) {
                url = `http://${CAMERA_IP}:${currentPort}/liveview.jpg`;
            }

            // 2. Stáhnout z kamery
            const response = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: 2000
            });

            // 3. Odeslat na Cloud
            await axios.post(CLOUD_URL, response.data, {
                headers: { 'Content-Type': 'image/jpeg' },
                timeout: 2000
            });

            // Úspěch - resetujeme počítadlo
            retryCount = 0;

        } catch (e) {
            // Pokud se nemůžeme připojit (ECONNREFUSED), zkusíme další port
            if (e.code === 'ECONNREFUSED' || e.code === 'ETIMEDOUT') {
                console.log(`⚠️ Port ${currentPort} neodpovídá.`);

                // Posun na další port v seznamu
                portIndex = (portIndex + 1) % PORTS_TO_TRY.length;
                currentPort = PORTS_TO_TRY[portIndex];

                console.log(`🔄 Zkouším port ${currentPort}...`);
                await new Promise(r => setTimeout(r, 500));
            } else {
                console.error('Chyba streamu:', e.message);
                await new Promise(r => setTimeout(r, 1000));
            }
        }

        // Časování
        const duration = Date.now() - start;
        const wait = Math.max(0, POLL_INTERVAL - duration);
        await new Promise(r => setTimeout(r, wait));
    }
}

streamLoop();
