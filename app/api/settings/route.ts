import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

// GET: Vrátí veškeré nastavení
export async function GET() {
    try {
        const settings = await prisma.setting.findMany();
        // Převedeme pole [{key, value}, ...] na objekt { key: value, ... }
        const config: Record<string, any> = {};

        settings.forEach(s => {
            try {
                config[s.key] = JSON.parse(s.value);
            } catch {
                config[s.key] = s.value;
            }
        });

        return NextResponse.json(config);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// POST: Uloží nastavení (merge)
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        // Iterujeme přes klíče v body a ukládáme je
        const updates = Object.keys(body).map(async (key) => {
            const val = body[key];
            const stringVal = typeof val === 'object' ? JSON.stringify(val) : String(val);

            return prisma.setting.upsert({
                where: { key },
                update: { value: stringVal },
                create: { key, value: stringVal }
            });
        });

        await Promise.all(updates);

        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
