import { timingSafeEqual } from 'node:crypto';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const TOKEN = process.env.DASHBOARD_HUB_API_TOKEN ?? '';
const PUBLIC_MODE = process.env.DASHBOARD_HUB_PUBLIC === 'true';

interface PageEntry {
  pageId: string;
  title: string;
  score: number;
  status: string;
  staleness: number;
  depth: number;
  commentActivity: number;
  wordCount: number;
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

/** Returns a color on a red→amber→green scale based on a 0–1 ratio. */
function heatColor(ratio: number): string {
  const r = Math.max(0, Math.min(1, ratio));
  if (r < 0.5) {
    // red (#EF4444) → amber (#F59E0B)
    const t = r * 2;
    const cr = Math.round(0xEF + (0xF5 - 0xEF) * t);
    const cg = Math.round(0x44 + (0x9E - 0x44) * t);
    const cb = Math.round(0x44 + (0x0B - 0x44) * t);
    return `#${cr.toString(16).padStart(2, '0')}${cg.toString(16).padStart(2, '0')}${cb.toString(16).padStart(2, '0')}`;
  }
  // amber (#F59E0B) → green (#22C55E)
  const t = (r - 0.5) * 2;
  const cr = Math.round(0xF5 + (0x22 - 0xF5) * t);
  const cg = Math.round(0x9E + (0xC5 - 0x9E) * t);
  const cb = Math.round(0x0B + (0x5E - 0x0B) * t);
  return `#${cr.toString(16).padStart(2, '0')}${cg.toString(16).padStart(2, '0')}${cb.toString(16).padStart(2, '0')}`;
}

const FACTORS = [
  { key: 'staleness',       label: 'Staleness', max: 30 },
  { key: 'depth',           label: 'Depth',     max: 15 },
  { key: 'commentActivity', label: 'Comments',  max: 30 },
  { key: 'wordCount',       label: 'Words',     max: 25 },
] as const;

function renderHeatmap(pages: PageEntry[], spaceName: string, limit: number): string {
  const rows = pages.slice(0, limit);

  const width = 720;
  const titleAreaH = 56;
  const headerRowH = 26;
  const rowH = 38;
  const padX = 20;
  const labelW = 240;
  const cellW = (width - padX * 2 - labelW - 16) / FACTORS.length;
  const height = titleAreaH + headerRowH + rows.length * rowH + 24;

  const header = `
    <text x="${width / 2}" y="22" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" font-weight="bold" letter-spacing="1.5" fill="#374151">FACTOR BREAKDOWN</text>
    <text x="${width / 2}" y="40" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" fill="#6B7280">Top ${rows.length} worst pages  ·  ${escapeXml(spaceName)}</text>
  `;

  // Column headers
  let columnHeaders = '';
  FACTORS.forEach((f, i) => {
    const cx = padX + labelW + 16 + cellW * i + cellW / 2;
    columnHeaders += `<text x="${cx.toFixed(2)}" y="${titleAreaH + 18}" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#6B7280">${f.label}</text>`;
  });

  let cells = '';
  rows.forEach((p, i) => {
    const y = titleAreaH + headerRowH + i * rowH;
    const cellTop = y + 4;
    const cellHeight = rowH - 8;

    // Page label
    cells += `<text x="${padX}" y="${y + rowH / 2 + 4}" font-family="Arial, sans-serif" font-size="12" fill="#1F2937">${escapeXml(truncate(p.title, 32))}</text>`;

    // Heatmap cells
    FACTORS.forEach((f, fi) => {
      const value = (p as unknown as Record<string, number>)[f.key] ?? 0;
      const ratio = f.max > 0 ? value / f.max : 0;
      const color = heatColor(ratio);
      const cx = padX + labelW + 16 + cellW * fi;
      cells += `<rect x="${cx.toFixed(2)}" y="${cellTop}" width="${(cellW - 4).toFixed(2)}" height="${cellHeight}" rx="6" fill="${color}" />`;
      cells += `<text x="${(cx + (cellW - 4) / 2).toFixed(2)}" y="${cellTop + cellHeight / 2 + 4}" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#FFFFFF">${value}</text>`;
    });
  });

  if (rows.length === 0) {
    cells = `<text x="${width / 2}" y="${titleAreaH + headerRowH + 30}" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" fill="#9CA3AF">No pages found</text>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
    ${header}
    ${columnHeaders}
    ${cells}
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
  const limitRaw = url.searchParams.get('limit') ?? '5';
  const limit = Math.max(1, Math.min(20, parseInt(limitRaw, 10) || 5));

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

  const svg = renderHeatmap(pages, spaceName, limit);

  return new Response(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=60',
    },
  });
}
