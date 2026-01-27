import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;
        const type = (formData.get('type') as String) || 'PHOTO';
        const localPath = formData.get('localPath') as string || ''; // Cesta z Bridge

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const filename = file.name;

        // Vytvoříme virtuální URL (už nebude existovat na disku, ale View si ji najde)
        const publicUrl = `/api/view/${filename}`;

        // ULOŽENÍ DO DB ("Database as Storage")
        const media = await prisma.media.create({
            data: {
                url: publicUrl,
                type: type as string,
                data: buffer,         // TADY ukládáme samotný obrázek
                localPath: localPath  // A tady cestu u tebe na PC
            }
        });

        console.log(`[UPLOAD] Saved to DB: ${filename} (${buffer.length} bytes)`);

        return NextResponse.json({
            success: true,
            url: publicUrl,
            id: media.id
        });

    } catch (e: any) {
        console.error('Upload error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
