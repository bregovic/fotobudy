import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { filename, type = 'PHOTO' } = body;

        if (!filename) {
            return NextResponse.json({ error: 'Filename required' }, { status: 400 });
        }

        const media = await prisma.media.create({
            data: {
                type: type,
                url: `/photos/${filename}`, // Bridge ukládá do /photos
                isPrivate: false
            }
        });

        return NextResponse.json({ success: true, media });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
