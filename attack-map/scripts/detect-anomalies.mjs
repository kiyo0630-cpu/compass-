#!/usr/bin/env node
// フィード（attack-map/data/latest.json）を直近ベースラインと比較し、平常から大きく外れた値を検出する。
//   node attack-map/scripts/detect-anomalies.mjs --out attack-map/data/alerts.json [--days 7] [--latest attack-map/data/latest.json]
// ベースラインはリポジトリの git 履歴（latest.json の過去コミット）から組み立てるので、追加の保存先は不要。
// Actions では checkout の fetch-depth: 0 が必要。履歴が足りないときは判定を保留して正常終了する。
// 結果: alerts.json（JSON）、標準出力（Markdown）、GITHUB_STEP_SUMMARY / GITHUB_OUTPUT（あれば）。
// 終了コードは常に 0（--fail-on-alert を付けたときだけ warn 以上で 1）。
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { appendFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] ? args[i + 1] : def; };
const flag = (name) => args.includes(name);
const latestPath = opt('--latest', 'attack-map/data/latest.json');
const out = opt('--out', 'attack-map/data/alerts.json');
const days = Number(opt('--days', '7'));
const MIN_SAMPLES = Number(opt('--min-samples', '3'));

// しきい値（%ポイント）。シェアは 0〜100 の百分率。
export const RULES = {
  l7SurgeMinShare: 5,      // L7 送信元国: この値未満のシェアは急増とみなさない
  l7SurgeMinDelta: 5,      // L7 送信元国: 平均 +5pt 以上、かつ平均の 2 倍以上、かつ平均 +3σ 以上
  l7DropMinMean: 10,       // L7 送信元国: 平均 10% 以上の国が半分以下に落ちたら info
  l3NewDominantShare: 50,  // L3 送信元国: 首位シェア 50% 以上で、ベースライン平均 10% 未満の国なら warn
  l3NewDominantMaxMean: 10,
  l3SingleSourceShare: 90, // L3 首位が 90% 以上なら info（単一ソースの大型攻撃）
  industrySpikeMinShare: 25, // 業種（L7）: 25% 以上で、平均 +10pt 以上かつ +3σ 以上なら warn
  industrySpikeMinDelta: 10,
  seriesTailPoints: 8,     // L7 時系列: 末尾 8 点（約 2 時間）
  seriesTailMax: 0.95,     // 末尾に最大値（正規化で 1.0）があり
  seriesMedianMax: 0.4,    // 系列全体の中央値が 0.4 以下 → 直近に急増
};

function sh(cmd, a) { return execFileSync(cmd, a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); }
function mean(xs) { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0; }
function std(xs) { if (xs.length < 2) return 0; const m = mean(xs); return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1)); }
function median(xs) { const s = [...xs].sort((a, b) => a - b); const n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0; }
const pct = (x) => `${Number(x).toFixed(1)}%`;
const r1 = (x) => Math.round(x * 10) / 10;
const shareMap = (list) => Object.fromEntries((list || []).map((x) => [x.code || x.name, x.share]));

/** git 履歴から、現在のスナップショットより前の days 日分のスナップショットを集める */
export function loadBaseline(path, current, daysBack) {
  const curTime = Date.parse(current.generatedAt || 0) || Date.now();
  const since = new Date(curTime - daysBack * 86400e3).toISOString();
  let shas = [];
  try {
    shas = sh('git', ['log', '--format=%H', `--since=${since}`, '--', path]).split('\n').filter(Boolean);
  } catch { return { snapshots: [], reason: 'git 履歴を読めませんでした' }; }
  const snapshots = [];
  const seen = new Set();
  for (const sha of shas) {
    let snap;
    try { snap = JSON.parse(sh('git', ['show', `${sha}:${path}`])); } catch { continue; }
    const t = Date.parse(snap.generatedAt || 0);
    if (!t || t >= curTime || seen.has(snap.generatedAt)) continue;
    if (snap.target && current.target && snap.target !== current.target) continue;
    if (snap.dateRange && current.dateRange && snap.dateRange !== current.dateRange) continue;
    seen.add(snap.generatedAt);
    snapshots.push(snap);
  }
  snapshots.sort((a, b) => Date.parse(a.generatedAt) - Date.parse(b.generatedAt));
  return { snapshots, reason: shas.length ? null : 'git 履歴に過去のスナップショットがありません（fetch-depth: 0 が必要）' };
}

/** 判定本体。alerts の severity は warn（通知対象）/ info（記録のみ） */
export function detect(current, baseline, rules = RULES) {
  const alerts = [];
  const day = (current.generatedAt || new Date().toISOString()).slice(0, 10);
  const add = (severity, kind, key, title, detail, extra = {}) =>
    alerts.push({ id: `${kind}:${key}:${day}`, severity, kind, key, title, detail, ...extra });

  // フィード自体の問題
  if (!current.l7 && !current.l3) add('warn', 'feed', 'empty', 'フィードに国別データがありません', (current.errors || []).join(' / ') || '取得結果が空です');
  else if (current.errors?.length) add('info', 'feed', 'partial', 'フィードの一部取得に失敗', current.errors.join(' / '));

  const n = baseline.length;
  const enough = n >= MIN_SAMPLES;
  const col = (field, key) => baseline.map((s) => shareMap(s[field])[key] ?? 0);

  // L7 送信元国の急増・急減
  if (enough && current.l7) {
    for (const x of current.l7) {
      const hist = col('l7', x.code);
      const m = mean(hist), sd = std(hist), name = x.name || x.code;
      const threshold = Math.max(m + rules.l7SurgeMinDelta, m * 2, m + 3 * sd);
      if (x.share >= rules.l7SurgeMinShare && x.share >= threshold) {
        add('warn', 'l7-surge', x.code, `L7 送信元 ${name} が急増`, `${pct(x.share)}（${n} 回の平均 ${pct(m)}、最大 ${pct(Math.max(...hist))}）、順位 ${x.rank ?? '-'} 位`, { value: r1(x.share), baseline: r1(m), max: r1(Math.max(...hist)) });
      } else if (m >= rules.l7DropMinMean && x.share <= m / 2) {
        add('info', 'l7-drop', x.code, `L7 送信元 ${name} が半減`, `${pct(x.share)}（平均 ${pct(m)}）`, { value: r1(x.share), baseline: r1(m) });
      }
    }
    // ベースラインで平均 10% 以上なのに今回 top20 から消えた国
    const codes = new Set(current.l7.map((x) => x.code));
    const allCodes = new Set(baseline.flatMap((s) => (s.l7 || []).map((x) => x.code)));
    for (const code of allCodes) {
      if (codes.has(code)) continue;
      const m = mean(col('l7', code));
      if (m >= rules.l7DropMinMean) add('info', 'l7-drop', code, `L7 送信元 ${code} が上位から消失`, `平均 ${pct(m)} → 上位 20 位圏外`, { value: 0, baseline: r1(m) });
    }
  }

  // L3 首位の新顔・単一ソース集中
  if (current.l3?.length) {
    const top = current.l3[0];
    const name = top.name || top.code;
    const m = enough ? mean(col('l3', top.code)) : null;
    if (enough && top.share >= rules.l3NewDominantShare && m < rules.l3NewDominantMaxMean) {
      add('warn', 'l3-new-dominant', top.code, `L3 送信元の首位に ${name} が新たに浮上`, `${pct(top.share)}（${n} 回の平均 ${pct(m)}）。少数の大型 DDoS が原因の可能性`, { value: r1(top.share), baseline: r1(m) });
    } else if (top.share >= rules.l3SingleSourceShare) {
      add('info', 'l3-single-source', top.code, `L3 送信元が ${name} にほぼ集中`, `${pct(top.share)}`, { value: r1(top.share), baseline: m == null ? null : r1(m) });
    }
  }

  // 攻撃を受けた業種（L7）の突発
  if (enough && current.industries) {
    for (const x of current.industries) {
      const hist = col('industries', x.name);
      const m = mean(hist), sd = std(hist);
      if (x.share >= rules.industrySpikeMinShare && x.share >= Math.max(m + rules.industrySpikeMinDelta, m + 3 * sd)) {
        add('warn', 'industry-spike', x.name, `被害業種 ${x.name} が突発的に増加`, `${pct(x.share)}（${n} 回の平均 ${pct(m)}）`, { value: r1(x.share), baseline: r1(m) });
      }
    }
  }

  // L7 攻撃量の時系列（最大値 = 1 に正規化）。末尾にピークがあり、普段は低い → 直近の急増
  const vals = (current.series?.values || []).filter(Number.isFinite);
  if (vals.length >= rules.seriesTailPoints * 3) {
    const tail = vals.slice(-rules.seriesTailPoints);
    const med = median(vals);
    if (Math.max(...tail) >= rules.seriesTailMax && med <= rules.seriesMedianMax) {
      const ratio = med > 0 ? Math.round(1 / med) : null;
      const ts = current.series.timestamps || [];
      const peakAt = ts[vals.length - rules.seriesTailPoints + tail.indexOf(Math.max(...tail))] || '';
      add('warn', 'volume-surge', 'l7', '日本向け L7 攻撃量が直近で急増', `直近 ${rules.seriesTailPoints * 15} 分以内にこの 24 時間のピーク${ratio ? `（通常時の約 ${ratio} 倍）` : ''}。ピーク時刻 ${peakAt}`, { value: 1, baseline: r1(med), peakAt });
    }
  }

  const sev = alerts.some((a) => a.severity === 'warn') ? 'warn' : alerts.length ? 'info' : 'ok';
  return {
    schema: 1,
    generatedAt: new Date().toISOString(),
    snapshotGeneratedAt: current.generatedAt || null,
    target: current.target || null,
    dateRange: current.dateRange || null,
    status: sev,
    baseline: {
      samples: n,
      days,
      from: n ? baseline[0].generatedAt : null,
      to: n ? baseline[n - 1].generatedAt : null,
      sufficient: enough,
    },
    alerts: alerts.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'warn' ? -1 : 1)),
  };
}

export function toMarkdown(result, baselineNote) {
  const icon = { warn: '🚨', info: 'ℹ️', ok: '✅' }[result.status];
  const lines = [`## ${icon} 攻撃フィード 異常検知 — ${result.status === 'ok' ? '異常なし' : result.status === 'warn' ? '要確認' : '参考情報のみ'}`, ''];
  lines.push(`スナップショット: ${result.snapshotGeneratedAt || '-'}（${result.target || '-'} / ${result.dateRange || '-'}）`);
  lines.push(result.baseline.samples
    ? `ベースライン: 過去 ${result.baseline.days} 日の ${result.baseline.samples} スナップショット（${result.baseline.from} 〜 ${result.baseline.to}）${result.baseline.sufficient ? '' : ` — ${MIN_SAMPLES} 件未満のため国別・業種の判定は保留`}`
    : `ベースライン: なし${baselineNote ? `（${baselineNote}）` : ''} — 国別・業種の判定は保留`);
  lines.push('');
  if (!result.alerts.length) lines.push('検出された異常はありません。');
  for (const a of result.alerts) lines.push(`- ${a.severity === 'warn' ? '🚨' : 'ℹ️'} **${a.title}** — ${a.detail}`);
  return lines.join('\n') + '\n';
}

async function main() {
  const current = JSON.parse(await readFile(latestPath, 'utf8'));
  const { snapshots, reason } = loadBaseline(latestPath, current, days);
  const result = detect(current, snapshots);
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(result, null, 1) + '\n');
  const md = toMarkdown(result, reason);
  console.log(md);
  console.log(`書き出し: ${out}  (status=${result.status}, alerts=${result.alerts.length}, baseline=${result.baseline.samples})`);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, md);
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, `status=${result.status}\nalerts=${result.alerts.length}\nwarnings=${result.alerts.filter((a) => a.severity === 'warn').length}\n`);
  }
  for (const a of result.alerts) if (a.severity === 'warn') console.log(`::warning title=attack-map anomaly::${a.title} — ${a.detail}`);
  if (flag('--fail-on-alert') && result.status === 'warn') process.exit(1);
}

// 直接実行されたときだけ main を動かす（テストから import できるように）
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error('異常検知に失敗しました:', e.message); process.exit(1); });
}
