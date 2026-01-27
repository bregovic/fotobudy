import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';

// Next.js 15+ Change: context.params is now a Promise!
export async function GET(req: NextRequest, context: { params: Promise<{ filename: string }> }) {
    // Musíme počkat na parametry
    const { filename } = await context.params;

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
