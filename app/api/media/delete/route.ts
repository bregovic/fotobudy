import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { prisma } from '../../../../lib/prisma'; // Import prisma for Cloud deletion

const IS_CLOUD = !!process.env.RAILWAY_ENVIRONMENT_NAME;

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

        // --- ☁️ CLOUD DELETE (RAILWAY) ---
        if (IS_CLOUD) {
            const dbIds: string[] = [];
            for (const idOrUrl of idsToDelete) {
                // If it looks like a Cloud URL (/api/media/image/UUID)
                if (idOrUrl.includes('/api/media/image/')) {
                    dbIds.push(idOrUrl.split('/').pop() || idOrUrl);
                } else {
                    // It's probably just an ID or filename already, but in cloud we use DB IDs
                    dbIds.push(idOrUrl);
                }
            }

            console.log(`[CLOUD DELETE] Mazání DB ID: `, dbIds);
            const result = await prisma.media.deleteMany({
                where: { id: { in: dbIds } }
            });
            console.log(`[CLOUD DELETE] Smazáno ${result.count} záznamů v DB.`);
            return NextResponse.json({ success: true, count: result.count });
        }

        // --- 🏠 LOCAL DELETE (OFFLINE) ---
        const photosRoot = path.join(process.cwd(), 'public', 'photos');
        const syncMapPath = path.join(process.cwd(), 'sync_map.json');
        let syncMap: any = null;

        // Načíst sync_map.json, aby se dal smazat záznam z lokální DB
        if (fs.existsSync(syncMapPath)) {
            try {
                syncMap = JSON.parse(fs.readFileSync(syncMapPath, 'utf8'));
            } catch (e) { }
        }

        let deletedCount = 0;

        for (const relativeId of idsToDelete) {
            // relativeId can be "file.jpg" or "event/file.jpg"
            const filePath = path.join(photosRoot, relativeId);

            console.log(`   -> Mazání souboru: ${filePath}`); // Debug log

            // Pomocná funkce pro smazání jednoho souboru
            const tryDelete = (p: string) => {
                if (fs.existsSync(p)) {
                    try {
                        fs.unlinkSync(p);
                        console.log(`      Smazáno: ${path.basename(p)}`);
                    } catch (e) {
                        console.error(`      Chyba mazání ${path.basename(p)}:`, e);
                    }
                }
            };

            // 1. Smazat originál
            if (fs.existsSync(filePath)) {
                tryDelete(filePath);
                deletedCount++;
            } else {
                console.warn(`   -> Soubor neexistuje: ${filePath}`);
            }

            // 2. Smazat cloud (komprimovanou) verzi, pokud existuje
            const dir = path.dirname(relativeId);
            const base = path.basename(relativeId);
            const cloudPath = path.join(photosRoot, dir, 'cloud', base);
            tryDelete(cloudPath);

            // 3. Smazat starší "web_" verzi
            const webPath = path.join(photosRoot, dir, 'web_' + base);
            tryDelete(webPath);

            // 4. Smazat "edited_" verzi
            const editedPath = path.join(photosRoot, dir, 'edited_' + base);
            tryDelete(editedPath);

            // 5. Odstranit klíč z lokální sync_map.json, aby si PC nepamatovalo "Smazanou" fotku jako "Nyní Nahranou"
            if (syncMap && syncMap.synced) {
                const cloudRelPath = (dir && dir !== '.') ? `${dir}/cloud/${base}` : `cloud/${base}`;
                if (syncMap.synced[cloudRelPath]) {
                    delete syncMap.synced[cloudRelPath];
                    console.log(`      Smazáno ze sync_map.json: ${cloudRelPath}`);
                }
            }
        }

        // Uložit upravenou sync mapu zpět na disk
        if (syncMap) {
            fs.writeFileSync(syncMapPath, JSON.stringify(syncMap, null, 2));
        }

        return NextResponse.json({ success: true, count: deletedCount });

    } catch (error: any) {
        console.error('Delete error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
