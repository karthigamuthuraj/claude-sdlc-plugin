#!/usr/bin/env node
// Jira REST fallback for when the Atlassian connector cannot write. Uses the developer's own token
// from the environment variables named in project.json -> tracker.authEnv. Never reads tokens from files.
import { readFileSync, statSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { findWorkspace, loadProfile } from '../../scripts/lib/workspace.mjs';
import { redactionHits } from '../../scripts/lib/rules.mjs';

const die = (msg, code = 1) => { process.stderr.write(`jira: ${msg}\n`); process.exit(code); };
const ws = findWorkspace();
if (!ws) die('no .sdlc/project.json found; run setup first', 2);
const profile = loadProfile(ws);
const t = profile.tracker;
const MAX_MB = t.maxAttachmentMb || 10;

function auth() {
  const email = process.env[t.authEnv.email];
  const token = process.env[t.authEnv.token];
  if (!email || !token) die(`set ${t.authEnv.email} and ${t.authEnv.token} in your shell environment`, 2);
  return `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`;
}

async function call(method, path, body, extra = {}) {
  const headers = { Authorization: auth(), Accept: 'application/json', ...extra };
  const isForm = body instanceof FormData;
  if (body && !isForm) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${t.site}${path}`, { method, headers, body: isForm ? body : body && JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) die(`${method} ${path} -> ${res.status}: ${text.slice(0, 400)}`, 3);
  return text ? JSON.parse(text) : {};
}

const checkKey = (k) => (new RegExp(t.keyPattern).test(k || '') ? k : die(`invalid key "${k}"`));
const flags = process.argv.slice(2).filter((a) => a.startsWith('--'));
const [cmd, ...args] = process.argv.slice(2).filter((a) => !a.startsWith('--'));

function guard(text) {
  const hits = redactionHits(text, profile);
  if (hits.length && !flags.includes('--allow-flagged')) {
    die(`redaction scan flagged ${hits.length} item(s): ${hits.slice(0, 5).map((h) => JSON.stringify(h)).join(', ')}. Rewrite the text, or confirm with the developer and pass --allow-flagged.`, 5);
  }
}

switch (cmd) {
  case 'myself': { const me = await call('GET', '/rest/api/2/myself'); console.log(JSON.stringify({ accountId: me.accountId, displayName: me.displayName })); break; }
  case 'get': {
    const k = checkKey(args[0]);
    console.log(JSON.stringify(await call('GET', `/rest/api/2/issue/${k}?fields=summary,status,issuetype,assignee,reporter,priority,labels,description,issuelinks,subtasks,comment,attachment,components,customfield_10020`), null, 2));
    break;
  }
  case 'search': {
    const r = await call('POST', '/rest/api/3/search/jql', { jql: args.join(' '), maxResults: 50, fields: ['summary', 'status', 'issuetype', 'priority', 'assignee'] });
    console.log(JSON.stringify(r.issues?.map((i) => ({ key: i.key, summary: i.fields.summary, status: i.fields.status?.name, type: i.fields.issuetype?.name, priority: i.fields.priority?.name })) || [], null, 2));
    break;
  }
  case 'comment': {
    const k = checkKey(args[0]); const body = readFileSync(resolve(args[1]), 'utf8'); guard(body);
    const res = await call('POST', `/rest/api/2/issue/${k}/comment`, { body: `${t.commentPrefix || '[sdlc]'} ${body}` });
    console.log(res.id); break;
  }
  case 'transition': {
    const k = checkKey(args[0]); const target = args.slice(1).join(' ');
    if ((t.humanOnlyStatuses || []).map((s) => s.toLowerCase()).includes(target.toLowerCase())) die(`"${target}" is a human-only status`, 6);
    const { transitions } = await call('GET', `/rest/api/2/issue/${k}/transitions`);
    const tr = transitions.find((x) => x.to?.name?.toLowerCase() === target.toLowerCase());
    if (!tr) die(`no transition to "${target}"; available: ${transitions.map((x) => x.to?.name).join(', ')}`, 7);
    await call('POST', `/rest/api/2/issue/${k}/transitions`, { transition: { id: tr.id } });
    console.log(`moved ${k} -> ${tr.to.name}`); break;
  }
  case 'attach': {
    const k = checkKey(args[0]); const file = resolve(args[1]);
    if (statSync(file).size > MAX_MB * 1024 * 1024) die(`file over ${MAX_MB} MB`);
    const data = readFileSync(file);
    if (/\.(md|txt|json|csv|log)$/i.test(file)) guard(data.toString('utf8'));
    const form = new FormData(); form.append('file', new Blob([data]), basename(file));
    const res = await call('POST', `/rest/api/2/issue/${k}/attachments`, form, { 'X-Atlassian-Token': 'no-check' });
    console.log(Array.isArray(res) ? res.map((a) => a.id).join(',') : 'attached'); break;
  }
  case 'assign': {
    // assign <KEY> <email or name> — only after the developer confirmed the person.
    const k = checkKey(args[0]); const who = args.slice(1).join(' ');
    const users = await call('GET', `/rest/api/2/user/search?query=${encodeURIComponent(who)}`);
    if (users.length !== 1) die(`"${who}" matched ${users.length} users; use a more specific name or email`, 8);
    await call('PUT', `/rest/api/2/issue/${k}/assignee`, { accountId: users[0].accountId });
    console.log(`assigned ${k} -> ${users[0].displayName}`); break;
  }
  case 'worklog': {
    // worklog <KEY> <seconds> <startedISO> <comment.md> — only after the developer confirmed the hours.
    const k = checkKey(args[0]); const seconds = Number(args[1]);
    if (!Number.isInteger(seconds) || seconds < 60) die('seconds must be an integer of at least 60');
    const comment = readFileSync(resolve(args[3]), 'utf8'); guard(comment);
    const started = new Date(args[2]).toISOString().replace('Z', '+0000');
    const res = await call('POST', `/rest/api/2/issue/${k}/worklog`, { timeSpentSeconds: seconds, started, comment });
    console.log(res.id); break;
  }
  default:
    die('usage: jira.mjs myself | get <KEY> | search <JQL> | comment <KEY> <file> | transition <KEY> <status> | attach <KEY> <file> | assign <KEY> <who> | worklog <KEY> <seconds> <startedISO> <file>');
}
