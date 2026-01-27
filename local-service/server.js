const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http'); // Pro HTTP requesty
const https = require('https'); // Pro HTTPS requesty na cloud

const app = express();
const PORT = 5555;

app.use(cors());
app.use(express.json());

// --- KONFIGURACE ---
const DCC_API_URL = 'http://127.0.0.1:5520/?CMD=Capture';
const SAVE_DIR = path.join(process.cwd(), 'public', 'photos');
const CLOUD_API_URL = 'https://cvak.up.railway.app'; // Základní adresa cloudu
const CLOUD_STREAM_URL = `${CLOUD_API_URL}/api/stream`;
const CLOUD_UPLOAD_URL = `${CLOUD_API_URL}/api/media/upload`;

// --- EFEKTIVITA A KVALITA ---
// Počet snímků za sekundu pro cloud stream.
// 2 FPS je ideální kompromis (šetří data na hotspotu, ale stále je vidět pohyb).
const STREAM_FPS = 2;

let isStreaming = false;
let isCapturing = false;

// Vytvoření složky
if (!fs.existsSync(SAVE_DIR)) {
    fs.mkdirSync(SAVE_DIR, { recursive: true });
}

app.use('/photos', express.static(SAVE_DIR));

app.post('/shoot', async (req, res) => {
    if (isCapturing) {
        return res.status(429).json({ success: false, error: 'Camera busy' });
    }

    console.log('[BRIDGE] Odesílám HTTP příkaz: Capture');
    isCapturing = true;
    const startTime = Date.now();

    try {
        // 1. Spustíme spoušť
        await new Promise((resolve, reject) => {
            const request = http.get(DCC_API_URL, (response) => {
                if (response.statusCode < 200 || response.statusCode > 299) {
                    reject(new Error(`DigiCamControl status: ${response.statusCode}`));
                } else {
                    response.on('data', () => { });
                    response.on('end', resolve);
                }
            });
            request.on('error', (err) => reject(new Error(`Chyba spojení s DCC: ${err.message}`)));
        });

        console.log('[BRIDGE] Trigger OK, čekám na soubor...');

        // 2. Čekáme na soubor (15s timeout)
        const foundFile = await waitForNewFile(SAVE_DIR, startTime, 15000);
        console.log(`[BRIDGE] Fotka nalezena: ${foundFile}`);

        // 3. UPLOAD NA CLOUD
        const publicUrl = await uploadToCloud(foundFile);
        console.log(`[BRIDGE] Fotka nahrána na cloud: ${publicUrl}`);

        res.json({
            success: true,
            filename: foundFile,
            url: publicUrl
        });

    } catch (e) {
        console.error(`[CHYBA] ${e.message}`);
        res.status(500).json({ success: false, error: e.message });
    } finally {
        isCapturing = false;
    }
});

function uploadToCloud(filename) {
    return new Promise((resolve, reject) => {
        const filePath = path.join(SAVE_DIR, filename);

        // Použijeme curl pro upload
        const curlCmd = `curl -X POST -F "type=PHOTO" -F "file=@${filePath}" ${CLOUD_UPLOAD_URL}`;

        exec(curlCmd, (error, stdout, stderr) => {
            if (error) {
                console.warn("[UPLOAD] Curl selhal, vracím lokální URL fallback.");
                resolve(`/photos/${filename}`);
                return;
            }
            try {
                // Zkusíme parsovat JSON odpověď
                const response = JSON.parse(stdout);
                if (response.url) resolve(response.url);
                else resolve(`/photos/${filename}`);
            } catch (e) {
                console.log("[UPLOAD] Raw response:", stdout);
                resolve(`/photos/${filename}`);
            }
        });
    });
}

app.post('/print', (req, res) => {
    const { filename } = req.body;
    console.log(`[BRIDGE] Odesílám na tiskárnu: ${filename}`);
    const printCmd = `mspaint /p "${path.join(SAVE_DIR, filename)}"`;
    exec(printCmd, (error) => { });
    res.json({ success: true, message: 'Odesláno na tisk' });
});

app.listen(PORT, () => {
    console.log(`\n📷 FotoBuddy Bridge (Cloud Mode v2) běží na http://localhost:${PORT}`);
    console.log(`ℹ️  Ukládání do: ${SAVE_DIR}`);
    console.log(`⚡ Stream FPS: ${STREAM_FPS} (Úsporný režim)`);
    startCloudStream();
});

function startCloudStream() {
    if (isStreaming) return;
    isStreaming = true;
    console.log(`[STREAM] Vysílám na: ${CLOUD_STREAM_URL}`);

    const loop = () => {
        http.get('http://127.0.0.1:5520/liveview.jpg', (res) => {
            if (res.statusCode !== 200) {
                res.resume();
                return scheduleNext();
            }
            const uploadReq = https.request(CLOUD_STREAM_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'image/jpeg', 'Transfer-Encoding': 'chunked' }
            }, (r) => {
                r.on('data', () => { });
                scheduleNext();
            });

            uploadReq.on('error', () => scheduleNext());
            res.pipe(uploadReq);
        }).on('error', () => scheduleNext());
    };

    function scheduleNext() {
        // Výpočet pauzy podle požadovaného FPS
        const ms = Math.floor(1000 / STREAM_FPS);
        setTimeout(loop, ms);
    }

    loop();
}

function waitForNewFile(dir, afterTime, timeoutMs) {
    return new Promise((resolve, reject) => {
        const interval = 500;
        let elapsed = 0;
        const check = () => {
            fs.readdir(dir, (err, files) => {
                if (err) return;
                const images = files.filter(f => {
                    const low = f.toLowerCase();
                    return (low.endsWith('.jpg') || low.endsWith('.png')) && !low.includes('.tmp');
                });
                for (const file of images) {
                    const filePath = path.join(dir, file);
                    try {
                        const stats = fs.statSync(filePath);
                        if (stats.mtimeMs > (afterTime - 500)) {
                            setTimeout(() => resolve(file), 1500); // Delší čekání na dopsání souboru
                            return;
                        }
                    } catch (e) { }
                }
                elapsed += interval;
                if (elapsed >= timeoutMs) reject(new Error('Timeout: Fotka se neobjevila. Zkontrolujte Session Settings v DigiCamControl!'));
                else setTimeout(check, interval);
            });
        };
        check();
    });
}
