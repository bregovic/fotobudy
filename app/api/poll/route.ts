import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic'; // Disable caching

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const sessionId = searchParams.get('sessionId');

        if (!sessionId) return NextResponse.json({ error: 'Missing session' }, { status: 400 });

        // Find oldest pending command
        const result = await query(
            "SELECT * FROM photos WHERE session_id = $1 AND status = 'pending' ORDER BY created_at ASC LIMIT 1",
            [sessionId]
        );

        if (result.rows.length === 0) {
            return NextResponse.json({ pending: false });
        }

        // Update to 'processing' to avoid double trigger (optional, or handle in complete)
        // For simplicity, we keep it pending until Kiosk confirms capture

        return NextResponse.json({ pending: true, command: result.rows[0] });
    } catch (error) {
        console.error(error);
        // If DB not configured, return safe empty
        return NextResponse.json({ pending: false, error: 'DB_ERROR' });
    }
}
