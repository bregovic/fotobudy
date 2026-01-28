import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        let idsToDelete: string[] = [];

        if (body.ids && Array.isArray(body.ids)) {
            idsToDelete = body.ids;
        } else if (body.url) {
            // Extract filename from URL
            const filename = body.url.split('/').pop();
            if (filename) idsToDelete.push(filename);
        }

        if (idsToDelete.length === 0) {
            return NextResponse.json({ error: 'No IDs provided' }, { status: 400 });
        }

        console.log(`[DELETE] Mažu ${idsToDelete.length} položek...`);

        const publicDir = path.join(process.cwd(), 'public', 'photos');
        let deletedCount = 0;

        for (const id of idsToDelete) {
            // ID IS THE FILENAME in our new FS-only system
            const filePath = path.join(publicDir, id);
            if (fs.existsSync(filePath)) {
                try {
                    fs.unlinkSync(filePath);
                    console.log(`   -> Smazáno: ${id}`);
                    deletedCount++;
                } catch (e) {
                    console.error(`   -> Chyba mazání ${id}:`, e);
                }
            }
        }

        return NextResponse.json({ success: true, count: deletedCount });

    } catch (error: any) {
        console.error('Delete error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
