import { NextResponse } from 'next/server';
import { AppError, errorBody } from '@/lib/errors';

/** Wrap a route-handler body so every AppError becomes a consistent JSON error. */
export function withApiError(fn: () => Promise<Response>): Promise<Response> {
  return fn().catch((err) => {
    const status = err instanceof AppError ? err.status : 500;
    return NextResponse.json(errorBody(err), { status });
  });
}

/** Best-effort client IP for per-IP rate limiting. */
export function clientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}