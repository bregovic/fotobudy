import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';

export async function POST(req: NextRequest) {
    try {
        const { url } = await req.json();

        if (!url) return NextResponse.json({ error: 'Missing URL' }, { status: 400 });

        // Najdeme název souboru z URL
        const filename = url.split('/').pop();

        // Smažeme záznamy, které končí tímto souborem
        const deleteResult = await prisma.media.deleteMany({
            where: {
                url: { endsWith: filename }
            }
        });

        console.log(`[DELETE] Deleted ${deleteResult.count} items for ${filename}`);

        return NextResponse.json({ success: true });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
