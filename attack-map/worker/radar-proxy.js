// Cloudflare Worker: ブラウザから Cloudflare Radar API を安全に呼ぶための小さなプロキシ。
// API トークンはブラウザに置かず、Worker の Secret（CLOUDFLARE_API_TOKEN）として保持する。
//
// デプロイ（Node.js と wrangler が必要）:
//   cd attack-map/worker
//   npx wrangler deploy
//   npx wrangler secret put CLOUDFLARE_API_TOKEN
// （任意）許可するページのオリジンを絞る:  npx wrangler secret put ALLOWED_ORIGIN  → 例 https://kiyo0630-cpu.github.io
//
// 使い方: GET https://<worker>.workers.dev/?dateRange=1d  → index.html が読む JSON スナップショットを返す
import { buildSnapshot, DATE_RANGES } from '../scripts/radar-lib.mjs';

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = env.ALLOWED_ORIGIN ? env.ALLOWED_ORIGIN.split(',').map((s) => s.trim()) : ['*'];
    const allowOrigin = allowed.includes('*') ? '*' : (allowed.includes(origin) ? origin : allowed[0]);
    const cors = {
      'Access-Control-Allow-Origin': allowOrigin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'GET') return new Response('Method Not Allowed', { status: 405, headers: cors });

    const url = new URL(request.url);
    const dateRange = DATE_RANGES.includes(url.searchParams.get('dateRange')) ? url.searchParams.get('dateRange') : '1d';
    const target = /^[A-Z]{2}$/i.test(url.searchParams.get('target') || '') ? url.searchParams.get('target').toUpperCase() : 'JP';

    // Radar の集計は分単位でしか動かないので、同じ条件の応答を 5 分キャッシュしてレート制限を避ける
    const cache = caches.default;
    const cacheKey = new Request(`${url.origin}/snapshot?dateRange=${dateRange}&target=${target}`, { method: 'GET' });
    const hit = await cache.match(cacheKey);
    if (hit) {
      const res = new Response(hit.body, hit);
      for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
      res.headers.set('X-Cache', 'HIT');
      return res;
    }
    try {
      const snap = await buildSnapshot(env.CLOUDFLARE_API_TOKEN, dateRange, { target });
      const res = new Response(JSON.stringify(snap), {
        headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=300', 'X-Cache': 'MISS' },
      });
      await cache.put(cacheKey, res.clone());
      return res;
    } catch (e) {
      return new Response(JSON.stringify({ error: String(e.message || e) }), {
        status: 502, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' },
      });
    }
  },
};
