import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // Fetch the MJPEG stream from the local bridge (server.js)
        const response = await fetch('http://127.0.0.1:5555/stream.mjpg', {
            cache: 'no-store'
        });

        if (!response.ok || !response.body) {
            return new NextResponse('Stream unavailable', { status: 503 });
        }

        // Pass the stream through to the client
        // @ts-ignore
        return new NextResponse(response.body, {
            headers: {
                'Content-Type': 'multipart/x-mixed-replace; boundary=--myboundary',
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
            }
        });

    } catch (error) {
        console.error('Stream proxy error:', error);
        return new NextResponse('Stream Error', { status: 500 });
    }
}
