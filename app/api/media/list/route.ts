import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
    try {
        // Získat parametry z URL (např. ?filter=private)
        const { searchParams } = new URL(req.url);
        const filter = searchParams.get('filter') || 'public';

        // Dotaz do databáze
        const media = await prisma.media.findMany({
            where: {
                // Pokud je filtr 'public', chceme jen isPrivate: false
                // Pokud 'private', chceme isPrivate: true (zatím bez autentizace, jen demo)
                isPrivate: filter === 'private'
            },
            orderBy: {
                createdAt: 'desc' // Nejnovější první
            },
            take: 50 // Zatím limit 50, ať to nehltíme
        });

        // Obohacení dat (pro videa můžeme generovat thumbnail, zatím placeholder)
        const formattedMedia = media.map(m => ({
            ...m,
            thumbnail: m.type === 'VIDEO' ? '/video-placeholder.png' : m.url
        }));

        return NextResponse.json({ media: formattedMedia });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
