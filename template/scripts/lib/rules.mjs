// Approvals, review budgets, redaction and shell-command parsing.
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { PLUGIN_ROOT, readJson } from './workspace.mjs';
import { sha256, now, fileHash, docValid } from './context.mjs';

// ---------- approval lines typed by the developer ----------
const KEY = '([A-Z][A-Z0-9]+-\\d+)';
export const APPROVAL_PATTERNS = [
  { kind: 'doc', rx: new RegExp(`^APPROVE (REQUIREMENTS|DESIGN|BRIEF) ${KEY} v(\\d+)(?: TECHLEAD (.+))?$`) },
  { kind: 'rca', rx: new RegExp(`^CONFIRM RCA ${KEY} v(\\d+)$`) },
  { kind: 'deviation', rx: new RegExp(`^APPROVE DEVIATION ${KEY} D(\\d+)$`) },
  { kind: 'commit', rx: new RegExp(`^CONFIRM COMMIT ${KEY}$`) },
  { kind: 'push', rx: new RegExp(`^CONFIRM PUSH ${KEY}$`) },
  { kind: 'review', rx: new RegExp(`^AUTHORIZE REVIEW ${KEY} \\+(\\d+)$`) },
];

export function parseApprovalLines(prompt) {
  const found = [];
  for (const raw of String(prompt).split(/\r?\n/)) {
    const line = raw.trim();
    for (const { kind, rx } of APPROVAL_PATTERNS) {
      const m = line.match(rx);
      if (m) found.push({ kind, line, m });
    }
  }
  return found;
}

// Apply one parsed approval to a context. Returns a human-readable result.
export function applyApproval(ws, ctx, a, repoHashes) {
  const at = now();
  if (a.kind === 'doc' || a.kind === 'rca') {
    const type = a.kind === 'rca' ? 'rca' : a.m[1].toLowerCase();
    const candidates = type === 'requirements' ? ['requirements', 'bugfix'] : [type];
    const docType = candidates.find((t) => ctx.documents[t]);
    const version = Number(a.kind === 'rca' ? a.m[2] : a.m[3]);
    const doc = docType && ctx.documents[docType];
    if (!doc) return `No ${type} document registered for ${ctx.ticket.key}.`;
    if (doc.version !== version) return `${docType} is at v${doc.version}; the line names v${version}. Not recorded.`;
    if (fileHash(ws, doc.path) !== doc.sha256) return `${doc.path} changed since v${version} was registered. Re-register and approve again.`;
    const techLead = a.kind === 'doc' ? a.m[4] : undefined;
    ctx.approvals.push({ type: docType, version, sha256: doc.sha256, line: a.line, techLead, at });
    const needsTechLead = ctx.risk?.level === 'high' && ['design', 'brief'].includes(docType);
    const haveTechLead = ctx.approvals.some((x) => x.type === docType && x.sha256 === doc.sha256 && x.techLead);
    if (!needsTechLead || haveTechLead) doc.status = 'approved';
    return doc.status === 'approved' ? `${docType} v${version} approved.` : `${docType} v${version}: developer approval recorded; tech lead approval still needed (add "TECHLEAD <name>").`;
  }
  if (a.kind === 'deviation') {
    const dev = ctx.deviations.find((d) => d.id === `D${a.m[2]}`);
    if (!dev) return `No deviation D${a.m[2]} recorded.`;
    dev.status = 'approved'; dev.approved_at = at;
    return `Deviation D${a.m[2]} approved.`;
  }
  if (a.kind === 'commit' || a.kind === 'push') {
    ctx.confirmations.push({ type: a.kind, repoHashes: a.kind === 'commit' ? repoHashes : undefined, used: [], line: a.line, at });
    return a.kind === 'commit' ? `Commit confirmed for the currently staged changes (${Object.keys(repoHashes || {}).join(', ') || 'no staged repos'}).` : 'Push confirmed for the task branches.';
  }
  if (a.kind === 'review') {
    ctx.budgets.extra = (ctx.budgets.extra || 0) + Number(a.m[2]);
    return `${a.m[2]} extra review round(s) authorized. This is not an approval.`;
  }
  return 'Unrecognized.';
}

export function approvalSatisfied(ws, ctx, type) {
  return docValid(ws, ctx, type);
}

// ---------- review budgets ----------
export function budgetLimits(profile, track, base = track) {
  const defaults = readJson(join(PLUGIN_ROOT, 'config', 'budgets.json'));
  return { ...(defaults[track] || defaults[base] || defaults.standard), ...(profile.budgets?.[base] || {}), ...(profile.budgets?.[track] || {}) };
}

export function useBudget(profile, ctx, doc, role) {
  const limits = budgetLimits(profile, ctx.track, ctx.track_base);
  const used = (ctx.budgets.used ||= {});
  const key = `${doc}.${role}`;
  const n = (used[key] || 0) + 1;
  const base = limits[role] ?? 0;
  if (n <= base) { used[key] = n; return { ok: true, n, limit: base }; }
  // Beyond the base budget only with rounds authorized by "AUTHORIZE REVIEW <KEY> +n".
  if (role !== 'cycles' && (ctx.budgets.extra || 0) > 0) {
    ctx.budgets.extra -= 1;
    used[key] = n;
    return { ok: true, n, limit: base, extraUsed: true };
  }
  return { ok: false, n: n - 1, limit: base };
}

export function budgetLine(profile, ctx, doc) {
  const l = budgetLimits(profile, ctx.track, ctx.track_base);
  const u = ctx.budgets.used || {};
  return `Author ${u[`${doc}.author`] || 0}/${l.author} | Reviewer ${u[`${doc}.reviewer`] || 0}/${l.reviewer} | Critic ${u[`${doc}.critic`] || 0}/${l.critic} | Developer cycles ${u[`${doc}.cycles`] || 0}/${l.cycles}`;
}

// ---------- redaction ----------
export function redactionHits(text, profile) {
  const safety = readJson(join(PLUGIN_ROOT, 'config', 'safety.json'));
  const patterns = [...safety.redaction.blockPatterns, ...(profile?.redaction?.blockPatterns || [])];
  const allowed = [...safety.redaction.allowEmailDomains, ...(profile?.redaction?.allowEmailDomains || [])].map((d) => d.toLowerCase());
  const hits = [];
  for (const p of patterns) {
    for (const m of String(text).matchAll(new RegExp(p, 'g'))) {
      const v = m[0];
      if (v.includes('@') && allowed.some((d) => v.toLowerCase().endsWith(`@${d}`))) continue;
      hits.push(v);
    }
  }
  return hits;
}

// Values that look like real secrets (for template files such as .env.example).
const SECRET_VALUE = [
  /AKIA[0-9A-Z]{16}/, /\bsk-[A-Za-z0-9_-]{20,}/, /\bgh[pousr]_[A-Za-z0-9]{30,}/, /\bxox[abpr]-[A-Za-z0-9-]{10,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./, /AIza[0-9A-Za-z_-]{35}/,
];
export function realLookingValues(text) {
  const hits = [];
  for (const line of String(text).split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_.]*)\s*[:=]\s*"?([^"#\s]+)"?/);
    const value = m ? m[2] : line;
    if (SECRET_VALUE.some((rx) => rx.test(value))) { hits.push(m ? m[1] : line.slice(0, 40)); continue; }
    // Long random-looking strings: 24+ chars mixing upper, lower and digits.
    if (m && value.length >= 24 && /[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value) && !/[<>{}$]|example|change|your|placeholder|xxx/i.test(value)) hits.push(m[1]);
  }
  return hits;
}

// ---------- shell parsing ----------
export function splitCommands(cmd) {
  return String(cmd).split(/&&|\|\||;|\||\n/).map((s) => s.trim()).filter(Boolean);
}

export function tokenize(segment) {
  const out = [];
  const rx = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = rx.exec(segment))) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

// Parse a git invocation: returns { dir, sub, args } or null.
export function parseGit(tokens) {
  let i = tokens.findIndex((t) => t === 'git' || t.endsWith('/git') || t.endsWith('\\git') || t === 'git.exe');
  if (i < 0) return null;
  let dir = null;
  i++;
  while (i < tokens.length && tokens[i].startsWith('-')) {
    if (tokens[i] === '-C') { dir = tokens[i + 1]; i += 2; } else if (tokens[i] === '-c') i += 2; else i++;
  }
  return { dir, sub: tokens[i], args: tokens.slice(i + 1) };
}

export function stagedHash(dir) {
  try {
    return sha256(execFileSync('git', ['-C', dir, 'diff', '--cached', '--binary'], { encoding: 'buffer', stdio: ['ignore', 'pipe', 'ignore'] }));
  } catch { return null; }
}

export function currentBranch(dir) {
  try {
    return execFileSync('git', ['-C', dir, 'rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { return null; }
}

export function readIfExists(p) {
  return existsSync(p) ? readFileSync(p, 'utf8') : '';
}
