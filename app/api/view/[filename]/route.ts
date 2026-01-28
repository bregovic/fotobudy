import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Next.js 15+ Change: context.params is now a Promise!
export async function GET(req: NextRequest, context: { params: Promise<{ filename: string }> }) {
    const { filename } = await context.params;

    try {
        const filePath = path.join(process.cwd(), 'public', 'photos', filename);

        if (!fs.existsSync(filePath)) {
            return new NextResponse('Not Found', { status: 404 });
        }

        const fileBuffer = fs.readFileSync(filePath);

        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Type': 'image/jpeg',
                'Cache-Control': 'public, max-age=31536000, immutable'
            }
        });
    } catch (e) {
        return new NextResponse('Error', { status: 500 });
    }
}
