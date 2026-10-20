/* Network-free tests for /api/crypto/compare and the candle pairing helpers. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.join(__dirname, '..', 'src');

function evaluate(filename, mocks = {}, globals = {}) {
  const input = fs.readFileSync(path.join(root, filename), 'utf8');
  const compiled = ts.transpileModule(input, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports, require(name) {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    throw new Error(`Unexpected dependency: ${name}`);
  }, URL, URLSearchParams, AbortSignal, console, ...globals }, { filename });
  return module.exports;
}

const { toPricePoints, compareCandles, closestPrice } = evaluate('lib/market/comparison.ts');
const base = [{ t: 1_000_000, c: 100 }, { t: 2_000_000, c: 120 }];
const quote = [{ t: 1_000_000, c: 20 }, { t: 2_000_000, c: 30 }];
assert.equal(toPricePoints([{ t: 1, c: 0 }, { t: 2, c: 2 }, { t: 2, c: 4 }]).length, 1);
assert.equal(closestPrice([{ t: 1000, price: 20 }], 3000, 1000), null);
const ratios = compareCandles(base, quote, 1);
assert.equal(ratios.length, 2);
assert.deepEqual(Array.from(ratios, x => x.price), [5, 4]);
assert.equal(ratios[0].basePriceUsd, 100);
assert.equal(ratios[1].quotePriceUsd, 30);
assert.equal(compareCandles(base, [], 1).length, 0);

const called = [];
const candles = { BTC: { candles: base, updatedAt: '2026-10-19T00:00:00Z' }, ETH: { candles: quote } };
const route = evaluate('app/api/crypto/compare/route.ts', {
  'next/server': { NextResponse: { json: (data, options) => ({ data, status: options?.status || 200 }) } },
  '@/lib/getApiUrl': { getApiUrl: () => 'https://api.test' },
  '@/lib/market/comparison': { compareCandles },
}, { fetch: async (url, options) => {
  called.push({ url, options });
  const symbol = new URL(url).searchParams.get('symbol');
  return { ok: true, json: async () => candles[symbol] };
} });

(async () => {
  let response = await route.GET({ url: 'http://localhost/api/crypto/compare?base=bitcoin&quote=ethereum&days=1' });
  assert.equal(response.status, 200);
  assert.equal(response.data.prices.length, 2);
  assert.equal(response.data.current, 4);
  assert.equal(response.data.source, 'Value Visuals API');
  assert.equal(called.length, 2);
  assert(called.every(call => call.url.startsWith('https://api.test/api/crypto/chart?')));
  assert(called.every(call => call.options.next.revalidate === 60));
  response = await route.GET({ url: 'http://localhost/api/crypto/compare?base=bitcoin&quote=bitcoin&days=1' });
  assert.equal(response.status, 400);
  response = await route.GET({ url: 'http://localhost/api/crypto/compare?base=bitcoin&quote=ethereum&days=0' });
  assert.equal(response.status, 400);
  console.log('PASS: Cached self-hosted comparison, ratio alignment, chart contract, validation');
})().catch(error => { console.error(error); process.exitCode = 1; });
