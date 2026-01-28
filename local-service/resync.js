/**
 * RESYNC SCRIPT - Synchronizace lokálních fotek do Railway databáze
 * 
 * Funkce:
 * 1. Načte všechny fotky z lokální složky (public/photos)
 * 2. Zkontroluje mapovací tabulku (sync_map.json)
 * 3. Nové fotky optimalizuje na ~0.5MB a nahraje na Railway
 * 4. Aktualizuje mapovací tabulku
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { exec } = require('child_process');
const os = require('os');

// --- KONFIGURACE ---
const PHOTOS_DIR = path.join(__dirname, '..', 'public', 'photos');
const SYNC_MAP_FILE = path.join(__dirname, '..', 'sync_map.json');
const CLOUD_API_URL = 'https://cvak.up.railway.app/api/media/upload';
const TARGET_SIZE_KB = 500; // Cílová velikost ~0.5MB

// --- POMOCNÉ FUNKCE ---

function loadSyncMap() {
    if (!fs.existsSync(SYNC_MAP_FILE)) {
        return { synced: {}, lastSync: null };
    }
    try {
        return JSON.parse(fs.readFileSync(SYNC_MAP_FILE, 'utf-8'));
    } catch (e) {
        console.error('[SYNC] Chyba načítání sync_map.json:', e.message);
        return { synced: {}, lastSync: null };
    }
}

function saveSyncMap(map) {
    map.lastSync = new Date().toISOString();
    fs.writeFileSync(SYNC_MAP_FILE, JSON.stringify(map, null, 2));
}

function getLocalPhotos() {
    if (!fs.existsSync(PHOTOS_DIR)) {
        console.error('[SYNC] Složka s fotkami neexistuje:', PHOTOS_DIR);
        return [];
    }

    return fs.readdirSync(PHOTOS_DIR)
        .filter(f => f.match(/\.(jpg|jpeg|png)$/i))
        .filter(f => !f.startsWith('print_')) // Ignorovat tiskové úlohy
        .map(f => ({
            filename: f,
            path: path.join(PHOTOS_DIR, f),
            stats: fs.statSync(path.join(PHOTOS_DIR, f))
        }));
}

/**
 * Optimalizuje obrázek na cílovou velikost pomocí PowerShell
 * Postupně snižuje kvalitu dokud není pod limitem
 */
function optimizeImage(inputPath, targetSizeKB) {
    return new Promise((resolve, reject) => {
        const tempPath = path.join(os.tmpdir(), `sync_${Date.now()}_${path.basename(inputPath)}`);

        // Získat aktuální velikost
        const currentSizeKB = fs.statSync(inputPath).size / 1024;

        if (currentSizeKB <= targetSizeKB) {
            // Již je dostatečně malý, jen zkopírovat
            fs.copyFileSync(inputPath, tempPath);
            resolve(tempPath);
            return;
        }

        // Vypočítat potřebné rozlišení a kvalitu
        // Předpokládáme JPEG ~10KB na 100x100 při kvalitě 80
        // Pro 500KB -> cca 2200x1500 při kvalitě 75
        const targetWidth = 1800; // Rozumná šířka pro web
        const quality = Math.max(50, Math.min(85, Math.floor(70 * (targetSizeKB / currentSizeKB))));

        const psScript = `
Add-Type -AssemblyName System.Drawing;
$img = [System.Drawing.Image]::FromFile('${inputPath.replace(/\\/g, '\\\\')}');
$ratio = $img.Height / $img.Width;
$newWidth = [Math]::Min(${targetWidth}, $img.Width);
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
$newImg.Save('${tempPath.replace(/\\/g, '\\\\')}', $codecInfo, $encoderParams);
$img.Dispose(); $newImg.Dispose(); $graph.Dispose();
`;
        const command = `powershell -Command "${psScript.replace(/\r?\n/g, ' ')}"`;

        exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error) => {
            if (error) {
                reject(error);
            } else {
                resolve(tempPath);
            }
        });
    });
}

/**
 * Nahraje optimalizovaný obrázek na Railway
 */
function uploadToCloud(filePath, originalFilename) {
    return new Promise((resolve, reject) => {
        const fileBuffer = fs.readFileSync(filePath);
        const boundary = '----FormBoundary' + Date.now().toString(16);

        // Vytvořit multipart/form-data payload
        const header = Buffer.from(
            `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="file"; filename="${originalFilename}"\r\n` +
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
                    if (json.success) {
                        resolve(json);
                    } else {
                        reject(new Error(json.error || 'Upload failed'));
                    }
                } catch (e) {
                    reject(new Error('Invalid response: ' + data.substring(0, 200)));
                }
            });
        });

        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

// --- HLAVNÍ SYNCHRONIZACE ---

async function syncPhotos() {
    console.log('\n========================================');
    console.log('  📸 BLICK & CVAK - SYNC TO CLOUD');
    console.log('========================================\n');

    // 1. Načíst mapovací tabulku
    const syncMap = loadSyncMap();
    console.log(`[INFO] Poslední sync: ${syncMap.lastSync || 'nikdy'}`);
    console.log(`[INFO] Již synchronizováno: ${Object.keys(syncMap.synced).length} fotek\n`);

    // 2. Načíst lokální fotky
    const localPhotos = getLocalPhotos();
    console.log(`[SCAN] Nalezeno ${localPhotos.length} lokálních fotek`);

    // 3. Najít nové (nesynchronizované)
    const newPhotos = localPhotos.filter(p => !syncMap.synced[p.filename]);
    console.log(`[SYNC] Nových ke synchronizaci: ${newPhotos.length}\n`);

    if (newPhotos.length === 0) {
        console.log('✅ Vše je již synchronizované!');
        return;
    }

    // 4. Synchronizovat postupně
    let synced = 0;
    let failed = 0;

    for (const photo of newPhotos) {
        const sizeKB = Math.round(photo.stats.size / 1024);
        process.stdout.write(`  [${synced + failed + 1}/${newPhotos.length}] ${photo.filename} (${sizeKB}KB) ... `);

        try {
            // Optimalizovat
            const optimizedPath = await optimizeImage(photo.path, TARGET_SIZE_KB);
            const newSizeKB = Math.round(fs.statSync(optimizedPath).size / 1024);

            // Nahrát na cloud
            const result = await uploadToCloud(optimizedPath, photo.filename);

            // Aktualizovat mapu
            syncMap.synced[photo.filename] = {
                cloudId: result.id || null,
                cloudUrl: result.url || null,
                syncedAt: new Date().toISOString(),
                originalSize: sizeKB,
                optimizedSize: newSizeKB
            };

            // Smazat temp soubor
            fs.unlinkSync(optimizedPath);

            console.log(`✅ (${newSizeKB}KB)`);
            synced++;

            // Uložit mapu průběžně
            saveSyncMap(syncMap);

        } catch (e) {
            console.log(`❌ ${e.message}`);
            failed++;
        }

        // Malá pauza mezi uploady
        await new Promise(r => setTimeout(r, 200));
    }

    // 5. Finální report
    console.log('\n========================================');
    console.log(`  ✅ Synchronizováno: ${synced}`);
    console.log(`  ❌ Selhalo: ${failed}`);
    console.log(`  📊 Celkem v cloudu: ${Object.keys(syncMap.synced).length}`);
    console.log('========================================\n');

    saveSyncMap(syncMap);
}

// Spustit
syncPhotos().catch(e => {
    console.error('\n[FATAL]', e);
    process.exit(1);
});
