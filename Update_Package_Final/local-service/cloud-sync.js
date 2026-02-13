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

    // 1. Najít všechny editované fotky (finální výstupy)
    const sourceFiles = fs.readdirSync(PHOTOS_DIR)
        .filter(f => {
            const lower = f.toLowerCase();
            return (lower.startsWith('web_edited_') || lower.startsWith('edited_')) &&
                (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) &&
                !lower.startsWith('print_');
        });

    let created = 0;
    let uploaded = 0;
    let errors = 0;

    for (const filename of sourceFiles) {
        const sourcePath = path.join(PHOTOS_DIR, filename);
        const cloudFilename = `cloud_${filename}`;
        const cloudPath = path.join(CLOUD_DIR, cloudFilename);

        // 2. Vytvořit cloud verzi pokud neexistuje
        if (!fs.existsSync(cloudPath)) {
            try {
                await optimizeForCloud(sourcePath, cloudPath);
                const sizeKB = Math.round(fs.statSync(cloudPath).size / 1024);
                console.log(`[CLOUD-SYNC] ✅ Vytvořeno: ${cloudFilename} (${sizeKB}KB)`);
                created++;
            } catch (e) {
                console.error(`[CLOUD-SYNC] ❌ Chyba optimalizace ${filename}:`, e.message);
                errors++;
                continue;
            }
        }

        // 3. Uploadovat pokud není v sync_map
        if (!syncMap.synced[cloudFilename]) {
            try {
                const result = await uploadToCloud(cloudPath, cloudFilename);
                syncMap.synced[cloudFilename] = {
                    cloudId: result.id,
                    cloudUrl: result.url,
                    syncedAt: new Date().toISOString(),
                    localPath: sourcePath,
                    sizeKB: Math.round(fs.statSync(cloudPath).size / 1024)
                };
                console.log(`[CLOUD-SYNC] ☁️ Nahráno: ${cloudFilename}`);
                uploaded++;
                saveSyncMap(syncMap);
            } catch (e) {
                console.error(`[CLOUD-SYNC] ❌ Chyba uploadu ${cloudFilename}:`, e.message);
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
