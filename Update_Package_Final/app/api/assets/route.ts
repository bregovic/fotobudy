import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const ASSETS_DIR = path.join(process.cwd(), 'public', 'assets');

// Helper to ensure dir exists
const ensureDir = () => { if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true }); };

export async function GET(req: NextRequest) {
    try {
        ensureDir();
        const typeParam = req.nextUrl.searchParams.get('type'); // BACKGROUND | STICKER

        const files = fs.readdirSync(ASSETS_DIR);
        const assets = files
            .filter(f => !f.startsWith('.')) // Ignore hidden
            .map(f => {
                let type = 'OTHER';
                if (f.startsWith('bg_')) type = 'BACKGROUND';
                if (f.startsWith('sticker_')) type = 'STICKER';
                return {
                    id: f, // Filename is ID
                    type,
                    url: `/assets/${f}`,
                    name: f
                };
            })
            // Filter by type if requested
            .filter(a => !typeParam || a.type === typeParam);

        return NextResponse.json(assets);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        ensureDir();
        const formData = await req.formData();
        const file = formData.get('file') as File;
        const type = formData.get('type') as string; // BACKGROUND | STICKER

        if (!file || !type) return NextResponse.json({ error: 'Missing file/type' }, { status: 400 });

        const buffer = Buffer.from(await file.arrayBuffer());

        // Prefix based on type
        const prefix = type === 'BACKGROUND' ? 'bg_' : 'sticker_';
        // Clean filename
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filename = `${prefix}${Date.now()}_${safeName}`;

        fs.writeFileSync(path.join(ASSETS_DIR, filename), buffer);

        return NextResponse.json({ success: true, asset: { id: filename, url: `/assets/${filename}` } });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { id } = await req.json();
        // ID is filename
        const p = path.join(ASSETS_DIR, id);
        if (fs.existsSync(p)) fs.unlinkSync(p);
        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
