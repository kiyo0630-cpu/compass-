import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { buildSnapshot, DATE_RANGES } from '../attack-map/scripts/radar-lib.mjs';
import { installMockFetch, defaultRoutes, API_ERROR } from './helpers/radar-fixtures.mjs';

let mock;
afterEach(() => mock?.restore());

describe('buildSnapshot', () => {
  test('Radar の応答を正規化してスナップショットにする', async () => {
    mock = installMockFetch();
    const snap = await buildSnapshot('tok', '1d');

    assert.equal(snap.schema, 1);
    assert.equal(snap.provider, 'cloudflare-radar');
    assert.equal(snap.target, 'JP');
    assert.equal(snap.dateRange, '1d');
    assert.ok(!Number.isNaN(Date.parse(snap.generatedAt)));
    assert.deepEqual(snap.errors, []);

    // 国コードは大文字化、share は数値化、share 降順。不正な code / 数値でない value は除外
    assert.deepEqual(snap.l7.map((x) => x.code), ['US', 'CN', 'NL']);
    assert.deepEqual(snap.l7[0], { code: 'US', name: 'United States', share: 23.88, rank: 1 });
    assert.deepEqual(snap.l3, [{ code: 'VN', name: 'Vietnam', share: 40.1, rank: 1 }]);

    assert.deepEqual(snap.series, { timestamps: ['2026-10-21T00:00:00Z', '2026-10-21T01:00:00Z'], values: [0.5, 1.25] });

    // 業種・分野は名前なしを除外し share 降順
    assert.deepEqual(snap.industries, [{ name: 'Finance', share: 50 }, { name: 'Gaming', share: 34.2 }]);
    assert.deepEqual(snap.verticalsL3, snap.industries);
    assert.ok(snap.meta.l7.dateRange);
  });

  test('API には Bearer トークンと location / dateRange / limit を付けて 7 回呼ぶ', async () => {
    mock = installMockFetch();
    await buildSnapshot('secret-token', '7d', { target: 'us', limit: 5 });

    assert.equal(mock.calls.length, 7);
    for (const c of mock.calls) {
      assert.equal(c.headers.Authorization, 'Bearer secret-token');
      const u = new URL(c.url);
      assert.equal(u.searchParams.get('location'), 'US');
      assert.equal(u.searchParams.get('dateRange'), '7d');
    }
    const top = mock.calls.find((c) => c.url.includes('/layer7/top/locations/origin'));
    assert.equal(new URL(top.url).searchParams.get('limit'), '5');
  });

  test('不正な dateRange は 1d に丸める', async () => {
    mock = installMockFetch();
    const snap = await buildSnapshot('tok', '99d');
    assert.equal(snap.dateRange, '1d');
    assert.ok(DATE_RANGES.includes('1d'));
  });

  test('トークンが無ければ例外', async () => {
    await assert.rejects(() => buildSnapshot('', '1d'), /CLOUDFLARE_API_TOKEN/);
  });

  test('一部のエンドポイントが失敗しても L7 か L3 が取れれば成功し、errors に記録する', async () => {
    const routes = defaultRoutes();
    routes['/layer3/top/locations/origin'] = new Error('rate limited');
    routes['/layer7/timeseries'] = '<html>not json</html>';
    mock = installMockFetch(routes);
    const snap = await buildSnapshot('tok', '1d');

    assert.equal(snap.l3, null);
    assert.equal(snap.series, null);
    assert.equal(snap.meta.l3, null);
    assert.ok(snap.l7.length > 0);
    assert.equal(snap.errors.length, 2);
    assert.match(snap.errors.join(' '), /rate limited/);
    assert.match(snap.errors.join(' '), /JSON ではない応答/);
  });

  test('L7 と L3 の両方が失敗したら例外（エラーメッセージを連結）', async () => {
    const routes = defaultRoutes();
    routes['/layer7/top/locations/origin'] = new Error(API_ERROR.errors[0].message);
    routes['/layer3/top/locations/origin'] = new Error('boom');
    mock = installMockFetch(routes);
    await assert.rejects(() => buildSnapshot('tok', '1d'), (e) => /Authentication error/.test(e.message) && /boom/.test(e.message));
  });
});
