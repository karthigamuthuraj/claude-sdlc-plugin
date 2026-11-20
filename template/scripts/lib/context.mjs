// Shared ticket context: one context.json + log.md per ticket.
import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync, renameSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { PLUGIN_ROOT, readJson } from './workspace.mjs';

export const STAGES = [
  'picked_up', 'investigated', 'analyzed', 'designed', 'kicked_off', 'tasks_ready', 'building',
  'verified', 'committed', 'pr_open', 'handed_off', 'reviewed', 'qa_handed_over',
];
export const DOC_TYPES = ['logs', 'rca', 'requirements', 'bugfix', 'brief', 'design', 'kickoff'];
export const EVENTS = ['start', 'end', 'decision', 'tracker', 'blocked', 'deviation', 'approval', 'budget', 'model'];

export const now = () => new Date().toISOString();
export const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

export function ticketsDir(ws, profile) {
  return join(ws, profile.ticketDir || '.sdlc/tickets');
}
export function ticketDir(ws, profile, key) {
  return join(ticketsDir(ws, profile), key);
}

export function checkKey(profile, key) {
  const rx = new RegExp(profile.tracker?.keyPattern || '^[A-Z][A-Z0-9]+-\\d+$');
  if (!key || !rx.test(key)) throw new Error(`invalid ticket key "${key}"`);
  return key;
}

export function load(ws, profile, key) {
  const p = join(ticketDir(ws, profile, key), 'context.json');
  if (!existsSync(p)) throw Object.assign(new Error(`no context for ${key}; run pickup first`), { code: 2 });
  return JSON.parse(readFileSync(p, 'utf8'));
}

export function save(ws, profile, key, ctx) {
  ctx.updated_at = now();
  const p = join(ticketDir(ws, profile, key), 'context.json');
  writeFileSync(`${p}.tmp`, `${JSON.stringify(ctx, null, 2)}\n`);
  renameSync(`${p}.tmp`, p);
}

export function init(ws, profile, key, seed) {
  const dir = ticketDir(ws, profile, key);
  if (existsSync(join(dir, 'context.json'))) throw Object.assign(new Error(`context for ${key} exists; resume instead`), { code: 3 });
  mkdirSync(dir, { recursive: true });
  const base = readJson(join(PLUGIN_ROOT, 'templates', 'context.json'));
  const ctx = { ...base, ...seed, ticket: { ...base.ticket, ...(seed.ticket || {}), key }, stage: 'picked_up', created_at: now() };
  const logTpl = readFileSync(join(PLUGIN_ROOT, 'templates', 'log.md'), 'utf8').replaceAll('{KEY}', key);
  writeFileSync(join(dir, 'log.md'), logTpl);
  save(ws, profile, key, ctx);
  setActive(ws, key);
  return ctx;
}

export function log(ws, profile, key, skill, event, message) {
  if (!EVENTS.includes(event)) throw new Error(`event must be one of ${EVENTS.join(', ')}`);
  appendFileSync(join(ticketDir(ws, profile, key), 'log.md'), `| ${now()} | ${skill} | ${event} | ${String(message).replace(/\|/g, '/').replace(/\n/g, ' ')} |\n`);
}

export function setActive(ws, key) {
  mkdirSync(join(ws, '.sdlc'), { recursive: true });
  writeFileSync(join(ws, '.sdlc', 'active'), `${key}\n`);
}

export function getActive(ws) {
  const p = join(ws, '.sdlc', 'active');
  return existsSync(p) ? readFileSync(p, 'utf8').trim() || null : null;
}

export function listTickets(ws, profile) {
  const dir = ticketsDir(ws, profile);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((d) => existsSync(join(dir, d, 'context.json')));
}

export function fileHash(ws, relPath) {
  return sha256(readFileSync(resolve(ws, relPath)));
}

// Documents (rca, requirements, bugfix, brief, design, kickoff) are versioned and bound to a hash.
export function registerDoc(ws, ctx, type, relPath) {
  if (!DOC_TYPES.includes(type)) throw new Error(`doc type must be one of ${DOC_TYPES.join(', ')}`);
  const prev = ctx.documents[type];
  const version = (prev?.version || 0) + 1;
  ctx.documents[type] = { path: relPath, version, sha256: fileHash(ws, relPath), status: 'awaiting_approval', at: now() };
  // A changed upstream document voids approvals that depend on it.
  const dependents = { rca: ['requirements', 'bugfix', 'brief', 'design'], requirements: ['design'], bugfix: ['design'] };
  for (const d of dependents[type] || []) if (ctx.documents[d]) ctx.documents[d].status = 'stale';
  return ctx.documents[type];
}

export function docValid(ws, ctx, type) {
  const d = ctx.documents[type];
  if (!d || d.status !== 'approved') return false;
  if (!existsSync(resolve(ws, d.path))) return false;
  return fileHash(ws, d.path) === d.sha256;
}

export function stageIndex(stage) {
  return STAGES.indexOf(stage);
}
