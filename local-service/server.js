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
const LIVE_VIEW_URL = 'http://127.0.0.1:5566/'; // Optimizer URL
const SAVE_DIR = path.join(process.cwd(), 'public', 'photos');
const LOCAL_ONLY = true;

const CLOUD_API_URL = 'https://cvak.up.railway.app';
const CLOUD_UPLOAD_URL = `${CLOUD_API_URL}/api/media/upload`;

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
// Ignorujeme běžné logy, vypisujeme jen chyby
optimizer.stderr.on('data', (d) => {
    const msg = d.toString();
    if (msg.includes('HttpListenerException')) console.log('[OPTIMIZER] Port 5566 busy (OK if already running)');
    else console.error(`[OPT-ERR]: ${msg}`);
});

// --- LOCAL MJPEG STREAM ---
// Endpoint pro lokální klienty (Next.js proxy nebo přímo browser)
app.get('/stream.mjpg', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'multipart/x-mixed-replace; boundary=--myboundary',
        'Cache-Control': 'no-cache',
        'Connection': 'close',
        'Pragma': 'no-cache'
    });

    let active = true;

    req.on('close', () => { active = false; });
    req.on('end', () => { active = false; });

    const sendFrame = () => {
        if (!active) return;

        // 1. Try Optimizer First (5566), Fallback to Raw DCC (5520)
        const tryFetch = (url, isRetry = false) => {
            http.get(url, (frameRes) => {
                if (frameRes.statusCode !== 200) {
                    if (!isRetry) {
                        // Fallback to Raw
                        tryFetch('http://127.0.0.1:5520/liveview.jpg', true);
                    } else {
                        setTimeout(sendFrame, 500);
                    }
                    frameRes.resume();
                    return;
                }

                const chunks = [];
                frameRes.on('data', c => chunks.push(c));
                frameRes.on('end', () => {
                    if (!active) return;
                    const buffer = Buffer.concat(chunks);
                    res.write(`--myboundary\nContent-Type: image/jpeg\nContent-Length: ${buffer.length}\n\n`);
                    res.write(buffer);
                    res.write('\n');
                    setTimeout(sendFrame, 66);
                });
            }).on('error', (e) => {
                if (!isRetry) {
                    // Fallback to Raw
                    tryFetch('http://127.0.0.1:5520/liveview.jpg', true);
                } else {
                    setTimeout(sendFrame, 1000);
                }
            });
        };

        tryFetch(LIVE_VIEW_URL);
    };

    sendFrame();
});

// --- SNAPSHOT ENDPOINT (FOR CLOUD UPLOAD) ---
// Returns a single JPEG for the frontend loop to upload
app.get('/liveview.jpg', (req, res) => {
    const tryFetchOne = (url, isRetry = false) => {
        http.get(url, (frameRes) => {
            if (frameRes.statusCode !== 200) {
                frameRes.resume();
                if (!isRetry) {
                    tryFetchOne('http://127.0.0.1:5520/liveview.jpg', true);
                } else {
                    res.status(502).send('Gateway Error');
                }
                return;
            }

            res.set('Content-Type', 'image/jpeg');
            frameRes.pipe(res);

        }).on('error', (e) => {
            if (!isRetry) {
                tryFetchOne('http://127.0.0.1:5520/liveview.jpg', true);
            } else {
                console.error('[SNAPSHOT] Failed:', e.message);
                res.status(500).send('Snapshot Failed');
            }
        });
    };

    tryFetchOne(LIVE_VIEW_URL);
});


// --- SHOOT HANDLER (FIRE & FORGET) ---
app.post('/shoot', async (req, res) => {
    if (isCapturing) return res.status(429).json({ success: false, error: 'Camera busy' });

    console.log('[BRIDGE] Capture requested...');
    isCapturing = true;

    try {
        // Trigger Camera via DCC - Fire and forget mostly
        http.get(DCC_API_URL, (dccRes) => {
            if (dccRes.statusCode < 200 || dccRes.statusCode > 299) {
                console.error(`[BRIDGE] DCC Error ${dccRes.statusCode}`);
            }
            dccRes.resume();
        }).on('error', (e) => console.error('[BRIDGE] DCC Connection Failed', e));

        // Return SUCCESS immediately to the UI
        res.json({ success: true, message: 'Triggered' });

        // Reset lock quickly
        setTimeout(() => { isCapturing = false; }, 2000);

    } catch (e) {
        console.error(`[ERROR] ${e.message}`);
        res.status(500).json({ success: false, error: e.message });
        isCapturing = false;
    }
});

// STARTUP: FORCE LIVE VIEW ON
setTimeout(() => {
    console.log('[INIT] Sending Auto LiveAPI Trigger...');
    http.get('http://127.0.0.1:5520/?cmd=LiveView_Show', (res) => {
        // We expect this might fail if DCC is still showing the dialog, but we try anyway
        console.log('[INIT] LiveView Trigger Sent.');
        res.resume();
    }).on('error', () => console.log('[INIT] LiveView Trigger - DCC not ready yet.'));

    // Try again in 10s just in case
    setTimeout(() => {
        http.get('http://127.0.0.1:5520/?cmd=LiveView_Show').on('error', () => { });
    }, 10000);
}, 5000);

// --- BACKGROUND PROCESSING LOOP ---
// Checks for new photos and generates 'web_' versions for gallery
function startBackgroundProcessing() {
    console.log('[BG] Starting photo processor...');
    setInterval(async () => {
        try {
            const files = fs.readdirSync(SAVE_DIR);

            // Find original JPEGs that don't have a web_ counterpart
            const originals = files.filter(f =>
                f.match(/\.(jpg|jpeg)$/i) &&
                !f.startsWith('web_') &&
                !f.startsWith('print_') && // Ignore temporary print jobs
                !files.includes(`web_${f}`)
            );

            for (const textFile of originals) {
                const filePath = path.join(SAVE_DIR, textFile);

                // Check if file is "stable" (not being written to)
                // Simple check: check mtime is at least 2 seconds ago
                try {
                    const stats = fs.statSync(filePath);
                    const now = Date.now();
                    if (now - stats.mtimeMs < 2000) continue; // Too new, might be writing

                    console.log(`[BG] Processing new photo: ${textFile}`);

                    const tempPath = path.join(os.tmpdir(), `web_${textFile}`);

                    // 1. Resize to temp using PowerShell (robust, no node-canvas needed)
                    await resizeImagePowershell(filePath, tempPath, 1200);

                    // 2. Move to destination
                    const destPath = path.join(SAVE_DIR, `web_${textFile}`);
                    fs.copyFileSync(tempPath, destPath);
                    fs.unlinkSync(tempPath);

                    console.log(`[BG] Created web version: ${destPath}`);

                } catch (e) {
                    console.error(`[BG] Error processing ${textFile}:`, e.message);
                }
            }

        } catch (e) {
            console.error('[BG] Loop error:', e);
        }
    }, 3000); // Check every 3 seconds
}

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


app.post('/print', (req, res) => {
    let { filename } = req.body;
    // Strip web_ prefix if present to print the original high-res file
    if (filename && filename.startsWith('web_')) {
        filename = filename.replace('web_', '');
    }

    const filePath = path.join(SAVE_DIR, filename);
    console.log(`[PRINT] Požadavek na tisk: ${filename}`);

    if (!fs.existsSync(filePath)) {
        console.error('[PRINT] Soubor neexistuje!');
        return res.status(404).json({ success: false, error: 'File not found' });
    }

    const printCmd = `powershell -ExecutionPolicy Bypass -File "${path.join(__dirname, 'print-photo.ps1')}" -ImagePath "${filePath}"`;
    exec(printCmd, (error, stdout, stderr) => {
        if (error) {
            console.error('[PRINT] Chyba spuštění tisku:', error);
            console.error(stderr);
        } else {
            console.log('[PRINT] Odesláno do fronty.', stdout);
        }
    });
    res.json({ success: true, message: 'Odesláno na tisk' });
});

app.listen(PORT, () => {
    console.log(`\n📷 Blick & Cvak Bridge (LOCAL STREAM MODE) running on ${PORT}`);
    console.log(`   -> Live View Stream: http://localhost:${PORT}/stream.mjpg`);
    console.log(`   -> Photos Dir: ${SAVE_DIR}`);
    startBackgroundProcessing();
    startCloudSync();
});

// --- CLOUD SYNC INTEGRATION ---
const cloudSync = require('./cloud-sync');

function startCloudSync() {
    console.log('[CLOUD-SYNC] Spouštím automatickou synchronizaci...');

    // První sync po 10s (čekáme na startup)
    setTimeout(() => {
        runSyncWithLogging();
    }, 10000);

    // Pak každých 30s
    setInterval(() => {
        runSyncWithLogging();
    }, 30000);
}

async function runSyncWithLogging() {
    try {
        const result = await cloudSync.runSyncCycle();
        if (result.created || result.uploaded) {
            console.log(`[CLOUD-SYNC] Hotovo: ${result.created} nových, ${result.uploaded} nahráno`);
        }
    } catch (e) {
        console.error('[CLOUD-SYNC] Chyba:', e.message);
    }
}

// Sync Status Endpoint
app.get('/sync-status', (req, res) => {
    res.json(cloudSync.getSyncStatus());
});

// Manual Sync Trigger
app.post('/sync-now', async (req, res) => {
    try {
        const result = await cloudSync.runSyncCycle();
        res.json({ success: true, ...result });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

