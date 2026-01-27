import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function GET(req: NextRequest) {
    try {
        const type = req.nextUrl.searchParams.get('type');
        const filter = type ? { type } : {};

        const assets = await prisma.asset.findMany({
            where: filter,
            orderBy: { createdAt: 'desc' },
            select: { id: true, type: true, url: true, name: true }
        });

        return NextResponse.json(assets);
    } catch (e: any) {
        console.error("[API Asset GET Error]:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;
        const type = formData.get('type') as string; // BACKGROUND | STICKER

        if (!file || !type) {
            return NextResponse.json({ error: 'Chybí soubor nebo typ.' }, { status: 400 });
        }

        // Kontrola velikosti (např. 4MB limit pro DB)
        if (file.size > 4 * 1024 * 1024) {
            return NextResponse.json({ error: 'Soubor je příliš velký (max 4MB).' }, { status: 413 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const filename = file.name;

        // Unikátní název pro virtuální URL
        const safeName = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
        const publicUrl = `/api/view/asset_${Date.now()}_${safeName}`;

        // Zkusíme uložit
        try {
            const asset = await prisma.asset.create({
                data: {
                    type,
                    name: safeName,
                    url: publicUrl,
                    data: buffer
                }
            });
            return NextResponse.json({ success: true, asset });
        } catch (dbError: any) {
            console.error("[API Asset DB Error]:", dbError);
            return NextResponse.json({ error: 'Chyba databáze: ' + dbError.message }, { status: 500 });
        }

    } catch (e: any) {
        console.error("[API Asset Upload Error]:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { id } = await req.json();
        await prisma.asset.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
