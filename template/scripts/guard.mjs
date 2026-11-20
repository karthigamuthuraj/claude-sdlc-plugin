#!/usr/bin/env node
// Claude Code hook entry point: node guard.mjs <session-start|prompt|pre-tool|post-tool|stop>
// Reads the hook JSON from stdin. Exit 2 + stderr blocks the action (PreToolUse, Stop).
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve, join, isAbsolute, relative, sep } from 'node:path';
import { findWorkspace, loadProfile, safetyLists, isProtected, matchesAny, repoOf, loadStack, coreSafety, PLUGIN_ROOT } from './lib/workspace.mjs';
import { load, save, getActive, log, stageIndex } from './lib/context.mjs';
import { parseApprovalLines, applyApproval, splitCommands, tokenize, parseGit, stagedHash, currentBranch, redactionHits, realLookingValues } from './lib/rules.mjs';
import { nextSkill } from './lib/next.mjs';

const event = process.argv[2];
let input = {};
try { input = JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch { input = {}; }
const cwd = input.cwd || process.cwd();

const block = (msg) => { process.stderr.write(`[sdlc guard] ${msg}\n`); process.exit(2); };
const say = (msg) => { if (msg) process.stdout.write(`${msg}\n`); process.exit(0); };

let ws = null; let profile = null; let lists = null;
try { ws = findWorkspace(cwd); if (ws) profile = loadProfile(ws); } catch { ws = null; }
lists = safetyLists(profile);
const safety = coreSafety();

function activeContext() {
  if (!ws) return null;
  let key = getActive(ws);
  const branch = currentBranch(cwd);
  const m = branch && profile?.tracker?.keyPattern && branch.toUpperCase().match(new RegExp(profile.tracker.keyPattern.replace(/^\^|\$$/g, '')));
  if (m) key = m[0];
  if (!key) return null;
  try { return { key, ctx: load(ws, profile, key) }; } catch { return null; }
}

const absPath = (p) => (isAbsolute(p) ? p : resolve(cwd, p));

switch (event) {
  case 'session-start': {
    if (!ws) say('[sdlc] No .sdlc/project.json found above this folder. Run the setup skill to onboard this project.');
    const a = activeContext();
    if (!a) say(`[sdlc] Workspace: ${ws}. No active ticket. Start with the pickup skill and a ticket key.`);
    const { key, ctx } = a;
    say(`[sdlc] Active ticket ${key} (${ctx.ticket.summary || ''}). Track: ${ctx.track || 'not set'}. Stage: ${ctx.stage}. Next: ${nextSkill(ctx, ws, profile)}. Context: ${join(profile.ticketDir || '.sdlc/tickets', key, 'context.json')}.`);
    break;
  }

  case 'prompt': {
    if (!ws) say('');
    const found = parseApprovalLines(input.prompt || '');
    if (!found.length) say('');
    const out = [];
    for (const a of found) {
      const key = a.kind === 'doc' ? a.m[2] : a.m[1];
      let ctx;
      try { ctx = load(ws, profile, key); } catch { out.push(`${a.line}: no context for ${key}.`); continue; }
      const repoHashes = {};
      if (a.kind === 'commit') {
        for (const r of ctx.repos || []) {
          const dir = resolve(ws, r.worktree && r.branch_created ? r.worktree : r.path);
          const h = stagedHash(dir);
          if (h && h !== 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855') repoHashes[r.name] = h;
        }
      }
      const result = applyApproval(ws, ctx, a, repoHashes);
      save(ws, profile, key, ctx);
      log(ws, profile, key, 'developer', 'approval', `${a.line} -> ${result}`);
      out.push(`${a.line}: ${result}`);
    }
    say(`[sdlc] Recorded from your message (typed by you, so it counts as your approval):\n${out.join('\n')}`);
    break;
  }

  case 'pre-tool': {
    const tool = input.tool_name || '';
    const ti = input.tool_input || {};
    if (['Read', 'Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'Grep', 'Glob', 'LS'].includes(tool)) checkFileTool(tool, ti);
    else if (tool === 'Bash' || tool === 'PowerShell') checkShell(ti.command || '');
    else if (tool.startsWith('mcp__')) checkConnector(tool, ti);
    process.exit(0);
    break;
  }

  case 'post-tool': {
    const tool = input.tool_name || '';
    const file = input.tool_input?.file_path;
    if (!ws || !['Edit', 'Write', 'MultiEdit'].includes(tool) || !file) process.exit(0);
    const r = repoOf(profile, ws, absPath(file));
    if (!r) process.exit(0);
    const stack = r.repo.stack && loadStack(r.repo.stack);
    const cmd = r.repo.commands?.formatFile ?? stack?.commands?.formatFile;
    if (!cmd) process.exit(0);
    try {
      const wsFile = relative(ws, absPath(file)).split(sep).join('/');
      execSync(cmd.replaceAll('{file}', JSON.stringify(absPath(file))).replaceAll('{wsfile}', wsFile), { cwd: resolve(ws, r.repo.path || '.', r.repo.subproject || '.'), stdio: 'ignore', timeout: 60000 });
    } catch { /* formatting is best effort; lint runs in verify */ }
    process.exit(0);
    break;
  }

  case 'stop': {
    if (input.stop_hook_active) process.exit(0);
    const a = activeContext();
    if (a && a.ctx.stage === 'building' && a.ctx.tasks.total > 0 && a.ctx.tasks.done === a.ctx.tasks.total) {
      block(`All ${a.ctx.tasks.total} tasks for ${a.key} are marked done but the ticket is not verified. Run the verify skill before reporting completion.`);
    }
    process.exit(0);
    break;
  }

  default:
    process.exit(0);
}

// ---------- checks ----------
function checkFileTool(tool, ti) {
  const paths = [ti.file_path, ti.path, ti.notebook_path, ti.glob, ti.pattern && tool === 'Glob' ? ti.pattern : null].filter(Boolean);
  for (const p of paths) {
    if (isProtected(p, lists)) block(`${p} is a protected file (secrets or credentials). Claude never reads or edits it. If a new key is needed, list it in the handoff for a person to add.`);
  }
  const writing = ['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(tool);
  if (!writing) return;
  const target = ti.file_path || ti.notebook_path;
  if (!target) return;
  if (matchesAny(target, lists.guardrails) || resolve(absPath(target)).startsWith(PLUGIN_ROOT)) {
    block(`${target} is a guardrail or plugin file. Only people change these.`);
  }
  const newText = [ti.content, ti.new_string, ...(ti.edits || []).map((e) => e.new_string)].filter(Boolean).join('\n');
  if (matchesAny(target, lists.templates)) {
    const hits = realLookingValues(newText);
    if (hits.length) block(`${target} is a config template; use placeholder values only. Real-looking values for: ${hits.join(', ')}.`);
  }
  if (!ws) return;
  const r = repoOf(profile, ws, absPath(target));
  if (!r) return;
  const a = activeContext();
  if (!a) return;
  const { ctx, key } = a;
  const isTest = /(^|\/)(tests?|__tests__|spec|e2e)\/|[._-](test|spec)\.[a-z]+$|^test_|\/test_[^/]+$/i.test(r.rel);
  if (ctx.mode === 'readonly' && !isTest) block(`${key} is in read-only investigation (logs/rca). Only reproduction tests may be written now.`);
  if ((ctx.track_base || ctx.track) !== 'quick' && stageIndex(ctx.stage) < stageIndex('kicked_off') && !isTest) {
    block(`${key} is at stage "${ctx.stage}". Source edits start after the design is approved and kickoff has run.`);
  }
  const impact = ctx.impact?.[r.name];
  if (impact?.length && !isTest && !matchesAny(r.rel, impact)) {
    const allowed = (ctx.deviations || []).some((d) => d.status === 'approved' && (d.files || []).some((f) => matchesAny(r.rel, [f])));
    if (!allowed) block(`${r.name}/${r.rel} is not in the approved impact list for ${key}. Record a deviation (sdlc deviation add) and wait for "APPROVE DEVIATION ${key} D<n>".`);
  }
}

function checkShell(command) {
  for (const seg of splitCommands(command)) {
    const tokens = tokenize(seg);
    for (const t of tokens) {
      const clean = t.replace(/^[<>]+/, '');
      const pathLike = clean && !clean.startsWith('-') && !/\s/.test(clean) && /[./\\]/.test(clean);
      if (pathLike && isProtected(clean, lists)) block(`The command touches a protected file (${clean}). Claude never reads or edits secrets.`);
    }
    for (const rx of [...safety.blockedCommands, ...(profile?.blockedCommands || [])]) {
      if (new RegExp(rx, 'i').test(seg)) block(`"${seg}" is blocked by the safety rules (${rx}). A person runs this.`);
    }
    const a = activeContext();
    if (a?.ctx.mode === 'readonly' && new RegExp(safety.readOnlyBlocked.join('|'), 'i').test(seg)) {
      block(`Read-only investigation: "${seg}" would change a running system.`);
    }
    if (/\bgh\s+pr\s+(merge|review\b.*--approve)/.test(seg) || /\bgh\s+api\b.*\/merge\b/.test(seg)) block('Merging or approving a PR is human-only.');
    const g = parseGit(tokens);
    if (g) checkGit(g, seg, a);
  }
}

function checkGit({ dir, sub, args }, seg, a) {
  const gdir = dir ? absPath(dir) : cwd;
  const blockedSubs = [...safety.blockedGitSubcommands, ...(profile?.blockedGitSubcommands || [])];
  if (blockedSubs.includes(sub)) block(`git ${sub} is human-only.`);
  if (sub === 'branch' && args.some((x) => /^(-d|-D|--delete|-m|-M|--move|-f|--force)$/.test(x))) block('Deleting, renaming or forcing branches is human-only.');
  if (sub === 'worktree' && ['remove', 'prune', 'move'].includes(args[0])) block(`git worktree ${args[0]} is human-only.`);
  if (sub === 'add') {
    const paths = args.filter((x) => !x.startsWith('-'));
    if (args.some((x) => ['-A', '--all', '-u', '--update', '.', ':/', '*'].includes(x)) || paths.some((p) => /[*?]/.test(p) || p === '.')) {
      block('git add takes named files only (no ".", -A, --all, -u or wildcards).');
    }
    if (!paths.length) block('git add needs explicit file paths.');
  }
  if (sub === 'commit') {
    if (args.some((x) => /^(--no-verify|-n|--amend|-a|--all)$/.test(x) || /^-[a-zA-Z]*a[a-zA-Z]*$/.test(x))) block('git commit with --no-verify, --amend or -a is not allowed.');
    if (!a) block('No active ticket. Commits go through the commit skill and need "CONFIRM COMMIT <KEY>".');
    const r = ws && repoOf(profile, ws, gdir);
    const name = r?.name;
    const h = stagedHash(gdir);
    const conf = a.ctx.confirmations.find((c) => c.type === 'commit' && name && c.repoHashes?.[name] === h && !c.used.includes(name));
    if (!conf) block(`Commit not confirmed for exactly these staged changes. Show the files and message, then ask the developer to type "CONFIRM COMMIT ${a.key}".`);
    conf.used.push(name);
    save(ws, profile, a.key, a.ctx);
    log(ws, profile, a.key, 'guard', 'approval', `commit allowed in ${name}`);
  }
  if (sub === 'push') {
    if (args.some((x) => /^(--force|-f|--force-with-lease.*|--delete|-d|--mirror|--all|--tags|--prune)$/.test(x) || x.startsWith('+'))) block('Force, delete, mirror and tag pushes are human-only.');
    const protectedBranches = profile?.branching?.protected || safety.protectedBranches;
    const refs = args.filter((x) => !x.startsWith('-')).slice(1);
    if (refs.some((ref) => matchesAny(ref.split(':').pop(), protectedBranches))) block('Pushing to a protected branch is human-only.');
    const branch = currentBranch(gdir);
    if (branch && matchesAny(branch, protectedBranches)) block(`Current branch ${branch} is protected; push only the task branch.`);
    if (!a) block('No active ticket. Pushes go through the pr skill and need "CONFIRM PUSH <KEY>".');
    const r = ws && repoOf(profile, ws, gdir);
    const conf = a.ctx.confirmations.find((c) => c.type === 'push' && r && !c.used.includes(r.name));
    if (!conf) block(`Push not confirmed. Ask the developer to type "CONFIRM PUSH ${a.key}".`);
    conf.used.push(r.name);
    save(ws, profile, a.key, a.ctx);
    log(ws, profile, a.key, 'guard', 'approval', `push allowed in ${r.name}`);
  }
}

function checkConnector(tool, ti) {
  const name = tool.toLowerCase();
  if (/merge_?pull_?request|merge_?pr\b|pull_request_merge|approve/.test(name)) block(`${tool}: merging or approving is human-only.`);
  const writes = /(comment|create|update|edit|add|transition|worklog|post|send|reply|upload)/.test(name);
  if (!writes) return;
  const text = JSON.stringify(ti);
  const hits = redactionHits(text, profile);
  if (hits.length) block(`${tool}: possible personal data or secrets in outgoing text (${hits.slice(0, 3).map((h) => JSON.stringify(h)).join(', ')}). Redact and retry.`);
  const human = (profile?.tracker?.humanOnlyStatuses || []).map((s) => s.toLowerCase());
  if (/transition/.test(name) && human.some((s) => text.toLowerCase().includes(`"${s}"`))) block(`${tool}: that status is human-only.`);
}
