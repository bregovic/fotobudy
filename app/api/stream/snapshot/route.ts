import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Tento soubor bude sloužit jako sdílená paměť pro poslední snímek
const LIVE_IMAGE_PATH = path.join(process.cwd(), 'public', 'live.jpg');

// POST: Bridge sem nahraje aktuální snímek z kamery
export async function POST(req: NextRequest) {
    try {
        const blob = await req.blob();
        const buffer = Buffer.from(await blob.arrayBuffer());

        fs.writeFileSync(LIVE_IMAGE_PATH, buffer);

        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// GET: Kiosk si stáhne aktuální snímek
export async function GET() {
    if (!fs.existsSync(LIVE_IMAGE_PATH)) {
        return new NextResponse(null, { status: 404 });
    }
    const fileBuffer = fs.readFileSync(LIVE_IMAGE_PATH);
    return new NextResponse(fileBuffer, {
        headers: {
            'Content-Type': 'image/jpeg',
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
        }
    });
}
