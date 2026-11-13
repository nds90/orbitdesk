import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SKIP_DIRS = new Set(["node_modules", ".git", "coverage"]);
const TEXT_EXTENSIONS = new Set([
  "",
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".txt",
  ".yaml",
  ".yml",
]);
const REQUIRED_FILES = [
  "README.md",
  "CONTRIBUTING.md",
  "LICENSE",
  "package.json",
  ".github/workflows/ci.yml",
  ".github/pull_request_template.md",
  "app/server.js",
  "app/tickets.js",
  "app/sla.js",
  "app/store.js",
  "app/csv.js",
  "app/static/index.html",
  "app/static/app.js",
  "app/static/styles.css",
  "data/seed-tickets.json",
  "docs/architecture.md",
  "docs/api.md",
  "docs/demo-scenarios.md",
  "docs/review-checklist.md",
  "scripts/validate.js",
  "tests/api.test.js",
  "tests/csv.test.js",
  "tests/sla.test.js",
  "tests/tickets.test.js",
];
const SECRET_PATTERNS = [
  /AKIA[0-9A-Z]{16}/,
  /gh[pousr]_[A-Za-z0-9]{20,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /xox[baprs]-[A-Za-z0-9-]{10,}/,
];

const failures = [];
let checks = 0;

function pass() {
  checks += 1;
}

function fail(message) {
  checks += 1;
  failures.push(message);
}

function walk(directory) {
  const entries = readdirSync(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      files.push(...walk(join(directory, entry.name)));
    } else if (entry.isFile()) {
      files.push(join(directory, entry.name));
    }
  }

  return files;
}

function checkRequiredFiles() {
  for (const file of REQUIRED_FILES) {
    if (existsSync(join(ROOT, file))) pass();
    else fail(`missing required file: ${file}`);
  }
}

function checkPackageManifest() {
  const manifest = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  const scripts = manifest.scripts ?? {};

  for (const script of ["start", "test", "validate", "check"]) {
    if (scripts[script]) pass();
    else fail(`package.json is missing the "${script}" script`);
  }

  if (manifest.engines?.node) pass();
  else fail("package.json must declare engines.node");

  if (Object.keys(manifest.dependencies ?? {}).length === 0) pass();
  else fail("sample app must stay dependency-free");
}

function checkMarkdownLinks(files) {
  const linkPattern = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

  for (const file of files.filter((candidate) => candidate.endsWith(".md"))) {
    const content = readFileSync(file, "utf8");
    for (const match of content.matchAll(linkPattern)) {
      const raw = match[1].replace(/^<|>$/g, "");
      if (/^(https?:|mailto:|tel:|#)/i.test(raw)) continue;
      if (raw.startsWith("/")) {
        fail(`${relative(ROOT, file)}: use a relative link instead of ${raw}`);
        continue;
      }

      const target = decodeURIComponent(raw.split("#")[0]);
      if (!target) continue;

      if (existsSync(resolve(dirname(file), target))) pass();
      else fail(`${relative(ROOT, file)}: broken link -> ${raw}`);
    }
  }
}

function checkTextFiles(files) {
  for (const file of files) {
    if (!TEXT_EXTENSIONS.has(extname(file))) continue;

    const content = readFileSync(file, "utf8");
    const label = relative(ROOT, file);

    if (content.charCodeAt(0) === 0xfeff) fail(`${label}: file starts with a UTF-8 BOM`);
    else pass();

    if (/^(<{7}|={7}|>{7})( |$)/m.test(content)) {
      fail(`${label}: contains a merge-conflict marker`);
    } else {
      pass();
    }

    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(content)) fail(`${label}: contains a value that looks like a secret`);
      else pass();
    }
  }
}

function checkDemoScenarios() {
  const file = join(ROOT, "docs/demo-scenarios.md");
  if (!existsSync(file)) return;

  const content = readFileSync(file, "utf8");
  const scenarios = content.match(/^### Scenario \d+/gm) ?? [];

  if (scenarios.length >= 5) pass();
  else fail("docs/demo-scenarios.md must contain at least five scenario briefs");

  if ((content.match(/Acceptance criteria/gi) ?? []).length >= 5) pass();
  else fail("each demo scenario must include acceptance criteria");
}

const files = walk(ROOT);

checkRequiredFiles();
checkPackageManifest();
checkMarkdownLinks(files);
checkTextFiles(files);
checkDemoScenarios();

if (failures.length > 0) {
  console.error(`Validation failed (${failures.length} problem${failures.length === 1 ? "" : "s"}):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`Validation passed (${checks} checks).`);
