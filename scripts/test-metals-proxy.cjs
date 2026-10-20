/* Network-free proxy regression test for combined XAU + XAG summary. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const input = fs.readFileSync(path.join(__dirname, '../src/app/api/metals/summary/route.ts'), 'utf8');
const code = ts.transpileModule(input, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = { exports: {} };
let url;
vm.runInNewContext(code, { module: mod, exports: mod.exports,
  require(name) {
    switch (name) {
      case '@/lib/auth/serverBearer': return { readBearer: req => req.headers.get('authorization') };
      case '@/lib/getApiUrl': return { getApiUrl: () => 'https://api.test' };
      default: throw new Error(`Unknown dependency ${name}`);
    }
  }, URL, Response, Headers, console, fetch: async (input) => {
    url = new URL(input);
    return Response.json({ items: [{ base: 'XAU' }, { base: 'XAG' }] });
  },
}, { filename: 'metals/summary/route.ts' });

(async () => {
  const req = query => ({ url: `https://app.test/api/metals/summary?${query}`, headers: new Headers({ authorization: 'Bearer example' }) });
  const combined = await mod.exports.GET(req('currency=gbp'));
  assert.equal(combined.status, 200);
  assert.equal(url.searchParams.get('base'), null);
  assert.equal(url.searchParams.get('currency'), 'GBP');
  assert.equal((await combined.json()).items.length, 2);
  await mod.exports.GET(req('base=gold&currency=usd'));
  assert.equal(url.searchParams.get('base'), 'XAU');
  console.log('PASS: Omitted base returns two metals; explicit base keeps old behavior');
})().catch(error => { console.error(error); process.exitCode = 1; });
