import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { prisma } from '../../../../lib/prisma';

export const dynamic = 'force-dynamic';

const IS_CLOUD = !!process.env.RAILWAY_ENVIRONMENT_NAME;

export async function GET(request: Request) {
    try {
        // [CLOUD MODE] - Check DB
        if (IS_CLOUD) {
            const latest = await prisma.media.findFirst({
                orderBy: { createdAt: 'desc' },
                where: { type: 'PHOTO' }
            });
            if (latest) {
                return NextResponse.json({
                    pending: false,
                    latest: {
                        id: latest.id,
                        url: latest.data ? `/api/media/image/${latest.id}` : latest.url,
                        createdAt: latest.createdAt
                    }
                });
            }
            return NextResponse.json({ pending: false, latest: null });
        }

        // [LOCAL ONLY MODE - PURE FS]
        const baseDir = path.join(process.cwd(), 'public', 'photos');

        if (!fs.existsSync(baseDir)) {
            return NextResponse.json({ pending: false, latest: null });
        }

        let latestFile: { path: string, time: number } | null = null;
        const now = Date.now();

        // Funkce pro rekurzivni hledani (max depth 2)
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
                            // Ignorujeme print verze a thumbnails, pokud existuji
                            if (lower.startsWith('print_')) continue;

                            const stats = fs.statSync(fullPath);
                            // Hledame NEJNOVEJSI soubor
                            if (!latestFile || stats.mtimeMs > latestFile.time) {
                                latestFile = { path: fullPath, time: stats.mtimeMs };
                            }
                        }
                    }
                }
            } catch (e) { /* Ignore EPERM/ENOENT */ }
        };

        scan(baseDir, 0);

        if (latestFile && (latestFile as any).path) {
            // Prevod absolutni cesty na URL
            // C:\Apps\FotoBuddy\public\photos\test\web_123.jpg -> /photos/test/web_123.jpg
            const relativePath = path.relative(path.join(process.cwd(), 'public'), (latestFile as any).path);
            const url = '/' + relativePath.replace(/\\/g, '/');

            return NextResponse.json({
                pending: false,
                latest: {
                    id: path.basename((latestFile as any).path),
                    url: url,
                    createdAt: new Date((latestFile as any).time)
                }
            });
        }

        return NextResponse.json({ pending: false, latest: null });

    } catch (error: any) {
        console.warn("Poll error:", error);
        // Vzdy vratime platne JSON, i kdyz nastane chyba, aby klient nepadal
        return NextResponse.json({ pending: false, latest: null, error: error.message });
    }
}
