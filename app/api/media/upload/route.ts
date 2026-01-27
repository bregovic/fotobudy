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
        const type = formData.get('type') as string || 'VIDEO'; // VIDEO | PHOTO

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const timestamp = Date.now();
        const filename = `${type.toLowerCase()}_${timestamp}_${file.name}`;

        // Zajistit, že složka existuje
        const uploadDir = path.join(process.cwd(), 'public', 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const filePath = path.join(uploadDir, filename);
        fs.writeFileSync(filePath, buffer);

        // Uložit do DB
        const media = await prisma.media.create({
            data: {
                type: type,
                url: `/uploads/${filename}`,
                isPrivate: false // Defaultně veřejné, dokud nepřidáme logiku
            }
        });

        return NextResponse.json({ success: true, media });

    } catch (e: any) {
        console.error("Upload error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
