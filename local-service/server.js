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
const CANDIDATE_PORTS = [5513, 5520, 5514, 5599];
let dccPort = 5513; // Start with default, auto-rotate on error

// --- KONFIGURACE ---
// --- KONFIGURACE ---
// Dynamic URL getter
const getDccApiUrl = () => `http://${DCC_HOST}:${dccPort}/?CMD=Capture`;

// State for Frontend Countdown
let countdownTarget = 0;


const CLOUD_API_URL = 'https://cvak.up.railway.app';
const BASE_PHOTOS_DIR = path.join(process.cwd(), 'public', 'photos');
let currentEventSlug = '';
let SAVE_DIR = BASE_PHOTOS_DIR;

// Load persisted event
const EVENT_FILE = path.join(__dirname, 'current_event.json');
function loadCurrentEvent() {
    if (fs.existsSync(EVENT_FILE)) {
        try {
            const saved = JSON.parse(fs.readFileSync(EVENT_FILE));
            if (saved.slug) {
                currentEventSlug = saved.slug;
                SAVE_DIR = path.join(BASE_PHOTOS_DIR, currentEventSlug);
                console.log(`[EVENT] Aktivní událost: ${saved.name} (${saved.slug})`);
            }
        } catch (e) { console.error("Chyba načítání eventu", e); }
    }
}
loadCurrentEvent();

if (!fs.existsSync(SAVE_DIR)) fs.mkdirSync(SAVE_DIR, { recursive: true });

// Serve base directory so we can access any event via /photos/slug/file.jpg
// AND serve the current directory at root for backward compatibility if needed, 
// OR just serve the base and update frontend to know about paths.
// Let's serve BASE at /photos. 
// NOTE: This changes API. Old frontend might break if it expects /photos/abc.jpg to be in root public/photos.
// But we are in charge of frontend too. 
app.use('/photos', express.static(BASE_PHOTOS_DIR));
// Also serve the current active folder specifically at /active-photos if we want easy access? 
// No, let's stick to /photos/slug/... structure for new files. 
// BUT wait, if SAVE_DIR is root (no event), files are in /photos/img.jpg.
// If SAVE_DIR is /photos/slug, files are in /photos/slug/img.jpg.
// Express static on BASE_PHOTOS_DIR handles both!
// If file is at public/photos/img.jpg -> /photos/img.jpg
// If file is at public/photos/slug/img.jpg -> /photos/slug/img.jpg
// Validation: correct.

// --- SHARED FRAME BUFFER STRATEGY ---
// Instead of every client hitting DCC, we poll once and serve many
let latestFrame = null;
let lastFrameTime = 0;
let isReviewing = false;

function startCameraPolling() {
    console.log(`[POLLER] Starting smart camera polling (trying ${CANDIDATE_PORTS.join(', ')})...`);

    // Wait for DCC to start up
    setTimeout(() => {
        poll();
    }, 3000);

    let consecutiveErrors = 0;

    const poll = () => {
        if (isReviewing) { setTimeout(poll, 200); return; }

        // Fetch from DCC Raw (most reliable) - WITH TIMEOUT & NO AGENT (Fix Socket Exhaustion)
        const liveViewUrl = `http://${DCC_HOST}:${dccPort}/liveview.jpg`;

        let requestCompleted = false;

        const req = http.get(liveViewUrl, { agent: false }, (res) => {
            if (res.statusCode !== 200) {
                res.resume(); // consume body calling 'end'
                requestCompleted = true; // Mark as handled to skip error logic
                consecutiveErrors++;
                setTimeout(poll, consecutiveErrors > 5 ? 2000 : 500);
                return;
            }

            // Success! 
            if (consecutiveErrors > 5) {
                console.log(`[POLLER] Spojení OBNOVENO na portu ${dccPort}!`);
            }
            consecutiveErrors = 0;

            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => {
                requestCompleted = true;
                const buffer = Buffer.concat(chunks);
                if (buffer.length > 2000) {
                    latestFrame = buffer;
                    lastFrameTime = Date.now();
                } else {
                    // console.log(`[POLLER] Malý frame: ${buffer.length}b`);
                }
                setTimeout(poll, 50); // ~20 FPS target
            });

            res.on('error', (e) => {
                req.destroy();
            });
        });

        req.on('error', (e) => {
            if (requestCompleted) return; // Ignore errors if we already handled response

            // Increase error streak
            consecutiveErrors++;

            // Switch port only if not stuck in heavy error loop
            const currentIdx = CANDIDATE_PORTS.indexOf(dccPort);
            const nextIdx = (currentIdx + 1) % CANDIDATE_PORTS.length;
            dccPort = CANDIDATE_PORTS[nextIdx];

            // BACKOFF STRATEGY
            let retryDelay = 500;
            if (consecutiveErrors > 5) retryDelay = 2000;
            if (consecutiveErrors > 20) retryDelay = 5000;

            if (consecutiveErrors % 10 === 0) {
                console.log(`[POLLER] Chyba spojení (${e.code || e.message}). Retrying in ${retryDelay}ms... (Fail #${consecutiveErrors})`);
            }

            setTimeout(poll, retryDelay);
        });

        // TIMEOUT FIX: 2s
        req.setTimeout(2000, () => {
            if (!requestCompleted) {
                req.destroy();
            }
        });
    };
}


// --- LOCAL MJPEG STREAM ENDPOINT ---
app.get('/stream.mjpg', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'multipart/x-mixed-replace; boundary=myboundary',
        'Cache-Control': 'no-cache',
        'Connection': 'close',
        'Pragma': 'no-cache'
    });

    const writeFrame = () => {
        if (latestFrame) {
            res.write(`--myboundary\r\nContent-Type: image/jpeg\r\nContent-Length: ${latestFrame.length}\r\n\r\n`);
            res.write(latestFrame);
            res.write('\r\n');
        }
    };

    const interval = setInterval(writeFrame, 50); // 20 FPS

    req.on('close', () => clearInterval(interval));
});


// --- CLOUD STREAM UPLOAD LOOP ---
// Reads from SHARED BUFFER
let cloudStreamActive = true;

function startCloudStreamUpload() {
    // console.log('[CLOUD-STREAM] Startuji upload ze sdíleného bufferu...');

    const uploadLoop = () => {
        if (!cloudStreamActive) { setTimeout(uploadLoop, 1000); return; }

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

            req.on('error', (e) => {
                // Silent fail on cloud upload error to not fetch CPU
            });
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
// --- BACKGROUND PROCESSING LOOP ---
// Checks for new photos and generates 'cloud' versions for gallery/upload
function startBackgroundProcessing() {
    console.log('[BG] Starting photo processor (Dest: /cloud folder)...');
    let isProcessing = false;
    setInterval(async () => {
        if (isProcessing) return;
        isProcessing = true;
        try {
            if (!fs.existsSync(SAVE_DIR)) {
                // console.log(`[BG] Save dir not found: ${SAVE_DIR}`);
                return;
            }

            // Ensure CLOUD subdir exists
            const cloudDir = path.join(SAVE_DIR, 'cloud');
            if (!fs.existsSync(cloudDir)) fs.mkdirSync(cloudDir, { recursive: true });

            const files = fs.readdirSync(SAVE_DIR);

            // Find original JPEGs in ROOT that don't have a copy in CLOUD
            const originals = files.filter(f =>
                f.match(/\.(jpg|jpeg)$/i) &&
                !fs.lstatSync(path.join(SAVE_DIR, f)).isDirectory()
            );

            // console.log(`[BG] Scan: ${originals.length} originals found in ${SAVE_DIR}`);

            for (const textFile of originals) {
                const srcPath = path.join(SAVE_DIR, textFile);
                const destPath = path.join(cloudDir, textFile); // Same filename, separated folder

                // Skip if already exists
                if (fs.existsSync(destPath)) continue;

                // Check if file is "stable" (not being written to)
                try {
                    const stats = fs.statSync(srcPath);
                    const now = Date.now();
                    if (now - stats.mtimeMs < 1000) continue; // Too new

                    console.log(`[BG] 🔄 Optimizing: ${textFile} -> cloud/${textFile}`);

                    // Use PowerShell/Sharp to resize
                    const tempPath = path.join(os.tmpdir(), `temp_${textFile}`);

                    try {
                        await resizeImagePowershell(srcPath, tempPath, 1600);

                        if (fs.existsSync(tempPath)) {
                            fs.copyFileSync(tempPath, destPath);
                            fs.unlinkSync(tempPath);
                            console.log(`[BG] ✅ Created cloud version: ${destPath}`);

                            // Inject into Live View stream for review
                            try {
                                latestFrame = fs.readFileSync(destPath);
                                isReviewing = true;
                                setTimeout(() => isReviewing = false, 2000);
                            } catch (e) { }
                        } else {
                            console.error(`[BG] ⚠️ PowerShell failed to create file (no error thrown, but file missing)`);
                        }
                    } catch (psError) {
                        console.error(`[BG] ❌ PowerShell Error:`, psError);
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
        const command = `powershell -WindowStyle Hidden -Command "${psScript.replace(/\r?\n/g, ' ')}"`;
        exec(command, { maxBuffer: 1024 * 1024 * 10, windowsHide: true }, (error) => { if (error) reject(error); else resolve(); });
    });
}


// --- STATUS ENDPOINT (For Countdown) ---
app.get('/status', (req, res) => {
    res.json({
        countdownTarget,
        now: Date.now(),
        dccPort
    });
});

// --- SHOOT TRIGGER ---
app.post('/shoot', (req, res) => {
    let { delay } = req.body;
    delay = parseInt(delay) || 0;

    console.log(`[SHOOT] Požadavek na focení (Delay: ${delay}ms)...`);

    // Set Target Time implies countdown starts NOW
    if (delay > 0) {
        countdownTarget = Date.now() + delay;
    }

    setTimeout(() => {
        // Reset countdown just before shooting
        countdownTarget = 0;

        // Call DCC API ?CMD=Capture
        const captureUrl = getDccApiUrl();

        http.get(captureUrl, (dccRes) => {
            dccRes.resume();
        }).on('error', (e) => {
            console.error(`[SHOOT] Chyba komunikace s DCC: ${e.message}`);
        });

    }, delay);

    res.json({ success: true, message: `Timer started (${delay}ms)` });
});

app.post('/print', (req, res) => {
    let { filename, path: relativePath } = req.body;

    // Logic: The frontend (gallery) sees the 'cloud' version e.g. "cloud/IMG_001.jpg"
    // We need to find the ORIGINAL "IMG_001.jpg" one level up.

    let printFilePath = '';

    // If ID/Relative path sent
    if (relativePath) {
        // relativePath might be "event/cloud/IMG.jpg" or "event/IMG.jpg"
        // Try to locate it in BASE_PHOTOS_DIR first
        const fullPath = path.join(BASE_PHOTOS_DIR, relativePath);

        // Strategy: If file is in a 'cloud' folder, step up.
        if (fullPath.includes('\\cloud\\') || fullPath.includes('/cloud/')) {
            printFilePath = fullPath.replace(/[\\/]cloud[\\/]/, path.sep); // Remove /cloud/
        } else {
            printFilePath = fullPath;
        }
    }
    // Legacy/Filename only
    else if (filename) {
        // If filename is "web_..." (legacy), strip it
        const cleanName = filename.replace(/^web_/, '');
        printFilePath = path.join(SAVE_DIR, cleanName);
    }

    console.log(`[PRINT] Požadavek: ${filename || relativePath}`);
    console.log(`        -> Originál: ${printFilePath}`);

    if (!fs.existsSync(printFilePath)) {
        // Fallback: Try printing the cloud version if master missing?
        const fallback = relativePath ? path.join(BASE_PHOTOS_DIR, relativePath) : '';
        if (fs.existsSync(fallback)) {
            console.log("⚠️ Originál nenalezen, tisknu Cloud verzi.");
            printFilePath = fallback;
        } else {
            return res.status(404).json({ success: false, error: 'Original file not found' });
        }
    }

    // --- KONFIGURACE TISKÁRNY ---
    const TARGET_PRINTER = "Canon SELPHY CP1500";
    const printCmd = `powershell -ExecutionPolicy Bypass -File "${path.join(__dirname, 'print-photo.ps1')}" -ImagePath "${printFilePath}" -PrinterName "${TARGET_PRINTER}"`;

    exec(printCmd, (error, stdout, stderr) => {
        if (error) console.error('[PRINT] Chyba:', error);
        else console.log('[PRINT] Odesláno.', stdout);
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


// --- COMMAND POLLING (CLOUD -> LOCAL) ---
function startCommandPolling() {
    console.log('[COMMAND-POLL] Spouštím sledování příkazů z cloudu...');

    setInterval(async () => {
        try {
            // Polling interval 2s
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

                // Získat lokální URL
                let photoUrl = params.photoUrl;
                // Pokud je v parametrech název souboru, použijeme ho (preferováno pro originální kvalitu)
                if (params.filename) {
                    // Název na cloudu bývá "cloud_web_IMAGE.jpg", lokálně "web_IMAGE.jpg"
                    const localName = params.filename.replace(/^cloud_/, '');

                    // Zkontrolujeme jestli soubor existuje
                    const localPath = path.join(SAVE_DIR, localName);
                    if (fs.existsSync(localPath)) {
                        // Použijeme bridge URL (localhost:5555)
                        photoUrl = `http://127.0.0.1:${PORT}/photos/${localName}`;
                    }
                }

                console.log(`[COMMAND] Odesílám fotku: ${photoUrl}`);

                // Zavolat API Next.js aplikace (která má SMTP config)
                // Předpokládáme že Next.js běží na portu 3000
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

            if ((command === 'CAPTURE' || command === 'TRIGGER') && params) {
                console.log(`[COMMAND] 📸 Požadavek na focení z webu! (Delay: ${params.delay || 0})`);

                // Use local /shoot endpoint to handle delay + timer state
                try {
                    const req = http.request({
                        hostname: 'localhost',
                        port: PORT,
                        path: '/shoot',
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                    }, (res) => { res.resume(); });

                    req.write(JSON.stringify({ delay: params.delay || 0 }));
                    req.end();
                } catch (e) {
                    console.error("Trigger Error", e);
                }
            }

        } catch (e) {
            // Nechceme spamovat logy chybami připojení
            if (e.cause && e.cause.code === 'ECONNREFUSED') return;
            // console.error('[COMMAND-POLL] Chyba:', e.message);
        }
    }, 3000);
}

function resizeImagePowershell(inputPath, outputPath, maxSize = 1600) {
    return new Promise((resolve, reject) => {
        const script = `
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile('${inputPath}')
$ratio = $img.Width / $img.Height
$newW = ${maxSize}
$newH = ${maxSize}

if ($img.Width -gt $img.Height) {
    $newH = [Math]::Round($newW / $ratio)
} else {
    $newW = [Math]::Round($newH * $ratio)
}

$newImg = new-object System.Drawing.Bitmap($newW, $newH)
$graph = [System.Drawing.Graphics]::FromImage($newImg)
$graph.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
$graph.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graph.DrawImage($img, 0, 0, $newW, $newH)
$img.Dispose()

$newImg.Save('${outputPath}', [System.Drawing.Imaging.ImageFormat]::Jpeg)
$newImg.Dispose()
$graph.Dispose()
`;

        const ps = spawn('powershell', ['-NoProfile', '-Command', script]);

        ps.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`PowerShell exited with code ${code}`));
        });

        ps.on('error', (err) => reject(err));

        // Timeout 10s
        setTimeout(() => {
            ps.kill();
            reject(new Error('PowerShell Timeout'));
        }, 10000);
    });
}
