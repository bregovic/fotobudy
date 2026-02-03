import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
    try {
        const { id } = await req.json();

        // 1. Deaktivovat všechny
        await prisma.event.updateMany({ data: { isActive: false } });

        // 2. Aktivovat vybranou
        const event = await prisma.event.update({
            where: { id },
            data: { isActive: true }
        });

        // 3. Command pro Bridge
        await prisma.command.create({
            data: {
                command: 'SET_EVENT',
                params: JSON.stringify({ slug: event.slug, name: event.name }),
                processed: false
            }
        });

        return NextResponse.json({ success: true, event });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function GET() {
    const active = await prisma.event.findFirst({ where: { isActive: true } });
    return NextResponse.json({ active });
}
