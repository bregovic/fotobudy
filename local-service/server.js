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

    const poll = () => {
        if (isReviewing) { setTimeout(poll, 200); return; }

        // Fetch from DCC Raw (most reliable) - WITH TIMEOUT & NO AGENT (Fix Socket Exhaustion)
        const liveViewUrl = `http://${DCC_HOST}:${dccPort}/liveview.jpg`;

        const req = http.get(liveViewUrl, { agent: false }, (res) => {
            if (res.statusCode !== 200) {
                res.resume(); // consume body calling 'end'
                // Don't wait too long on error
                setTimeout(poll, 200);
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

            res.on('error', (e) => {
                // log error?
                req.destroy();
            });
        });

        req.on('error', (e) => {
            // Switch port on error
            const currentIdx = CANDIDATE_PORTS.indexOf(dccPort);
            const nextIdx = (currentIdx + 1) % CANDIDATE_PORTS.length;
            dccPort = CANDIDATE_PORTS[nextIdx];

            console.log(`[POLLER] Chyba spojení s kamerou (${e.message}). Zkouším port ${dccPort}...`);
            setTimeout(poll, 500);
        });

        // TIMEOUT FIX: 2s
        req.setTimeout(2000, () => {
            // console.log(`[POLLER] Timeout na portu ${dccPort}, retrying...`);
            req.destroy();
        });
    };
    poll();
}

// ... (stream.mjpg endpoint remains the same)

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
function startBackgroundProcessing() {
    console.log('[BG] Starting photo processor...');
    let isProcessing = false;
    setInterval(async () => {
        if (isProcessing) return;
        isProcessing = true;
        try {
            if (!fs.existsSync(SAVE_DIR)) return;
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
                    if (fs.existsSync(tempPath)) {
                        const destPath = path.join(SAVE_DIR, `web_${textFile}`);
                        fs.copyFileSync(tempPath, destPath);
                        fs.unlinkSync(tempPath);

                        console.log(`[BG] Created web version: ${destPath}`);

                        // INJECT REVIEW FRAME INTO STREAM
                        try {
                            latestFrame = fs.readFileSync(destPath);
                            isReviewing = true;
                            setTimeout(() => isReviewing = false, 2000);
                        } catch (e) { console.error("Preview inject failed", e); }
                    } else {
                        console.error(`[BG] Error: Temp file not found after resize: ${tempPath}`);
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
    let { filename, path: relativePath } = req.body;

    // Determine file path
    let filePath;
    if (relativePath) {
        // If relative path is provided (e.g. from URL), use it relative to BASE
        // Sanitize path to prevent traversal
        const safePath = relativePath.replace(/^(\.\.(\/|\\|$))+/, '');
        filePath = path.join(BASE_PHOTOS_DIR, safePath);
    } else {
        // Legacy/Fallback: Use filename and current SAVE_DIR
        // Strip web_ prefix if present to print the original high-res file
        if (filename && filename.startsWith('web_')) {
            filename = filename.replace('web_', '');
        }
        filePath = path.join(SAVE_DIR, filename);
    }

    console.log(`[PRINT] Požadavek na tisk: ${path.basename(filePath)} (${filePath})`);

    if (!fs.existsSync(filePath)) {
        console.error(`[PRINT] Soubor neexistuje: ${filePath}`);
        // Fallback: If we looked in SAVE_DIR and failed, try BASE_PHOTOS_DIR just in case
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

    // --- KONFIGURACE TISKÁRNY ---
    // Přesný název tiskárny ve Windows. Pokud neexistuje, použije se výchozí.
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

        } catch (e) {
            // Nechceme spamovat logy chybami připojení
            if (e.cause && e.cause.code === 'ECONNREFUSED') return;
            // console.error('[COMMAND-POLL] Chyba:', e.message);
        }
    }, 3000);
}

