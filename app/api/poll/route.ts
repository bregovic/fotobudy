import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const sessionId = searchParams.get('sessionId');

        // 1. Zkontrolujeme pending commandy (stará logika pro Remote Trigger - zatím necháme, i když nepoužíváme)
        // ... (vynecháme pro zjednodušení, cloud trigger řešíme jinak)

        // 2. Najdeme NEJNOVĚJŠÍ fotku/média v celém systému
        // To nám umožní detekovat, že se něco vyfotilo
        const latestMedia = await prisma.media.findFirst({
            orderBy: { createdAt: 'desc' },
            take: 1
        });

        // 3. Vrátíme info
        return NextResponse.json({
            pending: false,
            latest: latestMedia ? {
                id: latestMedia.id,
                url: latestMedia.url,
                createdAt: latestMedia.createdAt
            } : null
        });

    } catch (error) {
        console.warn("Poll error (DB issue?):", error);
        return NextResponse.json({ pending: false, error: 'DB_ERROR' });
    }
}
