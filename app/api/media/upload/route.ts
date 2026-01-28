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

        const buffer = Buffer.from(await file.arrayBuffer());
        const originalName = file.name;

        const isPrint = formData.get('isPrint') === 'true';

        // [FIX DUPLICATES] Použijeme deterministický název (bez timestampu).
        const safeName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
        const webFilename = isPrint ? `print_${safeName}` : `web_${safeName}`;

        let processedBuffer: Buffer;

        if (isPrint) {
            // PRO TISK: Necháme originál (nebo jen lehce zmenšíme pokud je obří)
            processedBuffer = await sharp(buffer)
                .resize(2400, 2400, { fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 95 })
                .toBuffer();
        } else {
            // OPTIMALIZACE: Zmenšíme fotku pro web
            processedBuffer = await sharp(buffer)
                .resize(1280, 1280, { fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 80 })
                .toBuffer();
        }

        const publicUrl = `/photos/${webFilename}`;

        // --- ☁️ CLOUD MODE (RAILWAY) ---
        if (IS_CLOUD) {
            // Save to DB (Persistent)
            // We assume the URL might need to be /api/media/image/[id] if file system is ephemeral,
            // but for now we keep publicUrl. If you are serving from DB, you need a viewer route.
            // If you are using Railway Volume for /public/photos, then FS write is enough and DB is metadata.
            // Assuming "Strict DB Mode": we save the Blob.

            const media = await prisma.media.create({
                data: {
                    url: `/api/media/image/${Date.now()}`, // Placeholder, will update below
                    type: type as string,
                    localPath: originalLocalPath,
                    data: processedBuffer // Storing the image BLOB
                }
            });

            // Update URL with actual ID
            const dbUrl = `/api/media/image/${media.id}`;
            await prisma.media.update({
                where: { id: media.id },
                data: { url: dbUrl }
            });

            console.log(`[UPLOAD] Cloud DB Saved: ${media.id}`);

            // Still write to FS for immediate cache (ephemeral)
            const publicDir = path.join(process.cwd(), 'public', 'photos');
            if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
            fs.writeFileSync(path.join(publicDir, webFilename), processedBuffer);

            return NextResponse.json({
                success: true,
                url: dbUrl,
                filename: webFilename,
                id: media.id
            });
        }

        // --- 🏠 LOCAL MODE (OFFLINE) ---
        // Save to FS only. No DB.
        const publicDir = path.join(process.cwd(), 'public', 'photos');
        if (!fs.existsSync(publicDir)) {
            fs.mkdirSync(publicDir, { recursive: true });
        }
        const webFilePath = path.join(publicDir, webFilename);

        fs.writeFileSync(webFilePath, processedBuffer);

        console.log(`[UPLOAD] Local Disk Saved: ${webFilename}`);

        return NextResponse.json({
            success: true,
            url: publicUrl,
            filename: webFilename,
        });

    } catch (e: any) {
        console.error('Upload error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
