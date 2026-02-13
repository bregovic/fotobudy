import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { cmd, params } = body;

        if (cmd) {
            console.log(`[CLOUD] Přijat příkaz: ${cmd}`);
            await prisma.command.create({
                data: {
                    command: cmd,
                    params: params ? JSON.stringify(params) : null,
                    processed: false
                }
            });
            return NextResponse.json({ success: true });
        }
        return NextResponse.json({ error: 'No command' }, { status: 400 });
    } catch (e) {
        return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }
}

export async function GET(req: NextRequest) {
    // Bridge se ptá: "Mám něco dělat?"
    try {
        // 1. Najít nejstarší nezpracovaný příkaz
        const command = await prisma.command.findFirst({
            where: { processed: false },
            orderBy: { createdAt: 'asc' }
        });

        if (command) {
            // 2. Označit jako zpracovaný
            await prisma.command.update({
                where: { id: command.id },
                data: { processed: true }
            });

            let parsedParams = null;
            if (command.params) {
                try {
                    parsedParams = JSON.parse(command.params);
                } catch (e) {
                    // ignorovat
                }
            }

            return NextResponse.json({
                command: command.command,
                params: parsedParams,
                id: command.id
            });
        }

        return NextResponse.json({ command: null });
    } catch (e) {
        console.error("Chyba při čtení příkazů:", e);
        return NextResponse.json({ command: null });
    }
}
