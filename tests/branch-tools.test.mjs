import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareVersions, rankReleases, branchName, globToRegExp } from '../template/scripts/branch-tools.mjs';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', 'template', 'scripts', 'branch-tools.mjs');
const git = (cwd, ...args) => { const r = spawnSync('git', ['-c', 'user.name=T', '-c', 'user.email=t@example.com', ...args], { cwd, encoding: 'utf8' }); assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`); return r.stdout.trim(); };
const tool = (cwd, ...args) => { const r = spawnSync(process.execPath, [SCRIPT, ...args, '--cwd', cwd], { encoding: 'utf8' }); return { status: r.status, json: JSON.parse(r.stdout) }; };

test('version order: numbers are compared one by one, not as text', () => {
  assert.ok(compareVersions('release/release-1.6.10', 'release/release-1.6.9') > 0);
  assert.ok(compareVersions('release/release-1.10.0', 'release/release-1.6.5') > 0);
  assert.ok(compareVersions('release/release-1.6.5', 'release/release-1.6.5') === 0);
  const ranked = rankReleases([{ name: 'release/1.6.9', date: 5 }, { name: 'release/1.6.10', date: 1 }, { name: 'release/1.2.0', date: 9 }]);
  assert.deepEqual(ranked.map((r) => r.name), ['release/1.6.10', 'release/1.6.9', 'release/1.2.0']);
  assert.equal(rankReleases([{ name: 'release/1.6.10', date: 1 }, { name: 'release/1.2.0', date: 9 }], 'newest-commit')[0].name, 'release/1.2.0');
  assert.ok(globToRegExp('release/*').test('release/release-1.6.5') && !globToRegExp('release/*').test('hc_api_prod_release'));
});

test('branch name: pattern placeholders, types and slug', () => {
  assert.equal(branchName({ pattern: 'feature/{KEY}', key: 'BLMFAI-1252' }), 'feature/BLMFAI-1252');
  assert.equal(branchName({ pattern: '{type}/{KEY}-{slug}', key: 'BLMFAI-1252', type: 'Bug', typeMap: { Bug: 'bugfix', default: 'feature' }, summary: 'Bloomlink takes too long to open from the BloomLink menu!', slugMax: 4 }), 'bugfix/BLMFAI-1252-bloomlink-takes-too-long');
  assert.equal(branchName({ pattern: '{type}/{key}', key: 'BLMFAI-7', type: 'Story', typeMap: { Bug: 'bugfix', default: 'feature' } }), 'feature/blmfai-7');
  assert.equal(branchName({ pattern: 'wip/{number}-{slug}', key: 'BLMFAI-1252', summary: '' }), 'wip/1252');
  assert.equal(branchName({ pattern: 'feature/{KEY}/', key: 'A-1' }), 'feature/A-1');
});

test('base branch: the latest release branch, a named branch, the fallback and the current branch', () => {
  const dir = mkdtempSync(join(tmpdir(), 'branch-tools-'));
  const origin = join(dir, 'origin.git');
  const work = join(dir, 'work');
  git(dir, 'init', '--bare', '-b', 'development', origin);
  git(dir, 'init', '-b', 'development', work);
  writeFileSync(join(work, 'a.txt'), 'a');
  git(work, 'add', 'a.txt');
  git(work, 'commit', '-m', 'first');
  git(work, 'remote', 'add', 'origin', origin);
  for (const b of ['release/release-1.6.9', 'release/release-1.6.10', 'release/release-1.2.0', 'hc_api_prod_release']) git(work, 'branch', b);
  git(work, 'push', 'origin', '--all');
  git(work, 'fetch', 'origin', '--prune');

  const latest = tool(work, 'base', '--base', 'release', '--release-pattern', 'release/*');
  assert.equal(latest.status, 0);
  assert.equal(latest.json.base, 'release/release-1.6.10');
  assert.equal(latest.json.ref, 'origin/release/release-1.6.10');
  assert.equal(latest.json.source, 'release');
  assert.deepEqual(latest.json.candidates, ['release/release-1.6.10', 'release/release-1.6.9', 'release/release-1.2.0']);

  const named = tool(work, 'base', '--base', 'development');
  assert.deepEqual([named.json.ref, named.json.source], ['origin/development', 'named']);

  const none = tool(work, 'base', '--base', 'release', '--release-pattern', 'rc/*', '--fallback', 'development');
  assert.deepEqual([none.json.base, none.json.source], ['development', 'fallback']);

  const missing = tool(work, 'base', '--base', 'nope', '--fallback', 'development');
  assert.deepEqual([missing.json.base, missing.json.source], ['development', 'fallback']);

  const nothing = tool(work, 'base', '--base', 'nope', '--fallback', 'also-nope');
  assert.equal(nothing.status, 3);

  assert.deepEqual([tool(work, 'base', '--base', 'current').json.base], ['development']);

  const nameOk = tool(work, 'name', '--pattern', 'feature/{KEY}', '--key', 'BLMFAI-1252');
  assert.deepEqual([nameOk.json.name, nameOk.json.valid], ['feature/BLMFAI-1252', true]);
  assert.equal(tool(work, 'name', '--pattern', 'feature/{KEY} x..y', '--key', 'BLMFAI-1').json.valid, false, 'git refuses it');
  assert.equal(tool(work, 'name').status, 2);
});
