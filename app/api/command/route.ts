import { NextRequest, NextResponse } from 'next/server';

// Jednoduchá paměť pro příkazy (v produkci by byla lepší DB nebo Redis)
// Ukládáme příkaz a timestamp
let pendingCommand: { cmd: string, time: number } | null = null;

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { cmd } = body;

        if (cmd) {
            console.log(`[CLOUD] Přijat příkaz od Kiosku: ${cmd}`);
            pendingCommand = { cmd, time: Date.now() };
            return NextResponse.json({ success: true });
        }
        return NextResponse.json({ error: 'No command' }, { status: 400 });
    } catch (e) {
        return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }
}

export async function GET(req: NextRequest) {
    // Bridge se ptá: "Mám něco dělat?"

    // Pokud je příkaz starší než 5 sekund, ignorujeme ho (vypršel)
    if (pendingCommand && (Date.now() - pendingCommand.time > 5000)) {
        pendingCommand = null;
    }

    if (pendingCommand) {
        const cmd = pendingCommand.cmd;
        // Po přečtení příkaz smažeme (aby se nevykonal 2x)
        // POZOR: Pokud by bylo více Bridge klientů, mohl by to vzít nesprávný,
        // ale my máme jen jeden PC s foťákem.
        pendingCommand = null;
        return NextResponse.json({ command: cmd });
    }

    return NextResponse.json({ command: null });
}
