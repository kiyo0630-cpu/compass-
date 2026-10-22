// Cloudflare Worker（attack-map/worker/radar-proxy.js）のテスト。
// caches.default と fetch を差し替えて Worker ランタイム無しで動かす。
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installMockFetch } from './helpers/radar-fixtures.mjs';

function fakeCache() {
  const store = new Map();
  return {
    store,
    async match(req) { return store.get(req.url)?.clone() ?? undefined; },
    async put(req, res) { store.set(req.url, res); },
  };
}

let mock, cache, worker;
beforeEach(async () => {
  cache = fakeCache();
  globalThis.caches = { default: cache };
  mock = installMockFetch();
  worker = (await import('../attack-map/worker/radar-proxy.js')).default;
});
afterEach(() => { mock.restore(); delete globalThis.caches; });

const env = { CLOUDFLARE_API_TOKEN: 'tok' };
const get = (qs = '', headers = {}) => new Request(`https://proxy.example.workers.dev/${qs}`, { headers });

describe('radar-proxy worker', () => {
  test('OPTIONS は 204 で CORS ヘッダーを返す', async () => {
    const res = await worker.fetch(new Request('https://proxy.example.workers.dev/', { method: 'OPTIONS' }), env);
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('Access-Control-Allow-Origin'), '*');
    assert.equal(res.headers.get('Access-Control-Allow-Methods'), 'GET, OPTIONS');
  });

  test('GET 以外は 405', async () => {
    const res = await worker.fetch(new Request('https://proxy.example.workers.dev/', { method: 'POST' }), env);
    assert.equal(res.status, 405);
  });

  test('GET でスナップショット JSON を返し、キャッシュに保存する', async () => {
    const res = await worker.fetch(get('?dateRange=6h&target=jp'), env);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('X-Cache'), 'MISS');
    assert.match(res.headers.get('Content-Type'), /application\/json/);
    const body = await res.json();
    assert.equal(body.dateRange, '6h');
    assert.equal(body.target, 'JP');
    assert.equal(body.l7[0].code, 'US');
    assert.equal(cache.store.size, 1);
    assert.ok([...cache.store.keys()][0].includes('dateRange=6h&target=JP'));
  });

  test('2 回目は Radar を呼ばずキャッシュから返す', async () => {
    await worker.fetch(get('?dateRange=1d'), env);
    const before = mock.calls.length;
    const res = await worker.fetch(get('?dateRange=1d'), env);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('X-Cache'), 'HIT');
    assert.equal(mock.calls.length, before);
    assert.equal((await res.json()).dateRange, '1d');
  });

  test('不正な dateRange / target は既定値（1d / JP）に丸める', async () => {
    const res = await worker.fetch(get('?dateRange=99d&target=japan'), env);
    const body = await res.json();
    assert.equal(body.dateRange, '1d');
    assert.equal(body.target, 'JP');
  });

  test('ALLOWED_ORIGIN に一致するオリジンだけをそのまま返す', async () => {
    const e = { ...env, ALLOWED_ORIGIN: 'https://a.example, https://b.example' };
    const ok = await worker.fetch(get('', { Origin: 'https://b.example' }), e);
    assert.equal(ok.headers.get('Access-Control-Allow-Origin'), 'https://b.example');
    const ng = await worker.fetch(get('', { Origin: 'https://evil.example' }), e);
    assert.equal(ng.headers.get('Access-Control-Allow-Origin'), 'https://a.example');
    assert.equal(ng.headers.get('Vary'), 'Origin');
  });

  test('Radar がすべて失敗したら 502 と error を返す', async () => {
    mock.restore();
    mock = installMockFetch({ '/radar/attacks': new Error('Authentication error') });
    const res = await worker.fetch(get(), env);
    assert.equal(res.status, 502);
    assert.match((await res.json()).error, /Authentication error/);
    assert.equal(cache.store.size, 0);
  });

  test('トークン未設定なら 502', async () => {
    const res = await worker.fetch(get(), {});
    assert.equal(res.status, 502);
    assert.match((await res.json()).error, /CLOUDFLARE_API_TOKEN/);
  });
});
