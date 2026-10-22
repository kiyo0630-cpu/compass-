// GitHub Actions がコミットする attack-map/data/*.json が、ページ（index.html）の期待する形かを確認する。
// ファイルが無い（初回実行前）場合はスキップする。
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
async function loadJson(rel) {
  try { return JSON.parse(await readFile(resolve(ROOT, rel), 'utf8')); } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
}
const isCode = (c) => /^[A-Z0-9]{2}$/.test(c);

describe('attack-map/data/latest.json', async () => {
  const snap = await loadJson('attack-map/data/latest.json');
  test('スナップショットの形式（schema 1）', { skip: snap ? false : 'latest.json がまだ無い' }, () => {
    assert.equal(snap.schema, 1);
    assert.equal(snap.provider, 'cloudflare-radar');
    assert.match(snap.target, /^[A-Z]{2}$/);
    assert.ok(!Number.isNaN(Date.parse(snap.generatedAt)), 'generatedAt は ISO 日時');
    assert.ok(Array.isArray(snap.l7) || Array.isArray(snap.l3), 'l7 か l3 のどちらかは配列');
    for (const key of ['l7', 'l3']) {
      if (!Array.isArray(snap[key])) continue;
      for (const row of snap[key]) {
        assert.ok(isCode(row.code), `${key}: code が alpha-2 でない: ${row.code}`);
        assert.ok(Number.isFinite(row.share) && row.share >= 0 && row.share <= 100, `${key}: share が 0〜100 でない: ${row.share}`);
      }
      const shares = snap[key].map((r) => r.share);
      assert.deepEqual(shares, [...shares].sort((a, b) => b - a), `${key}: share 降順でない`);
    }
    if (snap.series) {
      assert.equal(snap.series.timestamps.length, snap.series.values.length, 'series の長さが一致');
      assert.ok(snap.series.values.every(Number.isFinite));
    }
    for (const key of ['industries', 'verticals', 'industriesL3', 'verticalsL3']) {
      if (!Array.isArray(snap[key])) continue;
      for (const row of snap[key]) {
        assert.equal(typeof row.name, 'string');
        assert.ok(Number.isFinite(row.share));
      }
    }
    assert.ok(Array.isArray(snap.errors));
  });
});

describe('attack-map/data/targets.json', async () => {
  const snap = await loadJson('attack-map/data/targets.json');
  test('ゾーン集計の形式', { skip: snap ? false : 'targets.json は任意（CLOUDFLARE_ZONE_IDS 設定時のみ）' }, () => {
    assert.equal(snap.provider, 'cloudflare-zone-firewall');
    for (const t of snap.targets) { assert.equal(typeof t.host, 'string'); assert.ok(Number.isFinite(t.count)); }
    for (const c of snap.countries) { assert.ok(isCode(c.code)); assert.ok(Number.isFinite(c.count)); }
  });
});

describe('attack-map/data/countries-110m.json', async () => {
  const topo = await loadJson('attack-map/data/countries-110m.json');
  test('world-atlas の TopoJSON', { skip: topo ? false : 'countries-110m.json がまだ無い' }, () => {
    assert.equal(topo.type, 'Topology');
    assert.ok(topo.objects?.countries?.geometries?.length > 100);
  });
});
