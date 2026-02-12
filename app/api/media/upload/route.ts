import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const IS_CLOUD = !!process.env.RAILWAY_ENVIRONMENT_NAME;

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;
        const type = (formData.get('type') as String) || 'PHOTO';
        const originalLocalPath = formData.get('localPath') as string || '';

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        // 1. Get Active Event
        const activeEvent = await prisma.event.findFirst({ where: { isActive: true } });

        const buffer = Buffer.from(await file.arrayBuffer());
        const originalName = file.name;

        const isPrint = formData.get('isPrint') === 'true';

        // [FIX DUPLICATES] Použijeme deterministický název (bez timestampu).
        const safeName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
        let webFilename = isPrint ? `print_${safeName}` : `web_${safeName}`;

        let processedBuffer: Buffer;

        // [CLOUD SYNC OPTIMIZATION]
        if (originalName.startsWith('cloud_')) {
            console.log(`[UPLOAD] Detected optimized CLOUD file: ${originalName}`);
            webFilename = originalName;
            processedBuffer = buffer;
        } else if (isPrint) {
            processedBuffer = await sharp(buffer)
                .resize(2400, 2400, { fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 95 })
                .toBuffer();
        } else {
            processedBuffer = await sharp(buffer)
                .resize(1280, 1280, { fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 80 })
                .toBuffer();
        }

        const HAS_DB = process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgresql');

        // 1. ALWAYS SAVE LOCALLY (For Kiosk Display)
        // Determine Sync/Public Path Structure
        const basePhotosDir = path.join(process.cwd(), 'public', 'photos');
        let targetDir = basePhotosDir;
        let urlPrefix = '/photos/';

        if (activeEvent?.slug) {
            targetDir = path.join(basePhotosDir, activeEvent.slug);
            urlPrefix = `/photos/${activeEvent.slug}/`;
        }

        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        const webFilePath = path.join(targetDir, webFilename);
        fs.writeFileSync(webFilePath, processedBuffer);
        console.log(`[UPLOAD] Local Disk Saved: ${webFilename}`);

        const publicUrl = `${urlPrefix}${webFilename}`;
        let finalUrl = publicUrl;
        let finalId = webFilename;

        // 2. SYNCHRONIZE TO CLOUD DB (If available)
        if (HAS_DB) {
            try {
                const media = await prisma.media.create({
                    data: {
                        url: `/api/media/image/${Date.now()}`, // Placeholder, updated next step
                        type: type as string,
                        localPath: originalLocalPath,
                        data: processedBuffer, // Store binary in DB
                        eventId: activeEvent?.id
                    }
                });

                const dbUrl = `/api/media/image/${media.id}`;
                await prisma.media.update({
                    where: { id: media.id },
                    data: { url: dbUrl }
                });

                console.log(`[UPLOAD] Cloud DB Synced: ${media.id}`);
                finalUrl = dbUrl; // Use DB URL for consistency if we wanted, but local kiosk prefers local file?
                // Actually, local kiosk can use local file for speed, but returns DB ID for reference.
                finalId = media.id;
            } catch (e) {
                console.error("Cloud Sync Failed (Offline?)", e);
                // Continue with local only
            }
        }

        return NextResponse.json({
            success: true,
            url: publicUrl, // Keep local URL for immediate display on Kiosk
            filename: webFilename,
            id: finalId
        });

    } catch (e: any) {
        console.error('Upload error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
