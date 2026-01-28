import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { prisma } from '../../../../lib/prisma';

export const dynamic = 'force-dynamic';

const IS_CLOUD = !!process.env.RAILWAY_ENVIRONMENT_NAME;

export async function GET() {
    try {
        // --- ☁️ CLOUD MODE (RAILWAY) ---
        if (IS_CLOUD) {
            const medias = await prisma.media.findMany({
                orderBy: { createdAt: 'desc' },
                take: 60,
                where: {
                    type: { in: ['PHOTO', 'VIDEO'] } // Filter if needed
                }
            });

            return NextResponse.json(medias.map(m => ({
                id: m.id,
                // On Cloud, serve from DB to ensure persistence (ephemeral FS)
                url: m.data ? `/api/media/image/${m.id}` : m.url,
                createdAt: m.createdAt
            })));
        }

        // --- 🏠 LOCAL MODE (OFFLINE) ---
        const publicDir = path.join(process.cwd(), 'public', 'photos');
        if (!fs.existsSync(publicDir)) return NextResponse.json([]);

        const files = fs.readdirSync(publicDir)
            .filter(f => {
                const lower = f.toLowerCase();
                // SHOW ONLY PROCESSED FILES (web_ or edited_)
                // Hide raw 'DSC_xxxx.jpg' and 'web_DSC_xxxx.jpg' (auto-generated previews) to prevent duplicates
                // We only want to show the final Kiosk exports which are 'web_edited_'
                const isWeb = lower.startsWith('web_');
                const isEdited = lower.startsWith('edited_');
                const isAutoPreview = lower.startsWith('web_dsc_');

                return (isWeb || isEdited) && !isAutoPreview &&
                    (lower.startsWith('print_') === false) && // Explicitly exclude prints
                    (lower.endsWith('.jpg') || lower.endsWith('.jpeg'));
            })
            .map(f => ({
                name: f,
                time: fs.statSync(path.join(publicDir, f)).mtime.getTime()
            }))
            .sort((a, b) => b.time - a.time)
            .slice(0, 50);

        const media = files.map(f => ({
            id: f.name, // ID is filename
            url: `/photos/${f.name}`,
            createdAt: new Date(f.time)
        }));

        return NextResponse.json(media);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to fetch media' }, { status: 500 });
    }
}
