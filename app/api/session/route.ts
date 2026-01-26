import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { id } = body;

        // Insert session if not exists
        await query('INSERT INTO sessions (id) VALUES ($1) ON CONFLICT (id) DO NOTHING', [id]);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
}
