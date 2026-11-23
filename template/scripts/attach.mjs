#!/usr/bin/env node
// Upload files to a Jira ticket as attachments: screenshots, screen recordings, documents, anything.
//   node attach.mjs --site https://<site>.atlassian.net --key PROJ-123 [--max-mb N] [--allow-flagged] [--email-env NAME] [--token-env NAME] <file>...
//   node attach.mjs --check --site <url> <file>...      checks without uploading: credentials, site, files, size, personal data
// The Atlassian connector cannot upload files, so this uses the Jira REST API with the developer's own API token.
// Credentials are read from the environment only (JIRA_EMAIL and JIRA_API_TOKEN by default; --email-env and
// --token-env rename them) and are never printed. The token is only sent to an Atlassian Cloud site, or to the
// host named in JIRA_BASE_URL, and never to a host that differs from JIRA_BASE_URL when that is set.
// Text files (md, txt, json, csv, log) are scanned for personal data and secrets first; flagged files are skipped
// unless --allow-flagged is given. Prints JSON. Exit: 0 all good, 2 usage, 3 credentials missing or rejected,
// 5 a file skipped as flagged, 6 unsafe site, 7 some files not uploaded.
import * as fs from 'node:fs';
import { basename, extname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { redactionHits } from './lib/rules.mjs';

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const VALUE_FLAGS = new Set(['--site', '--key', '--max-mb', '--email-env', '--token-env']);
const paths = argv.filter((a, i) => !a.startsWith('--') && !VALUE_FLAGS.has(argv[i - 1]));
const out = (obj, code) => { console.log(JSON.stringify(obj, null, 2)); process.exit(code); };
const die = (msg, code) => out({ ok: false, error: msg }, code);

const check = flag('check');
const site = opt('site');
const key = opt('key');
if (!site) die('usage: attach.mjs [--check] --site <url> [--key PROJ-123] <file>...', 2);
if (!check && !/^[A-Z][A-Z0-9_]+-\d+$/.test(key || '')) die('--key must be a ticket key such as PROJ-123', 2);
if (!paths.length) die('no files given', 2);

// A variable saved with setx is not visible to a session that was already running, so on Windows fall back to the
// saved user variables (registry HKCU\Environment). Values are only read here, never printed.
function savedUserVar(name) {
  if (process.platform !== 'win32' || !/^[A-Za-z0-9_]+$/.test(name)) return '';
  const r = spawnSync('reg', ['query', 'HKCU\\Environment', '/v', name], { encoding: 'utf8', windowsHide: true });
  const m = r.status === 0 && new RegExp(`^\\s*${name}\\s+REG_(?:EXPAND_)?SZ\\s+(.*)$`, 'im').exec(r.stdout || '');
  return m ? m[1].trim() : '';
}
const credential = (n) => process.env[n] || savedUserVar(n);

// Only variables meant for Jira may be used as the login, so this script cannot be pointed at another secret.
const emailEnv = opt('email-env', 'JIRA_EMAIL');
const tokenEnv = opt('token-env', 'JIRA_API_TOKEN');
for (const n of [emailEnv, tokenEnv]) if (!/^(JIRA|ATLASSIAN)_[A-Z0-9_]+$/.test(n)) die(`${n} is not allowed as a credential variable; use a name starting with JIRA_ or ATLASSIAN_`, 2);

// Where the token may go. JIRA_BASE_URL (saved by setup-jira-upload.ps1) pins it to one site: any other host is refused.
let origin;
let pinned = false;
try {
  const u = new URL(site);
  const host = u.hostname.toLowerCase();
  const local = host === 'localhost' || host === '127.0.0.1';
  if (u.protocol !== 'https:' && !(local && u.protocol === 'http:')) die('the site must be an https address', 6);
  const configured = credential('JIRA_BASE_URL');
  const base = configured ? new URL(configured).hostname.toLowerCase() : null;
  if (base && base !== host) die(`JIRA_BASE_URL (${base}) is not this ticket's site (${host}); refusing to send credentials there`, 6);
  if (!local && !host.endsWith('.atlassian.net') && base !== host) die(`${host} is not an Atlassian Cloud site; set JIRA_BASE_URL to it to allow uploads`, 6);
  pinned = Boolean(base);
  origin = u.origin;
} catch (e) {
  die(`bad --site: ${e.message}`, 2);
}

const missing = [emailEnv, tokenEnv].filter((n) => !credential(n));
const auth = missing.length ? null : `Basic ${Buffer.from(`${credential(emailEnv)}:${credential(tokenEnv)}`).toString('base64')}`;

// Credential-type files are never uploaded, whatever the ticket says.
const CREDENTIAL_FILE = /^(\.env(\..*)?|id_(rsa|dsa|ecdsa|ed25519)(\.pub)?|\.npmrc|\.netrc|credentials(\..*)?)$|\.(pem|key|pfx|p12|ppk|kdbx)$/i;
const SCAN_LIMIT = 20 * 1024 * 1024;
// A file is text when its first bytes hold no NUL and decode as UTF-8; every such file is scanned, whatever its extension.
function looksLikeText(path) {
  const fd = fs.openSync(path, 'r');
  try {
    const buf = Buffer.alloc(8192);
    const n = fs.readSync(fd, buf, 0, buf.length, 0);
    const head = buf.subarray(0, n);
    if (head.includes(0)) return false;
    try { new TextDecoder('utf-8', { fatal: true }).decode(head, { stream: true }); return true; } catch { return false; }
  } finally { fs.closeSync(fd); }
}
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.mkv': 'video/x-matroska', '.pdf': 'application/pdf', '.txt': 'text/plain', '.md': 'text/markdown', '.json': 'application/json', '.csv': 'text/csv', '.log': 'text/plain', '.zip': 'application/zip', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation' };
const maxBytes = Number(opt('max-mb', 0)) > 0 ? Number(opt('max-mb')) * 1024 * 1024 : 0;

const infos = paths.map((p) => {
  const path = resolve(p);
  const info = { file: basename(path), path };
  let st;
  try { st = fs.statSync(path); } catch { return { ...info, problem: 'file not found' }; }
  if (!st.isFile()) return { ...info, problem: 'not a regular file' };
  info.size = st.size;
  if (!st.size) return { ...info, problem: 'file is empty' };
  if (maxBytes && st.size > maxBytes) return { ...info, problem: `over the ${opt('max-mb')} MB limit` };
  if (CREDENTIAL_FILE.test(info.file)) return { ...info, problem: 'credential-type file (key, .env, .npmrc ...): never uploaded' };
  try {
    if (looksLikeText(path)) {
      const text = st.size > SCAN_LIMIT ? fs.readFileSync(path).subarray(0, SCAN_LIMIT).toString('utf8') : fs.readFileSync(path, 'utf8');
      const hits = redactionHits(text, null);
      if (hits.length) info.flagged = hits.length;
    }
  } catch { return { ...info, problem: 'file could not be read' }; }
  return info;
});
const publicInfo = (i) => ({ file: i.file, size: i.size, ...(i.flagged ? { flagged: i.flagged } : {}), ...(i.problem ? { problem: i.problem } : {}) });
const blocked = (i) => i.problem || (i.flagged && !flag('allow-flagged'));
const why = (i) => i.problem || `flagged: ${i.flagged} possible personal-data or secret item(s); not uploaded without --allow-flagged`;

// The network work returns its result instead of calling process.exit, so open uploads finish cleanly.
async function checkOnly() {
  let credentials = missing.length ? `missing: ${missing.join(', ')}` : 'unchecked';
  if (!missing.length) {
    try {
      const res = await fetch(`${origin}/rest/api/3/myself`, { headers: { Authorization: auth, Accept: 'application/json' } });
      credentials = res.ok ? 'ok' : `rejected (HTTP ${res.status})`;
    } catch (e) {
      credentials = `unreachable (${e.message})`;
    }
  }
  const ok = credentials === 'ok' && !infos.filter(blocked).length;
  return { obj: { ok, site: origin, siteBound: pinned ? 'yes (JIRA_BASE_URL)' : 'no: set JIRA_BASE_URL (setup-jira-upload.ps1) to bind the token to this site', credentials, files: infos.map(publicInfo) }, code: ok ? 0 : credentials === 'ok' ? 5 : 3 };
}

async function uploadAll() {
if (missing.length) return { obj: { ok: false, error: `set ${missing.join(' and ')} in your environment (never paste a token into a chat or a command)`, attached: [], failed: infos.map((i) => ({ file: i.file, reason: 'no credentials' })) }, code: 3 };

const attached = [];
const failed = [];
for (const info of infos) {
  if (blocked(info)) { failed.push({ file: info.file, reason: why(info) }); continue; }
  try {
    const blob = typeof fs.openAsBlob === 'function' ? await fs.openAsBlob(info.path, { type: MIME[extname(info.path).toLowerCase()] || 'application/octet-stream' })
      : new Blob([fs.readFileSync(info.path)], { type: MIME[extname(info.path).toLowerCase()] || 'application/octet-stream' });
    const form = new FormData();
    form.append('file', blob, info.file);
    const res = await fetch(`${origin}/rest/api/3/issue/${key}/attachments`, { method: 'POST', headers: { Authorization: auth, 'X-Atlassian-Token': 'no-check', Accept: 'application/json' }, body: form });
    if (res.ok) {
      const body = await res.json().catch(() => []);
      const a = Array.isArray(body) ? body[0] : null;
      attached.push({ file: info.file, id: a && a.id, size: info.size });
    } else {
      const text = (await res.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 160);
      failed.push({ file: info.file, reason: res.status === 413 ? 'too large for this Jira site (HTTP 413)' : `HTTP ${res.status}${text ? `: ${text}` : ''}` });
    }
  } catch (e) {
    failed.push({ file: info.file, reason: `upload error: ${e.message}` });
  }
}
const onlyFlagged = failed.length && failed.every((f) => f.reason.startsWith('flagged'));
return { obj: { ok: !failed.length, key, attached, failed }, code: !failed.length ? 0 : onlyFlagged ? 5 : 7 };
}

const result = check ? await checkOnly() : await uploadAll();
console.log(JSON.stringify(result.obj, null, 2));
process.exitCode = result.code;
