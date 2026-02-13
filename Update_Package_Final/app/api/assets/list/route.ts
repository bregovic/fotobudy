
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
    try {
        const bgDir = path.join(process.cwd(), 'public', 'assets', 'backgrounds');
        const stDir = path.join(process.cwd(), 'public', 'assets', 'stickers');

        // Create if missing
        if (!fs.existsSync(bgDir)) fs.mkdirSync(bgDir, { recursive: true });
        if (!fs.existsSync(stDir)) fs.mkdirSync(stDir, { recursive: true });

        const backgrounds = fs.readdirSync(bgDir)
            .filter(f => /\.(jpg|jpeg|png)$/i.test(f))
            .map(f => ({ name: f, url: `/assets/backgrounds/${f}` }));

        const stickers = fs.readdirSync(stDir)
            .filter(f => /\.(png|webp)$/i.test(f))
            .map(f => ({ name: f, url: `/assets/stickers/${f}` }));

        return NextResponse.json({ success: true, backgrounds, stickers });
    } catch (e) {
        return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
    }
}
