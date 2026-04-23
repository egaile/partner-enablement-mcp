import { timingSafeEqual } from 'node:crypto';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const TOKEN = process.env.DASHBOARD_HUB_API_TOKEN ?? '';
const PUBLIC_MODE = process.env.DASHBOARD_HUB_PUBLIC === 'true';

const STATUS_COLORS: Record<string, string> = {
  healthy: '#22C55E',
  'needs-attention': '#F59E0B',
  stale: '#F97316',
  critical: '#EF4444',
};

interface PageEntry {
  pageId: string;
  title: string;
  score: number;
  status: keyof typeof STATUS_COLORS | string;
}

function authorized(req: Request): boolean {
  if (!TOKEN) return false;
  const header = req.headers.get('authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  const a = Buffer.from(match[1]);
  const b = Buffer.from(TOKEN);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function renderBars(pages: PageEntry[], spaceName: string, limit: number): string {
  const rows = pages.slice(0, limit);

  const width = 640;
  const titleAreaH = 50;
  const rowH = 36;
  const padX = 20;
  const labelW = 220;        // page title column
  const scoreW = 36;          // numeric score column on the right
  const barX = padX + labelW + 12;
  const barAreaW = width - barX - scoreW - padX - 8;
  const height = titleAreaH + rows.length * rowH + 16;

  // Header
  const header = `
    <text x="${width / 2}" y="22" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" font-weight="bold" letter-spacing="1.5" fill="#374151">WORST-SCORED PAGES</text>
    <text x="${width / 2}" y="40" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" fill="#6B7280">Top ${rows.length}  ·  ${escapeXml(spaceName)}</text>
  `;

  let bars = '';
  rows.forEach((p, i) => {
    const y = titleAreaH + i * rowH;
    const barTop = y + 8;
    const barH = 20;
    const fillRatio = Math.max(0, Math.min(1, p.score / 100));
    const fillW = Math.max(2, barAreaW * fillRatio);
    const color = STATUS_COLORS[p.status] ?? '#9CA3AF';
    const titleText = truncate(p.title, 30);

    bars += `
      <text x="${padX}" y="${barTop + 14}" font-family="Arial, sans-serif" font-size="12" fill="#1F2937">${escapeXml(titleText)}</text>
      <rect x="${barX}" y="${barTop}" width="${barAreaW}" height="${barH}" rx="4" fill="#F3F4F6" />
      <rect x="${barX}" y="${barTop}" width="${fillW.toFixed(2)}" height="${barH}" rx="4" fill="${color}" />
      <text x="${width - padX}" y="${barTop + 14}" text-anchor="end" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#111827">${p.score}</text>
    `;
  });

  if (rows.length === 0) {
    bars = `<text x="${width / 2}" y="${titleAreaH + 30}" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" fill="#9CA3AF">No pages found</text>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
    ${header}
    ${bars}
  </svg>`;
}

export async function GET(request: Request) {
  if (!PUBLIC_MODE && !authorized(request)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const url = new URL(request.url);
  const spaceKey = url.searchParams.get('spaceKey') ?? 'HA';
  if (!/^[A-Z][A-Z0-9_]{0,9}$/.test(spaceKey)) {
    return new Response('Invalid spaceKey', { status: 400 });
  }
  const limitRaw = url.searchParams.get('limit') ?? '10';
  const limit = Math.max(1, Math.min(20, parseInt(limitRaw, 10) || 10));

  const headers: HeadersInit = {};
  if (TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`;
  const dataRes = await fetch(
    `${url.origin}/api/dashboard-hub/knowledge-health?spaceKey=${spaceKey}`,
    { cache: 'no-store', headers }
  );
  if (!dataRes.ok) {
    return new Response(`Upstream error: ${dataRes.status}`, { status: 502 });
  }
  const data = await dataRes.json() as {
    pages?: PageEntry[];
    space?: { name?: string };
  };

  const pages = data.pages ?? [];
  const spaceName = data.space?.name ?? spaceKey;

  const svg = renderBars(pages, spaceName, limit);

  return new Response(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=60',
    },
  });
}
