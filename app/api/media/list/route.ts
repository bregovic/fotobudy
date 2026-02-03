import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { prisma } from '../../../../lib/prisma';

export const dynamic = 'force-dynamic';

const IS_CLOUD = !!process.env.RAILWAY_ENVIRONMENT_NAME;

export async function GET() {
    try {
        // 1. Get Active Event
        const activeEvent = await prisma.event.findFirst({ where: { isActive: true } });

        // --- ☁️ CLOUD MODE (RAILWAY) ---
        if (IS_CLOUD) {
            // Filter by Event ID if active, otherwise show all/none (or maybe default is show all?)
            // User requirement: "V režimu focení bude umožněno zobrazovat vyfocené fotky z přiřazeného projektu"
            // So if event is active, show ONLY that event. If no event, show what? maybe everything or nothing.
            // Let's filter by event if exists.

            const whereClause = activeEvent ? { eventId: activeEvent.id } : {};

            const medias = await prisma.media.findMany({
                orderBy: { createdAt: 'desc' },
                take: 60,
                where: {
                    ...whereClause,
                    type: { in: ['PHOTO', 'VIDEO'] }
                }
            });

            return NextResponse.json(medias.map(m => ({
                id: m.id,
                url: m.data ? `/api/media/image/${m.id}` : m.url,
                createdAt: m.createdAt
            })));
        }

        // --- 🏠 LOCAL MODE (OFFLINE) ---
        let publicDir = path.join(process.cwd(), 'public', 'photos');
        let urlPrefix = '/photos/';

        if (activeEvent?.slug) {
            publicDir = path.join(publicDir, activeEvent.slug);
            urlPrefix = `/photos/${activeEvent.slug}/`;
        }

        if (!fs.existsSync(publicDir)) return NextResponse.json([]);

        const files = fs.readdirSync(publicDir)
            .filter(f => {
                const lower = f.toLowerCase();
                const isWeb = lower.startsWith('web_');
                const isEdited = lower.startsWith('edited_');
                const isAutoPreview = lower.startsWith('web_dsc_');

                return (isWeb || isEdited) && !isAutoPreview &&
                    (lower.startsWith('print_') === false) &&
                    (lower.endsWith('.jpg') || lower.endsWith('.jpeg'));
            })
            .map(f => ({
                name: f,
                time: fs.statSync(path.join(publicDir, f)).mtime.getTime()
            }))
            .sort((a, b) => b.time - a.time)
            .slice(0, 50);

        const media = files.map(f => ({
            id: f.name,
            url: `${urlPrefix}${f.name}`, // Append slug to URL if needed
            createdAt: new Date(f.time)
        }));

        return NextResponse.json(media);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to fetch media' }, { status: 500 });
    }
}
