import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream';
import { promisify } from 'util';

const pump = promisify(pipeline);
const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;
        let type = formData.get('type') as string;

        if (!type) {
            const ext = file.name.split('.').pop()?.toLowerCase();
            if (ext === 'jpg' || ext === 'png' || ext === 'jpeg') type = 'PHOTO';
            else if (ext === 'mp4' || ext === 'webm') type = 'VIDEO';
            else type = 'PHOTO'; // Fallback
        }

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const timestamp = Date.now();
        // Remove spaces and weird chars from filename
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '');
        const filename = `${type.toLowerCase()}_${timestamp}_${safeName}`;

        // Zajistit, že složka existuje
        const uploadDir = path.join(process.cwd(), 'public', 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const filePath = path.join(uploadDir, filename);
        fs.writeFileSync(filePath, buffer);

        // Uložit do DB (pokusíme se, ale nezboříme to, pokud DB nejede)
        let media;
        try {
            media = await prisma.media.create({
                data: {
                    type: type,
                    url: `/uploads/${filename}`,
                    isPrivate: false
                }
            });
        } catch (dbError) {
            console.warn("DB Save failed (running without DB?):", dbError);
            // Fallback object pro odpověď
            media = { url: `/uploads/${filename}`, type };
        }

        // Bridge očekává { url: ... }
        return NextResponse.json({ success: true, url: media.url, media });

    } catch (e: any) {
        console.error("Upload error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
