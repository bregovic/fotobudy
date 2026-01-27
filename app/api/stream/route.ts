import { NextRequest, NextResponse } from 'next/server';

// Ukládáme poslední snímek do paměti serveru
// Poznámka: Funguje spolehlivě na Railway (stálý server). Na Vercelu (serverless) by to nefungovalo.
let currentFrame: Buffer | null = null;
let lastUpdate = 0;

export async function GET(req: NextRequest) {
    // Mobily si chodí pro tento endpoint, aby viděly obraz
    if (!currentFrame) {
        return new NextResponse('No signal', { status: 404 });
    }

    // Vrátíme obrázek s hlavičkou, aby se neukládal do cache
    // @ts-ignore - Buffer is compatible at runtime but TS types mismatch in Next.js
    return new NextResponse(currentFrame, {
        headers: {
            'Content-Type': 'image/jpeg',
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'X-Stream-Age': (Date.now() - lastUpdate).toString()
        },
    });
}

export async function POST(req: NextRequest) {
    // Tvůj lokální počítač sem posílá obrázky
    try {
        const blob = await req.blob();
        const buffer = Buffer.from(await blob.arrayBuffer());

        currentFrame = buffer;
        lastUpdate = Date.now();

        return NextResponse.json({ success: true, size: buffer.length });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
