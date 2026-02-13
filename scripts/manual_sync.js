
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp'); // Added compression

const prisma = new PrismaClient();

async function sync() {
    console.log("==========================================");
    console.log("📸 MANUAL SYNC: Local -> Railway DB (Compressed)");
    console.log("==========================================");

    // 1. Check DB Connection
    try {
        console.log("Connecting to Database...");
        const count = await prisma.media.count();
        console.log(`✅ Connected! Current DB Photo Count: ${count}`);
    } catch (e) {
        console.error("❌ ERROR: Cannot connect to Database.");
        console.error("   Check if .env file exists and internet is working.");
        console.error(e.message);
        return;
    }

    // 2. Scan Local Photos
    const photosDir = path.join(process.cwd(), 'public', 'photos');
    if (!fs.existsSync(photosDir)) {
        console.log("📂 No 'public/photos' directory found.");
        return;
    }

    const events = fs.readdirSync(photosDir).filter(f => fs.statSync(path.join(photosDir, f)).isDirectory());
    // Also scan root photos folder
    const rootFiles = fs.readdirSync(photosDir).filter(f => f.endsWith('.jpg') || f.endsWith('.png'));

    let filesToProcess = rootFiles.map(f => ({ path: path.join(photosDir, f), name: f, event: null }));

    // Scan subfolders (events)
    for (const eventSlug of events) {
        const eventPath = path.join(photosDir, eventSlug);
        const files = fs.readdirSync(eventPath).filter(f => f.endsWith('.jpg') || f.endsWith('.png'));
        filesToProcess.push(...files.map(f => ({
            path: path.join(eventPath, f),
            name: f,
            event: eventSlug
        })));
    }

    console.log(`📂 Found ${filesToProcess.length} local files.`);

    // 3. Process Sync
    let uploaded = 0;
    let skipped = 0;
    let errors = 0;

    for (const file of filesToProcess) {
        process.stdout.write(`Processing ${file.name}... `);

        const existing = await prisma.media.findFirst({
            where: {
                localPath: { contains: file.name }
            }
        });

        if (existing) {
            console.log("Skipped (Already in DB)");
            skipped++;
            continue;
        }

        try {
            // COMPRESSION LOGIC
            let buffer;
            try {
                buffer = await sharp(file.path)
                    .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
                    .jpeg({ quality: 80, mozjpeg: true })
                    .toBuffer();
                // console.log(` (Original: ${(fs.statSync(file.path).size/1024/1024).toFixed(2)}MB -> ${(buffer.length/1024).toFixed(1)}KB)`);
            } catch (sharpError) {
                console.error(`⚠️ Image processing failed, using original.`, sharpError.message);
                buffer = fs.readFileSync(file.path);
            }

            // Try to find event ID if slug exists
            let eventId = null;
            if (file.event) {
                const ev = await prisma.event.findUnique({ where: { slug: file.event } });
                if (ev) eventId = ev.id;
            }

            const isPrint = file.name.includes('print');

            const media = await prisma.media.create({
                data: {
                    url: `/api/media/image/${Date.now()}`,
                    type: isPrint ? 'PRINT' : 'PHOTO',
                    localPath: file.name, // storing filename here for reference
                    data: buffer,
                    eventId: eventId
                }
            });

            // Update URL to point to ID
            await prisma.media.update({
                where: { id: media.id },
                data: { url: `/api/media/image/${media.id}` }
            });

            console.log(`✅ Uploaded! (ID: ${media.id})`);
            uploaded++;

        } catch (e) {
            console.log("❌ Failed");
            console.error(e.message);
            errors++;
        }
    }

    console.log("\n------------------------------------------");
    console.log(`🎉 SYNC COMPLETE`);
    console.log(`   Uploaded: ${uploaded}`);
    console.log(`   Skipped:  ${skipped}`);
    console.log(`   Errors:   ${errors}`);
    console.log("------------------------------------------");
}

sync()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
        console.log("Press Ctrl+C to exit...");
        setInterval(() => { }, 1000);
    });
