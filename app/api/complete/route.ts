import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { id, filename } = body;

        await query(
            "UPDATE photos SET status = 'done', filename = $1, taken_at = NOW() WHERE id = $2",
            [filename, id]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
}
