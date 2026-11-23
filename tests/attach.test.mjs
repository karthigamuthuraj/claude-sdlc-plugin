import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', 'template', 'scripts', 'attach.mjs');
const EMAIL = 'dev@example.com';
const TOKEN = 'tok-SECRET-123';
const EXPECTED = `Basic ${Buffer.from(`${EMAIL}:${TOKEN}`).toString('base64')}`;
const calls = [];

// A stand-in for Jira: /myself checks the credentials, the attachment endpoint stores nothing and answers like Jira.
const server = http.createServer((req, res) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    calls.push({ method: req.method, url: req.url, auth: req.headers.authorization, xat: req.headers['x-atlassian-token'], body: body.toString('latin1') });
    if (req.url === '/rest/api/3/myself') { res.writeHead(req.headers.authorization === EXPECTED ? 200 : 401); return res.end('{}'); }
    const m = /\/issue\/([A-Z]+-\d+)\/attachments$/.exec(req.url);
    if (m && m[1] === 'BIG-1') { res.writeHead(413); return res.end('too big'); }
    if (m) {
      const name = /filename="([^"]+)"/.exec(body.toString('latin1'));
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify([{ id: `att-${calls.length}`, filename: name && name[1] }]));
    }
    res.writeHead(404);
    return res.end();
  });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
after(() => server.close());
const SITE = `http://127.0.0.1:${server.address().port}`;

const dir = mkdtempSync(join(tmpdir(), 'attach-test-'));
const png = join(dir, 'screenshot.png');
const mp4 = join(dir, 'recording.mp4');
const log = join(dir, 'notes.log');
const flagged = join(dir, 'transcript.txt');
writeFileSync(png, Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.from('PNGDATA')]));
writeFileSync(mp4, Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypisomVIDEODATA')]));
writeFileSync(log, 'plain log line, nothing personal');
writeFileSync(flagged, 'call me at jo@corp.com about the visit');

const baseEnv = () => { const e = { ...process.env }; for (const k of ['JIRA_BASE_URL', 'JIRA_EMAIL', 'JIRA_API_TOKEN']) delete e[k]; return e; };
const withCreds = () => ({ ...baseEnv(), JIRA_EMAIL: EMAIL, JIRA_API_TOKEN: TOKEN, JIRA_BASE_URL: SITE });
const run = (args, env) => new Promise((resolve) => {
  const p = spawn(process.execPath, [SCRIPT, ...args], { env });
  let stdout = '';
  let stderr = '';
  p.stdout.on('data', (d) => { stdout += d; });
  p.stderr.on('data', (d) => { stderr += d; });
  p.on('close', (status) => { let json = null; try { json = JSON.parse(stdout); } catch { /* not json */ } resolve({ status, stdout, stderr, json }); });
});
const reset = () => { calls.length = 0; };

test('attach: uploads every kind of file with the right headers and never prints the token', async () => {
  reset();
  const r = await run(['--site', SITE, '--key', 'PROJ-1', png, mp4, log], withCreds());
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.deepEqual(r.json.attached.map((a) => a.file), ['screenshot.png', 'recording.mp4', 'notes.log']);
  const posts = calls.filter((c) => c.method === 'POST');
  assert.equal(posts.length, 3);
  for (const c of posts) {
    assert.equal(c.url, '/rest/api/3/issue/PROJ-1/attachments');
    assert.equal(c.auth, EXPECTED);
    assert.equal(c.xat, 'no-check');
  }
  assert.ok(posts[0].body.includes('PNGDATA') && posts[1].body.includes('VIDEODATA'), 'the file contents are sent');
  assert.ok(!r.stdout.includes(TOKEN) && !r.stderr.includes(TOKEN), 'the token is not printed');
});

test('attach: --check reports ready credentials and files without uploading', async () => {
  reset();
  const r = await run(['--check', '--site', SITE, png, mp4], withCreds());
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(r.json.credentials, 'ok');
  assert.equal(r.json.files.length, 2);
  assert.equal(calls.filter((c) => c.method === 'POST').length, 0, 'nothing is uploaded in check mode');
});

test('attach: missing credentials are named, not guessed, and nothing is sent', async () => {
  reset();
  const check = await run(['--check', '--site', SITE, png], baseEnv());
  assert.equal(check.status, 3);
  assert.match(check.json.credentials, /missing: JIRA_EMAIL, JIRA_API_TOKEN/);
  const up = await run(['--site', SITE, '--key', 'PROJ-1', png], baseEnv());
  assert.equal(up.status, 3);
  assert.match(up.json.error, /JIRA_EMAIL and JIRA_API_TOKEN/);
  assert.equal(calls.length, 0);
});

test('attach: a rejected token is reported by --check', async () => {
  const env = { ...withCreds(), JIRA_API_TOKEN: 'wrong-token' };
  const r = await run(['--check', '--site', SITE, png], env);
  assert.equal(r.status, 3);
  assert.match(r.json.credentials, /rejected \(HTTP 401\)/);
  assert.ok(!r.stdout.includes('wrong-token'));
});

test('attach: text files with personal data are skipped unless allowed', async () => {
  reset();
  const skipped = await run(['--site', SITE, '--key', 'PROJ-2', png, flagged], withCreds());
  assert.equal(skipped.status, 5, skipped.stdout);
  assert.deepEqual(skipped.json.attached.map((a) => a.file), ['screenshot.png']);
  assert.match(skipped.json.failed[0].reason, /flagged/);
  assert.equal(calls.filter((c) => c.method === 'POST').length, 1);
  reset();
  const allowed = await run(['--site', SITE, '--key', 'PROJ-2', '--allow-flagged', flagged], withCreds());
  assert.equal(allowed.status, 0, allowed.stdout);
  assert.equal(calls.filter((c) => c.method === 'POST').length, 1);
});

test('attach: a file Jira refuses is reported with the reason and the others still go up', async () => {
  reset();
  const r = await run(['--site', SITE, '--key', 'BIG-1', png], withCreds());
  assert.equal(r.status, 7);
  assert.match(r.json.failed[0].reason, /too large/);
  const missing = await run(['--site', SITE, '--key', 'PROJ-3', join(dir, 'nope.png'), log], withCreds());
  assert.equal(missing.status, 7);
  assert.deepEqual(missing.json.attached.map((a) => a.file), ['notes.log']);
  assert.equal(missing.json.failed[0].reason, 'file not found');
});

test('attach: the token is never sent to an unsafe or mismatched host', async () => {
  reset();
  const other = await run(['--site', 'https://evil.example.com', '--key', 'PROJ-1', png], { ...baseEnv(), JIRA_EMAIL: EMAIL, JIRA_API_TOKEN: TOKEN });
  assert.equal(other.status, 6, other.stdout);
  const plain = await run(['--site', 'http://acme.atlassian.net', '--key', 'PROJ-1', png], { ...baseEnv(), JIRA_EMAIL: EMAIL, JIRA_API_TOKEN: TOKEN });
  assert.equal(plain.status, 6, 'plain http is refused for a remote host');
  const mismatch = await run(['--site', 'https://acme.atlassian.net', '--key', 'PROJ-1', png], { ...baseEnv(), JIRA_EMAIL: EMAIL, JIRA_API_TOKEN: TOKEN, JIRA_BASE_URL: 'https://other.atlassian.net' });
  assert.equal(mismatch.status, 6, mismatch.stdout);
  assert.equal(calls.length, 0);
});

test('create-ticket skill: collects every file, checks the upload first and verifies the attachments', () => {
  const skill = readFileSync(join(dirname(SCRIPT), '..', 'skills', 'create-ticket', 'SKILL.md'), 'utf8');
  assert.match(skill, /every file the developer provided is uploaded to the ticket/);
  assert.match(skill, /attach\.mjs --check --site/);
  assert.match(skill, /attach\.mjs --site <site url> --key <PARENT KEY>/);
  assert.match(skill, /Never say a file is attached unless the re-read of the ticket lists it/);
  assert.ok(!/via <jira attach/.test(skill), 'the old by-hand preview wording is gone');
});

test('create-ticket skill: waits for the upload set-up instead of creating the ticket without the files', () => {
  const skill = readFileSync(join(dirname(SCRIPT), '..', 'skills', 'create-ticket', 'SKILL.md'), 'utf8');
  assert.match(skill, /do not create the ticket yet/);
  assert.match(skill, /no answer or "no preference" means stop and wait/);
  assert.match(skill, /setup-jira-upload.ps1/);
});

test('attach: on Windows, saved user variables are used when the session lacks them', { skip: process.platform !== 'win32' }, async () => {
  const E = 'JIRA_ATTACH_TEST_EMAIL';
  const T = 'JIRA_ATTACH_TEST_TOKEN';
  const KEY = 'HKCU\\Environment';
  const reg = (args) => spawnSync('reg', args, { encoding: 'utf8' });
  try {
    reg(['add', KEY, '/v', E, '/t', 'REG_SZ', '/d', EMAIL, '/f']);
    reg(['add', KEY, '/v', T, '/t', 'REG_SZ', '/d', TOKEN, '/f']);
    const r = await run(['--check', '--site', SITE, '--email-env', E, '--token-env', T, png], { ...baseEnv(), JIRA_BASE_URL: SITE });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(r.json.credentials, 'ok');
    assert.ok(!r.stdout.includes(TOKEN) && !r.stderr.includes(TOKEN));
  } finally {
    reg(['delete', KEY, '/v', E, '/f']);
    reg(['delete', KEY, '/v', T, '/f']);
  }
});

test('attach: only Jira-named variables can be the login', async () => {
  reset();
  const r = await run(['--check', '--site', SITE, '--token-env', 'AWS_SECRET_ACCESS_KEY', png], { ...withCreds(), AWS_SECRET_ACCESS_KEY: 'x' });
  assert.equal(r.status, 2, r.stdout);
  assert.match(r.json.error, /not allowed as a credential variable/);
  assert.equal(calls.length, 0);
});

test('attach: credential-type files are refused and any text file is scanned, whatever its extension', async () => {
  reset();
  const envFile = join(dir, '.env');
  const noExt = join(dir, 'notes');
  writeFileSync(envFile, 'KEY=value');
  writeFileSync(noExt, 'call me at jo@corp.com about the visit');
  const r = await run(['--check', '--site', SITE, envFile, noExt, png], withCreds());
  assert.equal(r.status, 5, r.stdout);
  const byName = Object.fromEntries(r.json.files.map((f) => [f.file, f]));
  assert.match(byName['.env'].problem, /credential-type file/);
  assert.ok(byName['notes'].flagged > 0, 'a text file without a known extension is scanned');
  assert.ok(!byName['screenshot.png'].problem && !byName['screenshot.png'].flagged);
  const up = await run(['--site', SITE, '--key', 'PROJ-9', '--allow-flagged', envFile], withCreds());
  assert.equal(up.status, 7, 'a credential-type file is never uploaded, even with --allow-flagged');
  assert.equal(calls.filter((c) => c.method === 'POST').length, 0);
});

test('attach: --check says whether the token is bound to the saved site', async () => {
  const bound = await run(['--check', '--site', SITE, png], withCreds());
  assert.match(bound.json.siteBound, /^yes/);
  // On a Windows machine that has saved its own JIRA_BASE_URL the "not bound" case cannot be shown, so skip that half.
  const saved = process.platform === 'win32' && spawnSync('reg', ['query', 'HKCU\\Environment', '/v', 'JIRA_BASE_URL'], { encoding: 'utf8' }).status === 0;
  if (!saved) {
    const unbound = await run(['--check', '--site', SITE, png], { ...baseEnv(), JIRA_EMAIL: EMAIL, JIRA_API_TOKEN: TOKEN });
    assert.match(unbound.json.siteBound, /^no/);
  }
});

test('attach: usage errors', async () => {
  assert.equal((await run([], baseEnv())).status, 2);
  assert.equal((await run(['--site', SITE, png], withCreds())).status, 2, 'a ticket key is required to upload');
  assert.equal((await run(['--site', SITE, '--key', 'not-a-key', png], withCreds())).status, 2);
  assert.equal((await run(['--site', SITE, '--key', 'PROJ-1'], withCreds())).status, 2, 'no files');
});
