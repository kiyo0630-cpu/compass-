#!/usr/bin/env node
// フィード履歴（attack-map/data/history/）の管理 CLI。
//
//   node attack-map/scripts/history.mjs append   [--in attack-map/data/latest.json] [--dir attack-map/data/history]
//   node attack-map/scripts/history.mjs backfill [--dir ...] [--path attack-map/data/latest.json]
//   node attack-map/scripts/history.mjs rebuild  [--dir ...]
//
// append   : latest.json を 1 行の JSON に圧縮して当月の YYYY-MM.jsonl に追記し、index.json と daily.csv を更新する。
//            同じ generatedAt の行がすでにあれば何もしない（GitHub Actions が毎時呼んでも重複しない）。
// backfill : git の履歴にある latest.json の全バージョンを取り込む（初回導入時・取りこぼしの復旧用）。
// rebuild  : jsonl から index.json と daily.csv を作り直す。
//
// 履歴フォーマットの説明は attack-map/README.md の「フィード履歴」を参照。
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

export const HISTORY_SCHEMA = 1;
const SHARE_DIGITS = 3;

const args = process.argv.slice(2);
const cmd = args[0] && !args[0].startsWith('--') ? args[0] : 'append';
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] ? args[i + 1] : def; };
const dir = opt('--dir', 'attack-map/data/history');
const input = opt('--in', 'attack-map/data/latest.json');
const gitPath = opt('--path', 'attack-map/data/latest.json');

const round = (v) => Number(Number(v).toFixed(SHARE_DIGITS));
const pairs = (list, key) => Array.isArray(list)
  ? list.filter((x) => x && Number.isFinite(Number(x.share))).map((x) => [String(x[key]), round(x.share)])
  : null;

/** latest.json（スナップショット）を履歴 1 行の形に圧縮する */
export function compactSnapshot(snap) {
  if (!snap || !snap.generatedAt) throw new Error('generatedAt がありません');
  const t = new Date(snap.generatedAt);
  if (Number.isNaN(t.getTime())) throw new Error(`generatedAt が不正です: ${snap.generatedAt}`);
  const row = {
    t: t.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    target: String(snap.target || 'JP').toUpperCase(),
    range: String(snap.dateRange || '1d'),
    l7: pairs(snap.l7, 'code'),
    l3: pairs(snap.l3, 'code'),
    industries: pairs(snap.industries, 'name'),
    verticals: pairs(snap.verticals, 'name'),
    industriesL3: pairs(snap.industriesL3, 'name'),
    verticalsL3: pairs(snap.verticalsL3, 'name'),
    updated: {
      l7: snap.meta?.l7?.lastUpdated || null,
      l3: snap.meta?.l3?.lastUpdated || null,
    },
    errors: Array.isArray(snap.errors) ? snap.errors.length : 0,
  };
  // 時系列（相対値）は窓が重なるので全点は保存せず、ピーク時刻だけ残す
  if (snap.series && Array.isArray(snap.series.values) && snap.series.values.length) {
    let bi = 0;
    snap.series.values.forEach((v, i) => { if (Number(v) > Number(snap.series.values[bi])) bi = i; });
    row.l7PeakAt = snap.series.timestamps?.[bi] || null;
  }
  return row;
}

const monthOf = (iso) => iso.slice(0, 7);
const fileOf = (iso) => `${monthOf(iso)}.jsonl`;

async function readRows(file) {
  if (!existsSync(file)) return [];
  const text = await readFile(file, 'utf8');
  return text.split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
}
async function listMonthFiles() {
  if (!existsSync(dir)) return [];
  return (await readdir(dir)).filter((f) => /^\d{4}-\d{2}\.jsonl$/.test(f)).sort();
}
async function readAllRows() {
  const all = [];
  for (const f of await listMonthFiles()) all.push(...await readRows(join(dir, f)));
  return all.sort((a, b) => a.t.localeCompare(b.t));
}

/** 行を追加する。すでに同じ t があれば false */
async function appendRows(rows) {
  await mkdir(dir, { recursive: true });
  const byFile = new Map();
  for (const r of rows) { const f = fileOf(r.t); if (!byFile.has(f)) byFile.set(f, []); byFile.get(f).push(r); }
  let added = 0;
  for (const [f, list] of byFile) {
    const file = join(dir, f);
    const existing = await readRows(file);
    const seen = new Set(existing.map((r) => r.t));
    const fresh = list.filter((r) => !seen.has(r.t) && seen.add(r.t));
    if (!fresh.length) continue;
    const merged = existing.concat(fresh).sort((a, b) => a.t.localeCompare(b.t));
    await writeFile(file, merged.map((r) => JSON.stringify(r)).join('\n') + '\n');
    added += fresh.length;
  }
  return added;
}

// 日本時間の日付（YYYY-MM-DD）
const jstDate = (iso) => new Date(new Date(iso).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);

/** index.json（月ファイル一覧）と daily.csv（JST 日別・国別の集計）を書き直す */
async function writeDerived() {
  const files = await listMonthFiles();
  const months = [];
  const all = [];
  for (const f of files) {
    const rows = await readRows(join(dir, f));
    if (!rows.length) continue;
    months.push({ file: f, month: f.slice(0, 7), count: rows.length, first: rows[0].t, last: rows[rows.length - 1].t });
    all.push(...rows);
  }
  all.sort((a, b) => a.t.localeCompare(b.t));
  const index = {
    schema: HISTORY_SCHEMA,
    updatedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    total: all.length,
    first: all[0]?.t || null,
    last: all[all.length - 1]?.t || null,
    months,
    files: { daily: 'daily.csv' },
  };
  await writeFile(join(dir, 'index.json'), JSON.stringify(index, null, 1) + '\n');

  // daily.csv: date(JST), layer(l7|l3), code, share_avg, share_min, share_max, snapshots
  const agg = new Map();
  const perDay = new Map();
  for (const r of all) {
    const d = jstDate(r.t);
    perDay.set(d, (perDay.get(d) || 0) + 1);
    for (const layer of ['l7', 'l3']) {
      for (const [code, share] of r[layer] || []) {
        const k = `${d}\t${layer}\t${code}`;
        const a = agg.get(k) || { sum: 0, min: Infinity, max: -Infinity, n: 0 };
        a.sum += share; a.min = Math.min(a.min, share); a.max = Math.max(a.max, share); a.n++;
        agg.set(k, a);
      }
    }
  }
  const lines = ['date,layer,code,share_avg,share_min,share_max,snapshots'];
  for (const k of [...agg.keys()].sort()) {
    const [d, layer, code] = k.split('\t');
    const a = agg.get(k);
    // その日の全スナップショット数で平均する（ランキング圏外＝0% とみなす）
    const n = perDay.get(d);
    lines.push(`${d},${layer},${code},${(a.sum / n).toFixed(3)},${(a.n < n ? 0 : a.min).toFixed(3)},${a.max.toFixed(3)},${a.n}`);
  }
  await writeFile(join(dir, 'daily.csv'), lines.join('\n') + '\n');
  return index;
}

async function main() {
  if (cmd === 'append') {
    if (!existsSync(input)) { console.log(`${input} が無いためスキップしました`); return; }
    const snap = JSON.parse(await readFile(input, 'utf8'));
    const row = compactSnapshot(snap);
    const added = await appendRows([row]);
    // 追加が無いときは index.json を書き直さない（updatedAt だけ変わって毎時コミットされるのを防ぐ）
    if (!added && existsSync(join(dir, 'index.json'))) { console.log(`履歴に追加なし（${row.t} は保存済み）`); return; }
    const index = await writeDerived();
    console.log(`履歴に追加: ${row.t} → ${fileOf(row.t)} / 合計 ${index.total} 件`);
  } else if (cmd === 'backfill') {
    const shas = execFileSync('git', ['log', '--format=%H', '--', gitPath], { encoding: 'utf8' }).split('\n').filter(Boolean);
    const rows = [];
    for (const sha of shas) {
      try {
        const text = execFileSync('git', ['show', `${sha}:${gitPath}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
        rows.push(compactSnapshot(JSON.parse(text)));
      } catch (e) { console.warn(`スキップ ${sha.slice(0, 7)}: ${e.message}`); }
    }
    const added = await appendRows(rows);
    const index = await writeDerived();
    console.log(`git 履歴 ${shas.length} 版のうち ${added} 件を追加 / 合計 ${index.total} 件`);
  } else if (cmd === 'rebuild') {
    const index = await writeDerived();
    console.log(`index.json と daily.csv を再生成しました / 合計 ${index.total} 件`);
  } else {
    console.error(`不明なコマンド: ${cmd}`);
    process.exit(2);
  }
}

if (process.argv[1] && /history\.mjs$/.test(process.argv[1])) {
  main().catch((e) => { console.error('失敗:', e.message); process.exit(1); });
}
