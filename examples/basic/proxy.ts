import { NextResponse, type NextRequest } from 'next/server';

import { migrate } from './url-migrations.mjs';

export function proxy(request: NextRequest) {
  if (request.method === 'GET' || request.method === 'HEAD') {
    const migration = migrate(request.url);
    if (migration.applied) return NextResponse.redirect(migration.url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
