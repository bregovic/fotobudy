import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        let idsToDelete: string[] = [];

        if (body.ids && Array.isArray(body.ids)) {
            // TODO: If using IDs, we assume they are in the root 'photos' folder 
            // OR we need to fetch the active event to know the sub-folder.
            // For now, IDs are assumed to be filenames in the correct context or relative paths.
            idsToDelete = body.ids;
        } else if (body.url) {
            // Extract relative path from URL
            // URL is typically /photos/filename.jpg OR /photos/event-slug/filename.jpg
            const relativePath = body.url.replace(/^\/photos\//, '');
            if (relativePath) idsToDelete.push(decodeURIComponent(relativePath));
        }

        if (idsToDelete.length === 0) {
            return NextResponse.json({ error: 'No IDs provided' }, { status: 400 });
        }

        console.log(`[DELETE] Mažu ${idsToDelete.length} položek...`);

        const photosRoot = path.join(process.cwd(), 'public', 'photos');
        let deletedCount = 0;

        for (const relativeId of idsToDelete) {
            // relativeId can be "file.jpg" or "event/file.jpg"
            const filePath = path.join(photosRoot, relativeId);

            console.log(`   -> Mazání souboru: ${filePath}`); // Debug log

            if (fs.existsSync(filePath)) {
                try {
                    fs.unlinkSync(filePath);
                    console.log(`   -> Smazáno: ${relativeId}`);
                    deletedCount++;
                } catch (e) {
                    console.error(`   -> Chyba mazání ${relativeId}:`, e);
                }
            } else {
                console.warn(`   -> Soubor neexistuje: ${filePath}`);
            }
        }

        return NextResponse.json({ success: true, count: deletedCount });

    } catch (error: any) {
        console.error('Delete error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
