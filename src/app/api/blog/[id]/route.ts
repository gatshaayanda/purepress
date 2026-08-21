// src/app/api/blog/[id]/route.ts
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ status: 'skipped at build' });
}

export async function DELETE() {
  return NextResponse.json({ status: 'deleted (noop)' });
}
