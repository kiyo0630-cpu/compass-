#!/usr/bin/env node
// 自分が Cloudflare で管理しているドメイン（ゾーン）が受けた攻撃を、ホスト名別・送信元国別に集計して JSON に書き出す。
// Cloudflare の GraphQL Analytics API（firewallEventsAdaptiveGroups）を使い、ブロック/チャレンジされたリクエストを数える。
//
//   CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ZONE_IDS=zoneid1,zoneid2 \
//     node attack-map/scripts/targets-from-cloudflare-zone.mjs --out attack-map/data/targets.json --hours 24
//
// 必要なトークン権限: Zone → Analytics: Read（対象ゾーン）。
// CLOUDFLARE_ZONE_IDS が未設定のときは何もせず正常終了する。
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] ? args[i + 1] : def; };
const out = opt('--out', 'attack-map/data/targets.json');
const hours = Math.min(72, Math.max(1, Number(opt('--hours', process.env.ATTACK_MAP_TARGET_HOURS || '24')) || 24));
const token = process.env.CLOUDFLARE_API_TOKEN || '';
const zones = (process.env.CLOUDFLARE_ZONE_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);

if (!token || !zones.length) {
  console.log('CLOUDFLARE_API_TOKEN または CLOUDFLARE_ZONE_IDS が未設定のためスキップしました（自分のゾーンの集計は任意機能です）。');
  process.exit(0);
}

const ACTIONS = ['block', 'drop', 'challenge', 'js_challenge', 'managed_challenge', 'challenge_failed', 'jschallenge_failed', 'managed_challenge_non_interactive_solved'];
const QUERY = `
query AttackTargets($zone: String!, $since: Time!, $until: Time!, $actions: [String!]) {
  viewer {
    zones(filter: { zoneTag: $zone }) {
      byHost: firewallEventsAdaptiveGroups(
        limit: 100, orderBy: [count_DESC],
        filter: { datetime_geq: $since, datetime_lt: $until, action_in: $actions }
      ) { count dimensions { clientRequestHTTPHost } }
      byCountry: firewallEventsAdaptiveGroups(
        limit: 100, orderBy: [count_DESC],
        filter: { datetime_geq: $since, datetime_lt: $until, action_in: $actions }
      ) { count dimensions { clientCountryName } }
      bySource: firewallEventsAdaptiveGroups(
        limit: 20, orderBy: [count_DESC],
        filter: { datetime_geq: $since, datetime_lt: $until, action_in: $actions }
      ) { count dimensions { source action } }
    }
  }
}`;

async function gql(variables) {
  const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: QUERY, variables }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || (body.errors && body.errors.length)) {
    throw new Error((body.errors || []).map((e) => e.message).join('; ') || `HTTP ${res.status}`);
  }
  return body.data;
}

const until = new Date(); const since = new Date(until.getTime() - hours * 3600e3);
const hosts = new Map(), countries = new Map(), sources = new Map(); const errors = [];
for (const zone of zones) {
  try {
    const data = await gql({ zone, since: since.toISOString(), until: until.toISOString(), actions: ACTIONS });
    const z = data?.viewer?.zones?.[0];
    if (!z) { errors.push(`${zone}: ゾーンが見つからないか権限がありません`); continue; }
    for (const g of z.byHost || []) { const h = g.dimensions.clientRequestHTTPHost || '(不明)'; hosts.set(h, (hosts.get(h) || 0) + g.count); }
    for (const g of z.byCountry || []) { const c = (g.dimensions.clientCountryName || 'XX').toUpperCase(); countries.set(c, (countries.get(c) || 0) + g.count); }
    for (const g of z.bySource || []) { const k = `${g.dimensions.source}/${g.dimensions.action}`; sources.set(k, (sources.get(k) || 0) + g.count); }
  } catch (e) { errors.push(`${zone}: ${e.message}`); }
}
const toList = (m, key) => [...m.entries()].map(([k, count]) => ({ [key]: k, count })).sort((a, b) => b.count - a.count);
const snap = {
  schema: 1,
  provider: 'cloudflare-zone-firewall',
  generatedAt: until.toISOString(),
  windowHours: hours,
  note: '自分の Cloudflare ゾーンでブロック/チャレンジされたリクエスト数。ホスト名は自分の管理ドメインのみ。',
  targets: toList(hosts, 'host'),
  countries: toList(countries, 'code'),
  sources: toList(sources, 'source'),
  errors,
};
if (!snap.targets.length && errors.length) { console.error('取得に失敗しました:', errors.join(' / ')); process.exit(1); }
await mkdir(dirname(out), { recursive: true });
await writeFile(out, JSON.stringify(snap, null, 1) + '\n');
console.log(`書き出し: ${out}  ホスト ${snap.targets.length} 件 / 国 ${snap.countries.length} 件 / 直近 ${hours} 時間`);
if (errors.length) console.warn('警告:', errors.join(' / '));
