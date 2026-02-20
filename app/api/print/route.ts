import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma'; // Correct path for app/api/print/route.ts -> lib is in the root

const IS_CLOUD = !!process.env.RAILWAY_ENVIRONMENT_NAME;

export async function POST(req: Request) {
    try {
        const body = await req.json();

        // ☁️ CLOUD MODE -> Fronta příkazů (Local Service to za chvíli vyčte)
        if (IS_CLOUD) {
            await prisma.command.create({
                data: {
                    command: 'PRINT',
                    params: JSON.stringify(body),
                    processed: false
                }
            });
            return NextResponse.json({ success: true, message: 'Tiskový příkaz odeslán do Kiosku ☁️' });
        }

        // 🏠 LOCAL MODE -> Přímé volání lokálního Bridge
        const res = await fetch('http://127.0.0.1:5555/print', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            return NextResponse.json({ error: 'Bridge nedosažitelný' }, { status: 503 });
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed to print' }, { status: 500 });
    }
}
