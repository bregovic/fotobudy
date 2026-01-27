import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';
const prisma = new PrismaClient();

export async function GET() {
    try {
        const media = await prisma.media.findMany({
            orderBy: { createdAt: 'desc' },
            take: 50 // Limit na posledních 50 fotek
        });
        return NextResponse.json(media);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch media' }, { status: 500 });
    }
}
