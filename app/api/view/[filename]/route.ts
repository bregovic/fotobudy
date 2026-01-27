import { NextRequest, NextResponse } from 'next/server';
// Používáme relativní cestu, aby to fungovalo vždy (i bez aliasů)
import { prisma } from '../../../../lib/prisma';

export async function GET(req: NextRequest, { params }: { params: { filename: string } }) {
    const filename = params.filename;

    try {
        const media = (await prisma.media.findFirst({
            where: {
                url: { endsWith: filename }
            },
            orderBy: { createdAt: 'desc' }
        })) as any;

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
