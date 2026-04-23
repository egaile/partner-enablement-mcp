import { timingSafeEqual } from 'node:crypto';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const TOKEN = process.env.DASHBOARD_HUB_API_TOKEN ?? '';
const PUBLIC_MODE = process.env.DASHBOARD_HUB_PUBLIC === 'true';

interface Slice {
  name: string;
  value: number;
  color: string;
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

function arcPath(cx: number, cy: number, rOuter: number, rInner: number, startAngle: number, endAngle: number): string {
  const x1 = cx + rOuter * Math.sin(startAngle);
  const y1 = cy - rOuter * Math.cos(startAngle);
  const x2 = cx + rOuter * Math.sin(endAngle);
  const y2 = cy - rOuter * Math.cos(endAngle);
  const x3 = cx + rInner * Math.sin(endAngle);
  const y3 = cy - rInner * Math.cos(endAngle);
  const x4 = cx + rInner * Math.sin(startAngle);
  const y4 = cy - rInner * Math.cos(startAngle);
  const large = endAngle - startAngle > Math.PI ? 1 : 0;
  return [
    `M ${x1.toFixed(2)} ${y1.toFixed(2)}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
    `L ${x3.toFixed(2)} ${y3.toFixed(2)}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${x4.toFixed(2)} ${y4.toFixed(2)}`,
    'Z',
  ].join(' ');
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function renderPie(slices: Slice[], totalLabel: string, spaceName: string): string {
  const width = 500;
  const height = 320;
  const cx = 160;
  const cy = 160;
  const rOuter = 120;
  const rInner = 70;

  const total = slices.reduce((sum, s) => sum + s.value, 0);

  let arcs = '';
  if (total === 0) {
    arcs = `<circle cx="${cx}" cy="${cy}" r="${rOuter}" fill="#F3F4F6" />
            <circle cx="${cx}" cy="${cy}" r="${rInner}" fill="white" />`;
  } else {
    let cursor = 0;
    for (const s of slices) {
      if (s.value <= 0) continue;
      const start = (cursor / total) * 2 * Math.PI;
      const end = ((cursor + s.value) / total) * 2 * Math.PI;
      // Full-circle case (only one slice covers everything) — split into two halves so the arc is well-defined.
      if (end - start >= 2 * Math.PI - 0.001) {
        const mid = start + Math.PI;
        arcs += `<path d="${arcPath(cx, cy, rOuter, rInner, start, mid)}" fill="${s.color}" stroke="white" stroke-width="2" />`;
        arcs += `<path d="${arcPath(cx, cy, rOuter, rInner, mid, end)}" fill="${s.color}" stroke="white" stroke-width="2" />`;
      } else {
        arcs += `<path d="${arcPath(cx, cy, rOuter, rInner, start, end)}" fill="${s.color}" stroke="white" stroke-width="2" />`;
      }
      cursor += s.value;
    }
  }

  // Center text
  const centerText = `<text x="${cx}" y="${cy - 6}" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" font-weight="bold" fill="#111827">${total}</text>
                      <text x="${cx}" y="${cy + 18}" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" fill="#6B7280">${escapeXml(totalLabel)}</text>`;

  // Legend on the right — explicit columns: swatch | name | count
  const swatchX = 310;
  const nameX = 330;
  const countX = width - 16;
  const legendItemHeight = 28;
  const legendStartY = cy - (slices.length * legendItemHeight) / 2 + 12;

  let legend = '';
  slices.forEach((s, i) => {
    const y = legendStartY + i * legendItemHeight;
    legend += `<rect x="${swatchX}" y="${y - 9}" width="12" height="12" rx="2" fill="${s.color}" />`;
    legend += `<text x="${nameX}" y="${y + 1}" font-family="Arial, sans-serif" font-size="12" fill="#374151">${escapeXml(s.name)}</text>`;
    legend += `<text x="${countX}" y="${y + 1}" text-anchor="end" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#111827">${s.value}</text>`;
  });

  // Title at top
  const title = `<text x="${width / 2}" y="22" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" font-weight="bold" letter-spacing="1.5" fill="#374151">PAGE STATUS DISTRIBUTION</text>
                 <text x="${width / 2}" y="40" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" fill="#6B7280">${escapeXml(spaceName)}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
    ${title}
    <g transform="translate(0, 30)">
      ${arcs}
      ${centerText}
      ${legend}
    </g>
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

  // Reuse the JSON endpoint to get current data — keeps scoring logic in one place.
  const origin = url.origin;
  const headers: HeadersInit = {};
  if (TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`;
  const dataRes = await fetch(
    `${origin}/api/dashboard-hub/knowledge-health?spaceKey=${spaceKey}`,
    { cache: 'no-store', headers }
  );

  if (!dataRes.ok) {
    return new Response(`Upstream error: ${dataRes.status}`, { status: 502 });
  }
  const data = await dataRes.json() as {
    statusBreakdown?: Slice[];
    space?: { name?: string };
    summary?: { totalPages?: number };
  };

  const slices = data.statusBreakdown ?? [];
  const totalPages = data.summary?.totalPages ?? slices.reduce((s, x) => s + x.value, 0);
  const spaceName = data.space?.name ?? spaceKey;

  const svg = renderPie(slices, `${totalPages} pages`, spaceName);

  return new Response(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
