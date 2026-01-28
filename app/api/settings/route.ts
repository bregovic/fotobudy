import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const SETTINGS_FILE = path.join(process.cwd(), 'settings.json');

function getSettings() {
    if (!fs.existsSync(SETTINGS_FILE)) return {};
    try {
        return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
    } catch {
        return {};
    }
}

function saveSettings(newSettings: Record<string, any>) {
    const current = getSettings();
    const updated = { ...current, ...newSettings };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2));
    return updated;
}

// GET: Return all settings
export async function GET() {
    return NextResponse.json(getSettings());
}

// POST: Save settings (merge)
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        let changes = {};

        // Variant A: Single key-value
        if (body.key && body.value !== undefined) {
            changes = { [body.key]: body.value };
        }
        // Variant B: Bulk object
        else {
            changes = body;
        }

        saveSettings(changes);
        return NextResponse.json({ success: true });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
