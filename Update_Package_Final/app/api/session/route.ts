import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    // [LOCAL ONLY] No DB session tracking needed
    return NextResponse.json({ success: true });
}
