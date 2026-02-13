import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';

export async function POST(req: NextRequest) {
    try {
        const { filename, type } = await req.json();

        const media = await prisma.media.create({
            data: {
                type: type,
                url: `/photos/${filename}` // Bridge ukládá do /photos
            }
        });

        return NextResponse.json({ success: true, id: media.id });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
