import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        // [LOCAL ONLY MODE] - Scan public/photos for latest file
        const publicDir = path.join(process.cwd(), 'public', 'photos');
        let latestMedia = null;

        if (fs.existsSync(publicDir)) {
            const files = fs.readdirSync(publicDir)
                .map(f => {
                    const lower = f.toLowerCase();
                    return { name: f, lower, time: fs.statSync(path.join(publicDir, f)).mtime.getTime() };
                })
                .filter(f => f.lower.endsWith('.jpg') || f.lower.endsWith('.jpeg'))
                .sort((a, b) => b.time - a.time);

            if (files.length > 0) {
                const newest = files[0];
                latestMedia = {
                    id: newest.name, // Use filename as ID
                    url: `/photos/${newest.name}`,
                    createdAt: new Date(newest.time)
                };
            }
        }

        return NextResponse.json({
            pending: false,
            latest: latestMedia
        });

    } catch (error: any) {
        console.warn("Poll error:", error);
        return NextResponse.json({ pending: false, error: error.message }, { status: 500 });
    }
}
