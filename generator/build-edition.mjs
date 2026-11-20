#!/usr/bin/env node
// Generate or upgrade a project edition (<slug>-sdlc) from sdlc-core/template.
//   node build-edition.mjs --name "Acme Portal" --out <dir> [--slug acme-portal]
//   node build-edition.mjs --upgrade <edition dir> [--force] [--allow-core-overrides]
// Files in <edition>/custom/ are the project's own: custom/<path> replaces or adds <path> on every
// build, and custom/lifecycle.json adds tracks and steps. The generator never overwrites custom/.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync, rmSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const CORE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE = join(CORE, 'template');
const CORE_VERSION = JSON.parse(readFileSync(join(CORE, '.claude-plugin', 'plugin.json'), 'utf8')).version;
const TEXT = /\.(md|json|mjs|js|yml|yaml|sh|txt)$|(^|\/)[^.]+$/;

const die = (msg, code = 1) => { process.stderr.write(`build-edition: ${msg}\n`); process.exit(code); };
const argv = process.argv.slice(2);
const opt = (name) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : undefined; };
const has = (name) => argv.includes(`--${name}`);
const sha = (buf) => createHash('sha256').update(buf).digest('hex');

function walk(dir) {
  return readdirSync(dir).filter((n) => n !== '.git' && n !== 'node_modules').flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

export function slugify(name) {
  return name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Overlays may not replace the safety rails unless explicitly allowed.
const GUARDED = /^(scripts\/|hooks\/|config\/safety\.json$|\.claude-plugin\/|edition\.json$)/;
const CUSTOM_KEEP = new Set(['README.md', 'lifecycle.json']);

function checksums(dir, skip = new Set()) {
  const out = {};
  for (const f of walk(dir)) {
    const rel = relative(dir, f).split(sep).join('/');
    if (rel === 'edition.json' || rel.startsWith('custom/') || skip.has(rel)) continue;
    out[rel] = sha(readFileSync(f));
  }
  return out;
}

function render(src, dest, vars) {
  mkdirSync(dirname(dest), { recursive: true });
  if (TEXT.test(src)) {
    let text = readFileSync(src, 'utf8');
    for (const [k, v] of Object.entries(vars)) text = text.replaceAll(k, v);
    writeFileSync(dest, text);
  } else copyFileSync(src, dest);
}

function applyCustom(out, vars) {
  const dir = join(out, 'custom');
  if (!existsSync(join(dir, 'README.md'))) render(join(CORE, 'generator', 'custom-README.md'), join(dir, 'README.md'), vars);
  const overlays = {};
  for (const src of walk(dir)) {
    const rel = relative(dir, src).split(sep).join('/');
    if (CUSTOM_KEEP.has(rel)) continue;
    const core = join(TEMPLATE, rel);
    overlays[rel] = existsSync(core) ? { overrides: true, coreSha: sha(readFileSync(core)) } : { overrides: false };
    render(src, join(out, rel), vars);
  }
  return overlays;
}

// Check custom/ before anything is written, so a refused build leaves the edition untouched.
function checkCustom(out) {
  const dir = join(out, 'custom');
  if (!existsSync(dir)) return;
  for (const src of walk(dir)) {
    const rel = relative(dir, src).split(sep).join('/');
    if (!CUSTOM_KEEP.has(rel) && GUARDED.test(rel) && !has('allow-core-overrides')) die(`custom/${rel} would replace a safety file; pass --allow-core-overrides only after review`, 4);
  }
  if (existsSync(join(dir, 'lifecycle.json'))) {
    try { JSON.parse(readFileSync(join(dir, 'lifecycle.json'), 'utf8')); } catch (e) { die(`custom/lifecycle.json is not valid JSON: ${e.message}`); }
  }
}

function generate({ name, slug, out, build }) {
  checkCustom(out);
  const editionName = `${slug}-sdlc`;
  const editionVersion = `${CORE_VERSION}+${slug}.${build}`;
  const vars = { '{{PROJECT_NAME}}': name, '{{SLUG}}': slug, '{{EDITION_NAME}}': editionName, '{{CORE_VERSION}}': CORE_VERSION, '{{EDITION_VERSION}}': editionVersion };
  for (const src of walk(TEMPLATE)) {
    const rel = relative(TEMPLATE, src).split(sep).join('/');
    render(src, join(out, rel), vars);
  }
  const custom = applyCustom(out, vars);
  const edition = { project: name, slug, edition: editionName, coreVersion: CORE_VERSION, version: editionVersion, build, generatedAt: new Date().toISOString(), custom, checksums: checksums(out, new Set(Object.keys(custom))) };
  writeFileSync(join(out, 'edition.json'), `${JSON.stringify(edition, null, 2)}\n`);
  return edition;
}

if (has('upgrade')) {
  const dir = resolve(opt('upgrade') || die('--upgrade needs the edition folder'));
  const file = join(dir, 'edition.json');
  if (!existsSync(file)) die(`${file} not found`);
  const ed = JSON.parse(readFileSync(file, 'utf8'));
  const skip = new Set(Object.keys(ed.custom || {}));
  const now = checksums(dir, skip);
  const edited = Object.keys({ ...ed.checksums, ...now }).filter((f) => ed.checksums[f] !== now[f]);
  if (edited.length && !has('force')) {
    die(`edition was edited by hand; move these changes into custom/ (same path), the project profile (.sdlc/) or sdlc-core, then retry:\n  ${edited.join('\n  ')}`, 3);
  }
  const before = Object.keys(now);
  const res = generate({ name: ed.project, slug: ed.slug, out: dir, build: ed.build + 1 });
  // Files the new template no longer has; removal may be refused on some mounts, so report them.
  const stale = before.filter((f) => !res.checksums[f] && !res.custom[f]);
  const kept = stale.filter((f) => { try { rmSync(join(dir, f)); return false; } catch { return true; } });
  console.log(`upgraded ${res.edition} to ${res.version} (core ${ed.coreVersion} -> ${res.coreVersion})`);
  for (const [f, c] of Object.entries(res.custom)) {
    if (c.overrides && ed.custom?.[f]?.coreSha && ed.custom[f].coreSha !== c.coreSha) console.log(`core changed ${f}; your custom/${f} was kept — compare and merge by hand`);
  }
  if (Object.keys(res.custom).length) console.log(`custom files applied: ${Object.keys(res.custom).join(', ')}`);
  if (kept.length) console.log(`remove these obsolete files by hand:\n  ${kept.join('\n  ')}`);
} else {
  const name = opt('name') || die('--name "<Project name>" is required');
  const slug = opt('slug') || slugify(name);
  if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(slug)) die(`slug "${slug}" must be lowercase letters, digits and dashes`);
  const out = resolve(opt('out') || join(process.cwd(), `${slug}-sdlc`));
  if (existsSync(out) && readdirSync(out).filter((n) => n !== '.git').length) die(`${out} is not empty; use --upgrade for an existing edition`);
  const res = generate({ name, slug, out, build: 1 });
  console.log(JSON.stringify({ edition: res.edition, version: res.version, path: out, files: Object.keys(res.checksums).length }, null, 2));
}
