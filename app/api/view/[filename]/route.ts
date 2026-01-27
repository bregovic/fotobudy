import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';

export async function GET(req: NextRequest, { params }: { params: { filename: string } }) {
    const filename = params.filename;

    // Hledáme v DB podle URL (protože url v DB je /api/view/filename)
    // Nebo můžeme hledat jen podle koncovky url...
    // Zkusíme najít záznam, který končí na toto jméno

    try {
        const media = await prisma.media.findFirst({
            where: {
                url: { endsWith: filename }
            },
            orderBy: { createdAt: 'desc' }
        });

        if (!media || !media.data) {
            return new NextResponse('Not found', { status: 404 });
        }

        return new NextResponse(media.data, {
            headers: {
                'Content-Type': 'image/jpeg',
                'Cache-Control': 'public, max-age=31536000, immutable'
            }
        });
    } catch (e) {
        return new NextResponse('Error', { status: 500 });
    }
}
