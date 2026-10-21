/* Fixture-based contract checks. No real API keys or external network requests. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.resolve(__dirname, "../src/lib/market");
function load(file, deps = {}, mockFetch = () => { throw new Error("Unexpected network access"); }) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  // Inject fetch rather than contacting any production system.
  new Function("module", "exports", "require", "fetch", "process", "AbortSignal", compiled)(
    module, module.exports, (id) => { if (id in deps) return deps[id]; throw new Error(`Unexpected import ${id}`); }, mockFetch, process, AbortSignal
  );
  return module.exports;
}
const types = load("assetMarketCapTypes.ts");
const payload = {
  metadata: { asOf: "2026-10-20T15:30:00Z", totalAssets: 100 },
  data: [
    { Rank: 3, Ticker: "GC=F", Name: "Gold", AssetType: "Commodity", MarketCap: 30000000000000, Price: 4500, "24HrChange": 0.3, CirculatingSupply: 1000 },
    { Rank: 1, Ticker: "real-estate", Name: "Real Estate", AssetType: "Commodity", MarketCap: 500000000000000, Price: 1100, "24HrChange": null },
    { Rank: 2, Ticker: "BTC-USD", Name: "Bitcoin", AssetType: "Crypto", MarketCap: 2000000000000, Price: 100000, "24HrChange": -1.25 },
    { Rank: 4, Ticker: "SI=F", Name: "Silver", AssetType: "Commodity", MarketCap: 4000000000000, Price: 65, "24HrChange": null },
    { Rank: 5, Ticker: "FOO", Name: "Gold Mining Ltd", AssetType: "Company", MarketCap: 9000, Price: 42, "24HrChange": 4 },
    { Rank: 3, Ticker: "DUP", Name: "Duplicate", AssetType: "Company", MarketCap: 12, Price: 1 },
    { Rank: -1, Ticker: "INVALID", Name: "Invalid", AssetType: "Company", MarketCap: 12, Price: 1 },
  ],
};
const originalKey = process.env.ASSETMARKETCAP_API_KEY;
process.env.ASSETMARKETCAP_API_KEY = "fixture-private-key";
const marketCalls = [];
const fetchMock = async (url, options) => {
  marketCalls.push(String(url));
  if (String(url).includes("/API/daily")) {
    assert.equal(options.headers["X-API-Key"], "fixture-private-key");
    return { ok: true, status: 200, json: async () => payload };
  }
  if (String(url).endsWith("/EUR")) return { ok: true, status: 200, json: async () => ({ rate: 0.86, date: "2026-10-20" }) };
  if (String(url).endsWith("/GBP")) return { ok: true, status: 200, json: async () => ({ rate: null }) };
  throw new Error(`Unexpected URL ${url}`);
};
const backend = load("assetMarketCapServer.ts", { "./assetMarketCapTypes": types }, fetchMock);

(async () => {
  assert.equal(types.trackedMarketCapAsset("Gold", "GC=F", "Commodity"), "gold");
  assert.equal(types.trackedMarketCapAsset("Silver", "SI=F", "Commodity"), "silver");
  assert.equal(types.trackedMarketCapAsset("Bitcoin", "BTC-USD", "Crypto"), "bitcoin");
  assert.equal(types.trackedMarketCapAsset("Gold Mining Ltd", "GC=F", "Company"), null);
  assert.equal(types.trackedMarketCapAsset("Gold", "SCAM", "Crypto"), null);
  assert.equal(types.trackedMarketCapAsset("Bitcoin", "BTC-COMPANY", "Company"), null);
  assert.throws(() => backend.normalizeDaily({ data: [] }, new Date().toISOString()), /empty/);
  assert.throws(() => backend.normalizeDaily({}, new Date().toISOString()), /empty/);
  const raw = backend.normalizeDaily(payload, new Date().toISOString());
  assert.deepEqual(raw.rows.map((a) => a.rank), [1, 2, 3, 4, 5]);
  assert.equal(raw.rows[2].trackedAsset, "gold");
  assert.equal(raw.rows[3].trackedAsset, "silver");
  assert.equal(raw.rows[0].change24hPct, null);
  assert.equal(raw.rows[0].marketCapUsd, 500000000000000);
  const [usd, top10] = await Promise.all([backend.getMarketCapRanking("USD", 100), backend.getMarketCapRanking("USD", 10)]);
  assert.equal(marketCalls.filter((url) => url.includes("/API/daily")).length, 1, "Single-flight cache must eliminate duplicates");
  assert.equal(usd.currency, "USD");
  assert.equal(usd.data[2].price, 4500);
  assert.equal(usd.count, 5);
  assert.equal(top10.data.length, 5);
  assert.equal(usd.asOf, "2026-10-20T15:30:00Z");
  assert.equal(JSON.stringify(usd).includes("fixture-private-key"), false, "Credentials must never reach browsers");
  const eur = await backend.getMarketCapRanking("EUR", 100);
  assert.equal(eur.fxRate, 0.86);
  assert.equal(eur.data[2].marketCap, 30000000000000 * 0.86);
  assert.equal(eur.data[2].marketCapUsd, 30000000000000);
  const gbp = await backend.getMarketCapRanking("GBP", 100);
  assert.equal(gbp.fxRate, null);
  assert.equal(gbp.data[2].marketCap, null, "Never pretend USD prices are GBP prices");
  assert.equal(gbp.data[2].marketCapUsd, 30000000000000);
  assert.equal(marketCalls.filter((url) => url.includes("/API/daily")).length, 1);
  let throttledFetches = 0;
  const throttled = load("assetMarketCapServer.ts", { "./assetMarketCapTypes": types }, async () => {
    throttledFetches++;
    return { ok: false, status: 429, headers: { get: () => "3600" } };
  });
  await assert.rejects(throttled.getMarketCapRanking("USD", 100), /temporarily unavailable/);
  await assert.rejects(throttled.getMarketCapRanking("USD", 100), /temporarily unavailable/);
  assert.equal(throttledFetches, 1, "429 backoff must prevent repeat provider calls");
  console.log("PASS: API shape, exact asset identity, rank ordering, single-flight cache, EUR conversion, FX failure, key isolation and 429 backoff");
})().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => {
  if (originalKey === undefined) delete process.env.ASSETMARKETCAP_API_KEY;
  else process.env.ASSETMARKETCAP_API_KEY = originalKey;
});
