import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';

const SETTINGS_FILE_LOCAL = path.join(process.cwd(), 'settings.local.json');
const SETTINGS_FILE_DEFAULT = path.join(process.cwd(), 'settings.json');

// Helper: Read Local
function getLocalSettings() {
    let settings = {};
    if (fs.existsSync(SETTINGS_FILE_DEFAULT)) {
        try { settings = JSON.parse(fs.readFileSync(SETTINGS_FILE_DEFAULT, 'utf-8')); } catch { }
    }
    if (fs.existsSync(SETTINGS_FILE_LOCAL)) {
        try {
            const local = JSON.parse(fs.readFileSync(SETTINGS_FILE_LOCAL, 'utf-8'));
            settings = { ...settings, ...local };
        } catch { }
    }
    return settings;
}

export async function GET() {
    try {
        // 1. Load from DB
        const dbSettings = await prisma.setting.findMany();
        const dbConfig: Record<string, any> = {};

        dbSettings.forEach(s => {
            try {
                // Try parsing JSON values, otherwise keep string
                dbConfig[s.key] = JSON.parse(s.value);
            } catch {
                dbConfig[s.key] = s.value;
            }
        });

        // 2. Load Local (fallback/override?)
        // Strategy: DB is source of truth. If DB has data, use it.
        if (dbSettings.length > 0) {
            // Sync DB -> Local file for offline backup
            try {
                // Prioritize syncing to local override file if exists, otherwise default
                const targetFile = fs.existsSync(SETTINGS_FILE_LOCAL) ? SETTINGS_FILE_LOCAL : SETTINGS_FILE_DEFAULT;
                fs.writeFileSync(targetFile, JSON.stringify(dbConfig, null, 2));
            } catch (e) { console.error("Write Local Settings Error", e); }
            return NextResponse.json(dbConfig);
        } else {
            // DB empty? Return local.
            return NextResponse.json(getLocalSettings());
        }

    } catch (e) {
        console.error("Settings DB Error:", e);
        // Fallback to local file if DB fails
        return NextResponse.json(getLocalSettings());
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const currentLocal = getLocalSettings();
        const newSettings = { ...currentLocal, ...body };

        // 1. Save to Local File (Backup/Offline)
        // 1. Save to Local File (Backup/Offline) - Always prefer local specific file
        const targetFile = fs.existsSync(SETTINGS_FILE_LOCAL) ? SETTINGS_FILE_LOCAL : SETTINGS_FILE_DEFAULT;
        // If neither exists, create local specific
        const finalFile = !fs.existsSync(SETTINGS_FILE_DEFAULT) && !fs.existsSync(SETTINGS_FILE_LOCAL) ? SETTINGS_FILE_LOCAL : targetFile;

        fs.writeFileSync(finalFile, JSON.stringify(newSettings, null, 2));

        // 2. Save to DB (Cloud Sync)
        try {
            const updates = Object.entries(body).map(([key, val]) => {
                const valueStr = typeof val === 'object' ? JSON.stringify(val) : String(val);
                return prisma.setting.upsert({
                    where: { key },
                    update: { value: valueStr },
                    create: { key, value: valueStr }
                });
            });
            await prisma.$transaction(updates);
        } catch (dbErr) {
            console.warn("Could not sync settings to DB (Offline?)", dbErr);
        }

        return NextResponse.json({ success: true, settings: newSettings });
    } catch (e) {
        return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
    }
}
