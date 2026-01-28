import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

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

        // Cesta kam uložit webovou verzi
        const publicDir = path.join(process.cwd(), 'public', 'photos');
        if (!fs.existsSync(publicDir)) {
            fs.mkdirSync(publicDir, { recursive: true });
        }
        const webFilePath = path.join(publicDir, webFilename);
        const publicUrl = `/photos/${webFilename}`;

        if (isPrint) {
            // PRO TISK: Necháme originál (nebo jen lehce zmenšíme pokud je obří)
            // Ale pro jistotu uložím buffer přímo, abychom neztratili kvalitu
            // Případně resize na 300DPI pro 10x15 (cca 1800x1200)
            await sharp(buffer)
                .resize(2400, 2400, { fit: 'inside', withoutEnlargement: true }) // Higher limit for print
                .jpeg({ quality: 95 })
                .toFile(webFilePath);
        } else {
            // OPTIMALIZACE: Zmenšíme fotku pro web (max 1280px, kvalita 80%)
            await sharp(buffer)
                .resize(1280, 1280, { fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 80 })
                .toFile(webFilePath);
        }

        console.log(`[UPLOAD] Disk OK: ${webFilename}`);

        // --- FIRE AND FORGET DB WRITE ---
        // [LOCAL ONLY MODE] Skip DB write to avoid dependency on cloud/railway
        /*
        prisma.media.create({
            data: {
                url: publicUrl,
                type: type as string,
                localPath: originalLocalPath || webFilePath
            }
        }).then((media) => {
            console.log(`[UPLOAD] DB Sync OK: ${media.id}`);
        }).catch((err) => {
            console.error(`[UPLOAD] DB Sync Failed:`, err);
        });
        */

        // Return Success Immediately
        return NextResponse.json({
            success: true,
            url: publicUrl,
            filename: webFilename, // Return filename for direct access
            // id: ... // We don't have ID yet, but that's okay for local print
        });

    } catch (e: any) {
        console.error('Upload error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
