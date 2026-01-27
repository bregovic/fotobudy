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

// --- KONFIGURACE PRO HTTP TRIGGER ---
// Místo CMD exe použijeme HTTP příkaz na běžící instanci
// Port 5520 podle tvého nastavení
const DCC_API_URL = 'http://127.0.0.1:5520/?CMD=Capture';
const SAVE_DIR = path.join(process.cwd(), 'public', 'photos');

// --- CLOUD STREAMING KONFIGURACE ---
// Adresa tvého veřejného serveru na Railway
const CLOUD_API_URL = 'https://cvak.up.railway.app/api/stream';
let isStreaming = false;

// Zámek
let isCapturing = false;

// Vytvoření složky
if (!fs.existsSync(SAVE_DIR)) {
    fs.mkdirSync(SAVE_DIR, { recursive: true });
}

app.use('/photos', express.static(SAVE_DIR));

app.get('/status', (req, res) => {
    res.json({ status: 'ready', mode: 'http-trigger', busy: isCapturing });
});

app.post('/shoot', async (req, res) => {
    if (isCapturing) {
        return res.status(429).json({ success: false, error: 'Camera busy' });
    }

    console.log('[BRIDGE] Odesílám HTTP příkaz: Capture');
    isCapturing = true;
    const startTime = Date.now();

    try {
        // 1. Spustíme spoušť přes HTTP (pomocí nativního http modulu)
        await new Promise((resolve, reject) => {
            const request = http.get(DCC_API_URL, (response) => {
                if (response.statusCode < 200 || response.statusCode > 299) {
                    reject(new Error(`DigiCamControl vrátil status: ${response.statusCode}`));
                } else {
                    response.on('data', () => { }); // Konzumovat stream
                    response.on('end', resolve);
                }
            });
            request.on('error', (err) => reject(new Error(`Chyba spojení s DigiCamControl (Port 5520): ${err.message}`)));
        });

        console.log('[BRIDGE] Trigger OK, čekám na soubor...');

        // 2. Čekáme na nový soubor ve složce (Polling)
        // Čekáme max 15 sekund
        const foundFile = await waitForNewFile(SAVE_DIR, startTime, 15000);

        console.log(`[BRIDGE] Fotka nalezena: ${foundFile}`);
        res.json({
            success: true,
            filename: foundFile,
            url: `/photos/${foundFile}`
        });

    } catch (e) {
        console.error(`[CHYBA] ${e.message}`);
        res.status(500).json({ success: false, error: e.message });
    } finally {
        isCapturing = false;
    }
});

app.post('/print', (req, res) => {
    const { filename } = req.body;
    console.log(`[BRIDGE] Odesílám na tiskárnu: ${filename}`);
    const printCmd = `mspaint /p "${path.join(SAVE_DIR, filename)}"`;
    exec(printCmd, (error) => { });
    res.json({ success: true, message: 'Odesláno na tisk' });
});

app.listen(PORT, () => {
    console.log(`\n📷 FotoBuddy Bridge (HTTP Trigger Mode) běží na http://localhost:${PORT}`);
    console.log(`ℹ️  Ujistěte se, že DigiCamControl ukládá fotky do:\n   ${SAVE_DIR}`);

    // Automaticky spustit streamování do cloudu na pozadí
    startCloudStream();
});

// Funkce pro cloud stream bez fetch (pouze nativní http/https)
function startCloudStream() {
    if (isStreaming) return;
    isStreaming = true;
    console.log(`[STREAM] Začínám vysílat na: ${CLOUD_API_URL}`);

    const loop = () => {
        // 1. Stáhnout snímek z lokální kamery (MJPEG snapshot)
        http.get('http://127.0.0.1:5520/liveview.jpg', (res) => {
            if (res.statusCode !== 200) {
                // Kamera asi nejede nebo server je dole
                res.resume(); // Zahodit data (nutné pro uvolnění socketu)
                return scheduleNext();
            }

            // 2. Odeslat na cloud (HTTPS POST)
            const uploadReq = https.request(CLOUD_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'image/jpeg',
                    'Transfer-Encoding': 'chunked' // Streaming upload
                }
            }, (cloudRes) => {
                // Hotovo, odpověď nás nezajímá, jen ji zkonzumujeme
                cloudRes.on('data', () => { });

                // Hned jak se uploadne, plánujeme další
                scheduleNext();
            });

            uploadReq.on('error', (e) => {
                // console.warn('[STREAM] Upload error:', e.message);
                scheduleNext();
            });

            // "Trubka" z kamery rovnou do cloudu
            res.pipe(uploadReq);

        }).on('error', (e) => {
            // Chyba stahování z kamery (asi neběží DigiCamControl)
            // console.warn('[STREAM] Download error:', e.message);
            scheduleNext();
        });
    };

    function scheduleNext() {
        // 200ms = 5 FPS, stačí pro náhled a šetří data
        setTimeout(loop, 200);
    }

    loop();
}

// Funkce pro čekání na nový soubor
function waitForNewFile(dir, afterTime, timeoutMs) {
    return new Promise((resolve, reject) => {
        const interval = 500;
        let elapsed = 0;

        const check = () => {
            // Najdeme nejnovější soubor
            fs.readdir(dir, (err, files) => {
                if (err) return;

                // Filtrujeme jen obrázky (bez dočasných souborů)
                const images = files.filter(f => {
                    const low = f.toLowerCase();
                    return (low.endsWith('.jpg') || low.endsWith('.png')) && !low.includes('.tmp');
                });

                for (const file of images) {
                    const filePath = path.join(dir, file);
                    try {
                        const stats = fs.statSync(filePath);
                        // Pokud je soubor novější než začátek focení
                        // (dáváme malou toleranci -100ms kdyby se časy rozcházely)
                        if (stats.mtimeMs > (afterTime - 100)) {
                            // Počkáme chvilku, ať se dopíše na disk úplně
                            setTimeout(() => resolve(file), 500);
                            return;
                        }
                    } catch (e) { }
                }

                elapsed += interval;
                if (elapsed >= timeoutMs) {
                    reject(new Error('Timeout: Fotka se neobjevila (Zkontrolujte nastavení složky v DigiCamControlu!)'));
                } else {
                    setTimeout(check, interval);
                }
            });
        };
        check();
    });
}
