
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const https = require('https');

const prisma = new PrismaClient();
const PHOTOS_DIR = path.join(process.cwd(), 'public', 'photos');

async function sync() {
    try {
        console.log(`[SYNC] Starting Cloud Sync check...`);
        console.log(`       Source: ${PHOTOS_DIR}/**/cloud/*.jpg`);

        if (!fs.existsSync(PHOTOS_DIR)) {
            console.log(`[SYNC] Photos directory missing.`);
            return;
        }

        // 1. Find all 'cloud' optimized images
        let filesToProcess = [];

        // Root folders (Events)
        const eventFolders = fs.readdirSync(PHOTOS_DIR).filter(f => {
            const fullPath = path.join(PHOTOS_DIR, f);
            return fs.statSync(fullPath).isDirectory() && f !== 'cloud';
        });

        // 1b. Check ROOT CLOUD folder
        const rootCloudDir = path.join(PHOTOS_DIR, 'cloud');
        if (fs.existsSync(rootCloudDir)) {
            const files = fs.readdirSync(rootCloudDir).filter(f => f.match(/\.(jpg|jpeg|png)$/i));
            for (const file of files) {
                filesToProcess.push({
                    path: path.join(rootCloudDir, file),
                    name: file,
                    event: null, // No event
                    relativePath: `cloud/${file}`
                });
            }
        }

        for (const eventSlug of eventFolders) {
            const cloudDir = path.join(PHOTOS_DIR, eventSlug, 'cloud');

            if (fs.existsSync(cloudDir)) {
                const files = fs.readdirSync(cloudDir).filter(f => f.match(/\.(jpg|jpeg|png)$/i));

                for (const file of files) {
                    filesToProcess.push({
                        path: path.join(cloudDir, file),
                        name: file,
                        event: eventSlug,
                        relativePath: `${eventSlug}/cloud/${file}`
                    });
                }
            }
        }

        console.log(`[SYNC] Found ${filesToProcess.length} optimized files ready for upload.`);

        // 2. Upload Logic
        for (const file of filesToProcess) {

            // Check if already in DB (by filename match)
            const existing = await prisma.media.findFirst({
                where: { localPath: { contains: file.name } }
            });

            if (existing) continue;

            console.log(`[SYNC] Uploading: ${file.relativePath}`);

            try {
                // Read optimized file directly
                const buffer = fs.readFileSync(file.path);

                // Find Event ID
                let eventId = null;
                if (file.event) {
                    const ev = await prisma.event.findUnique({ where: { slug: file.event } });
                    if (ev) eventId = ev.id;
                }

                const isPrint = file.name.includes('print');

                // Upload to DB
                const media = await prisma.media.create({
                    data: {
                        url: `/api/media/image/pending`,
                        type: isPrint ? 'PRINT' : 'PHOTO',
                        localPath: file.relativePath, // "event/cloud/img.jpg"
                        data: buffer,
                        eventId: eventId
                    }
                });

                // Update URL
                await prisma.media.update({
                    where: { id: media.id },
                    data: { url: `/api/media/image/${media.id}` }
                });

                console.log(`       ✅ Published (ID: ${media.id})`);

            } catch (err) {
                console.error(`       ❌ Error uploading file:`, err.message);
            }
        }

    } catch (e) {
        console.error('[SYNC] Fatal Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

// Run once or loop? This script is likely run by setInterval in server.js or cron.
// If run standalone:
if (require.main === module) {
    sync();
}

module.exports = { sync };
