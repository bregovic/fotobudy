import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Tento endpoint slouží pro dynamické čtení nahraných souborů,
// které Next.js 'public' složka nevidí okamžitě po nahrání.
export async function GET(req: NextRequest, { params }: { params: { filename: string } }) {
    const filename = params.filename;

    // Cesta k "runtime" uploadům (musí sedět s upload/route.ts)
    // Bezpečně ošetříme cestu
    const safeName = path.basename(filename);
    const filePath = path.join(process.cwd(), 'public', 'uploads', safeName);

    if (!fs.existsSync(filePath)) {
        return new NextResponse("File not found", { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);

    // Detekce typu
    const ext = path.extname(safeName).toLowerCase();
    let contentType = 'application/octet-stream';
    if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    if (ext === '.png') contentType = 'image/png';

    return new NextResponse(fileBuffer, {
        headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000, immutable'
        }
    });
}
