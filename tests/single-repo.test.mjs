// Single-repo workspace with subprojects (for example Laravel + Angular + Python in one Git repo).
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const CORE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let ED; let WS;
const run = (script, args, opts = {}) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', cwd: WS, env: { ...process.env, SDLC_WORKSPACE: WS }, ...opts });
const sdlc = (...a) => run(join(ED, 'scripts', 'sdlc.mjs'), a);
const hook = (event, payload) => run(join(ED, 'scripts', 'guard.mjs'), [event], { input: JSON.stringify({ cwd: WS, ...payload }) });

before(() => {
  const root = mkdtempSync(join(tmpdir(), 'sdlc1-'));
  ED = join(root, 'shop-sdlc');
  execFileSync(process.execPath, [join(CORE, 'generator', 'build-edition.mjs'), '--name', 'Shop Platform', '--slug', 'shop', '--out', ED]);
  WS = join(root, 'platform');
  mkdirSync(join(WS, 'frontend', 'admin', 'src'), { recursive: true });
  execFileSync('git', ['init', '-q', WS]);
  writeFileSync(join(WS, 'composer.json'), '{}');
  mkdirSync(join(WS, '.sdlc'), { recursive: true });
  writeFileSync(join(WS, '.sdlc', 'project.json'), JSON.stringify({
    project: { name: 'Shop Platform', slug: 'shop' },
    tracker: { type: 'jira', site: 'https://x.atlassian.net', projectKey: 'SHOP', keyPattern: '^SHOP-\\d+$' },
    repos: { platform: { path: '', stack: 'php', parent: 'dev', subprojects: { admin: { path: 'frontend/admin', stack: 'node', commands: { test: 'npx ng test' } } } } },
    branching: { pattern: '{KEY}', prefixByType: {}, protected: ['main', 'dev'] },
    commitMessagePattern: '^SHOP-\\d+ ?: ',
  }));
});

test('generator names the edition after the project', () => {
  assert.match(run(join(ED, 'scripts', 'sdlc.mjs'), ['stack-detect', WS]).stdout, /php/);
});

test('branch pattern {KEY} and commit pattern', () => {
  const seed = join(WS, 'seed.json');
  writeFileSync(seed, JSON.stringify({ ticket: { summary: 'x' }, repos: [{ name: 'platform', path: '', branch: 'SHOP-3100' }] }));
  assert.equal(sdlc('init', 'SHOP-3100', seed).status, 0);
  assert.equal(sdlc('branch-name', 'SHOP-3100', 'Task', 'Anything here').stdout.trim(), 'SHOP-3100');
  const msg = join(WS, 'm.txt');
  writeFileSync(msg, 'SHOP-3100 : admin page migration');
  assert.equal(run(join(ED, 'scripts', 'githook.mjs'), ['commit-msg', msg]).status, 0);
  writeFileSync(msg, 'migration');
  assert.equal(run(join(ED, 'scripts', 'githook.mjs'), ['commit-msg', msg]).status, 1);
});

test('ticket documents under .sdlc are not treated as source', () => {
  sdlc('track', 'SHOP-3100', 'full');
  assert.equal(hook('pre-tool', { tool_name: 'Write', tool_input: { file_path: join(WS, '.sdlc', 'tickets', 'SHOP-3100', 'design.md'), content: '# d' } }).status, 0);
  assert.equal(hook('pre-tool', { tool_name: 'Edit', tool_input: { file_path: join(WS, 'app', 'Models', 'User.php'), new_string: 'x' } }).status, 2, 'source waits for kickoff');
});

test('php and subproject secrets are protected', () => {
  assert.equal(hook('pre-tool', { tool_name: 'Read', tool_input: { file_path: join(WS, 'storage', 'oauth-private.key') } }).status, 2);
  assert.equal(hook('pre-tool', { tool_name: 'Read', tool_input: { file_path: join(WS, 'frontend', 'admin', '.env.local') } }).status, 2);
  assert.equal(hook('pre-tool', { tool_name: 'Read', tool_input: { file_path: join(WS, '.env.example') } }).status, 0);
});
