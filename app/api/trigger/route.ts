import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { sessionId } = body;

        // Insert pending photo command
        const result = await query(
            "INSERT INTO photos (session_id, status) VALUES ($1, 'pending') RETURNING id",
            [sessionId]
        );

        return NextResponse.json({ success: true, id: result.rows[0].id });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
}
