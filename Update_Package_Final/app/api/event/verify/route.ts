import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { eventId, password } = body;

        const event = await prisma.event.findUnique({
            where: { id: eventId }
        });

        if (!event) {
            return NextResponse.json({ success: false, error: 'Událost nenalezena' }, { status: 404 });
        }

        // Jednoduché porovnání hesel (plaintext, dle stávající implementace)
        if (event.password === password) {
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({ success: false, error: 'Špatné heslo' }, { status: 401 });
        }

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
