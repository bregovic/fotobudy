const axios = require('axios');
const fs = require('fs');

// KONFIGURACE
const CAMERA_IP = '127.0.0.1'; // IP adresa PC kde běží DigicamControl
const CLOUD_URL = 'https://cvak.up.railway.app/api/stream/snapshot';
const POLL_INTERVAL = 100; // ms (100ms = 10 FPS).

async function streamLoop() {
    let currentPort = 5521; // Zkusíme nejdřív LiveView port
    let retryCount = 0;

    console.log(`🚀 Spouštím Stream Proxy`);
    console.log(`📷 Kamera: ${CAMERA_IP}`);
    console.log(`☁️ Cloud: ${CLOUD_URL}`);
    console.log(`⏱️ Interval: ${POLL_INTERVAL}ms`);

    while (true) {
        const start = Date.now();
        try {
            // 1. Zjistit URL podle portu
            let url = `http://${CAMERA_IP}:${currentPort}/live`;
            if (currentPort === 5513) url = `http://${CAMERA_IP}:5513/liveview.jpg`;

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

            // Úspěch - resetujeme počítadlo chyb
            retryCount = 0;
            // console.log('.'); // Heartbeat

        } catch (e) {
            // Pokud se nemůžeme připojit (ECONNREFUSED), zkusíme přepnout port
            if (e.code === 'ECONNREFUSED') {
                console.log(`⚠️ Port ${currentPort} neodpovídá.`);
                if (currentPort === 5521) {
                    currentPort = 5513;
                    console.log(`🔄 Přepínám na port ${currentPort} (Webserver)...`);
                } else {
                    // Pokud nejde ani 5513, zkusíme zase 5521 příště (cyklování)
                    currentPort = 5521;
                    console.log(`🔄 Zkouším zpět port ${currentPort}...`);
                    await new Promise(r => setTimeout(r, 2000)); // Delší pauza před dalším pokusem
                }
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
