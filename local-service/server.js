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
const SNAPSHOT_API_URL = `${CLOUD_API_URL}/api/stream/snapshot`;
const CLOUD_UPLOAD_URL = `${CLOUD_API_URL}/api/media/upload`;

// FPS pro Snapshoty (ZRYCHLENÍ: 4 -> 10)
const SNAPSHOT_FPS = 10;

let isCapturing = false;

if (!fs.existsSync(SAVE_DIR)) fs.mkdirSync(SAVE_DIR, { recursive: true });
app.use('/photos', express.static(SAVE_DIR));

// Spuštění Stream Optimizeru (PowerShell proxy)
console.log('[INIT] Spouštím Stream Optimizer...');
const optimizer = spawn('powershell', [
    '-ExecutionPolicy', 'Bypass',
    '-File', path.join(__dirname, 'optimize-stream.ps1')
]);
optimizer.on('error', (err) => console.error('[OPTIMIZER] Failed to start:', err));
optimizer.stderr.on('data', (d) => console.error(`[OPT-ERR]: ${d}`));

app.post('/shoot', async (req, res) => {
    if (isCapturing) return res.status(429).json({ success: false, error: 'Camera busy' });
    console.log('[BRIDGE] Capture start...');
    isCapturing = true;
    const startTime = Date.now();
    try {
        await new Promise((resolve, reject) => {
            http.get(DCC_API_URL, (res) => {
                if (res.statusCode < 200 || res.statusCode > 299) reject(new Error(`DCC Error ${res.statusCode}`));
                else { res.resume(); resolve(); }
            }).on('error', reject);
        });

        console.log('[BRIDGE] Triggered. Waiting for file...');
        const foundFile = await waitForNewFile(SAVE_DIR, startTime, 15000);

        // Resize & Upload
        let uploadPath = path.join(SAVE_DIR, foundFile);
        try {
            const resizedPath = path.join(os.tmpdir(), `web_${foundFile}`);
            await resizeImagePowershell(uploadPath, resizedPath, 1200);
            uploadPath = resizedPath;
        } catch (e) { console.error('Resize fail', e); }

        const publicUrl = await uploadToCloud(uploadPath, foundFile);
        console.log(`[BRIDGE] Upload done: ${publicUrl}`);
        res.json({ success: true, filename: foundFile, url: publicUrl });

    } catch (e) {
        console.error(`[ERROR] ${e.message}`);
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
        const fullLocalPath = path.join(SAVE_DIR, originalFilename);
        // Přidali jsme -F "localPath=..."
        const curlCmd = `curl -X POST -F "type=PHOTO" -F "file=@${filePath};filename=${originalFilename}" -F "localPath=${fullLocalPath}" ${CLOUD_UPLOAD_URL}`;

        exec(curlCmd, (error, stdout) => {
            if (error) { resolve(`/api/view/${originalFilename}`); return; }
            try {
                const response = JSON.parse(stdout);
                if (response.url) resolve(response.url); else resolve(`/api/view/${originalFilename}`);
            } catch (e) { resolve(`/api/view/${originalFilename}`); }
        });
    });
}

// --- SNAPSHOT LOOP (The "Webcam" Logic) ---
function startSnapshotLoop() {
    console.log('[SNAPSHOT] Startuji odesílání snímků na Cloud...');

    // Zkusíme nejdřív Optimizer (5566), fallback na RAW (5520)
    let currentSource = 'http://127.0.0.1:5566/';

    const oneFrame = () => {
        const req = http.get(currentSource, (res) => {
            if (res.statusCode !== 200) {
                res.resume();
                if (currentSource.includes('5566')) {
                    // Fallback
                    currentSource = 'http://127.0.0.1:5520/liveview.jpg';
                    setTimeout(oneFrame, 100);
                } else {
                    setTimeout(oneFrame, 1000); // Wait on error
                }
                return;
            }

            // Stáhneme obrázek do paměti a pošleme na Cloud
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => {
                const buffer = Buffer.concat(chunks);

                // POST na Cloud
                const upload = https.request(SNAPSHOT_API_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'image/jpeg',
                        'Content-Length': buffer.length
                    }
                }, (upRes) => {
                    upRes.on('data', () => { }); // Consume
                    upRes.on('end', () => setTimeout(oneFrame, 1000 / SNAPSHOT_FPS));
                });

                upload.on('error', () => setTimeout(oneFrame, 500));
                upload.write(buffer);
                upload.end();
            });

        });

        req.on('error', () => {
            if (currentSource.includes('5566')) {
                currentSource = 'http://127.0.0.1:5520/liveview.jpg';
            }
            setTimeout(oneFrame, 500);
        });
    };
    oneFrame();
}

app.post('/print', (req, res) => {
    let { filename } = req.body;

    // UI může poslat 'web_DSC_0001.jpg', ale my chceme tisknout originál 'DSC_0001.jpg'
    if (filename.startsWith('web_')) {
        filename = filename.replace('web_', '');
    }

    const filePath = path.join(SAVE_DIR, filename);
    console.log(`[PRINT] Požadavek na tisk: ${filename}`);
    console.log(`[PRINT] Cesta k originálu: ${filePath}`);

    if (!fs.existsSync(filePath)) {
        console.error('[PRINT] Soubor neexistuje!');
        return res.status(404).json({ success: false, error: 'File not found' });
    }

    // Tisk přes MS Paint (nejjednodušší cesta na Windows bez externích utilit)
    // /p tiskne na VÝCHOZÍ tiskárnu -> Proto musí být Selphy nastavena jako Default.
    const printCmd = `mspaint /p "${filePath}"`;

    exec(printCmd, (error) => {
        if (error) console.error('[PRINT] Chyba spuštění tisku:', error);
        else console.log('[PRINT] Odesláno do fronty.');
    });

    res.json({ success: true, message: 'Odesláno na tisk' });
});

function startCommandPolling() {
    console.log('[CMD] Polling commands...');
    const poll = () => {
        https.get(`${CLOUD_API_URL}/api/command`, (res) => {
            let data = ''; res.on('data', c => data += c);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.command === 'SHOOT' && !isCapturing) triggerLocalShoot();
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

function waitForNewFile(dir, afterTime, timeoutMs) {
    return new Promise((resolve, reject) => {
        const interval = 500; let elapsed = 0;
        const check = () => {
            fs.readdir(dir, (err, files) => {
                if (err) return;
                const images = files.filter(f => f.match(/\.(jpg|png)$/i) && !f.includes('.tmp'));
                for (const file of images) {
                    try {
                        if (fs.statSync(path.join(dir, file)).mtimeMs > (afterTime - 500)) {
                            setTimeout(() => resolve(file), 1500); return;
                        }
                    } catch (e) { }
                }
                elapsed += interval;
                if (elapsed >= timeoutMs) reject(new Error('Timeout')); else setTimeout(check, interval);
            });
        };
        check();
    });
}

app.listen(PORT, () => {
    console.log(`\n📷 FotoBuddy Bridge (SNAPSHOT MODE) running on ${PORT}`);
    console.log(`ℹ️  Posílám statické snímky na Cloud (Webcam Style).`);
    startSnapshotLoop();
    startCommandPolling();
});
