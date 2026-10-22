#!/usr/bin/env node
// 週次・月次の攻撃トレンドレポートを生成する（Markdown + HTML、依存ライブラリなし）。
//
//   node attack-map/scripts/trend-report.mjs --mode weekly  [--end 2026-10-18]
//   node attack-map/scripts/trend-report.mjs --mode monthly [--month 2026-10]
//   node attack-map/scripts/trend-report.mjs --index            # 一覧ページだけ作り直す
//
// 入力: attack-map/data/latest.json の git 履歴（全スナップショット）。--snapshots-dir で JSON の入った
//       ディレクトリを追加・代替できる（履歴を別途保存している場合）。
// 出力: --out-dir（既定 attack-map/reports）に weekly-YYYY-MM-DD.{md,html} / monthly-YYYY-MM.{md,html} と index.html。
//
// 集計の決め方（過去の手作業レポートと同じ）:
//   - 各 UTC 日の最後のスナップショット（直近 24h 集計）をその日の値とする
//   - 期間の値は日次値の平均。上位 20 件に入らなかった国・業種は 0% とみなす
//   - 急増・急減は前期間との比較、突発はその期間内の中央値との比較で自動検出する
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { countryJa, industryJa } from './names-ja.mjs';

// ---------- 引数 ----------
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] ? args[i + 1] : def; };
const has = (name) => args.includes(name);
const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoDir = resolve(opt('--repo-dir', resolve(scriptDir, '..', '..')));
const feedPath = opt('--feed-path', 'attack-map/data/latest.json');
const outDir = resolve(opt('--out-dir', join(repoDir, 'attack-map', 'reports')));
const snapshotsDir = opt('--snapshots-dir', '');
const mode = opt('--mode', 'weekly');
const indexOnly = has('--index');
const noGit = has('--no-git');

// ---------- 日付ユーティリティ（すべて UTC） ----------
const DAY = 86400000;
const iso = (d) => new Date(d).toISOString().slice(0, 10);
const parseDate = (s) => { const d = new Date(`${s}T00:00:00Z`); if (Number.isNaN(d.getTime())) throw new Error(`日付の形式が不正です: ${s}`); return d; };
const addDays = (d, n) => new Date(d.getTime() + n * DAY);
const mmdd = (s) => `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}`;
const WEEKDAY_JA = ['日', '月', '火', '水', '木', '金', '土'];
const wday = (s) => WEEKDAY_JA[parseDate(s).getUTCDay()];
const fmtPct = (v, digits = 1) => (Number.isFinite(v) ? `${v.toFixed(digits)}%` : '—');
const fmtPt = (v) => (Number.isFinite(v) ? `${v > 0 ? '+' : ''}${v.toFixed(1)}pt` : '—');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- スナップショットの読み込み ----------
async function loadSnapshots() {
  const snaps = new Map(); // generatedAt -> snapshot
  const add = (j) => { if (j && j.generatedAt && (j.l7 || j.l3)) snaps.set(j.generatedAt, j); };
  if (!noGit) {
    let hashes = [];
    try {
      hashes = execFileSync('git', ['log', '--format=%H', '--', feedPath], { cwd: repoDir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
        .split('\n').filter(Boolean);
    } catch (e) {
      console.warn(`git 履歴を読めませんでした（${e.message.split('\n')[0]}）。--snapshots-dir のデータだけを使います。`);
    }
    for (const h of hashes) {
      try { add(JSON.parse(execFileSync('git', ['show', `${h}:${feedPath}`], { cwd: repoDir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }))); } catch { /* 壊れたコミットは無視 */ }
    }
  }
  if (snapshotsDir) {
    for (const f of await readdir(snapshotsDir)) {
      if (!f.endsWith('.json')) continue;
      try { add(JSON.parse(await readFile(join(snapshotsDir, f), 'utf8'))); } catch { /* 無視 */ }
    }
  }
  return [...snaps.values()].sort((a, b) => a.generatedAt.localeCompare(b.generatedAt));
}

// 各 UTC 日の最後のスナップショットを日次値にする
export const DIMENSIONS = {
  l7: { label: 'L7（HTTP DDoS）送信元国', unit: 'リクエスト比', key: 'code', name: countryJa },
  l3: { label: 'L3/4（ネットワーク層 DDoS）送信元国', unit: 'バイト比', key: 'code', name: countryJa },
  industries: { label: '攻撃を受けた業種（L7）', unit: 'リクエスト比', key: 'name', name: (n) => industryJa(n) || n },
  verticals: { label: '攻撃を受けた分野（L7）', unit: 'リクエスト比', key: 'name', name: (n) => industryJa(n) || n },
  industriesL3: { label: '攻撃を受けた業種（L3/4）', unit: 'バイト比', key: 'name', name: (n) => industryJa(n) || n },
};
function toDaily(snaps) {
  const byDay = new Map();
  for (const s of snaps) byDay.set(s.generatedAt.slice(0, 10), s); // 昇順なので最後が残る
  const days = new Map();
  for (const [date, s] of byDay) {
    const d = { date, generatedAt: s.generatedAt, snapshots: snaps.filter((x) => x.generatedAt.startsWith(date)).length };
    for (const [dim, spec] of Object.entries(DIMENSIONS)) {
      const list = Array.isArray(s[dim]) ? s[dim] : null;
      d[dim] = list ? new Map(list.filter((x) => x && Number.isFinite(x.share)).map((x) => [String(x[spec.key]), x.share])) : null;
    }
    days.set(date, d);
  }
  return days;
}

// ---------- 期間集計 ----------
function dateRange(start, end) { const out = []; for (let d = start; d <= end; d = addDays(d, 1)) out.push(iso(d)); return out; }

function aggregate(days, dates) {
  const present = dates.filter((d) => days.has(d));
  const out = { dates, present, dims: {} };
  for (const dim of Object.keys(DIMENSIONS)) {
    const withData = present.filter((d) => days.get(d)[dim]);
    const keys = new Set();
    for (const d of withData) for (const k of days.get(d)[dim].keys()) keys.add(k);
    const items = [];
    for (const k of keys) {
      const series = withData.map((d) => days.get(d)[dim].get(k) || 0);
      const avg = series.reduce((a, b) => a + b, 0) / (series.length || 1);
      let maxI = 0; series.forEach((v, i) => { if (v > series[maxI]) maxI = i; });
      const sorted = [...series].sort((a, b) => a - b);
      const median = sorted.length ? (sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2) : 0;
      items.push({ key: k, avg, max: series[maxI], maxDate: withData[maxI], median, series, days: series.length });
    }
    items.sort((a, b) => b.avg - a.avg);
    out.dims[dim] = { items, byKey: new Map(items.map((x) => [x.key, x])), days: withData };
  }
  return out;
}

// ---------- 急増・急減・突発の自動検出 ----------
export function detectHighlights(cur, prev, opts = {}) {
  const out = [];
  for (const [dim, spec] of Object.entries(DIMENSIONS)) {
    const c = cur.dims[dim]; const p = prev?.dims[dim];
    if (!c || !c.days.length) continue;
    const isL3 = dim === 'l3' || dim === 'industriesL3';
    const keys = new Set([...c.items.map((x) => x.key), ...(p ? p.items.map((x) => x.key) : [])]);
    for (const k of keys) {
      const ci = c.byKey.get(k); const pi = p?.byKey.get(k);
      const ca = ci ? ci.avg : 0; const pa = pi ? pi.avg : 0;
      const name = spec.name(k);
      if (p && p.days.length) {
        const diff = ca - pa; const ratio = pa > 0 ? ca / pa : Infinity;
        if (ca >= 2 && (pa < 0.5 || ratio >= 1.5 || diff >= 3)) {
          const kind = pa < 0.5 ? 'new' : 'up';
          out.push({ dim, key: k, name, kind, cur: ca, prev: pa, diff, ratio, score: diff + (ratio === Infinity ? 5 : Math.min(ratio, 5)), severity: diff >= 5 || ratio >= 2 ? 'high' : 'mid' });
        } else if (pa >= 2 && (ca < 0.5 || pa / ca >= 1.5 || -diff >= 3)) {
          const kind = ca < 0.5 ? 'gone' : 'down';
          out.push({ dim, key: k, name, kind, cur: ca, prev: pa, diff, ratio: ca > 0 ? pa / ca : Infinity, score: -diff + Math.min(ca > 0 ? pa / ca : 5, 5), severity: -diff >= 5 || (ca > 0 ? pa / ca : 5) >= 2 ? 'high' : 'mid' });
        }
      }
      // 期間内の突発（単日スパイク）。L3/4 は少数の大型攻撃で首位が入れ替わるので基準を高くする
      if (ci && ci.days >= 3) {
        const threshold = isL3 ? 50 : Math.max(10, ci.median * 3);
        if (ci.max >= threshold && ci.max >= ci.median * 2) {
          out.push({ dim, key: k, name, kind: 'spike', cur: ci.max, prev: ci.median, date: ci.maxDate, diff: ci.max - ci.median, ratio: ci.median > 0 ? ci.max / ci.median : Infinity, score: (ci.max - ci.median) / 2, severity: ci.max >= (isL3 ? 80 : 20) ? 'high' : 'mid' });
        }
      }
    }
  }
  // 次元ごとに上限を設け、変動の大きい L3/4 がハイライトを占有しないようにする。並びは次元の定義順 → スコア順
  out.sort((a, b) => b.score - a.score);
  const order = Object.keys(DIMENSIONS); const perDim = {};
  return out.filter((h) => (perDim[h.dim] = (perDim[h.dim] || 0) + 1) <= (opts.perDim || 3))
    .sort((a, b) => order.indexOf(a.dim) - order.indexOf(b.dim) || b.score - a.score);
}
const KIND = {
  new: { badge: '新顔', arrow: '↑', ja: '前期間はほぼ 0% から浮上' },
  up: { badge: '急増', arrow: '↑', ja: '前期間比で大きく増加' },
  down: { badge: '急減', arrow: '↓', ja: '前期間比で大きく減少' },
  gone: { badge: '消失', arrow: '↓', ja: '前期間に目立っていたがほぼ消えた' },
  spike: { badge: '突発', arrow: '⚡', ja: '期間内の 1 日だけ突出' },
};
function highlightText(h) {
  const dimLabel = DIMENSIONS[h.dim].label;
  if (h.kind === 'spike') return `${dimLabel}: ${h.name} が ${mmdd(h.date)} に ${fmtPct(h.cur)}（期間中央値 ${fmtPct(h.prev)}）`;
  const down = h.kind === 'down' || h.kind === 'gone';
  const r = h.ratio === Infinity ? '' : down ? `、1/${h.ratio.toFixed(1)}` : `、${h.ratio.toFixed(1)} 倍`;
  return `${dimLabel}: ${h.name} ${fmtPct(h.prev)} → ${fmtPct(h.cur)}（${fmtPt(h.diff)}${r}）`;
}

// ---------- 期間の決定 ----------
function resolvePeriods(days, today) {
  const dates = [...days.keys()].sort();
  if (!dates.length) throw new Error('スナップショットが 1 件もありません');
  const lastComplete = dates.filter((d) => d < iso(today)).pop() || dates[dates.length - 1];
  if (mode === 'weekly') {
    const end = parseDate(opt('--end', lastComplete));
    const start = addDays(end, -6);
    return {
      mode, id: `weekly-${iso(end)}`, title: `週次 攻撃トレンド要約（${mmdd(iso(start))} 〜 ${mmdd(iso(end))}）`,
      cur: dateRange(start, end), prev: dateRange(addDays(start, -7), addDays(end, -7)), curLabel: '今週', prevLabel: '前週',
    };
  }
  if (mode === 'monthly') {
    const m = opt('--month', lastComplete.slice(0, 7));
    if (!/^\d{4}-\d{2}$/.test(m)) throw new Error(`--month は YYYY-MM 形式で指定してください: ${m}`);
    const start = parseDate(`${m}-01`);
    const end = addDays(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)), -1);
    const pStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 1, 1));
    return {
      mode, id: `monthly-${m}`, title: `月次 攻撃トレンドまとめ（${start.getUTCFullYear()} 年 ${start.getUTCMonth() + 1} 月）`,
      cur: dateRange(start, end), prev: dateRange(pStart, addDays(start, -1)), curLabel: '今月', prevLabel: '前月',
    };
  }
  throw new Error(`--mode は weekly か monthly を指定してください: ${mode}`);
}

// ---------- SVG チャート ----------
// 配色は dataviz リファレンスパレット（CVD 検証済みの並び）。CSS 変数で light/dark を切り替える。
const SERIES = 8;
const svgOpen = (w, h, cls = '') => `<svg class="chart ${cls}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" xmlns="http://www.w3.org/2000/svg">`;

// 今期間と前期間の横棒（ペア）。current: slot 1、previous: 無彩色
function pairedBars(items, nameOf, curLabel, prevLabel, opts = {}) {
  const top = items.slice(0, opts.limit || 10);
  if (!top.length) return '<p class="muted">データなし</p>';
  const w = 720, left = 170, right = 70, rowH = 46, barH = 14, gap = 2, topPad = 28;
  const h = topPad + top.length * rowH + 10;
  const maxV = Math.max(1, ...top.flatMap((x) => [x.cur, x.prev || 0])) * 1.08;
  const sx = (v) => left + (v / maxV) * (w - left - right);
  let s = svgOpen(w, h, 'paired');
  // 目盛り
  const step = maxV > 40 ? 10 : maxV > 15 ? 5 : maxV > 6 ? 2 : 1;
  for (let v = 0; v <= maxV; v += step) s += `<line class="grid" x1="${sx(v)}" y1="${topPad - 6}" x2="${sx(v)}" y2="${h - 10}"/><text class="tick" x="${sx(v)}" y="${topPad - 12}" text-anchor="middle">${v}%</text>`;
  top.forEach((x, i) => {
    const y = topPad + i * rowH;
    const name = nameOf(x.key);
    s += `<text class="label" x="${left - 10}" y="${y + barH + 4}" text-anchor="end">${esc(name)}</text>`;
    const wc = Math.max(0, sx(x.cur) - sx(0));
    s += `<rect class="bar s1 hit" x="${sx(0)}" y="${y}" width="${wc.toFixed(1)}" height="${barH}" rx="0" data-tip="${esc(`${name} ${curLabel}: ${fmtPct(x.cur, 2)}`)}"/>`;
    s += `<text class="value" x="${sx(x.cur) + 6}" y="${y + barH - 3}">${fmtPct(x.cur)}</text>`;
    if (x.prev != null) {
      const wp = Math.max(0, sx(x.prev) - sx(0));
      s += `<rect class="bar prev hit" x="${sx(0)}" y="${y + barH + gap + 2}" width="${wp.toFixed(1)}" height="${barH - 4}" data-tip="${esc(`${name} ${prevLabel}: ${fmtPct(x.prev, 2)}`)}"/>`;
      s += `<text class="value muted" x="${sx(x.prev) + 6}" y="${y + barH * 2 - 3}">${fmtPct(x.prev)}</text>`;
    }
  });
  s += '</svg>';
  const legend = `<div class="legend"><span><i class="sw s1"></i>${esc(curLabel)}</span><span><i class="sw prev"></i>${esc(prevLabel)}</span></div>`;
  return legend + s;
}

// 日次の折れ線（上位 N 系列）。前期間も含めて描き、期間境界に縦線を入れる
function dailyLines(dates, seriesList, nameOf, boundaryDate) {
  if (!seriesList.length || dates.length < 2) return '<p class="muted">データなし</p>';
  const w = 720, left = 48, right = 120, top = 20, bottom = 36, h = 260;
  const maxV = Math.max(1, ...seriesList.flatMap((s) => s.values.filter((v) => v != null))) * 1.1;
  const sx = (i) => left + (i / (dates.length - 1)) * (w - left - right);
  const sy = (v) => top + (1 - v / maxV) * (h - top - bottom);
  let s = svgOpen(w, h, 'lines');
  const step = maxV > 40 ? 10 : maxV > 15 ? 5 : maxV > 6 ? 2 : 1;
  for (let v = 0; v <= maxV; v += step) s += `<line class="grid" x1="${left}" y1="${sy(v)}" x2="${w - right}" y2="${sy(v)}"/><text class="tick" x="${left - 6}" y="${sy(v) + 4}" text-anchor="end">${v}%</text>`;
  const every = Math.max(1, Math.ceil(dates.length / 12));
  dates.forEach((d, i) => { if (i % every === 0 || i === dates.length - 1) s += `<text class="tick" x="${sx(i)}" y="${h - bottom + 18}" text-anchor="middle">${mmdd(d)}</text>`; });
  if (boundaryDate) { const bi = dates.indexOf(boundaryDate); if (bi > 0) { const x = (sx(bi) + sx(bi - 1)) / 2; s += `<line class="boundary" x1="${x}" y1="${top}" x2="${x}" y2="${h - bottom}"/>`; } }
  const ends = []; // 終端ラベルの位置（衝突回避用）
  seriesList.forEach((ser, si) => {
    const pts = ser.values.map((v, i) => (v == null ? null : [sx(i), sy(v)]));
    let d = ''; let pen = false;
    pts.forEach((p) => { if (!p) { pen = false; return; } d += `${pen ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`; pen = true; });
    s += `<path class="line s${si + 1}" d="${d}"/>`;
    pts.forEach((p, i) => { if (p) s += `<circle class="dot s${si + 1} hit" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4" data-tip="${esc(`${mmdd(dates[i])} ${nameOf(ser.key)}: ${fmtPct(ser.values[i], 2)}`)}"/>`; });
    const last = [...pts].reverse().find(Boolean);
    if (last) ends.push({ si, x: last[0], y: last[1], ly: last[1], name: nameOf(ser.key) });
  });
  // 近接するラベルを上下に 13px ずつ離し、線の終端から引き出し線でつなぐ
  ends.sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) ends[i].ly = Math.max(ends[i].ly, ends[i - 1].ly + 13);
  for (let i = ends.length - 2; i >= 0; i--) ends[i].ly = Math.min(ends[i].ly, ends[i + 1].ly - 13);
  for (const e of ends) {
    s += `<line class="leader" x1="${(e.x + 5).toFixed(1)}" y1="${e.y.toFixed(1)}" x2="${w - right + 6}" y2="${e.ly.toFixed(1)}"/>`;
    s += `<text class="label" x="${w - right + 9}" y="${(e.ly + 4).toFixed(1)}">${esc(e.name)}</text>`;
  }
  s += '</svg>';
  const legend = `<div class="legend">${seriesList.map((ser, i) => `<span><i class="sw s${i + 1}"></i>${esc(nameOf(ser.key))}</span>`).join('')}</div>`;
  return legend + s;
}

// 日別の 100% 積み上げ棒（L3/4 向け）。上位 7 + その他
function stackedDaily(dates, days, dim, nameOf, limit = 7) {
  const avail = dates.filter((d) => days.get(d)?.[dim]);
  if (!avail.length) return '<p class="muted">データなし</p>';
  const total = new Map();
  for (const d of avail) for (const [k, v] of days.get(d)[dim]) total.set(k, (total.get(k) || 0) + v);
  const keys = [...total.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map((x) => x[0]);
  const w = 720, left = 48, right = 16, top = 16, bottom = 36, h = 240;
  const slot = (w - left - right) / dates.length; const barW = Math.min(24, slot - 6);
  const sy = (v) => top + (1 - v / 100) * (h - top - bottom);
  let s = svgOpen(w, h, 'stacked');
  for (let v = 0; v <= 100; v += 25) s += `<line class="grid" x1="${left}" y1="${sy(v)}" x2="${w - right}" y2="${sy(v)}"/><text class="tick" x="${left - 6}" y="${sy(v) + 4}" text-anchor="end">${v}%</text>`;
  const every = Math.max(1, Math.ceil(dates.length / 12));
  dates.forEach((d, i) => {
    const x = left + i * slot + (slot - barW) / 2;
    if (i % every === 0 || i === dates.length - 1) s += `<text class="tick" x="${x + barW / 2}" y="${h - bottom + 18}" text-anchor="middle">${mmdd(d)}</text>`;
    const m = days.get(d)?.[dim]; if (!m) return;
    let acc = 0; const segs = keys.map((k) => [k, m.get(k) || 0]);
    const other = Math.max(0, [...m.values()].reduce((a, b) => a + b, 0) - segs.reduce((a, b) => a + b[1], 0));
    segs.push(['__other', other]);
    segs.forEach(([k, v], si) => {
      if (v <= 0) return;
      const y0 = sy(acc + v), y1 = sy(acc); acc += v;
      const hh = Math.max(0, y1 - y0 - 2);
      const name = k === '__other' ? 'その他' : nameOf(k);
      s += `<rect class="bar ${k === '__other' ? 'other' : `s${si + 1}`} hit" x="${x.toFixed(1)}" y="${(y0 + 1).toFixed(1)}" width="${barW.toFixed(1)}" height="${hh.toFixed(1)}" data-tip="${esc(`${mmdd(d)} ${name}: ${fmtPct(v)}`)}"/>`;
    });
  });
  s += '</svg>';
  const legend = `<div class="legend">${keys.map((k, i) => `<span><i class="sw s${i + 1}"></i>${esc(nameOf(k))}</span>`).join('')}<span><i class="sw other"></i>その他</span></div>`;
  return legend + s;
}

// ---------- レポート本体 ----------
function buildReport(days, period, meta) {
  const cur = aggregate(days, period.cur);
  const prev = aggregate(days, period.prev);
  const highlights = detectHighlights(cur, prev);
  const nameOf = (dim) => DIMENSIONS[dim].name;
  const topTable = (dim, limit) => cur.dims[dim].items.slice(0, limit).map((x, i) => ({
    rank: i + 1, key: x.key, name: nameOf(dim)(x.key), cur: x.avg, prev: prev.dims[dim].byKey.get(x.key)?.avg ?? (prev.dims[dim].days.length ? 0 : null),
    max: x.max, maxDate: x.maxDate,
  }));
  const l7 = topTable('l7', 10), l3 = topTable('l3', 8), ind = topTable('industries', 8), ver = topTable('verticals', 6), ind3 = topTable('industriesL3', 5);
  const prevHas = prev.present.length > 0;
  const firstData = [...period.prev, ...period.cur].find((d) => days.has(d)) || period.cur[0];
  const allDates = [...period.prev, ...period.cur].filter((d) => d >= firstData && d <= period.cur[0] || d >= period.cur[0]);
  const lineKeys = cur.dims.l7.items.slice(0, 5).map((x) => x.key);
  const lineSeries = lineKeys.map((k) => ({ key: k, values: allDates.map((d) => (days.get(d)?.l7 ? days.get(d).l7.get(k) || 0 : null)) }));
  const l3Leaders = period.cur.filter((d) => days.get(d)?.l3).map((d) => {
    const sorted = [...days.get(d).l3.entries()].sort((a, b) => b[1] - a[1]);
    return { date: d, first: sorted[0], second: sorted[1] };
  });
  // 月次用: 7 日ごとの週平均（L7 上位 5）
  let weeks = null;
  if (period.mode === 'monthly') {
    weeks = [];
    for (let i = 0; i < period.cur.length; i += 7) {
      const chunk = period.cur.slice(i, i + 7);
      const agg = aggregate(days, chunk);
      weeks.push({ label: `${mmdd(chunk[0])}〜${mmdd(chunk[chunk.length - 1])}`, days: agg.present.length, agg });
    }
  }
  const arrow = (c, p) => (p == null ? '' : c - p >= 1 ? '↑' : p - c >= 1 ? '↓' : '→');
  const delta = (c, p) => (p == null ? '—' : `${arrow(c, p)} ${fmtPt(c - p)}`);
  const cov = `${cur.present.length}/${period.cur.length} 日`;
  const covPrev = prevHas ? `${prev.present.length}/${period.prev.length} 日` : 'なし';
  const srcLine = `データ: ${meta.snapshotCount} スナップショット（${meta.first.slice(0, 16).replace('T', ' ')}Z 〜 ${meta.last.slice(0, 16).replace('T', ' ')}Z）、各 UTC 日の最後の 24h 集計を日次値として平均。${period.curLabel}の実データ ${cov}、${period.prevLabel} ${covPrev}。`;

  // ---- Markdown ----
  let md = `# ${period.title}\n\n`;
  md += `対象: 日本を標的（宛先）とする攻撃の送信元国シェア（Cloudflare Radar、IP 地理情報ベース）\n${srcLine}\n生成: ${meta.generatedAt.slice(0, 16).replace('T', ' ')}Z（自動生成: attack-map/scripts/trend-report.mjs）\n\n`;
  md += `## ハイライト（自動検出）\n`;
  if (!highlights.length) md += `- 前${period.mode === 'weekly' ? '週' : '月'}から大きな変化はありません。\n`;
  for (const h of highlights.slice(0, 15)) md += `- ${KIND[h.kind].arrow} **${KIND[h.kind].badge}** ${highlightText(h)}\n`;
  md += `\n## ${DIMENSIONS.l7.label} 上位 10（${period.curLabel}平均、${DIMENSIONS.l7.unit}）\n| 順位 | 国 | ${period.curLabel} | ${period.prevLabel} | 変化 | 最大日 |\n|---|---|---|---|---|---|\n`;
  for (const r of l7) md += `| ${r.rank} | ${r.name} | ${fmtPct(r.cur)} | ${fmtPct(r.prev)} | ${delta(r.cur, r.prev)} | ${mmdd(r.maxDate)} ${fmtPct(r.max)} |\n`;
  md += `\n## ${DIMENSIONS.l3.label}（${DIMENSIONS.l3.unit}）\n${period.curLabel}平均: ${l3.map((r) => `${r.name} ${fmtPct(r.cur)}`).join('、')}\n\n| 日 | 首位 | シェア | 2 位 |\n|---|---|---|---|\n`;
  for (const r of l3Leaders) md += `| ${mmdd(r.date)}(${wday(r.date)}) | ${r.first ? countryJa(r.first[0]) : '—'} | ${r.first ? fmtPct(r.first[1], 0) : '—'} | ${r.second ? `${countryJa(r.second[0])} ${fmtPct(r.second[1], 0)}` : '—'} |\n`;
  md += `\nL3/4 は少数の大型攻撃に左右されるため、日単位で首位が入れ替わる。\n`;
  md += `\n## ${DIMENSIONS.industries.label}（${period.curLabel}平均）\n| 業種 | ${period.curLabel} | ${period.prevLabel} | 変化 | 最大日 |\n|---|---|---|---|---|\n`;
  for (const r of ind) md += `| ${r.name} | ${fmtPct(r.cur)} | ${fmtPct(r.prev)} | ${delta(r.cur, r.prev)} | ${mmdd(r.maxDate)} ${fmtPct(r.max)} |\n`;
  md += `\n分野（L7）: ${ver.map((r) => `${r.name} ${fmtPct(r.cur)}`).join('、')}\n`;
  md += `業種（L3/4）: ${ind3.map((r) => `${r.name} ${fmtPct(r.cur)}`).join('、')}\n`;
  if (weeks) {
    md += `\n## 週ごとの推移（L7 上位 5、週平均）\n| 週 | 日数 | ${lineKeys.map((k) => countryJa(k)).join(' | ')} |\n|---|---|${lineKeys.map(() => '---').join('|')}|\n`;
    for (const wk of weeks) md += `| ${wk.label} | ${wk.days} | ${lineKeys.map((k) => fmtPct(wk.agg.dims.l7.byKey.get(k)?.avg ?? (wk.days ? 0 : NaN))).join(' | ')} |\n`;
  }
  md += `\n## 注意\n- 「国」は送信元 IP の位置であり、国家による攻撃を意味しない。\n- シェアは上位 20 件のみ取得しているため、圏外の国・業種は 0% として扱う。\n- ポート別の内訳は Cloudflare Radar の公開 API に含まれないため、このレポートでは扱わない。\n`;
  if (cur.present.length < period.cur.length) md += `- ${period.curLabel}は ${period.cur.length} 日中 ${cur.present.length} 日分のデータで集計している。\n`;

  // ---- HTML ----
  const badgeClass = { new: 'up', up: 'up', down: 'down', gone: 'down', spike: 'spike' };
  const hlHtml = highlights.length
    ? `<ul class="hl">${highlights.slice(0, 15).map((h) => `<li class="${badgeClass[h.kind]} ${h.severity}"><span class="badge">${KIND[h.kind].arrow} ${KIND[h.kind].badge}</span><span>${esc(highlightText(h))}</span></li>`).join('')}</ul>`
    : `<p class="muted">前${period.mode === 'weekly' ? '週' : '月'}から大きな変化はありません。</p>`;
  const table = (rows, head, cells) => `<table><thead><tr>${head.map((x) => `<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${cells(r).map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const deltaHtml = (c, p) => (p == null ? '—' : `<span class="d ${c - p >= 1 ? 'up' : p - c >= 1 ? 'down' : ''}">${arrow(c, p)} ${fmtPt(c - p)}</span>`);
  const sec = (title, sub, body) => `<section><h2>${esc(title)}</h2>${sub ? `<p class="sub">${esc(sub)}</p>` : ''}${body}</section>`;
  const weeksHtml = weeks ? sec('週ごとの推移（L7 上位 5、週平均）', '', table(weeks, ['週', '日数', ...lineKeys.map((k) => countryJa(k))], (wk) => [esc(wk.label), String(wk.days), ...lineKeys.map((k) => fmtPct(wk.agg.dims.l7.byKey.get(k)?.avg ?? (wk.days ? 0 : NaN)))])) : '';

  const html = `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(period.title)}</title>
<style>${CSS}</style></head>
<body><div class="tip" id="tip" hidden></div>
<main>
<header><p class="crumb"><a href="./index.html">レポート一覧</a> · <a href="../">攻撃マップ</a></p>
<h1>${esc(period.title)}</h1>
<p class="sub">日本を標的（宛先）とする攻撃の送信元国シェア（Cloudflare Radar、IP 地理情報ベース）</p>
<p class="meta">${esc(srcLine)}<br>生成 ${esc(meta.generatedAt.slice(0, 16).replace('T', ' '))}Z · <a href="./${period.id}.md">Markdown 版</a></p></header>
${sec('ハイライト（自動検出）', `${period.prevLabel}平均との比較で 1.5 倍以上または 3pt 以上の増減、新顔・消失、期間内の単日突発を自動で抽出。`, hlHtml)}
${sec(`${DIMENSIONS.l7.label} 上位 10`, `${period.curLabel}平均と${period.prevLabel}平均（${DIMENSIONS.l7.unit}）`, pairedBars(l7, countryJa, period.curLabel, period.prevLabel) + `<details><summary>表で見る</summary>${table(l7, ['順位', '国', period.curLabel, period.prevLabel, '変化', '最大日'], (r) => [String(r.rank), esc(r.name), fmtPct(r.cur), fmtPct(r.prev), deltaHtml(r.cur, r.prev), `${mmdd(r.maxDate)} ${fmtPct(r.max)}`])}</details>`)}
${sec('L7 上位 5 か国の日次推移', `${period.prevLabel}から${period.curLabel}まで。縦線が期間の境目。`, dailyLines(allDates, lineSeries, countryJa, period.cur[0]))}
${sec(`${DIMENSIONS.l3.label}`, `日別の構成（${DIMENSIONS.l3.unit}）。少数の大型攻撃に左右されるため日単位で首位が入れ替わる。`, stackedDaily(period.cur, days, 'l3', countryJa) + `<p class="note">${period.curLabel}平均: ${esc(l3.map((r) => `${r.name} ${fmtPct(r.cur)}`).join('、'))}</p><details><summary>日別首位の表</summary>${table(l3Leaders, ['日', '首位', 'シェア', '2 位'], (r) => [`${mmdd(r.date)}(${wday(r.date)})`, r.first ? esc(countryJa(r.first[0])) : '—', r.first ? fmtPct(r.first[1], 0) : '—', r.second ? `${esc(countryJa(r.second[0]))} ${fmtPct(r.second[1], 0)}` : '—'])}</details>`)}
${sec(DIMENSIONS.industries.label, `${period.curLabel}平均と${period.prevLabel}平均（${DIMENSIONS.industries.unit}）`, pairedBars(ind, (k) => industryJa(k) || k, period.curLabel, period.prevLabel, { limit: 8 }) + `<details><summary>表で見る</summary>${table(ind, ['業種', period.curLabel, period.prevLabel, '変化', '最大日'], (r) => [esc(r.name), fmtPct(r.cur), fmtPct(r.prev), deltaHtml(r.cur, r.prev), `${mmdd(r.maxDate)} ${fmtPct(r.max)}`])}</details><p class="note">分野（L7）: ${esc(ver.map((r) => `${r.name} ${fmtPct(r.cur)}`).join('、'))}<br>業種（L3/4）: ${esc(ind3.map((r) => `${r.name} ${fmtPct(r.cur)}`).join('、'))}</p>`)}
${weeksHtml}
<section class="notes"><h2>注意</h2><ul>
<li>「国」は送信元 IP の位置であり、国家による攻撃を意味しない。</li>
<li>シェアは上位 20 件のみ取得しているため、圏外の国・業種は 0% として扱う。</li>
<li>ポート別の内訳は Cloudflare Radar の公開 API に含まれないため、このレポートでは扱わない。</li>
${cur.present.length < period.cur.length ? `<li>${period.curLabel}は ${period.cur.length} 日中 ${cur.present.length} 日分のデータで集計している。</li>` : ''}
</ul></section>
</main>
<script>${JS}</script>
</body></html>
`;
  return { md, html, highlights, summary: { l7Top: l7.slice(0, 3), highlightCount: highlights.length } };
}

const CSS = `
:root{color-scheme:light;--bg:#fcfcfb;--surface:#ffffff;--text:#0b0b0b;--text2:#52514e;--muted:#8a8984;--line:#e6e5e1;--accent:#2a78d6;
--s1:#2a78d6;--s2:#eb6834;--s3:#1baf7a;--s4:#eda100;--s5:#e87ba4;--s6:#008300;--s7:#6250d6;--s8:#e34948;--prev:#b9b8b2;--other:#d4d3cd;
--up:#b42318;--up-bg:#fdecea;--down:#1c5cab;--down-bg:#e6f0fb;--spike:#8a5a00;--spike-bg:#fff4d6}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){color-scheme:dark;--bg:#141413;--surface:#1a1a19;--text:#f0efec;--text2:#c3c2b7;--muted:#8d8c85;--line:#2d2d2b;--accent:#3987e5;
--s1:#3987e5;--s2:#d95926;--s3:#199e70;--s4:#c98500;--s5:#d55181;--s6:#008300;--s7:#9085e9;--s8:#e66767;--prev:#56554f;--other:#3a3a37;
--up:#ff8a80;--up-bg:#3a1a17;--down:#86b6ef;--down-bg:#16294a;--spike:#f2c15c;--spike-bg:#3a2d10}}
:root[data-theme="dark"]{color-scheme:dark;--bg:#141413;--surface:#1a1a19;--text:#f0efec;--text2:#c3c2b7;--muted:#8d8c85;--line:#2d2d2b;--accent:#3987e5;
--s1:#3987e5;--s2:#d95926;--s3:#199e70;--s4:#c98500;--s5:#d55181;--s6:#008300;--s7:#9085e9;--s8:#e66767;--prev:#56554f;--other:#3a3a37;
--up:#ff8a80;--up-bg:#3a1a17;--down:#86b6ef;--down-bg:#16294a;--spike:#f2c15c;--spike-bg:#3a2d10}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.6 system-ui,-apple-system,"Segoe UI","Hiragino Sans","Noto Sans JP",sans-serif}
main{max-width:800px;margin:0 auto;padding:24px 16px 64px}a{color:var(--accent)}
h1{font-size:1.5rem;margin:.2em 0 .3em}h2{font-size:1.1rem;margin:0 0 .3em}.crumb{font-size:.85rem;color:var(--text2);margin:0}
.sub{color:var(--text2);margin:.1em 0 .6em;font-size:.92rem}.meta{color:var(--muted);font-size:.82rem;margin:0}
section{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:16px;margin:16px 0}
.chart{display:block;max-width:100%;height:auto}.chart text{font-family:inherit}.chart .tick{font-size:11px;fill:var(--muted)}.chart .label{font-size:12px;fill:var(--text)}.chart .value{font-size:11px;fill:var(--text2)}
.chart .grid{stroke:var(--line);stroke-width:1}.chart .leader{stroke:var(--muted);stroke-width:1;opacity:.6}.chart .boundary{stroke:var(--muted);stroke-width:1;stroke-dasharray:none}
.chart .bar{fill:var(--s1)}.chart .bar.prev{fill:var(--prev)}.chart .bar.other{fill:var(--other)}.chart .hit{cursor:default}.chart .hit:hover{opacity:.8}
.chart path.line{fill:none !important;stroke-width:2;stroke-linejoin:round;stroke-linecap:round}.chart .dot{stroke:var(--surface);stroke-width:2}
.chart .paired .bar{rx:0}.chart.paired rect.s1{fill:var(--s1)}
${[1, 2, 3, 4, 5, 6, 7, 8].map((i) => `.chart .s${i}{fill:var(--s${i});stroke:var(--s${i})}.chart .dot.s${i}{stroke:var(--surface)}.chart .line.s${i}{stroke:var(--s${i})}.sw.s${i}{background:var(--s${i})}`).join('')}
.sw.prev{background:var(--prev)}.sw.other{background:var(--other)}
.legend{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:.85rem;color:var(--text2);margin:4px 0 8px}.legend .sw{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;vertical-align:-1px}
.muted{color:var(--muted)}.note{font-size:.9rem;color:var(--text2);margin:.6em 0 0}
table{border-collapse:collapse;width:100%;font-size:.9rem;margin-top:8px}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--line)}th{color:var(--text2);font-weight:600}td:nth-child(n+3){font-variant-numeric:tabular-nums}
details{margin-top:8px}summary{cursor:pointer;color:var(--accent);font-size:.9rem}
.hl{list-style:none;margin:0;padding:0;display:grid;gap:8px}.hl li{display:flex;gap:10px;align-items:flex-start;padding:8px 10px;border-radius:8px;border:1px solid var(--line)}
.hl .badge{flex:none;font-size:.78rem;font-weight:700;padding:2px 8px;border-radius:999px;white-space:nowrap}
.hl.up,.hl li.up .badge{color:var(--up);background:var(--up-bg)}.hl li.down .badge{color:var(--down);background:var(--down-bg)}.hl li.spike .badge{color:var(--spike);background:var(--spike-bg)}
.hl li.high{border-color:transparent;background:color-mix(in srgb,var(--surface) 70%,var(--line))}
.d.up{color:var(--up)}.d.down{color:var(--down)}
.tip{position:fixed;z-index:9;pointer-events:none;background:var(--text);color:var(--bg);font-size:.8rem;padding:4px 8px;border-radius:6px;max-width:260px}
.notes ul{margin:0;padding-left:1.2em;font-size:.9rem;color:var(--text2)}
.list{list-style:none;padding:0;margin:0}.list li{padding:10px 0;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
`;
const JS = `
(function(){var tip=document.getElementById('tip');if(!tip)return;
function show(e){var t=e.target.closest&&e.target.closest('[data-tip]');if(!t){tip.hidden=true;return;}tip.textContent=t.getAttribute('data-tip');tip.hidden=false;
var x=e.clientX+12,y=e.clientY+12;if(x+tip.offsetWidth>window.innerWidth-8)x=e.clientX-tip.offsetWidth-12;if(y+tip.offsetHeight>window.innerHeight-8)y=e.clientY-tip.offsetHeight-12;tip.style.left=x+'px';tip.style.top=y+'px';}
document.addEventListener('mousemove',show);document.addEventListener('touchstart',function(e){var t=e.touches[0];show({target:e.target,clientX:t.clientX,clientY:t.clientY});},{passive:true});})();
`;

// ---------- 一覧ページ ----------
async function writeIndex() {
  await mkdir(outDir, { recursive: true });
  const files = (await readdir(outDir)).filter((f) => /^(weekly|monthly)-.*\.html$/.test(f));
  const titleOf = async (f) => { const m = (await readFile(join(outDir, f), 'utf8')).match(/<title>([^<]*)<\/title>/); return m ? m[1] : f; };
  const section = async (prefix, label) => {
    const list = files.filter((f) => f.startsWith(prefix)).sort().reverse();
    const items = await Promise.all(list.map(async (f) => `<li><a href="./${f}">${await titleOf(f)}</a><span class="muted"><a href="./${f.replace(/\.html$/, '.md')}">md</a></span></li>`));
    return `<section><h2>${label}</h2>${items.length ? `<ul class="list">${items.join('')}</ul>` : '<p class="muted">まだありません</p>'}</section>`;
  };
  const html = `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>攻撃トレンドレポート一覧</title><style>${CSS}</style></head>
<body><main><header><p class="crumb"><a href="../">攻撃マップ</a></p><h1>攻撃トレンドレポート</h1><p class="sub">日本を標的とする攻撃の送信元国・業種の週次・月次まとめ（Cloudflare Radar のスナップショットから自動生成）</p></header>
${await section('monthly-', '月次まとめ')}${await section('weekly-', '週次レポート')}
</main></body></html>
`;
  await writeFile(join(outDir, 'index.html'), html);
}

// ---------- メイン ----------
async function main() {
  if (indexOnly) { await writeIndex(); console.log(`一覧を更新: ${join(outDir, 'index.html')}`); return; }
  const snaps = await loadSnapshots();
  if (!snaps.length) throw new Error('スナップショットが見つかりません（git 履歴または --snapshots-dir を確認）');
  const days = toDaily(snaps);
  const today = new Date();
  const period = resolvePeriods(days, today);
  const meta = { snapshotCount: snaps.length, first: snaps[0].generatedAt, last: snaps[snaps.length - 1].generatedAt, generatedAt: today.toISOString() };
  const { md, html, highlights } = buildReport(days, period, meta);
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, `${period.id}.md`), md);
  await writeFile(join(outDir, `${period.id}.html`), html);
  await writeIndex();
  console.log(`書き出し: ${join(outDir, period.id)}.{md,html}  （${period.cur[0]} 〜 ${period.cur[period.cur.length - 1]}、ハイライト ${highlights.length} 件）`);
  for (const h of highlights.slice(0, 5)) console.log(`  ${KIND[h.kind].arrow} ${KIND[h.kind].badge} ${highlightText(h)}`);
}

main().catch((e) => { console.error('レポート生成に失敗しました:', e.message); process.exit(1); });
