import { NextRequest, NextResponse } from 'next/server';

// Použijeme globální proměnnou pro uložení aktuálního snímku
// POZOR: Toto funguje jen v prostředí kde běží jeden server instance (což u Hobby Railway plánu platí)
// V produkčním clusteru by to chtělo Redis/PubSub.
declare global {
    var latestFrame: Buffer | null;
    var frameSubscribers: ((frame: Buffer) => void)[];
}

if (!global.latestFrame) global.latestFrame = null;
if (!global.frameSubscribers) global.frameSubscribers = [];

export const dynamic = 'force-dynamic'; // Vypnout cache

// 1. PŘÍJEM DAT Z BRIDGE (POST)
// Bridge sem posílá "image/jpeg" stream nebo jednotlivé snímky
export async function POST(req: NextRequest) {
    try {
        // Čteme stream dat z requestu
        const reader = req.body?.getReader();
        if (!reader) return new NextResponse("No body", { status: 400 });

        // Jednoduchý parser streamu (Bridge posílá čisté chunky)
        // Pro jednoduchost budeme předpokládat, že co chunk, to update obrazu.
        // Správně bychom měli parsovat MJPEG boundary, ale pro latenci to zkusíme "hrubou silou".

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
                // Uložíme nejnovější data (buffer)
                // Konverze Uint8Array -> Buffer
                global.latestFrame = Buffer.from(value);

                // Notifikujeme všechny čekající klienty (prohlížeče)
                // (V této implementaci pro jednoduchost MJPEG streamování uděláme polling nebo long-poll)
            }
        }

        return new NextResponse("Stream ended", { status: 200 });

    } catch (e: any) {
        console.error("Stream error:", e);
        return new NextResponse(e.message, { status: 500 });
    }
}

// 2. VYSÍLÁNÍ DO PROHLÍŽEČE (GET)
// Prohlížeč si žádá o stream. My mu pošleme MJPEG stream.
export async function GET(req: NextRequest) {
    const encoder = new TextEncoder();

    // Vytvoříme stream response
    const stream = new ReadableStream({
        async start(controller) {

            // Nekonečná smyčka posílání snímků
            while (true) {
                try {
                    const frame = global.latestFrame;
                    if (frame) {
                        // MJPEG hlavička pro snímek
                        const boundary = `\r\n--boundary\r\nContent-Type: image/jpeg\r\nContent-Length: ${frame.length}\r\n\r\n`;
                        controller.enqueue(encoder.encode(boundary));
                        controller.enqueue(frame);

                        // Počkáme chvíli (omezíme FPS cca na 15, ať nezatížíme prohlížeč)
                        await new Promise(r => setTimeout(r, 66));
                    } else {
                        // Pokud nemáme frame, pošleme nic nebo placeholder?
                        // Radši počkáme
                        await new Promise(r => setTimeout(r, 100));
                    }
                } catch (e) {
                    // Klient se odpojil
                    controller.close();
                    break;
                }
            }
        }
    });

    return new NextResponse(stream, {
        headers: {
            'Content-Type': 'multipart/x-mixed-replace; boundary=boundary',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        }
    });
}
