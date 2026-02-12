
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as Blob | null;
        const type = formData.get('type') as string; // 'background' | 'sticker'

        if (!file || !type) return NextResponse.json({ success: false, error: 'No file or type' }, { status: 400 });

        const buffer = Buffer.from(await file.arrayBuffer());
        const fileName = `${type}_${Date.now()}_${(file as any).name || 'asset.png'}`;

        let subDir = '';
        if (type === 'background') subDir = 'backgrounds';
        else if (type === 'sticker') subDir = 'stickers';
        else return NextResponse.json({ success: false, error: 'Invalid type' }, { status: 400 });

        const dir = path.join(process.cwd(), 'public', 'assets', subDir);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const filePath = path.join(dir, fileName);
        fs.writeFileSync(filePath, buffer);

        return NextResponse.json({ success: true, url: `/assets/${subDir}/${fileName}` });
    } catch (e) {
        return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
    }
}
