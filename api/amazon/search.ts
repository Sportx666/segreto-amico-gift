import type { VercelRequest, VercelResponse } from '@vercel/node';

type Item = {
  asin: string; title: string; image: string;
  price: number | null; currency: string | null;
  url: string; lastUpdated: string;
};

let mockCache: Item[] | null = null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const enabled = String(process.env.AMAZON_API_ENABLED || 'false').toLowerCase() === 'true';
  const { q = '', page = 1 } = (req.body || {}) as { q?: string; page?: number };
  const query = (q || '').trim();
  if (!query) return res.status(400).json({ error: 'Missing q' });

  // MOCK-FIRST (default) — load once via ESM dynamic import
  if (!enabled) {
    try {
      if (!mockCache) {
        const mod = await import('./mock.mjs');
        mockCache = (mod.default ?? []) as Item[];
      }
    } catch {
      // tiny fallback if import fails for any reason
      mockCache = [{
        asin: 'FALLBACK001',
        title: 'Esempio regalo',
        image: 'https://via.placeholder.com/400?text=Regalo',
        price: 9.99, currency: 'EUR',
        url: 'https://www.amazon.it/s?k=regalo',
        lastUpdated: new Date().toISOString(),
      }];
    }
    const all = mockCache!;
    const filtered = all.filter(i => i.title.toLowerCase().includes(query.toLowerCase()));
    const pageSize = 10;
    const start = (Number(page) - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);
    return res.status(200).json({ items, total: filtered.length, page: Number(page), pageSize, mock: true });
  }

  // TODO: enable PA-API 5.0 (server-side only) when AMAZON_API_ENABLED=true
  return res.status(501).json({ error: 'PA-API integration not implemented yet' });
}
// import mockData from './mock.json';  // <-- Use this if using "resolveJsonModule" in tsconfig.json