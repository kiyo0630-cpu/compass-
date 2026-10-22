// Cloudflare Radar API の応答を模した固定データと、fetch を差し替えるヘルパー。
// テストからは installMockFetch() を呼ぶ。CLI スクリプトのテストでは
//   node --import ./tests/helpers/mock-fetch-preload.mjs attack-map/scripts/fetch-radar.mjs ...
// のようにプリロードして同じ応答を返す。

export const L7_TOP = {
  success: true,
  result: {
    meta: { dateRange: [{ startTime: '2026-10-21T00:00:00Z', endTime: '2026-10-22T00:00:00Z' }] },
    top_0: [
      { originCountryAlpha2: 'US', originCountryName: 'United States', value: '23.88', rank: 1 },
      { originCountryAlpha2: 'nl', originCountryName: 'Netherlands', value: '7.41', rank: 2 },
      { originCountryAlpha2: 'CN', originCountryName: 'China', value: '9.5', rank: 3 }, // 順位より share を優先して並べ替える
      { originCountryAlpha2: 'XYZ', originCountryName: 'Invalid', value: '1', rank: 4 }, // alpha-2 でないので除外
      { originCountryAlpha2: 'DE', originCountryName: 'Germany', value: 'n/a', rank: 5 }, // 数値でないので除外
    ],
  },
};
export const L3_TOP = {
  success: true,
  result: {
    meta: {},
    top_0: [{ originCountryAlpha2: 'VN', originCountryName: 'Vietnam', value: 40.1, rank: 1 }],
  },
};
export const SERIES = {
  success: true,
  result: { serie_0: { timestamps: ['2026-10-21T00:00:00Z', '2026-10-21T01:00:00Z'], values: ['0.5', '1.25'] } },
};
export const NAMED = {
  success: true,
  result: { top_0: [{ name: 'Gaming', value: '34.2' }, { name: 'Finance', value: '50' }, { name: '', value: '1' }] },
};
export const API_ERROR = { success: false, errors: [{ code: 10000, message: 'Authentication error' }] };

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/**
 * fetch を差し替える。routes は「パスに含まれる文字列 → 応答本体」のマップ。
 * 本体が Error のときは HTTP 500 + success:false を返す。
 * 返り値の calls に呼び出し URL が溜まるので、クエリやヘッダーを検証できる。
 */
export function installMockFetch(routes = defaultRoutes(), { onCall } = {}) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push({ url, headers: init.headers || {}, init });
    onCall?.(url, init);
    const key = Object.keys(routes).find((k) => url.includes(k));
    if (!key) return jsonResponse({ success: false, errors: [{ code: 404, message: `unmocked ${url}` }] }, 404);
    const body = routes[key];
    if (body instanceof Error) return jsonResponse({ success: false, errors: [{ code: 500, message: body.message }] }, 500);
    if (typeof body === 'string') return new Response(body, { status: 200, headers: { 'Content-Type': 'text/html' } });
    return jsonResponse(body);
  };
  return { calls, restore: () => { globalThis.fetch = original; } };
}

export function defaultRoutes() {
  return {
    '/layer7/top/locations/origin': L7_TOP,
    '/layer3/top/locations/origin': L3_TOP,
    '/layer7/timeseries': SERIES,
    '/layer7/top/industry': NAMED,
    '/layer7/top/vertical': NAMED,
    '/layer3/top/industry': NAMED,
    '/layer3/top/vertical': NAMED,
  };
}
