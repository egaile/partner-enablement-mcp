import { NextResponse } from 'next/server';

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 10;

const hits = new Map<string, { count: number; resetAt: number }>();

// Periodically prune expired entries to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now();
  hits.forEach((entry, ip) => {
    if (now > entry.resetAt) hits.delete(ip);
  });
}, WINDOW_MS);

export function rateLimit(request: Request): NextResponse | null {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || 'unknown';

  const now = Date.now();
  const entry = hits.get(ip);

  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return null;
  }

  entry.count++;
  if (entry.count > MAX_REQUESTS) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    );
  }

  return null;
}
