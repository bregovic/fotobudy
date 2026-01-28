const fs = require('fs');
const path = require('path');
const http = require('http');
const FormData = require('form-data');

// --- LOGOVÁNÍ DO SOUBORU ---
const LOG_FILE = path.join(__dirname, '..', 'debug_watcher.txt');
function log(msg) {
    const time = new Date().toLocaleTimeString();
    const line = `[${time}] ${msg}\n`;
    console.log(msg); // Stále i do konzole (pro jistotu)
    try { fs.appendFileSync(LOG_FILE, line); } catch (e) { }
}

log("--- START HLÍDAČE (v3 - Strict Dedup) ---");

// --- KONFIGURACE ---
// Sledujeme POUZE vstupní složky (kam fotí kamera). NESLEDUJEME 'public/photos' (tam ukládáme my).
const POSSIBLE_PATHS = [
    'C:/Fotky',
    'C:/Users/Wendulka/Pictures/DigiCamControl', // Default DCC
    path.join(process.env.USERPROFILE || 'C:/', 'Pictures/DigiCamControl'),
    path.join(process.env.USERPROFILE || 'C:/', 'Pictures')
];

const UPLOAD_URL = 'http://localhost:3000/api/media/upload';
const processedFiles = new Set();

function getLockKey(filePath) {
    return path.resolve(filePath).toLowerCase();
}

// 1. Spustíme sledování
function startWatching() {
    // Deduplicate paths to watch
    const uniquePaths = new Set();
    POSSIBLE_PATHS.forEach(p => {
        const normalized = path.resolve(p);
        if (fs.existsSync(normalized)) uniquePaths.add(normalized);
        else {
            // Try to create C:/Fotky if missing, as it is our preferred default
            if (path.normalize(p) === path.normalize('C:/Fotky')) {
                try { fs.mkdirSync(normalized, { recursive: true }); uniquePaths.add(normalized); } catch (e) { }
            }
        }
    });

    if (uniquePaths.size === 0) {
        log("⚠️ POZOR: Žádná složka k fotkám nenalezena! Vytvořte C:\\Fotky");
    }

    uniquePaths.forEach(safeDir => {
        log(`✅ SLEDUJI: ${safeDir}`);

        // A. Native Watch
        try {
            fs.watch(safeDir, (eventType, filename) => {
                if (!filename) return;
                const f = filename.toLowerCase();
                if (f.endsWith('.jpg') && !f.startsWith('web_') && !f.startsWith('edited_')) {
                    handleFileDetect(path.join(safeDir, filename));
                }
            });
        } catch (e) {
            log(`❌ Chyba sledování ${safeDir}: ${e.message}`);
        }

        // B. Initial Scan
        scanDirectory(safeDir);
    });
}

// Funkce pro zpracování souboru
function handleFileDetect(filePath) {
    const key = getLockKey(filePath);

    // STRICT LOCK
    if (processedFiles.has(key)) return;
    processedFiles.add(key);

    // log(`🔎 Detekce: ${path.basename(filePath)}`);
    checkFileReady(filePath, 0);
}

function checkFileReady(filePath, attempt) {
    const key = getLockKey(filePath);

    if (attempt > 40) { // 20 sec timeout
        log(`⏰ Timeout čekání na soubor: ${filePath}`);
        processedFiles.delete(key);
        return;
    }

    fs.stat(filePath, (err, stats) => {
        if (err) {
            processedFiles.delete(key); // File gone
            return;
        }

        const now = Date.now();
        const age = now - stats.mtimeMs;

        // 1. File must be non-empty
        // 2. Must be recent (< 3 mins) to avoid re-uploading entire history
        if (stats.size > 0) {
            if (age < 180000) {
                // Stabilizační pauza 500ms
                setTimeout(() => uploadPhoto(filePath), 500);
            } else {
                // Too old - ignore but keep lock for a while so we don't spam-check it
                // log(`👴 Ignoruji starý soubor: ${path.basename(filePath)}`);
                // Release lock after 1 min just in case
                setTimeout(() => processedFiles.delete(key), 60000);
            }
        } else {
            // Empty file (writing?) => wait
            setTimeout(() => checkFileReady(filePath, attempt + 1), 500);
        }
    });
}

function scanDirectory(dir) {
    if (!fs.existsSync(dir)) return;
    try {
        fs.readdir(dir, (err, files) => {
            if (err) return;
            files.forEach(file => {
                const lower = file.toLowerCase();
                if (lower.endsWith('.jpg') && !lower.startsWith('web_') && !lower.startsWith('edited_')) {
                    handleFileDetect(path.join(dir, file));
                }
            });
        });
    } catch (e) { }
}

function uploadPhoto(filePath) {
    const key = getLockKey(filePath);
    // Note: Locked by handleFileDetect

    log(`📸 INSTANT UPLOAD: ${path.basename(filePath)}`);

    const form = new FormData();
    try {
        form.append('file', fs.createReadStream(filePath));
        form.append('type', 'PHOTO');
        form.append('localPath', filePath); // Send origin path

        const req = http.request(UPLOAD_URL, {
            method: 'POST',
            headers: form.getHeaders(),
        }, (res) => {
            // Keep locked for 60s to prevent duplicate re-upload
            // log(`   -> Status: ${res.statusCode}`);
            setTimeout(() => processedFiles.delete(key), 60000);
        });

        req.on('error', (e) => {
            log(`   -> CHYBA: ${e.message}`);
            // On error, release lock fast so we can retry if needed? 
            // Or keep locked to prevent spam? Let's release after 10s.
            setTimeout(() => processedFiles.delete(key), 10000);
        });

        form.pipe(req);
    } catch (e) {
        log(`Create stream error: ${e.message}`);
        processFiles.delete(key);
    }
}

// Start
startWatching();

// Fallback Polling (pro případ selhání fs.watch) - každé 3s
setInterval(() => {
    // Only scan paths that we decided to watch
    POSSIBLE_PATHS.forEach(p => {
        const safeDir = path.resolve(p);
        if (fs.existsSync(safeDir)) scanDirectory(safeDir);
    });
}, 3000);
