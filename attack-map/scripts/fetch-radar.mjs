#!/usr/bin/env node
// Cloudflare Radar からスナップショットを取得して JSON に書き出す（GitHub Actions / ローカル実行用）。
//   CLOUDFLARE_API_TOKEN=... node attack-map/scripts/fetch-radar.mjs --out attack-map/data/latest.json --range 1d
// トークンが未設定のときは何もせず正常終了する（Actions を導入直後に失敗させないため）。
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { buildSnapshot } from './radar-lib.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] ? args[i + 1] : def; };
const out = opt('--out', 'attack-map/data/latest.json');
const range = opt('--range', process.env.ATTACK_MAP_RANGE || '1d');
const target = opt('--target', process.env.ATTACK_MAP_TARGET || 'JP');
const token = process.env.CLOUDFLARE_API_TOKEN || '';

if (!token) {
  console.log('CLOUDFLARE_API_TOKEN が未設定のためスキップしました。リポジトリの Secrets に設定するとライブデータが有効になります。');
  process.exit(0);
}
try {
  const snap = await buildSnapshot(token, range, { target });
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(snap, null, 1) + '\n');
  const top = (snap.l7 || snap.l3 || []).slice(0, 5).map((x) => `${x.code} ${x.share.toFixed(1)}%`).join(', ');
  console.log(`書き出し: ${out}  (${range}, L7 ${snap.l7 ? snap.l7.length : '-'} 件 / L3 ${snap.l3 ? snap.l3.length : '-'} 件)  上位: ${top}`);
  if (snap.errors.length) console.warn('警告:', snap.errors.join(' / '));
} catch (e) {
  console.error('取得に失敗しました:', e.message);
  process.exit(1);
}
