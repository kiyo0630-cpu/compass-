// Cloudflare Radar から「日本を標的とする攻撃の送信元国シェア」を取得し、
// attack-map/index.html が読む共通 JSON（スナップショット）に整形する。
// GitHub Actions（fetch-radar.mjs）と Cloudflare Worker（worker/radar-proxy.js）の両方から使う。

const API = 'https://api.cloudflare.com/client/v4/radar/attacks';
export const DATE_RANGES = ['1h', '6h', '1d', '7d', '14d', '28d'];

async function radarGet(path, params, token) {
  const url = new URL(API + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { throw new Error(`${path}: HTTP ${res.status} (JSON ではない応答)`); }
  if (!res.ok || body.success === false) {
    const msg = (body.errors || []).map((e) => `${e.code}: ${e.message}`).join('; ') || `HTTP ${res.status}`;
    throw new Error(`${path}: ${msg}`);
  }
  return body;
}

// result 内で "…CountryAlpha2" キーを持つ最初の配列を返す（top_0 など、キー名の差異に耐える）
function pickTop(body) {
  const r = body?.result || {};
  for (const v of Object.values(r)) {
    if (Array.isArray(v) && v.length && v[0] && Object.keys(v[0]).some((k) => /CountryAlpha2$/i.test(k))) return v;
  }
  return [];
}
function pickSeries(body) {
  const r = body?.result || {};
  for (const v of Object.values(r)) {
    if (v && typeof v === 'object' && Array.isArray(v.timestamps) && Array.isArray(v.values)) {
      return { timestamps: v.timestamps, values: v.values.map((x) => Number(x)) };
    }
  }
  return null;
}
// result 内で {name, value} 形式の最初の配列を返す（業種・分野など）
function pickNamed(body) {
  const r = body?.result || {};
  for (const v of Object.values(r)) {
    if (Array.isArray(v) && v.length && v[0] && 'name' in v[0] && 'value' in v[0]) return v;
  }
  return [];
}
function normalizeNamed(list) {
  return list
    .map((x) => ({ name: String(x.name || ''), share: Number(x.value) }))
    .filter((x) => x.name && Number.isFinite(x.share))
    .sort((a, b) => b.share - a.share);
}
function normalizeTop(list) {
  return list
    .map((x) => ({
      code: String(x.originCountryAlpha2 || x.countryAlpha2 || x.clientCountryAlpha2 || '').toUpperCase(),
      name: x.originCountryName || x.countryName || x.clientCountryName || null,
      share: Number(x.value),
      rank: x.rank ?? null,
    }))
    .filter((x) => /^[A-Z0-9]{2}$/.test(x.code) && Number.isFinite(x.share))
    .sort((a, b) => b.share - a.share);
}

/**
 * スナップショットを組み立てる。
 * @param {string} token  Cloudflare API トークン（権限: Account → Radar: Read）
 * @param {string} dateRange  1h / 6h / 1d / 7d / 14d / 28d
 * @param {{target?: string, limit?: number}} [opt]
 */
export async function buildSnapshot(token, dateRange = '1d', opt = {}) {
  if (!token) throw new Error('CLOUDFLARE_API_TOKEN が設定されていません');
  if (!DATE_RANGES.includes(dateRange)) dateRange = '1d';
  const target = (opt.target || 'JP').toUpperCase();
  const limit = String(opt.limit || 20);
  const common = { location: target, dateRange, limit };

  const [l7, l3, ts, ind, ver, ind3, ver3] = await Promise.allSettled([
    radarGet('/layer7/top/locations/origin', common, token),
    radarGet('/layer3/top/locations/origin', common, token),
    radarGet('/layer7/timeseries', { location: target, dateRange }, token),
    // 攻撃を受けている側の内訳（業種・分野）。個別のドメインや IP は Radar では公開されない
    radarGet('/layer7/top/industry', common, token),
    radarGet('/layer7/top/vertical', common, token),
    radarGet('/layer3/top/industry', common, token),
    radarGet('/layer3/top/vertical', common, token),
  ]);
  const errors = [l7, l3, ts, ind, ver, ind3, ver3].filter((p) => p.status === 'rejected').map((p) => String(p.reason?.message || p.reason));
  if (l7.status === 'rejected' && l3.status === 'rejected') throw new Error(errors.join(' / '));

  return {
    schema: 1,
    provider: 'cloudflare-radar',
    target,
    dateRange,
    generatedAt: new Date().toISOString(),
    note: '日本を標的（宛先）とする攻撃の送信元国シェア（%）。IP の地理情報に基づく。',
    l7: l7.status === 'fulfilled' ? normalizeTop(pickTop(l7.value)) : null,
    l3: l3.status === 'fulfilled' ? normalizeTop(pickTop(l3.value)) : null,
    series: ts.status === 'fulfilled' ? pickSeries(ts.value) : null,
    industries: ind.status === 'fulfilled' ? normalizeNamed(pickNamed(ind.value)) : null,
    verticals: ver.status === 'fulfilled' ? normalizeNamed(pickNamed(ver.value)) : null,
    industriesL3: ind3.status === 'fulfilled' ? normalizeNamed(pickNamed(ind3.value)) : null,
    verticalsL3: ver3.status === 'fulfilled' ? normalizeNamed(pickNamed(ver3.value)) : null,
    meta: {
      l7: l7.status === 'fulfilled' ? l7.value?.result?.meta ?? null : null,
      l3: l3.status === 'fulfilled' ? l3.value?.result?.meta ?? null : null,
    },
    errors,
  };
}
