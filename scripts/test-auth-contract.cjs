/* Minimal network-free Firebase request contract tests: npm ci && node scripts/test-auth-contract.cjs */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.join(__dirname, '..', 'src');
function evaluate(relativePath, mocks, extras = {}) {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports, require(id) {
    if (Object.hasOwn(mocks, id)) return mocks[id];
    throw new Error(`Unexpected dependency: ${id}`);
  }, Headers, FormData, Response, ...extras }, { filename: relativePath });
  return module.exports;
}
function userFixture(fetchStatuses, onReady = () => {}) {
  const calls = [];
  const tokenRefreshes = [];
  const redirects = [];
  let logouts = 0;
  const user = { uid: 'current-uid', async getIdToken(force) { tokenRefreshes.push(Boolean(force)); return force ? 'fresh.jwt.id' : 'cached.jwt.id'; } };
  const auth = { currentUser: null, async authStateReady() { onReady(auth, user); } };
  const mockedFetch = async (url, init) => {
    calls.push({ url, init });
    const status = fetchStatuses[calls.length - 1] ?? 200;
    return new Response(null, { status });
  };
  const { authenticatedFetch } = evaluate('lib/auth/authenticatedFetch.ts', {
    'firebase/auth': { async signOut() { logouts++; auth.currentUser = null; } },
    '@/lib/firebase': { auth },
    '@/lib/clientApiUrl': { clientApiUrl: p => p },
  }, { fetch: mockedFetch, window: { location: { pathname: '/dashboard', replace: u => redirects.push(u) } } });
  return { auth, user, calls, tokenRefreshes, redirects, get logouts() { return logouts; }, authenticatedFetch };
}
async function run() {
  let test = userFixture([200], (auth, user) => { auth.currentUser = user; });
  assert.equal((await test.authenticatedFetch('/api/crypto/summary')).status, 200);
  assert.equal(test.calls[0].init.headers.get('Authorization'), 'Bearer cached.jwt.id');
  assert.deepEqual(test.tokenRefreshes, [false]);

  test = userFixture([401, 200], (auth, user) => { auth.currentUser = user; });
  assert.equal((await test.authenticatedFetch('/api/crypto/summary')).status, 200);
  assert.deepEqual(test.tokenRefreshes, [false, true]);
  assert.equal(test.calls[1].init.headers.get('Authorization'), 'Bearer fresh.jwt.id');
  assert.equal(test.logouts, 0);

  test = userFixture([403], (auth, user) => { auth.currentUser = user; });
  assert.equal((await test.authenticatedFetch('/api/me')).status, 403);
  assert.equal(test.logouts, 0);

  test = userFixture([401, 401], (auth, user) => { auth.currentUser = user; });
  assert.equal((await test.authenticatedFetch('/api/me')).status, 401);
  assert.equal(test.logouts, 1);
  assert.equal(test.redirects[0], '/signin?expired=1');

  test = userFixture([200]);
  await assert.rejects(test.authenticatedFetch('/api/me'), /AUTH_REQUIRED/);
  assert.equal(test.calls.length, 0);
  await assert.rejects(test.authenticatedFetch('https://malicious.example/steal'), /Protected requests must use/);

  const web = evaluate('lib/clientApiUrl.ts', {}, { process: { env: { NEXT_PUBLIC_API_PROXY_ORIGIN: 'https://app.valuevisuals.io' } } });
  assert.equal(web.clientApiUrl('/api/me'), '/api/me');
  const native = evaluate('lib/clientApiUrl.ts', {}, { process: { env: { NEXT_PUBLIC_MOBILE_STATIC_EXPORT: 'true', NEXT_PUBLIC_API_PROXY_ORIGIN: 'https://app.valuevisuals.io' } } });
  assert.equal(native.clientApiUrl('/api/me'), 'https://app.valuevisuals.io/api/me');

  console.log('PASS: Firebase initialization, bearer tokens, forced refresh, sign-out, protected route guard and web/native proxy origins');
}
run().catch(err => { console.error(err); process.exitCode = 1; });
