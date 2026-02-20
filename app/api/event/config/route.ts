import { NextResponse } from 'next/server';

export async function GET() {
    try {
        // Proxy to local bridge server (server.js runs on 5555)
        const res = await fetch('http://127.0.0.1:5555/api/event/config');

        if (!res.ok) {
            return NextResponse.json({ error: 'Bridge unreachable' }, { status: 503 });
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error("Local bridge unreachable:", error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
