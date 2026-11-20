// node --test tests/
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, appendFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const CORE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let ED; let WS; const KEY = 'DEMO-7';

const node = (script, args, opts = {}) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', cwd: WS, env: { ...process.env, SDLC_WORKSPACE: WS }, ...opts });
const sdlc = (...a) => node(join(ED, 'scripts', 'sdlc.mjs'), a);
const hook = (event, payload) => node(join(ED, 'scripts', 'guard.mjs'), [event], { input: JSON.stringify({ cwd: WS, ...payload }) });
const git = (dir, ...a) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8' });

before(() => {
  const root = mkdtempSync(join(tmpdir(), 'sdlc-'));
  ED = join(root, 'demo-sdlc');
  execFileSync(process.execPath, [join(CORE, 'generator', 'build-edition.mjs'), '--name', 'Demo Co', '--slug', 'demo', '--out', ED]);
  WS = join(root, 'ws');
  const repo = join(WS, 'svc');
  mkdirSync(join(repo, 'src'), { recursive: true });
  git(WS, 'init', '-q', 'svc');
  git(repo, 'config', 'user.email', 'dev@example.com'); git(repo, 'config', 'user.name', 'Dev');
  writeFileSync(join(repo, 'src', 'a.py'), 'x = 1\n');
  writeFileSync(join(repo, 'requirements.txt'), '');
  git(repo, 'add', 'src/a.py', 'requirements.txt'); git(repo, 'commit', '-qm', 'init'); git(repo, 'branch', '-M', 'develop');
  git(repo, 'checkout', '-qb', 'bug-fix/demo-7-fix-x');
  mkdirSync(join(WS, '.sdlc'), { recursive: true });
  writeFileSync(join(WS, '.sdlc', 'project.json'), JSON.stringify({
    project: { name: 'Demo Co', slug: 'demo' },
    tracker: { type: 'jira', site: 'https://example.atlassian.net', projectKey: 'DEMO', keyPattern: '^DEMO-\\d+$', humanOnlyStatuses: ['Done'], authEnv: { email: 'JIRA_EMAIL', token: 'JIRA_API_TOKEN' } },
    repos: { svc: { path: 'svc', stack: 'python', parent: 'develop', commands: { test: 'python -m pytest {files}' } } },
    branching: { pattern: '{prefix}/{key_lower}-{slug}', prefixByType: { Bug: 'bug-fix' }, protected: ['main', 'develop'] },
    protectedFiles: ['login_details.txt'], templateExceptions: ['.env.dev'],
  }));
});

test('generator stamps the project name and checksums', () => {
  const plugin = JSON.parse(readFileSync(join(ED, '.claude-plugin', 'plugin.json'), 'utf8'));
  assert.equal(plugin.name, 'demo-sdlc');
  assert.match(plugin.version, /^\d+\.\d+\.\d+\+demo\.1$/);
  assert.match(readFileSync(join(ED, 'skills', 'pickup', 'SKILL.md'), 'utf8'), /demo-sdlc/);
  const ed = JSON.parse(readFileSync(join(ED, 'edition.json'), 'utf8'));
  assert.ok(Object.keys(ed.checksums).length > 40);
});

test('context, track, branch name and gates', () => {
  const seed = join(WS, 'seed.json');
  writeFileSync(seed, JSON.stringify({ ticket: { summary: 'Fix x', type: 'Bug' }, repos: [{ name: 'svc', path: 'svc', parent_branch: 'develop', branch: 'bug-fix/demo-7-fix-x', worktree: 'svc', branch_created: true }] }));
  assert.equal(sdlc('init', KEY, seed).status, 0);
  assert.equal(sdlc('branch-name', KEY, 'Bug', 'Fix: the X value!').stdout.trim(), 'bug-fix/demo-7-fix-the-x-value');
  assert.equal(sdlc('gate', KEY, 'rca').status, 4, 'no track yet');
  assert.equal(sdlc('track', KEY, 'bug').status, 0);
  assert.equal(sdlc('gate', KEY, 'analyze').status, 4, 'rca not confirmed');
  assert.equal(sdlc('set', KEY, 'stage', '"verified"').status, 1, 'stage only via its command');
});

test('approvals come only from typed lines and bind to the file hash', () => {
  const rca = join('.sdlc', 'tickets', KEY, 'rca.md');
  writeFileSync(join(WS, rca), '# rca v1\n');
  assert.equal(sdlc('doc', 'register', KEY, 'rca', rca).stdout.trim(), 'v1');
  let r = hook('prompt', { prompt: `CONFIRM RCA ${KEY} v2` });
  assert.match(r.stdout, /is at v1/);
  r = hook('prompt', { prompt: `looks good\nCONFIRM RCA ${KEY} v1` });
  assert.match(r.stdout, /rca v1 approved/);
  assert.equal(sdlc('gate', KEY, 'analyze').stdout.trim(), 'ok');
  appendFileSync(join(WS, rca), 'edited\n');
  assert.equal(sdlc('gate', KEY, 'analyze').status, 4, 'edit voids approval');
});

test('review budgets refuse beyond the limit until authorized', () => {
  assert.equal(sdlc('budget', 'use', KEY, 'brief', 'reviewer').status, 0);
  assert.equal(sdlc('budget', 'use', KEY, 'brief', 'reviewer').status, 6);
  hook('prompt', { prompt: `AUTHORIZE REVIEW ${KEY} +1` });
  assert.equal(sdlc('budget', 'use', KEY, 'brief', 'reviewer').status, 0);
});

test('protected files and templates', () => {
  assert.equal(hook('pre-tool', { tool_name: 'Read', tool_input: { file_path: join(WS, 'svc', '.env') } }).status, 2);
  assert.equal(hook('pre-tool', { tool_name: 'Read', tool_input: { file_path: join(WS, 'svc', 'login_details.txt') } }).status, 2);
  assert.equal(hook('pre-tool', { tool_name: 'Bash', tool_input: { command: 'cat svc/.env | grep KEY' } }).status, 2);
  assert.equal(hook('pre-tool', { tool_name: 'Read', tool_input: { file_path: join(WS, 'svc', '.env.example') } }).status, 0);
  assert.equal(hook('pre-tool', { tool_name: 'Edit', tool_input: { file_path: join(WS, '.env.example'), new_string: 'API_KEY=changeme' } }).status, 0);
  assert.equal(hook('pre-tool', { tool_name: 'Edit', tool_input: { file_path: join(WS, '.env.example'), new_string: 'GH=ghp_abcdefghijklmnopqrstuvwxyz0123456789' } }).status, 2);
  assert.equal(hook('pre-tool', { tool_name: 'Read', tool_input: { file_path: join(WS, 'svc', '.env.dev') } }).status, 0, 'project template exception');
  assert.equal(hook('pre-tool', { tool_name: 'Edit', tool_input: { file_path: join(WS, '.claude', 'settings.json'), new_string: '{}' } }).status, 2);
});

test('source edits wait for the design on non-quick tracks', () => {
  const r = hook('pre-tool', { tool_name: 'Edit', tool_input: { file_path: join(WS, 'svc', 'src', 'a.py'), new_string: 'x = 2' } });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /Source edits start after/);
  assert.equal(hook('pre-tool', { tool_name: 'Write', tool_input: { file_path: join(WS, 'svc', 'tests', 'test_a.py'), content: 'def test(): pass' } }).status, 0, 'reproduction tests allowed');
});

test('git safety: add, commit, push, merge', () => {
  const repo = join(WS, 'svc');
  const run = (command) => hook('pre-tool', { tool_name: 'Bash', tool_input: { command } });
  assert.equal(run('git -C svc add .').status, 2);
  assert.equal(run('git -C svc add -A').status, 2);
  assert.equal(run('git -C svc add src/a.py').status, 0);
  assert.equal(run('git merge develop').status, 2);
  assert.equal(run('git -C svc rebase develop').status, 2);
  assert.equal(run('git -C svc push --force origin bug-fix/demo-7-fix-x').status, 2);
  assert.equal(run('gh pr merge 12 --squash').status, 2);
  assert.equal(run('git -C svc commit --no-verify -m "DEMO-7: x"').status, 2);
  writeFileSync(join(repo, 'src', 'a.py'), 'x = 3\n');
  git(repo, 'add', 'src/a.py');
  assert.equal(run('git -C svc commit -m "DEMO-7: x"').status, 2, 'not confirmed');
  hook('prompt', { prompt: `CONFIRM COMMIT ${KEY}` });
  assert.equal(run('git -C svc commit -m "DEMO-7: x"').status, 0, 'confirmed for this staged diff');
  assert.equal(run('git -C svc commit -m "DEMO-7: x"').status, 2, 'single use');
  assert.equal(run('git -C svc push -u origin bug-fix/demo-7-fix-x').status, 2, 'push not confirmed');
  hook('prompt', { prompt: `CONFIRM PUSH ${KEY}` });
  assert.equal(run('git -C svc push -u origin bug-fix/demo-7-fix-x').status, 0);
  assert.equal(run('git -C svc push origin develop').status, 2, 'protected branch');
});

test('redaction and connector writes', () => {
  const f = join(WS, 'c.md');
  writeFileSync(f, 'Patient john.doe@gmail.com called (615) 555-1234');
  assert.equal(sdlc('redact', f).status, 5);
  writeFileSync(f, 'Fixed on 2026-11-19, commit 3f9a2b1c, by dev@example.com');
  assert.equal(sdlc('redact', f).status, 0);
  assert.equal(hook('pre-tool', { tool_name: 'mcp__atlassian__addCommentToJiraIssue', tool_input: { body: 'MRN 445566 failed' } }).status, 2);
  assert.equal(hook('pre-tool', { tool_name: 'mcp__github__merge_pull_request', tool_input: {} }).status, 2);
});

test('git hooks: commit message needs the key', () => {
  const msg = join(WS, 'msg.txt');
  writeFileSync(msg, 'fix things');
  assert.equal(node(join(ED, 'scripts', 'githook.mjs'), ['commit-msg', msg], { cwd: join(WS, 'svc') }).status, 1);
  writeFileSync(msg, 'DEMO-7: fix things');
  assert.equal(node(join(ED, 'scripts', 'githook.mjs'), ['commit-msg', msg], { cwd: join(WS, 'svc') }).status, 0);
});

test('upgrade refuses hand-edited editions', () => {
  appendFileSync(join(ED, 'skills', 'pickup', 'SKILL.md'), '\nhand edit\n');
  const r = spawnSync(process.execPath, [join(CORE, 'generator', 'build-edition.mjs'), '--upgrade', ED], { encoding: 'utf8' });
  assert.equal(r.status, 3);
  assert.match(r.stderr, /skills\/pickup\/SKILL.md/);
});

test('session start shows the active ticket and next step', () => {
  const r = hook('session-start', {});
  assert.match(r.stdout, /Active ticket DEMO-7/);
  assert.match(r.stdout, /Next:/);
});

test('pre-commit blocks protected files and debug prints', () => {
  const repo = join(WS, 'svc');
  const pre = () => node(join(ED, 'scripts', 'githook.mjs'), ['pre-commit'], { cwd: repo });
  writeFileSync(join(repo, 'src', 'b.py'), 'print("DEBUG x")\n');
  git(repo, 'add', 'src/b.py');
  assert.equal(pre().status, 1);
  git(repo, 'rm', '-q', '--cached', 'src/b.py');
  writeFileSync(join(repo, 'src', 'b.py'), 'y = 2\n');
  git(repo, 'add', 'src/b.py');
  assert.equal(pre().status, 0);
  writeFileSync(join(repo, 'secrets.json'), '{}');
  git(repo, 'add', '-f', 'secrets.json');
  assert.equal(pre().status, 1);
});
