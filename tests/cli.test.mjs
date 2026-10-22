// CLI スクリプト（fetch-radar.mjs / targets-from-cloudflare-zone.mjs）を子プロセスで実行し、
// 終了コード・出力ファイル・標準出力を確認する。fetch は tests/helpers/mock-fetch-preload.mjs で差し替える。
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const run = promisify(execFile);
const ROOT = resolve(import.meta.dirname, '..');
const PRELOAD = join(ROOT, 'tests/helpers/mock-fetch-preload.mjs');
const FETCH = join(ROOT, 'attack-map/scripts/fetch-radar.mjs');
const TARGETS = join(ROOT, 'attack-map/scripts/targets-from-cloudflare-zone.mjs');

async function exec(script, args, env) {
  try {
    const r = await run(process.execPath, ['--import', PRELOAD, script, ...args], {
      env: { PATH: process.env.PATH, ...env }, cwd: ROOT,
    });
    return { code: 0, ...r };
  } catch (e) {
    return { code: e.code, stdout: e.stdout, stderr: e.stderr };
  }
}
const exists = (p) => access(p).then(() => true, () => false);

let dir;
before(async () => { dir = await mkdtemp(join(tmpdir(), 'attack-map-test-')); });
after(() => rm(dir, { recursive: true, force: true }));

describe('fetch-radar.mjs', () => {
  test('トークン未設定ならスキップして正常終了し、ファイルを書かない', async () => {
    const out = join(dir, 'skip.json');
    const r = await exec(FETCH, ['--out', out], {});
    assert.equal(r.code, 0);
    assert.match(r.stdout, /CLOUDFLARE_API_TOKEN が未設定/);
    assert.equal(await exists(out), false);
  });

  test('取得したスナップショットを --out に書き出す（ディレクトリも作る）', async () => {
    const out = join(dir, 'nested/dir/latest.json');
    const r = await exec(FETCH, ['--out', out, '--range', '7d'], { CLOUDFLARE_API_TOKEN: 'tok' });
    assert.equal(r.code, 0, r.stderr);
    assert.match(r.stdout, /書き出し/);
    const snap = JSON.parse(await readFile(out, 'utf8'));
    assert.equal(snap.schema, 1);
    assert.equal(snap.dateRange, '7d');
    assert.equal(snap.l7[0].code, 'US');
  });

  test('ATTACK_MAP_RANGE / ATTACK_MAP_TARGET 環境変数を既定値として使う', async () => {
    const out = join(dir, 'env.json');
    const r = await exec(FETCH, ['--out', out], { CLOUDFLARE_API_TOKEN: 'tok', ATTACK_MAP_RANGE: '6h', ATTACK_MAP_TARGET: 'kr' });
    assert.equal(r.code, 0, r.stderr);
    const snap = JSON.parse(await readFile(out, 'utf8'));
    assert.equal(snap.dateRange, '6h');
    assert.equal(snap.target, 'KR');
  });

  test('API が失敗したら終了コード 1 でファイルを書かない', async () => {
    const out = join(dir, 'fail.json');
    const r = await exec(FETCH, ['--out', out], { CLOUDFLARE_API_TOKEN: 'tok', MOCK_FETCH_MODE: 'radar-fail' });
    assert.equal(r.code, 1);
    assert.match(r.stderr, /取得に失敗/);
    assert.equal(await exists(out), false);
  });
});

describe('targets-from-cloudflare-zone.mjs', () => {
  test('ゾーン未設定ならスキップして正常終了', async () => {
    const out = join(dir, 'targets-skip.json');
    const r = await exec(TARGETS, ['--out', out], { CLOUDFLARE_API_TOKEN: 'tok', MOCK_FETCH_MODE: 'graphql' });
    assert.equal(r.code, 0);
    assert.match(r.stdout, /未設定のためスキップ/);
    assert.equal(await exists(out), false);
  });

  test('ゾーンごとの集計をホスト・国・ソース別に合算して書き出す', async () => {
    const out = join(dir, 'targets.json');
    const r = await exec(TARGETS, ['--out', out, '--hours', '12'], {
      CLOUDFLARE_API_TOKEN: 'tok', CLOUDFLARE_ZONE_IDS: 'zone-a, zone-b,zone-missing', MOCK_FETCH_MODE: 'graphql',
    });
    assert.equal(r.code, 0, r.stderr);
    const snap = JSON.parse(await readFile(out, 'utf8'));
    assert.equal(snap.provider, 'cloudflare-zone-firewall');
    assert.equal(snap.windowHours, 12);
    // 2 ゾーン分が合算される（zone-missing は errors に入る）
    assert.deepEqual(snap.targets, [{ host: 'www.example.jp', count: 240 }, { host: '(不明)', count: 10 }]);
    assert.deepEqual(snap.countries, [{ code: 'US', count: 200 }, { code: 'CN', count: 50 }]);
    assert.deepEqual(snap.sources, [{ source: 'waf/block', count: 250 }]);
    assert.equal(snap.errors.length, 1);
    assert.match(snap.errors[0], /zone-missing/);
  });

  test('--hours は 1〜72 に丸める', async () => {
    const out = join(dir, 'targets-hours.json');
    const r = await exec(TARGETS, ['--out', out, '--hours', '500'], {
      CLOUDFLARE_API_TOKEN: 'tok', CLOUDFLARE_ZONE_IDS: 'zone-a', MOCK_FETCH_MODE: 'graphql',
    });
    assert.equal(r.code, 0, r.stderr);
    assert.equal(JSON.parse(await readFile(out, 'utf8')).windowHours, 72);
  });

  test('全ゾーンで失敗したら終了コード 1', async () => {
    const out = join(dir, 'targets-fail.json');
    const r = await exec(TARGETS, ['--out', out], {
      CLOUDFLARE_API_TOKEN: 'tok', CLOUDFLARE_ZONE_IDS: 'zone-a', MOCK_FETCH_MODE: 'graphql-fail',
    });
    assert.equal(r.code, 1);
    assert.match(r.stderr, /zone not authorized/);
    assert.equal(await exists(out), false);
  });
});
