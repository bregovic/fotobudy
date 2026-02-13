import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { prisma } from '../../../../lib/prisma'; // Keep import, but handle cautiously

export const dynamic = 'force-dynamic';

const IS_CLOUD = !!process.env.RAILWAY_ENVIRONMENT_NAME;

export async function GET(req: NextRequest) {
    try {
        // --- ☁️ CLOUD MODE (RAILWAY) ---
        if (IS_CLOUD) {
            const medias = await prisma.media.findMany({
                orderBy: { createdAt: 'desc' },
                take: 60,
                where: { type: 'PHOTO' }
            });

            return NextResponse.json(medias.map(m => ({
                id: m.id,
                url: m.data ? `/api/media/image/${m.id}` : m.url,
                createdAt: m.createdAt
            })));
        }

        // --- 🏠 LOCAL MODE (OFFLINE) ---
        // [SAFE LIST API] - No Prisma, No Crash.
        const baseDir = path.join(process.cwd(), 'public', 'photos');
        const allPhotos: any[] = [];
        const limit = 60; // Max number of photos to return

        if (!fs.existsSync(baseDir)) {
            return NextResponse.json([]);
        }

        // Funkce pro rekurzivni hledani
        const scan = (dir: string, depth: number) => {
            if (depth > 2) return;
            try {
                const list = fs.readdirSync(dir, { withFileTypes: true });
                for (const entry of list) {
                    const fullPath = path.join(dir, entry.name);

                    if (entry.isDirectory()) {
                        scan(fullPath, depth + 1);
                    } else if (entry.isFile()) {
                        const lower = entry.name.toLowerCase();
                        if ((lower.endsWith('.jpg') || lower.endsWith('.jpeg')) && !lower.startsWith('.')) {
                            // Pouze web verze, zadne printy
                            if (lower.startsWith('print_')) continue;

                            const stats = fs.statSync(fullPath);
                            const relativePath = path.relative(path.join(process.cwd(), 'public'), fullPath);
                            const url = '/' + relativePath.replace(/\\/g, '/');

                            allPhotos.push({
                                id: entry.name, // Use filename as ID
                                url: url,
                                createdAt: new Date(stats.mtimeMs),
                                isEdited: lower.startsWith('edited_'),
                                originalName: lower.startsWith('edited_') ? lower.replace('edited_', '') : lower
                            });
                        }
                    }
                }
            } catch (e) { /* Ignore EPERM/ENOENT */ }
        };

        scan(baseDir, 0);

        // [SMART FILTER] - Hide originals if edited version exists
        const editedMap = new Set<string>();
        allPhotos.forEach(p => {
            if (p.isEdited) editedMap.add(p.originalName);
        });

        const filteredPhotos = allPhotos.filter(p => {
            // Keep if it is edited OR if it is original AND NOT edited version exists
            if (p.isEdited) return true;
            if (editedMap.has(p.id.toLowerCase())) return false; // Hide original because edited exists
            return true;
        });

        // Sort by newest first
        filteredPhotos.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        // Return top N photos
        return NextResponse.json(filteredPhotos.slice(0, limit));

    } catch (error: any) {
        console.warn("List error:", error);
        return NextResponse.json([], { status: 500 });
    }
}
