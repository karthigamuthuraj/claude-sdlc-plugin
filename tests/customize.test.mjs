// Customisation: edition custom/ overlays, custom tracks and project lifecycle steps.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const CORE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GEN = join(CORE, 'generator', 'build-edition.mjs');
let ROOT; let ED; let WS; const KEY = 'CUS-1';
const gen = (...a) => spawnSync(process.execPath, [GEN, ...a], { encoding: 'utf8' });
const sdlc = (...a) => spawnSync(process.execPath, [join(ED, 'scripts', 'sdlc.mjs'), ...a], { encoding: 'utf8', cwd: WS, env: { ...process.env, SDLC_WORKSPACE: WS } });
const put = (p, text) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, text); };
const profile = (lifecycle) => put(join(WS, '.sdlc', 'project.json'), JSON.stringify({
  project: { name: 'Cus', slug: 'cus' },
  tracker: { type: 'jira', projectKey: 'CUS', keyPattern: '^CUS-\\d+$' },
  repos: { app: { path: '.', stack: 'node', parent: 'main' } },
  branching: { pattern: '{KEY}', prefixByType: {}, protected: ['main'] },
  lifecycle,
}));

before(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'sdlc-cus-'));
  ED = join(ROOT, 'cus-sdlc');
  assert.equal(gen('--name', 'Cus', '--out', ED).status, 0);
  WS = join(ROOT, 'ws');
  put(join(WS, '.sdlc', 'steps', 'security-scan.md'), '# security-scan\n1. audit\n');
});

test('custom/ adds and replaces skills and survives upgrade', () => {
  assert.ok(existsSync(join(ED, 'custom', 'README.md')), 'custom README created');
  put(join(ED, 'custom', 'skills', 'hello', 'SKILL.md'), '---\nname: hello\ndescription: say hello for {{EDITION_NAME}}\n---\n');
  put(join(ED, 'custom', 'skills', 'verify', 'SKILL.md'), '---\nname: verify\ndescription: our verify\n---\n');
  put(join(ED, 'custom', 'lifecycle.json'), JSON.stringify({ tracks: { spike: { base: 'quick', description: 'investigation', remove: ['pr', 'handoff', 'review'] } } }));
  const r = gen('--upgrade', ED);
  assert.equal(r.status, 0, r.stderr);
  assert.match(readFileSync(join(ED, 'skills', 'hello', 'SKILL.md'), 'utf8'), /cus-sdlc/);
  assert.match(readFileSync(join(ED, 'skills', 'verify', 'SKILL.md'), 'utf8'), /our verify/);
  const ed = JSON.parse(readFileSync(join(ED, 'edition.json'), 'utf8'));
  assert.equal(ed.custom['skills/verify/SKILL.md'].overrides, true);
  assert.equal(ed.custom['skills/hello/SKILL.md'].overrides, false);
  assert.equal(gen('--upgrade', ED).status, 0, 'second upgrade still clean');
});

test('hand edits outside custom/ are still refused; safety files cannot be overlaid', () => {
  const f = join(ED, 'skills', 'pr', 'SKILL.md');
  const orig = readFileSync(f, 'utf8');
  writeFileSync(f, `${orig}\nedited`);
  assert.equal(gen('--upgrade', ED).status, 3);
  writeFileSync(f, orig);
  put(join(ED, 'custom', 'scripts', 'guard.mjs'), '// bypass');
  assert.equal(gen('--upgrade', ED).status, 4);
  assert.equal(gen('--upgrade', ED, '--allow-core-overrides').status, 0);
  writeFileSync(join(ED, 'custom', 'scripts', 'guard.mjs'), readFileSync(join(CORE, 'template', 'scripts', 'guard.mjs')));
});

test('project step is inserted, gates commit and is recorded', () => {
  profile({ insert: [{ after: 'verify', steps: ['security-scan'], tracks: ['quick', 'spike'] }] });
  const flow = JSON.parse(sdlc('flow').stdout);
  assert.match(flow.spike, /based on quick/);
  assert.match(flow.quick, /verify > security-scan > commit/);
  const seed = join(WS, 'seed.json');
  writeFileSync(seed, JSON.stringify({ ticket: { summary: 'x' }, repos: [] }));
  assert.equal(sdlc('init', KEY, seed).status, 0);
  assert.equal(sdlc('track', KEY, 'spike').status, 0);
  assert.equal(sdlc('get', KEY, 'track_base').stdout.trim(), 'quick');
  assert.equal(sdlc('set', KEY, 'steps_done.security-scan', 'true').status, 1, 'steps only via step-done');
  assert.equal(sdlc('stage', KEY, 'verified').status, 0);
  assert.equal(sdlc('next', KEY).stdout.trim(), 'step security-scan');
  assert.equal(sdlc('gate', KEY, 'commit').status, 4, 'commit blocked until the step is done');
  assert.equal(sdlc('step-done', KEY, 'security-scan', 'no findings').status, 0);
  assert.equal(sdlc('next', KEY).stdout.trim(), 'commit');
  assert.equal(sdlc('gate', KEY, 'commit').status, 0);
  assert.equal(sdlc('step-done', KEY, 'ux-signoff', 'x').status, 4, 'not a step of this track');
});

test('invalid lifecycle is reported and blocks track selection', () => {
  profile({ tracks: { lean: { base: 'standard', remove: ['verify'] }, odd: { base: 'standard', insert: [{ after: 'verify', steps: ['missing-step'] }] } } });
  const r = sdlc('flow');
  assert.match(r.stdout, /verify\\?" cannot be removed/);
  assert.match(r.stdout, /missing-step/);
  assert.equal(sdlc('track', KEY, 'standard').status, 1);
  profile(undefined);
});
