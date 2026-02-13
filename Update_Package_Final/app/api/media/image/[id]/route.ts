import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> } // In Next.js 15+ params is a Promise
) {
    try {
        const { id } = await context.params;

        // Try to fetch from DB
        const media = await prisma.media.findUnique({
            where: { id: id },
            select: { data: true, type: true }
        });

        if (!media || !media.data) {
            return new NextResponse('Not found', { status: 404 });
        }

        // Determine content type (default to jpeg as we usually convert to jpeg)
        // If we stored original types, we should probably store mimeType in DB, 
        // but for now we know we upload JPEGs mainly.
        const contentType = 'image/jpeg';

        return new NextResponse(new Blob([new Uint8Array(media.data)]), {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=31536000, immutable'
            }
        });

    } catch (e) {
        console.error(e);
        return new NextResponse('Internal Error', { status: 500 });
    }
}
