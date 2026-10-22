// `node --import` でプリロードし、子プロセスの fetch を固定応答に差し替える（CLI スクリプトのテスト用）。
// 環境変数 MOCK_FETCH_MODE:
//   radar (既定) … Cloudflare Radar の正常応答
//   radar-fail   … すべてのエンドポイントが認証エラー
//   graphql      … Cloudflare GraphQL Analytics（targets-from-cloudflare-zone.mjs 用）の正常応答
//   graphql-fail … GraphQL がエラーを返す
import { installMockFetch, defaultRoutes, API_ERROR } from './radar-fixtures.mjs';

const mode = process.env.MOCK_FETCH_MODE || 'radar';
if (mode === 'radar') {
  installMockFetch(defaultRoutes());
} else if (mode === 'radar-fail') {
  const routes = Object.fromEntries(Object.keys(defaultRoutes()).map((k) => [k, new Error(API_ERROR.errors[0].message)]));
  installMockFetch(routes);
} else if (mode === 'graphql') {
  globalThis.fetch = async (_url, init) => {
    const { variables } = JSON.parse(init.body);
    if (variables.zone === 'zone-missing') return Response.json({ data: { viewer: { zones: [] } } });
    return Response.json({
      data: {
        viewer: {
          zones: [{
            byHost: [
              { count: 120, dimensions: { clientRequestHTTPHost: 'www.example.jp' } },
              { count: 5, dimensions: { clientRequestHTTPHost: '' } },
            ],
            byCountry: [
              { count: 100, dimensions: { clientCountryName: 'us' } },
              { count: 25, dimensions: { clientCountryName: 'CN' } },
            ],
            bySource: [{ count: 125, dimensions: { source: 'waf', action: 'block' } }],
          }],
        },
      },
    });
  };
} else if (mode === 'graphql-fail') {
  globalThis.fetch = async () => Response.json({ errors: [{ message: 'zone not authorized' }] }, { status: 200 });
}
