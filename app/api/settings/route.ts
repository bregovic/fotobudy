import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';

const SETTINGS_FILE_LOCAL = path.join(process.cwd(), 'settings.local.json');
const SETTINGS_FILE_DEFAULT = path.join(process.cwd(), 'settings.json');

// Helper: Read Local
function getLocalSettings() {
    let settings: any = {};
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
        // 1. Load Local Settings
        const localSettings = getLocalSettings();

        // 2. Load from DB
        const dbSettings = await prisma.setting.findMany();
        const dbConfig: Record<string, any> = {};

        if (dbSettings.length > 0) {
            dbSettings.forEach(s => {
                try {
                    dbConfig[s.key] = JSON.parse(s.value);
                } catch {
                    dbConfig[s.key] = s.value;
                }
            });

            // 3. Intelligent Merge: DB wins generally, BUT local wins for SMTP if DB is empty
            const finalConfig = { ...localSettings, ...dbConfig };

            const isDbSmtpEmpty = !dbConfig.smtp_config || !dbConfig.smtp_config.host || !dbConfig.smtp_config.user;
            const isLocalSmtpValid = localSettings.smtp_config && localSettings.smtp_config.host && localSettings.smtp_config.user;

            if (isDbSmtpEmpty && isLocalSmtpValid) {
                console.log("Using Local SMTP config instead of empty DB config");
                finalConfig.smtp_config = localSettings.smtp_config;
            }

            // 4. Sync Final -> Local File (Backup)
            try {
                const targetFile = fs.existsSync(SETTINGS_FILE_LOCAL) ? SETTINGS_FILE_LOCAL : SETTINGS_FILE_DEFAULT;
                fs.writeFileSync(targetFile, JSON.stringify(finalConfig, null, 2));
            } catch (e) { console.error("Write Local Settings Error", e); }

            return NextResponse.json(finalConfig);
        } else {
            // DB empty? Return local.
            return NextResponse.json(localSettings);
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
