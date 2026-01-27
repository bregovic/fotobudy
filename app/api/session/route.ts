import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { initDB } from '@/lib/init';

export async function POST(request: Request) {
    try {
        // Auto-init DB to ensure tables exist
        await initDB();

        const body = await request.json();
        const { id } = body;

        // Insert session if not exists
        await query('INSERT INTO sessions (id) VALUES ($1) ON CONFLICT (id) DO NOTHING', [id]);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Session API Error:', error);
        return NextResponse.json({ error: 'Database error', details: String(error) }, { status: 500 });
    }
}
