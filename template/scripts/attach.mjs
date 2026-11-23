#!/usr/bin/env node
// Upload files to a Jira ticket as attachments: screenshots, screen recordings, documents, anything.
//   node attach.mjs --site https://<site>.atlassian.net --key PROJ-123 [--max-mb N] [--allow-flagged] [--email-env NAME] [--token-env NAME] <file>...
//   node attach.mjs --check --site <url> <file>...      checks without uploading: credentials, site, files, size, personal data
// The Atlassian connector cannot upload files, so this uses the Jira REST API with the developer's own API token.
//   printf %s "<token>" | node attach.mjs --save --site <url> --email <email>   one-time: tests the login and saves it
// The login is saved once in ~/.claude/sdlc-core/jira-upload.json (site, email, token; the skill does this, the
// developer sets nothing up). JIRA_EMAIL, JIRA_API_TOKEN and JIRA_BASE_URL in the environment override it. Credentials
// are never printed. The token is only sent to an Atlassian Cloud site, and never to a host other than the saved site.
// Text files (md, txt, json, csv, log) are scanned for personal data and secrets first; flagged files are skipped
// unless --allow-flagged is given. Prints JSON. Exit: 0 all good, 2 usage, 3 credentials missing or rejected,
// 5 a file skipped as flagged, 6 unsafe site, 7 some files not uploaded.
import * as fs from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { redactionHits } from './lib/rules.mjs';

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const VALUE_FLAGS = new Set(['--site', '--key', '--max-mb', '--email-env', '--token-env', '--email']);
const paths = argv.filter((a, i) => !a.startsWith('--') && !VALUE_FLAGS.has(argv[i - 1]));
const out = (obj, code) => { console.log(JSON.stringify(obj, null, 2)); process.exit(code); };
const die = (msg, code) => out({ ok: false, error: msg }, code);

const check = flag('check');
const save = flag('save');
const site = opt('site');
const key = opt('key');
if (!site) die('usage: attach.mjs [--check] --site <url> [--key PROJ-123] <file>...   |   printf %s "<token>" | attach.mjs --save --site <url> --email <email>', 2);
if (!check && !save && !/^[A-Z][A-Z0-9_]+-\d+$/.test(key || '')) die('--key must be a ticket key such as PROJ-123', 2);
if (!save && !paths.length) die('no files given', 2);

// The developer's own Jira login, saved once by "attach.mjs --save" in a file in their user folder (never in a repo).
// Environment variables (JIRA_EMAIL, JIRA_API_TOKEN, JIRA_BASE_URL) override it, for CI or for people who prefer them.
const configDir = process.env.SDLC_CORE_CONFIG_DIR || join(homedir(), '.claude', 'sdlc-core');
const credFile = join(configDir, 'jira-upload.json');
const FILE_FIELD = { JIRA_EMAIL: 'email', JIRA_API_TOKEN: 'token', JIRA_BASE_URL: 'site' };
function savedFileValue(name) {
  const field = FILE_FIELD[name];
  if (!field) return '';
  try { const v = JSON.parse(fs.readFileSync(credFile, 'utf8'))[field]; return typeof v === 'string' ? v.trim() : ''; } catch { return ''; }
}
// A variable saved with setx is not visible to a session that was already running, so on Windows also look at the
// saved user variables (registry HKCU\Environment). Values are only read here, never printed.
function savedUserVar(name) {
  if (process.platform !== 'win32' || !/^[A-Za-z0-9_]+$/.test(name)) return '';
  const r = spawnSync('reg', ['query', 'HKCU\\Environment', '/v', name], { encoding: 'utf8', windowsHide: true });
  const m = r.status === 0 && new RegExp(`^\\s*${name}\\s+REG_(?:EXPAND_)?SZ\\s+(.*)$`, 'im').exec(r.stdout || '');
  return m ? m[1].trim() : '';
}
const credential = (n) => process.env[n] || savedUserVar(n) || savedFileValue(n);

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
  if (base && base !== host && !save) die(`the saved Jira site (${base}) is not this ticket's site (${host}); refusing to send credentials there. To switch sites save the login again with --save.`, 6);
  if (!local && !host.endsWith('.atlassian.net') && base !== host) die(`${host} is not an Atlassian Cloud site; uploads only go to *.atlassian.net unless the login was saved for that host`, 6);
  pinned = Boolean(base);
  origin = u.origin;
} catch (e) {
  die(`bad --site: ${e.message}`, 2);
}

// One-time set-up from inside the skill: the token arrives on stdin (never on a command line), is tested against Jira,
// and only a working login is saved, in the developer's own user folder.
if (save) {
  const email = (opt('email') || '').trim();
  const token = fs.readFileSync(0, 'utf8').trim();
  if (!email || !token) die('usage: printf %s "<token>" | attach.mjs --save --site <url> --email <email>', 2);
  let status;
  try {
    const res = await fetch(`${origin}/rest/api/3/myself`, { headers: { Authorization: `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`, Accept: 'application/json' } });
    await res.arrayBuffer();
    status = res.status;
  } catch (e) {
    die(`could not reach ${origin} (${e.message}); nothing saved`, 3);
  }
  if (status !== 200) die(`Jira rejected the email or token (HTTP ${status}); nothing saved`, 3);
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(credFile, JSON.stringify({ site: origin, email, token }, null, 2), { mode: 0o600 });
  console.log(JSON.stringify({ ok: true, saved: credFile, site: origin, email }, null, 2));
  process.exit(0);
}

const missing = [emailEnv, tokenEnv].filter((n) => !credential(n));
const auth = missing.length ? null : `Basic ${Buffer.from(`${credential(emailEnv)}:${credential(tokenEnv)}`).toString('base64')}`;

// Credential-type files are never uploaded, whatever the ticket says.
const CREDENTIAL_FILE = /^(\.env(\..*)?|id_(rsa|dsa|ecdsa|ed25519)(\.pub)?|\.npmrc|\.netrc|credentials(\..*)?)$|\.(pem|key|pfx|p12|ppk|kdbx)$/i;
const SCAN_LIMIT = 20 * 1024 * 1024;
// Files with these extensions are always scanned, whatever their encoding; any other file is scanned when it looks like text
// (its first bytes hold no NUL and decode as UTF-8, or it starts with a UTF-16 byte-order mark).
const TEXT_EXT = /\.(md|txt|json|csv|tsv|log|xml|html?|ya?ml|ini|conf|cfg|properties|sql|js|mjs|ts|java|py|sh|ps1)$/i;
function looksLikeText(path) {
  const fd = fs.openSync(path, 'r');
  try {
    const buf = Buffer.alloc(8192);
    const n = fs.readSync(fd, buf, 0, buf.length, 0);
    const head = buf.subarray(0, n);
    if (n >= 2 && ((head[0] === 0xff && head[1] === 0xfe) || (head[0] === 0xfe && head[1] === 0xff))) return true;
    if (head.includes(0)) return false;
    try { new TextDecoder('utf-8', { fatal: true }).decode(head, { stream: true }); return true; } catch { return false; }
  } finally { fs.closeSync(fd); }
}
// Decodes without ever failing: honours a UTF-16 byte-order mark, replaces bad bytes, drops NULs, so nothing can hide from the scan.
function scanText(buf) {
  let text;
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) text = buf.subarray(2).toString('utf16le');
  else if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) text = Buffer.from(buf.subarray(2)).swap16().toString('utf16le');
  else text = buf.toString('utf8');
  return text.replace(/\0/g, '');
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
    if (TEXT_EXT.test(info.file) || looksLikeText(path)) {
      if (st.size > SCAN_LIMIT) {
        // Too large to scan: fail closed, the developer decides with --allow-flagged.
        info.flagged = 1;
        info.unscanned = true;
      } else {
        const hits = redactionHits(scanText(fs.readFileSync(path)), null);
        if (hits.length) info.flagged = hits.length;
      }
    }
  } catch { return { ...info, problem: 'file could not be read' }; }
  return info;
});
const publicInfo = (i) => ({ file: i.file, size: i.size, ...(i.flagged ? { flagged: i.flagged } : {}), ...(i.problem ? { problem: i.problem } : {}) });
const blocked = (i) => i.problem || (i.flagged && !flag('allow-flagged'));
const why = (i) => i.problem || (i.unscanned ? `flagged: text file larger than ${SCAN_LIMIT / 1024 / 1024} MB, not scanned; not uploaded without --allow-flagged` : `flagged: ${i.flagged} possible personal-data or secret item(s); not uploaded without --allow-flagged`);

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
  return { obj: { ok, site: origin, siteBound: pinned ? 'yes (the saved site)' : 'no: save the login (attach.mjs --save) to bind the token to this site', credentials, files: infos.map(publicInfo) }, code: ok ? 0 : credentials === 'ok' ? 5 : 3 };
}

async function uploadAll() {
if (missing.length) return { obj: { ok: false, error: `no saved Jira login (missing ${missing.join(' and ')}): save it once with attach.mjs --save, which the create-ticket skill does for you`, attached: [], failed: infos.map((i) => ({ file: i.file, reason: 'no credentials' })) }, code: 3 };

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
