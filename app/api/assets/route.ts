import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function GET(req: NextRequest) {
    try {
        const type = req.nextUrl.searchParams.get('type');
        const filter = type ? { type } : {};

        const assets = await prisma.asset.findMany({
            where: filter,
            orderBy: { createdAt: 'desc' },
            select: { id: true, type: true, url: true, name: true } // Nechceme data (bytes), to by bylo obří
        });

        return NextResponse.json(assets);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;
        const type = formData.get('type') as string; // BACKGROUND | STICKER

        if (!file || !type) return NextResponse.json({ error: 'Missing file or type' }, { status: 400 });

        const buffer = Buffer.from(await file.arrayBuffer());
        const filename = file.name;
        const publicUrl = `/api/view/asset_${Date.now()}_${filename}`; // Virtuální URL, view handler to obslouží stejně jako fotky

        const asset = await prisma.asset.create({
            data: {
                type,
                name: filename,
                url: publicUrl,
                data: buffer
            }
        });

        return NextResponse.json({ success: true, asset });
    } catch (e: any) {
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
