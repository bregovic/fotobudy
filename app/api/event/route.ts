import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import fs from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { name, password, makeActive } = body;

        if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });

        // Vytvořit slug (název složky)
        const slug = name.toLowerCase()
            .replace(/ /g, '_')
            .replace(/[^a-z0-9_]/g, '');

        // Pokud má být aktivní, deaktivovat ostatní
        if (makeActive) {
            await prisma.event.updateMany({ data: { isActive: false } });
        }

        // Vytvořit v DB
        const event = await prisma.event.create({
            data: {
                name,
                slug,
                password,
                isActive: !!makeActive
            }
        });

        // Vytvořit command pro lokální složku (aby bridge vytvořil složku a začal do ní ukládat)
        if (makeActive) {
            await prisma.command.create({
                data: {
                    command: 'SET_EVENT',
                    params: JSON.stringify({ slug, name }),
                    processed: false
                }
            });
        }

        return NextResponse.json({ success: true, event });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    const events = await prisma.event.findMany({
        orderBy: { createdAt: 'desc' }
    });

    // Sanitizace hesel před odesláním na klienta
    const safeEvents = events.map(e => ({
        ...e,
        hasPassword: !!e.password && e.password.length > 0,
        password: undefined // Neodesílat heslo
    }));

    return NextResponse.json(safeEvents);
}
