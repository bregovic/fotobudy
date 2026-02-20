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
const DCC_HOST = '127.0.0.1';
// Port 5599 je prvni dle nastaveni DCC, dalsi jsou fallback
const CANDIDATE_PORTS = [5599, 5513, 5520, 5514];
let dccPort = 5599; // Start with configured port

// Dynamic URL getter
const getDccApiUrl = () => `http://${DCC_HOST}:${dccPort}/?CMD=Capture`;

const CLOUD_API_URL = 'https://cvak.up.railway.app';
const BASE_PHOTOS_DIR = path.join(process.cwd(), 'public', 'photos');
let currentEventSlug = '';
let SAVE_DIR = BASE_PHOTOS_DIR;

// (Old loadCurrentEvent removed to fix duplicate declaration)


// Serve base directory so we can access any event via /photos/slug/file.jpg
app.use('/photos', express.static(BASE_PHOTOS_DIR));

// --- SHARED FRAME BUFFER STRATEGY ---
// Instead of every client hitting DCC, we poll once and serve many
let latestFrame = null;
let lastFrameTime = 0;
let isReviewing = false;

function sendLiveViewShow() {
    // Send LiveView_Show to all candidate ports to make sure DCC activates live view
    CANDIDATE_PORTS.forEach(port => {
        http.get(`http://127.0.0.1:${port}/?cmd=LiveView_Show`, (res) => {
            res.resume();
        }).on('error', () => { });
    });
    console.log('[STARTUP] Odesílám príkaz LiveView_Show do DCC...');
}

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 1 });

function startCameraPolling() {
    console.log(`[POLLER] Starting smart camera polling (trying ${CANDIDATE_PORTS.join(', ')})...`);

    // Activate live view in DCC at startup (4s delay to let DCC fully initialize)
    setTimeout(sendLiveViewShow, 4000);


    const poll = () => {
        if (isReviewing) { setTimeout(poll, 200); return; }

        // Fetch from DCC Raw (most reliable) - WITH TIMEOUT & KEEP-ALIVE
        const liveViewUrl = `http://${DCC_HOST}:${dccPort}/liveview.jpg`;
        const req = http.get(liveViewUrl, { agent: httpAgent }, (res) => {
            if (res.statusCode !== 200) {
                res.resume(); // consume body to free memory
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
                // Poll immediately for next frame (max speed)
                setTimeout(poll, 10);
            });
        });

        req.on('error', (e) => {
            // Switch port on error
            const currentIdx = CANDIDATE_PORTS.indexOf(dccPort);
            const nextIdx = (currentIdx + 1) % CANDIDATE_PORTS.length;
            dccPort = CANDIDATE_PORTS[nextIdx];
            setTimeout(poll, 500);
        });

        // CRITICAL FIX: Timeout hangs — 1500ms is needed for large DSLR JPEG frames
        req.setTimeout(1500, () => {
            req.destroy(); // This triggers 'error' event above
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
        'Connection': 'keep-alive',
        'Pragma': 'no-cache'
    });

    let active = true;

    const streamInterval = setInterval(() => {
        if (!active || !latestFrame) return;
        try {
            if (!res.writable) { active = false; clearInterval(streamInterval); return; }
            res.write(`--myboundary\nContent-Type: image/jpeg\nContent-Length: ${latestFrame.length}\n\n`);
            res.write(latestFrame);
            res.write('\n');
        } catch (e) {
            // Broken pipe or closed socket — clean up
            active = false;
            clearInterval(streamInterval);
        }
    }, 50); // 20 FPS (Smooth)

    req.on('close', () => { active = false; clearInterval(streamInterval); });
    req.on('error', () => { active = false; clearInterval(streamInterval); });
    res.on('error', () => { active = false; clearInterval(streamInterval); });
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

// --- CLOUD STREAM UPLOAD LOOP ---
// Reads from SHARED BUFFER
let cloudStreamActive = true;

function startCloudStreamUpload() {
    const uploadLoop = () => {
        if (!cloudStreamActive) { setTimeout(uploadLoop, 1000); return; }

        if (latestFrame && (Date.now() - lastFrameTime < 2000)) {
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

            req.on('error', (e) => { });
            req.write(latestFrame);
            req.end();
        }

        setTimeout(uploadLoop, 200); // 5 FPS upload to cloud
    };

    // Start polling DCC first
    startCameraPolling();
    setTimeout(uploadLoop, 2000);
}

app.post('/cloud-stream', (req, res) => {
    const { enabled } = req.body;
    cloudStreamActive = !!enabled;
    res.json({ success: true, active: cloudStreamActive });
});

app.get('/cloud-stream-status', (req, res) => {
    res.json({ active: cloudStreamActive });
});

// --- STATUS ENDPOINT (For Countdown) ---
app.get('/status', (req, res) => {
    res.json({ countdownTarget, now: Date.now(), dccPort });
});

// --- SHOOT TRIGGER ---
function triggerShoot(delay) {
    delay = parseInt(delay) || 0;
    console.log(`[SHOOT] Požadavek na focení (Delay: ${delay}ms)...`);

    if (delay > 0) {
        countdownTarget = Date.now() + delay;
    }

    setTimeout(() => {
        countdownTarget = 0;
        isCapturing = false; // Reset lock
        const captureUrl = getDccApiUrl();
        http.get(captureUrl, (dccRes) => {
            dccRes.resume();
        }).on('error', (e) => {
            console.error(`[SHOOT] Chyba komunikace s DCC: ${e.message}`);
        });
    }, delay);
}

app.post('/shoot', (req, res) => {
    let { delay } = req.body;
    console.log(`[API] /shoot request přijat. isCapturing=${isCapturing}`);
    if (!isCapturing) {
        isCapturing = true;
        triggerShoot(delay);
    } else {
        console.warn(`[API] Focení zablokováno, isCapturing je pořád TRUE!`);
    }
    res.json({ success: true, message: `Timer started (${delay}ms)` });
});

// --- SERVER STATE & CONFIG ---
let countdownTarget = 0;
let isCapturing = false;
let currentEventConfig = { overlay: null }; // Stores { path, x, y, w } (ratios 0-1)

// Load persisted event
const EVENT_FILE = path.join(__dirname, 'current_event.json');
function loadCurrentEvent() {
    if (fs.existsSync(EVENT_FILE)) {
        try {
            const saved = JSON.parse(fs.readFileSync(EVENT_FILE));
            currentEventConfig = saved; // Load full config including overlay
            if (saved.slug) {
                currentEventSlug = saved.slug;
                SAVE_DIR = path.join(BASE_PHOTOS_DIR, currentEventSlug);
                console.log(`[EVENT] Aktivní událost: ${saved.name} (${saved.slug})`);
                if (saved.overlay) console.log(`[EVENT] 🎨 Aktivní overlay: ${path.basename(saved.overlay.path)}`);
            }
        } catch (e) { console.error("Chyba načítání eventu", e); }
    }
}
loadCurrentEvent();

if (!fs.existsSync(SAVE_DIR)) fs.mkdirSync(SAVE_DIR, { recursive: true });

// Endpoint to get event config
app.get('/api/event/config', (req, res) => {
    res.json(currentEventConfig);
});

// Endpoint to update event config (Overlay)
app.post('/api/event/update-config', (req, res) => {
    try {
        const newConfig = { ...currentEventConfig, ...req.body };
        currentEventConfig = newConfig;

        // Persist
        fs.writeFileSync(EVENT_FILE, JSON.stringify(currentEventConfig, null, 2));

        console.log('[CONFIG] Nastavení události aktualizováno:', JSON.stringify(req.body.overlay || 'No Overlay'));
        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// ... (Rest of polling code) ...

// --- BACKGROUND PROCESSING LOOP ---
function startBackgroundProcessing() {
    console.log('[BG] Starting photo processor (Dest: /cloud folder)...');
    let isProcessing = false;
    setInterval(async () => {
        if (isProcessing) return;
        isProcessing = true;
        try {
            if (!fs.existsSync(SAVE_DIR)) return;

            const cloudDir = path.join(SAVE_DIR, 'cloud');
            if (!fs.existsSync(cloudDir)) fs.mkdirSync(cloudDir, { recursive: true });

            // OPTIMIZATION: Use withFileTypes
            const dirents = fs.readdirSync(SAVE_DIR, { withFileTypes: true });

            const originals = dirents
                .filter(d => d.isFile() && d.name.match(/\.(jpg|jpeg)$/i) && !d.name.startsWith('web_') && !d.name.startsWith('edited_') && !d.name.startsWith('print_'))
                .map(d => d.name);

            for (const textFile of originals) {
                const srcPath = path.join(SAVE_DIR, textFile);
                const destPath = path.join(cloudDir, textFile);

                if (fs.existsSync(destPath)) continue; // Skip if exists

                try {
                    // Check stability
                    const stats = fs.statSync(srcPath);
                    if (Date.now() - stats.mtimeMs < 2000) continue;

                    console.log(`[BG] 🔄 Processing: ${textFile} ${currentEventConfig.overlay ? '(+ Sticker)' : ''}`);

                    const tempPath = path.join(os.tmpdir(), `temp_${textFile}`);

                    // RESIZE + OPTIONAL OVERLAY
                    await resizeImagePowershell(srcPath, tempPath, 1200, currentEventConfig.overlay);

                    if (fs.existsSync(tempPath)) {
                        fs.copyFileSync(tempPath, destPath);
                        fs.unlinkSync(tempPath);

                        console.log(`[BG] ✅ Processed: ${destPath}`);

                        // Inject preview
                        try {
                            latestFrame = fs.readFileSync(destPath);
                            isReviewing = true;
                            setTimeout(() => isReviewing = false, 3000);
                        } catch (e) { }

                    } else {
                        console.error(`[BG] ⚠️ Conversion failed for ${textFile}`);
                    }
                } catch (e) {
                    console.error(`[BG] Error processing ${textFile}:`, e.message);
                }
            }

        } catch (e) {
            console.error('[BG] Loop error:', e);
        } finally {
            isProcessing = false;
        }
    }, 2000);
}

function resizeImagePowershell(inputPath, outputPath, maxWidth, overlayConfig = null) {
    return new Promise((resolve, reject) => {
        // Prepare Overlay Script Block
        let overlayLogic = '';
        if (overlayConfig && overlayConfig.path) {
            const absOvPath = path.resolve(process.cwd(), overlayConfig.path);
            if (fs.existsSync(absOvPath)) {
                // overlayConfig: { path, x (0-1), y (0-1), w (0-1) }
                // We use ratios to be independent of resolution
                overlayLogic = `
                $ovPath = '${absOvPath.replace(/\\/g, '\\\\')}';
                if (Test-Path $ovPath) {
                    $overlay = [System.Drawing.Image]::FromFile($ovPath);
                    $ovWidth = [int]($newImg.Width * ${overlayConfig.w});
                    $ratio = $overlay.Height / $overlay.Width;
                    $ovHeight = [int]($ovWidth * $ratio);
                    $ovX = [int]($newImg.Width * ${overlayConfig.x});
                    $ovY = [int]($newImg.Height * ${overlayConfig.y});
                    $graph.DrawImage($overlay, $ovX, $ovY, $ovWidth, $ovHeight);
                    $overlay.Dispose();
                }
                `;
            } else {
                console.warn(`[BG] Sticker path not found: ${absOvPath}`);
            }
        }

        const psScript = `
Add-Type -AssemblyName System.Drawing;
$img = [System.Drawing.Image]::FromFile('${inputPath.replace(/\\/g, '\\\\')}');
$ratio = $img.Height / $img.Width;
$newWidth = ${maxWidth};
$newHeight = [int]($newWidth * $ratio);
if ($img.Width -lt $newWidth) { $newWidth = $img.Width; $newHeight = $img.Height; }
$newImg = new-object System.Drawing.Bitmap $newWidth, $newHeight;
$graph = [System.Drawing.Graphics]::FromImage($newImg);
$graph.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighSpeed;
$graph.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::Low; 
$graph.DrawImage($img, 0, 0, $newWidth, $newHeight);

${overlayLogic}

$newImg.Save('${outputPath.replace(/\\/g, '\\\\')}', [System.Drawing.Imaging.ImageFormat]::Jpeg);
$img.Dispose(); $newImg.Dispose(); $graph.Dispose();
`;
        const command = `powershell -WindowStyle Hidden -Command "${psScript.replace(/\r?\n/g, ' ')}"`;
        exec(command, { maxBuffer: 1024 * 1024 * 10, windowsHide: true }, (error) => { if (error) reject(error); else resolve(); });
    });
}



app.post('/print', (req, res) => {
    let { filename, path: relativePath } = req.body;

    let filePath;
    if (relativePath) {
        const safePath = relativePath.replace(/^(\.\.([/\\]|$))+/, '');
        filePath = path.join(BASE_PHOTOS_DIR, safePath);
    } else {
        if (filename && filename.startsWith('web_')) {
            filename = filename.replace('web_', '');
        }
        filePath = path.join(SAVE_DIR, filename);
    }

    console.log(`[PRINT] Požadavek na tisk: ${path.basename(filePath)} (${filePath})`);

    if (!fs.existsSync(filePath)) {
        console.error(`[PRINT] Soubor neexistuje: ${filePath}`);
        if (!relativePath && SAVE_DIR !== BASE_PHOTOS_DIR) {
            const fallbackPath = path.join(BASE_PHOTOS_DIR, filename);
            if (fs.existsSync(fallbackPath)) {
                console.log(`[PRINT] Nalezeno v fallback umístění: ${fallbackPath}`);
                filePath = fallbackPath;
            } else {
                return res.status(404).json({ success: false, error: 'File not found' });
            }
        } else {
            return res.status(404).json({ success: false, error: 'File not found' });
        }
    }

    const TARGET_PRINTER = "Canon SELPHY CP1500";
    const printCmd = `powershell -ExecutionPolicy Bypass -File "${path.join(__dirname, 'print-photo.ps1')}" -ImagePath "${filePath}" -PrinterName "${TARGET_PRINTER}"`;
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
    startCommandPolling();     // Poll for remote commands (Emails)
});

// --- CLOUD SYNC INTEGRATION ---
const cloudSync = require('./cloud-sync');

function startCloudSync() {
    console.log('[CLOUD-SYNC] Spouštím automatickou synchronizaci...');

    setTimeout(() => {
        runSyncWithLogging();
    }, 10000);

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


// --- COMMAND POLLING (CLOUD -> LOCAL) ---
function startCommandPolling() {
    console.log('[COMMAND-POLL] Spouštím sledování příkazů z cloudu...');

    setInterval(async () => {
        try {
            const res = await fetch(`${CLOUD_API_URL}/api/command`);
            if (!res.ok) return;

            const data = await res.json();
            const { command, params, id } = data;

            if (command === 'SET_EVENT' && params) {
                console.log(`[COMMAND] 📅 Změna události: ${params.name}`);
                currentEventSlug = params.slug;
                SAVE_DIR = path.join(BASE_PHOTOS_DIR, currentEventSlug);

                if (!fs.existsSync(SAVE_DIR)) fs.mkdirSync(SAVE_DIR, { recursive: true });

                fs.writeFileSync(EVENT_FILE, JSON.stringify({ slug: params.slug, name: params.name }));
                console.log(`[EVENT] Složka změněna na: ${SAVE_DIR}`);
            }

            if (command === 'SEND_EMAIL' && params) {
                console.log(`[COMMAND] 📨 Požadavek na email: ${params.email}`);

                let photoUrl = params.photoUrl;
                if (params.filename) {
                    const localName = params.filename.replace(/^cloud_/, '');
                    const localPath = path.join(SAVE_DIR, localName);
                    if (fs.existsSync(localPath)) {
                        photoUrl = `http://127.0.0.1:${PORT}/photos/${localName}`;
                    }
                }

                console.log(`[COMMAND] Odesílám fotku: ${photoUrl}`);

                await fetch('http://localhost:3000/api/email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: params.email,
                        photoUrls: [photoUrl],
                        isTest: false
                    })
                });
            }

            if (command === 'PRINT' && params) {
                console.log(`[COMMAND] 🖨️ Požadavek na tisk z webu: ${params.filename}`);
                try {
                    await fetch(`http://127.0.0.1:${PORT}/print`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(params)
                    });
                } catch (pe) {
                    console.error('[COMMAND] Chyba lokálního tisku:', pe.message);
                }
            }

            if ((command === 'CAPTURE' || command === 'TRIGGER') && params) {
                console.log(`[COMMAND] 📸 Požadavek na focení z webu! (Delay: ${params.delay || 0})`);
                if (!isCapturing) {
                    isCapturing = true;
                    triggerShoot(params.delay || 0);
                }
            }

        } catch (e) {
            if (e.cause && e.cause.code === 'ECONNREFUSED') return;
            // console.error('[COMMAND-POLL] Chyba:', e.message);
        }
    }, 3000);
}
