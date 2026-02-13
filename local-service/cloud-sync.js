/**
 * CLOUD SYNC MODULE - Automatická synchronizace fotek do Railway
 * 
 * Tento modul:
 * 1. Sleduje složku public/photos pro nové fotky
 * 2. Vytváří optimalizované verze do public/photos/cloud/ (~0.5MB)
 * 3. Sleduje sync_map.json pro stav synchronizace
 * 4. Automaticky uploaduje nesynchronizované fotky na Railway
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { exec } = require('child_process');
const os = require('os');

// --- KONFIGURACE ---
const PHOTOS_DIR = path.join(__dirname, '..', 'public', 'photos');
const CLOUD_DIR = path.join(PHOTOS_DIR, 'cloud');
const SYNC_MAP_FILE = path.join(__dirname, '..', 'sync_map.json');
const CLOUD_API_URL = 'https://cvak.up.railway.app/api/media/upload';
const TARGET_SIZE_KB = 500;
const TARGET_WIDTH = 1800;

// Vytvořit cloud složku pokud neexistuje
if (!fs.existsSync(CLOUD_DIR)) {
    fs.mkdirSync(CLOUD_DIR, { recursive: true });
    console.log('[CLOUD-SYNC] Vytvořena složka:', CLOUD_DIR);
}

// --- SYNC MAP ---
function loadSyncMap() {
    if (!fs.existsSync(SYNC_MAP_FILE)) {
        return { synced: {}, pending: [], lastCheck: null };
    }
    try {
        return JSON.parse(fs.readFileSync(SYNC_MAP_FILE, 'utf-8'));
    } catch (e) {
        return { synced: {}, pending: [], lastCheck: null };
    }
}

function saveSyncMap(map) {
    map.lastCheck = new Date().toISOString();
    fs.writeFileSync(SYNC_MAP_FILE, JSON.stringify(map, null, 2));
}

// --- OPTIMALIZACE ---
function optimizeForCloud(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        const currentSizeKB = fs.statSync(inputPath).size / 1024;

        // Vypočítat kvalitu na základě velikosti
        const quality = Math.max(50, Math.min(85, Math.floor(70 * (TARGET_SIZE_KB / currentSizeKB))));

        const psScript = `
Add-Type -AssemblyName System.Drawing;
$img = [System.Drawing.Image]::FromFile('${inputPath.replace(/\\/g, '\\\\')}');
$ratio = $img.Height / $img.Width;
$newWidth = [Math]::Min(${TARGET_WIDTH}, $img.Width);
$newHeight = [int]($newWidth * $ratio);
$newImg = new-object System.Drawing.Bitmap $newWidth, $newHeight;
$graph = [System.Drawing.Graphics]::FromImage($newImg);
$graph.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality;
$graph.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic;
$graph.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality;
$graph.DrawImage($img, 0, 0, $newWidth, $newHeight);
$codecInfo = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' };
$encoder = [System.Drawing.Imaging.Encoder]::Quality;
$encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1);
$encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter($encoder, ${quality});
$newImg.Save('${outputPath.replace(/\\/g, '\\\\')}', $codecInfo, $encoderParams);
$img.Dispose(); $newImg.Dispose(); $graph.Dispose();
`;
        const command = `powershell -WindowStyle Hidden -Command "${psScript.replace(/\r?\n/g, ' ')}"`;
        exec(command, { maxBuffer: 1024 * 1024 * 10, windowsHide: true }, (error) => {
            if (error) reject(error);
            else resolve();
        });
    });
}

// --- UPLOAD ---
function uploadToCloud(filePath, filename) {
    return new Promise((resolve, reject) => {
        const fileBuffer = fs.readFileSync(filePath);
        const boundary = '----FormBoundary' + Date.now().toString(16);

        const header = Buffer.from(
            `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
            `Content-Type: image/jpeg\r\n\r\n`
        );
        const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
        const body = Buffer.concat([header, fileBuffer, footer]);

        const url = new URL(CLOUD_API_URL);
        const options = {
            hostname: url.hostname,
            port: 443,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': body.length
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.success) resolve(json);
                    else reject(new Error(json.error || 'Upload failed'));
                } catch (e) {
                    reject(new Error('Invalid response'));
                }
            });
        });

        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

// --- HLAVNÍ SYNC LOOP ---
async function runSyncCycle() {
    const syncMap = loadSyncMap();

    // 1. Najít všechny soubory ve složkách CLOUD
    const filesToSync = [];

    // a) Root Cloud
    if (fs.existsSync(CLOUD_DIR)) {
        const files = fs.readdirSync(CLOUD_DIR).filter(f => f.match(/\.(jpg|jpeg|png)$/i));
        files.forEach(f => filesToSync.push({
            fullPath: path.join(CLOUD_DIR, f),
            filename: f,
            relPath: `cloud/${f}`
        }));
    }

    // b) Event Clouds
    const eventFolders = fs.readdirSync(PHOTOS_DIR).filter(f => {
        const full = path.join(PHOTOS_DIR, f);
        return fs.statSync(full).isDirectory() && f !== 'cloud';
    });

    for (const evt of eventFolders) {
        const evtCloud = path.join(PHOTOS_DIR, evt, 'cloud');
        if (fs.existsSync(evtCloud)) {
            const files = fs.readdirSync(evtCloud).filter(f => f.match(/\.(jpg|jpeg|png)$/i));
            files.forEach(f => filesToSync.push({
                fullPath: path.join(evtCloud, f),
                filename: f,
                relPath: `${evt}/cloud/${f}`
            }));
        }
    }

    let created = 0;
    let uploaded = 0;
    let errors = 0;

    for (const fileObj of filesToSync) {
        const { fullPath, filename, relPath } = fileObj;

        // Skip hidden/temp
        if (filename.startsWith('.')) continue;

        // 3. Uploadovat pokud není v sync_map
        // Use relative path as key to be unique across events
        const syncKey = relPath; // "event/cloud/img.jpg"

        if (!syncMap.synced[syncKey]) {
            try {
                // Upload logic needs to send the file content
                // We use existing uploadToCloud function

                // For API compatibility: The API might expect just a filename in Content-Disposition.
                // But we want to preserve uniqueness.
                // Let's send the filename as is. The server will generate an ID.
                const result = await uploadToCloud(fullPath, filename);

                syncMap.synced[syncKey] = {
                    cloudId: result.id,
                    cloudUrl: result.url,
                    syncedAt: new Date().toISOString(),
                    localPath: fullPath,
                    sizeKB: Math.round(fs.statSync(fullPath).size / 1024)
                };
                console.log(`[CLOUD-SYNC] ☁️ Nahráno: ${filename} -> ${result.url}`);
                uploaded++;
                saveSyncMap(syncMap);
            } catch (e) {
                console.error(`[CLOUD-SYNC] ❌ Chyba uploadu ${filename}:`, e.message);
                errors++;
            }
        }
    }

    saveSyncMap(syncMap);

    if (created || uploaded) {
        console.log(`[CLOUD-SYNC] 📊 Cyklus: ${created} vytvořeno, ${uploaded} nahráno, ${errors} chyb`);
    }

    return { created, uploaded, errors };
}

// --- API PRO BRIDGE ---
function getSyncStatus() {
    const syncMap = loadSyncMap();
    const cloudFiles = fs.existsSync(CLOUD_DIR) ? fs.readdirSync(CLOUD_DIR) : [];

    return {
        totalSynced: Object.keys(syncMap.synced).length,
        totalCloudFiles: cloudFiles.length,
        lastCheck: syncMap.lastCheck
    };
}

module.exports = {
    runSyncCycle,
    getSyncStatus,
    loadSyncMap,
    saveSyncMap
};
