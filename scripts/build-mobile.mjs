/**
 * Build a Capacitor-compatible static UI without changing the hosted Next.js API.
 * The hosted app remains a normal Next.js server and owns all /api/* routes.
 * Requires the normal npm dependencies and an HTTPS NEXT_PUBLIC_API_PROXY_ORIGIN.
 */
import { cpSync, existsSync, mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const origin = process.env.NEXT_PUBLIC_API_PROXY_ORIGIN || '';
let parsed;
try { parsed = new URL(origin); } catch { /* fail below */ }
if (!parsed || parsed.protocol !== 'https:' || parsed.origin !== origin) {
  console.error('Set NEXT_PUBLIC_API_PROXY_ORIGIN to the HTTPS origin of the deployed Next.js app (e.g. https://app.valuevisuals.io).');
  process.exit(1);
}
if (!existsSync(join(root, 'node_modules', '.bin', 'next'))) {
  console.error('Install project dependencies first: npm ci');
  process.exit(1);
}
const temp = mkdtempSync(join(tmpdir(), 'value-visuals-capacitor-'));
try {
  const exclude = resolve(root, 'src/app/api');
  cpSync(join(root, 'src'), join(temp, 'src'), {
    recursive: true,
    filter: p => !(resolve(p) === exclude || resolve(p).startsWith(exclude + '/')),
  });
  cpSync(join(root, 'public'), join(temp, 'public'), { recursive: true });
  for (const file of ['package.json', 'tsconfig.json', 'postcss.config.mjs', 'tailwind.config.ts', 'next-env.d.ts']) {
    if (existsSync(join(root, file))) cpSync(join(root, file), join(temp, file));
  }
  // Use already-installed modules; do not duplicate/download packages.
  symlinkSync(join(root, 'node_modules'), join(temp, 'node_modules'), 'dir');
  writeFileSync(join(temp, 'next.config.mjs'), 'export default { output: "export", trailingSlash: true, images: { unoptimized: true }, eslint: { ignoreDuringBuilds: true } };\n');
  const env = { ...process.env, NEXT_PUBLIC_API_PROXY_ORIGIN: origin, NEXT_PUBLIC_MOBILE_STATIC_EXPORT: 'true', NEXT_TELEMETRY_DISABLED: '1' };
  console.log(`Building isolated static frontend against ${origin}`);
  execFileSync(join(root, 'node_modules/.bin/next'), ['build'], { cwd: temp, env, stdio: 'inherit' });
  if (!existsSync(join(temp, 'out/index.html'))) throw new Error('Static build did not create index.html');
  rmSync(join(root, 'out'), { recursive: true, force: true });
  mkdirSync(join(root, 'out'), { recursive: true });
  cpSync(join(temp, 'out'), join(root, 'out'), { recursive: true });
  console.log('Mobile web bundle ready in out/. Run npx cap sync then open iOS/Android.');
} finally {
  rmSync(temp, { recursive: true, force: true });
}
