import ts from "typescript";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const src = join(root, "src");
const errors = [];
let checked = 0;

function sourceFiles(folder) {
  return readdirSync(folder, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory()
      ? sourceFiles(join(folder, entry.name))
      : /\.tsx?$/.test(entry.name) ? [join(folder, entry.name)] : []
  );
}

for (const path of sourceFiles(src)) {
  checked++;
  const body = readFileSync(path, "utf8");
  const source = ts.createSourceFile(
    path, body, ts.ScriptTarget.Latest, true,
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );

  for (const error of source.parseDiagnostics) {
    errors.push(`${path}: ${ts.flattenDiagnosticMessageText(error.messageText, " ")}`);
  }

  // Compare complete import declarations, not the first line of multiline imports.
  const seen = new Set();
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const declaration = statement.getText(source).replace(/\s+/g, " ");
    if (seen.has(declaration)) errors.push(`Duplicate import: ${path}`);
    seen.add(declaration);
  }
}

if (existsSync(join(src, "app/api/auth"))) {
  errors.push("Custom sign-in / sign-up handlers must not exist");
}
if (readFileSync(join(src, "app/(auth)/signup/page.tsx"), "utf8").includes("/api/auth/")) {
  errors.push("Sign-up still calls backend auth");
}

// The modal provider must wrap both navigation and page content. Without it,
// `useAuthModal()` throws in the browser on every page despite a successful build.
const layout = readFileSync(join(src, "app/layout.tsx"), "utf8");
const providerStart = layout.indexOf("<AuthModalProvider>");
const providerEnd = layout.indexOf("</AuthModalProvider>");
const nav = layout.indexOf("<AppNavigation />");
const child = layout.indexOf("{children}");
if (providerStart < 0 || providerEnd < providerStart ||
    nav < providerStart || nav > providerEnd ||
    child < providerStart || child > providerEnd) {
  errors.push("AuthModalProvider must wrap AppNavigation and children in root layout");
}

// Navigation regressions: keep bottom tabs while moving currency into the menu.
const navigation = readFileSync(join(src, "components/AppNavigation.tsx"), "utf8");
const css = readFileSync(join(src, "app/globals.css"), "utf8");
if (!navigation.includes('className="enterprise-mobile-bottom"')) errors.push("Mobile bottom navigation missing");
if (!navigation.includes('CurrencyToggle className="enterprise-menu-currency"')) errors.push("Currency buttons missing from menu");
if (navigation.includes("enterprise-top-currency")) errors.push("Duplicate currency selector remains in navbar");
if (!css.includes(".enterprise-account-menu { top: 100%; left: 0; right: 0; width: 100%;")) {
  errors.push("Mobile dropdown must span full header width");
}

console.log(`Checked ${checked} TS/TSX files and navigation requirements; ${errors.length} issues`);
for (const error of errors) console.error(error);
if (errors.length) process.exitCode = 1;
