const express = require('express');
const cors = require('cors');
const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const os = require('os');

const app = express();
const PORT = 5555;

app.use(cors());
app.use(express.json());

// --- KONFIGURACE ---
const DCC_API_URL = 'http://127.0.0.1:5520/?CMD=Capture';
const SAVE_DIR = path.join(process.cwd(), 'public', 'photos');
const CLOUD_API_URL = 'https://cvak.up.railway.app';
const CLOUD_STREAM_URL = `${CLOUD_API_URL}/api/stream`;
const CLOUD_UPLOAD_URL = `${CLOUD_API_URL}/api/media/upload`;

const STREAM_FPS = 4;

let isStreaming = false;
let isCapturing = false;

// Vytvoření složky
if (!fs.existsSync(SAVE_DIR)) fs.mkdirSync(SAVE_DIR, { recursive: true });

app.use('/photos', express.static(SAVE_DIR));

// Spuštění Stream Optimizeru (PowerShell proxy)
console.log('[INIT] Spouštím Stream Optimizer...');
const optimizer = spawn('powershell', [
    '-ExecutionPolicy', 'Bypass',
    // '-WindowStyle', 'Hidden', // Schválně odkrytý pro debugging!
    '-File', path.join(__dirname, 'optimize-stream.ps1')
]);

optimizer.on('error', (err) => console.error('[OPTIMIZER] Failed to start:', err));
optimizer.stdout.on('data', (d) => { /* console.log(`[OPT]: ${d}`); */ });
optimizer.stderr.on('data', (d) => console.error(`[OPT-ERR]: ${d}`));

app.post('/shoot', async (req, res) => {
    if (isCapturing) return res.status(429).json({ success: false, error: 'Camera busy' });

    console.log('[BRIDGE] Odesílám HTTP příkaz: Capture');
    isCapturing = true;
    const startTime = Date.now();

    try {
        await new Promise((resolve, reject) => {
            const request = http.get(DCC_API_URL, (response) => {
                if (response.statusCode < 200 || response.statusCode > 299) reject(new Error(`DigiCamControl status: ${response.statusCode}`));
                else { response.on('data', () => { }); response.on('end', resolve); }
            });
            request.on('error', (err) => reject(new Error(`Chyba spojení s DCC: ${err.message}`)));
        });

        console.log('[BRIDGE] Trigger OK, čekám na soubor...');
        const foundFile = await waitForNewFile(SAVE_DIR, startTime, 15000);
        console.log(`[BRIDGE] Fotka nalezena: ${foundFile}`);

        // OPTIMALIZACE: Resize
        const shrinkStartTime = Date.now();
        let uploadPath = path.join(SAVE_DIR, foundFile);

        try {
            console.log('[BRIDGE] Vytvářím optimalizovaný náhled...');
            const resizedFilename = `web_${foundFile}`;
            const resizedPath = path.join(os.tmpdir(), resizedFilename);
            await resizeImagePowershell(uploadPath, resizedPath, 1200);
            uploadPath = resizedPath;
        } catch (resizeError) {
            console.error('[BRIDGE] Chyba zmenšování (použiji originál):', resizeError.message);
        }
        console.log(`[BRIDGE] Resize hotov za ${Date.now() - shrinkStartTime}ms`);

        // UPLOAD 
        const publicUrl = await uploadToCloud(uploadPath, foundFile);
        console.log(`[BRIDGE] Fotka nahrána na cloud: ${publicUrl}`);

        res.json({ success: true, filename: foundFile, url: publicUrl });

    } catch (e) {
        console.error(`[CHYBA] ${e.message}`);
        res.status(500).json({ success: false, error: e.message });
    } finally {
        isCapturing = false;
    }
});

function resizeImagePowershell(inputPath, outputPath, maxWidth) {
    return new Promise((resolve, reject) => {
        const psScript = `
Add-Type -AssemblyName System.Drawing;
$img = [System.Drawing.Image]::FromFile('${inputPath}');
$ratio = $img.Height / $img.Width;
$newWidth = ${maxWidth};
$newHeight = [int]($newWidth * $ratio);
if ($img.Width -lt $newWidth) { $newWidth = $img.Width; $newHeight = $img.Height; }
$newImg = new-object System.Drawing.Bitmap $newWidth, $newHeight;
$graph = [System.Drawing.Graphics]::FromImage($newImg);
$graph.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighSpeed;
$graph.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::Low; 
$graph.DrawImage($img, 0, 0, $newWidth, $newHeight);
$newImg.Save('${outputPath}', [System.Drawing.Imaging.ImageFormat]::Jpeg);
$img.Dispose(); $newImg.Dispose(); $graph.Dispose();
`;
        const command = `powershell -Command "${psScript.replace(/\r?\n/g, ' ')}"`;
        exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error) => { if (error) reject(error); else resolve(); });
    });
}

function uploadToCloud(filePath, originalFilename) {
    return new Promise((resolve, reject) => {
        const curlCmd = `curl -X POST -F "type=PHOTO" -F "file=@${filePath};filename=${originalFilename}" ${CLOUD_UPLOAD_URL}`;
        exec(curlCmd, (error, stdout) => {
            if (error) { resolve(`/photos/${originalFilename}`); return; }
            try {
                const response = JSON.parse(stdout);
                if (response.url) resolve(response.url); else resolve(`/photos/${originalFilename}`);
            } catch (e) { resolve(`/photos/${originalFilename}`); }
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
    console.log(`\n📷 FotoBuddy Bridge (ULTRA FAST STREAM + FALLBACK) běží na http://localhost:${PORT}`);
    console.log(`ℹ️  Optimizer běží na portu 5566 (pokud nespadne)`);
    startCloudStream();
    startCommandPolling();
});

function startCommandPolling() {
    console.log('[CMD] Začínám naslouchat příkazům z cloudu...');
    const poll = () => {
        https.get(`${CLOUD_API_URL}/api/command`, (res) => {
            let data = ''; res.on('data', c => data += c);
            res.on('end', () => {
                try {
                    if (res.statusCode === 200) {
                        const json = JSON.parse(data);
                        if (json.command === 'SHOOT' && !isCapturing) {
                            console.log('[CMD] PŘIJAT PŘÍKAZ SHOOT 🔫');
                            triggerLocalShoot();
                        }
                    }
                } catch (e) { }
                setTimeout(poll, 500);
            });
        }).on('error', () => setTimeout(poll, 2000));
    };
    poll();
}

async function triggerLocalShoot() {
    if (isCapturing) return;
    const postData = JSON.stringify({});
    const req = http.request({
        hostname: 'localhost', port: PORT, path: '/shoot', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': postData.length }
    }, () => { });
    req.write(postData); req.end();
}

function startCloudStream() {
    if (isStreaming) return;
    isStreaming = true;

    // FALLBACK LOGIKA: Začínáme s optimalizovaným, když selže, jdeme na RAW
    let currentSource = 'http://127.0.0.1:5566/';
    console.log(`[STREAM] Startuji streamování...`);

    const loop = () => {
        http.get(currentSource, (res) => {
            // Pokud selže optimalizovaný zdroj, přepneme hned.
            if (res.statusCode !== 200) {
                res.resume();
                if (currentSource.includes('5566')) {
                    console.warn("⚠️  Optimizer (5566) neodpovídá, přepínám na RAW stream (5520)!");
                    currentSource = 'http://127.0.0.1:5520/liveview.jpg';
                    return loop(); // Zkusit hned znovu s novým zdrojem
                }
                return scheduleNext();
            }

            const uploadReq = https.request(CLOUD_STREAM_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'image/jpeg', 'Transfer-Encoding': 'chunked' }
            }, (r) => { r.on('data', () => { }); });

            uploadReq.on('error', () => scheduleNext());

            // Důležité: Další snímek až po dokončení uploadu tohoto (proti zahlcení)
            res.on('end', () => scheduleNext());
            res.pipe(uploadReq);

        }).on('error', (err) => {
            // Chyba připojení (Connection refused)
            if (currentSource.includes('5566')) {
                console.warn("⚠️  Chyba spojení s Optimizerem, přepínám na RAW stream (5520)!");
                currentSource = 'http://127.0.0.1:5520/liveview.jpg';
                setTimeout(loop, 100);
            } else {
                scheduleNext();
            }
        });
    };

    function scheduleNext() {
        // Pokud jedeme RAW, zpomalíme na 2 FPS, jinak 4 FPS
        const delay = currentSource.includes('5520') ? 500 : (1000 / STREAM_FPS);
        setTimeout(loop, delay);
    }
    loop();
}

function waitForNewFile(dir, afterTime, timeoutMs) {
    return new Promise((resolve, reject) => {
        const interval = 500; let elapsed = 0;
        const check = () => {
            fs.readdir(dir, (err, files) => {
                if (err) return;
                const images = files.filter(f => {
                    const low = f.toLowerCase(); return (low.endsWith('.jpg') || low.endsWith('.png')) && !low.includes('.tmp');
                });
                for (const file of images) {
                    const filePath = path.join(dir, file);
                    try {
                        const stats = fs.statSync(filePath);
                        if (stats.mtimeMs > (afterTime - 500)) { setTimeout(() => resolve(file), 1500); return; }
                    } catch (e) { }
                }
                elapsed += interval;
                if (elapsed >= timeoutMs) reject(new Error('Timeout: Fotka se neobjevila.')); else setTimeout(check, interval);
            });
        };
        check();
    });
}
