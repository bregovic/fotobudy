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

if (!fs.existsSync(SAVE_DIR)) fs.mkdirSync(SAVE_DIR, { recursive: true });
app.use('/photos', express.static(SAVE_DIR));

// --- SHARED FRAME BUFFER STRATEGY ---
// Instead of every client hitting DCC, we poll once and serve many
let latestFrame = null;
let lastFrameTime = 0;

function startCameraPolling() {
    console.log('[POLLER] Starting centralized camera polling...');

    const poll = () => {
        // Fetch from DCC Raw (most reliable)
        http.get('http://127.0.0.1:5520/liveview.jpg', (res) => {
            if (res.statusCode !== 200) {
                res.resume();
                setTimeout(poll, 1000); // Retry slow if error
                return;
            }

            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => {
                const buffer = Buffer.concat(chunks);
                if (buffer.length > 2000) { // Ignore partial/invalid frames
                    latestFrame = buffer;
                    lastFrameTime = Date.now();
                }
                setTimeout(poll, 50); // ~20 FPS target
            });
        }).on('error', (e) => {
            // console.error('[POLLER] Error:', e.message); // Too noisy
            setTimeout(poll, 1000);
        });
    };
    poll();
}

// --- LOCAL MJPEG STREAM ---
// Serves from Memory Buffer - Zero load on camera
app.get('/stream.mjpg', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'multipart/x-mixed-replace; boundary=--myboundary',
        'Cache-Control': 'no-cache',
        'Connection': 'close',
        'Pragma': 'no-cache'
    });

    const streamInterval = setInterval(() => {
        if (latestFrame) {
            res.write(`--myboundary\nContent-Type: image/jpeg\nContent-Length: ${latestFrame.length}\n\n`);
            res.write(latestFrame);
            res.write('\n');
        }
    }, 100); // 10 FPS for clients is enough

    req.on('close', () => clearInterval(streamInterval));
    req.on('end', () => clearInterval(streamInterval));
});

// --- SNAPSHOT ENDPOINT ---
app.get('/liveview.jpg', (req, res) => {
    if (latestFrame) {
        res.set('Content-Type', 'image/jpeg');
        res.send(latestFrame);
    } else {
        res.status(503).send('Initializing...');
    }
});


// --- SERVER STATE ---
let countdownTarget = 0; // Timestamp when photo will be taken
let isCapturing = false;

// --- STATUS ENDPOINT (POLLING) ---
app.get('/status', (req, res) => {
    res.json({
        isCapturing,
        countdownTarget, // If > Date.now(), we are counting down
        now: Date.now()  // Server time for sync
    });
});

// --- SHOOT HANDLER (SYNC COUNTDOWN) ---
app.post('/shoot', async (req, res) => {
    if (isCapturing) return res.status(429).json({ success: false, error: 'Camera busy' });

    const delay = parseInt(req.body.delay || '0');

    // If delay is requested, start countdown
    if (delay > 0) {
        console.log(`[BRIDGE] Starting countdown: ${delay}ms`);
        countdownTarget = Date.now() + delay;
        isCapturing = true; // Lock immediately

        // Wait for countdown
        setTimeout(() => {
            performCapture();
        }, delay);

        return res.json({ success: true, message: 'Countdown started', target: countdownTarget });
    }

    // No delay - immediate capture
    performCapture();
    res.json({ success: true, message: 'Triggered' });
});

function performCapture() {
    console.log('[BRIDGE] Capture NOW!');
    countdownTarget = 0; // Reset countdown
    isCapturing = true;

    try {
        // Trigger Camera via DCC
        http.get(DCC_API_URL, (dccRes) => {
            if (dccRes.statusCode < 200 || dccRes.statusCode > 299) {
                console.error(`[BRIDGE] DCC Error ${dccRes.statusCode}`);
            }
            dccRes.resume();
        }).on('error', (e) => console.error('[BRIDGE] DCC Connection Failed', e));

        // Reset lock after capture
        setTimeout(() => { isCapturing = false; }, 2500);

    } catch (e) {
        console.error(`[ERROR] ${e.message}`);
        isCapturing = false;
    }
}

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

// --- CLOUD STREAM UPLOAD LOOP ---
// Reads from SHAARED BUFFER
let cloudStreamActive = true;

function startCloudStreamUpload() {
    console.log('[CLOUD-STREAM] Startuji upload ze sdíleného bufferu...');

    const uploadLoop = () => {
        if (!cloudStreamActive) return;

        if (latestFrame && (Date.now() - lastFrameTime < 2000)) {
            // Upload only if frame is fresh (< 2s old)
            const req = https.request({
                hostname: 'cvak.up.railway.app',
                port: 443,
                path: '/api/stream/snapshot',
                method: 'POST',
                headers: {
                    'Content-Type': 'image/jpeg',
                    'Content-Length': latestFrame.length
                }
            }, (res) => { res.resume(); });

            req.on('error', () => { });
            req.write(latestFrame);
            req.end();
        }

        setTimeout(uploadLoop, 200); // 5 FPS upload to cloud
    };

    // Start polling DCC first
    startCameraPolling();
    // Start upload loop
    setTimeout(uploadLoop, 2000);
}

// Endpoint to control cloud stream
app.post('/cloud-stream', (req, res) => {
    const { enabled } = req.body;
    cloudStreamActive = !!enabled;
    res.json({ success: true, active: cloudStreamActive });
});

app.get('/cloud-stream-status', (req, res) => {
    res.json({ active: cloudStreamActive });
});


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
        // -WindowStyle Hidden prevents the CMD window from appearing
        const command = `powershell -WindowStyle Hidden -Command "${psScript.replace(/\r?\n/g, ' ')}"`;
        exec(command, { maxBuffer: 1024 * 1024 * 10, windowsHide: true }, (error) => { if (error) reject(error); else resolve(); });
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
    startCloudStreamUpload();  // Upload live frames to Railway
    startCloudSync();          // Sync photos to Railway DB
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

