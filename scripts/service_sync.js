
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp'); // Added compression

const prisma = new PrismaClient();
const PHOTOS_DIR = path.join(process.cwd(), 'public', 'photos');
const SYNC_INTERVAL_MS = 30000; // Check every 30 seconds

console.log("🔄 BACKGROUND SYNC SERVICE STARTED");
console.log("   Waiting for internet connection to sync photos (Compressed to ~1920px)...");

async function syncLoop() {
    while (true) {
        try {
            await runSyncStep();
        } catch (e) {
            console.error("⚠️ Sync Loop Error (retrying in 30s):", e.message);
        }
        // Wait before next run
        await new Promise(r => setTimeout(r, SYNC_INTERVAL_MS));
    }
}

async function runSyncStep() {
    // 1. Check Internet / DB Connection
    try {
        await prisma.media.count(); // Lightweight ping
    } catch (e) {
        // Silent fail if offline
        return;
    }

    if (!fs.existsSync(PHOTOS_DIR)) return;

    // 2. Scan Local Files
    const filesToSync = [];

    // Scan root and subfolders
    const scanDir = (dir, eventSlug = null) => {
        if (!fs.existsSync(dir)) return;
        const items = fs.readdirSync(dir);
        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                scanDir(fullPath, item);
            } else if (item.endsWith('.jpg') || item.endsWith('.png')) {
                filesToSync.push({ path: fullPath, name: item, event: eventSlug });
            }
        }
    };

    scanDir(PHOTOS_DIR);

    if (filesToSync.length === 0) return;

    // 3. Process each file
    for (const file of filesToSync) {
        try {
            // Check if exists in DB
            const existing = await prisma.media.findFirst({
                where: { localPath: { contains: file.name } },
                select: { id: true }
            });

            if (!existing) {
                console.log(`📤 Processing & Uploading: ${file.name}`);

                // COMPRESSION LOGIC
                let buffer;
                try {
                    buffer = await sharp(file.path)
                        .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
                        .jpeg({ quality: 80, mozjpeg: true })
                        .toBuffer();
                    // console.log(`   Compressed size: ${(buffer.length/1024).toFixed(1)} KB`);
                } catch (sharpError) {
                    console.error(`⚠️ Image processing failed for ${file.name}, using original.`, sharpError.message);
                    buffer = fs.readFileSync(file.path);
                }

                // Find Event ID
                let eventId = null;
                if (file.event) {
                    const ev = await prisma.event.findUnique({ where: { slug: file.event } });
                    if (ev) eventId = ev.id;
                }

                const isPrint = file.name.includes('print');

                // Create in DB
                const media = await prisma.media.create({
                    data: {
                        url: `/api/media/image/pending`, // Temp URL
                        type: isPrint ? 'PRINT' : 'PHOTO',
                        localPath: file.name,
                        data: buffer,
                        eventId: eventId
                    }
                });

                // Fix URL with ID
                await prisma.media.update({
                    where: { id: media.id },
                    data: { url: `/api/media/image/${media.id}` }
                });

                console.log(`✅ Synced: ${file.name} (ID: ${media.id})`);
            }
        } catch (e) {
            console.error(`❌ Failed to sync ${file.name}:`, e.message);
        }
    }
}

// Start the loop
syncLoop();
