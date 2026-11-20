#!/usr/bin/env node
// sdlc CLI: the deterministic half of every skill. Node 18+, no dependencies.
// Run from anywhere inside the workspace (or set SDLC_WORKSPACE).
import { readFileSync, writeFileSync, existsSync, chmodSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { findWorkspace, loadProfile, PLUGIN_ROOT, safetyLists, loadStack } from './lib/workspace.mjs';
import * as C from './lib/context.mjs';
import { useBudget, budgetLine, redactionHits } from './lib/rules.mjs';
import { nextSkill } from './lib/next.mjs';
import { loadLifecycle, flow, stepDone, stepKind, pendingBefore, DONE_STAGE } from './lib/lifecycle.mjs';

const die = (msg, code = 1) => { process.stderr.write(`sdlc: ${msg}\n`); process.exit(code); };
const out = (v) => console.log(typeof v === 'string' ? v : JSON.stringify(v, null, 2));

const [cmd, ...args] = process.argv.slice(2);
const NO_WS = ['branch-name-raw', 'stack-detect', 'help', undefined];
const ws = findWorkspace();
if (!ws && !NO_WS.includes(cmd)) die('no .sdlc/project.json found above this folder; run setup first', 2);
const profile = ws ? loadProfile(ws) : null;
const key = () => C.checkKey(profile, args[0]);
const ctxOf = (k) => { try { return C.load(ws, profile, k); } catch (e) { die(e.message, e.code || 1); } return null; };

const SET_FORBIDDEN = ['approvals', 'stage', 'confirmations', 'budgets', 'documents', 'track', 'track_base', 'steps_done'];
const lifecycle = () => loadLifecycle(ws, profile);
const nxt = (c) => nextSkill(c, ws, profile);

// Preconditions for starting a skill, by track.
function gate(ctx, skill) {
  const t = ctx.track_base || ctx.track;
  const ok = (type) => C.docValid(ws, ctx, type);
  const req = (cond, msg) => { if (!cond) die(`${skill} cannot start: ${msg}`, 4); };
  req(t, 'track not confirmed; run pickup');
  const lc = lifecycle();
  const steps = flow(lc, ctx.track);
  if (!Object.hasOwn(DONE_STAGE, skill)) {
    req(steps.includes(skill), `"${skill}" is not a step of track ${ctx.track} (${steps.join(' > ')})`);
    const prev = steps[steps.indexOf(skill) - 1];
    req(!prev || stepDone(ctx, prev), `previous step "${prev}" is not done`);
    return 'ok';
  }
  const pending = pendingBefore(lc, ctx, skill);
  req(!pending.length, `project step(s) not done yet: ${pending.join(', ')}`);
  if (['analyze', 'design', 'kickoff', 'tasks', 'build'].includes(skill) && ['bug', 'hotfix'].includes(t)) req(ok('rca'), 'root cause not confirmed (CONFIRM RCA)');
  if (skill === 'design' && t === 'full') req(ok('requirements') || ok('bugfix'), 'requirements not approved');
  if (['kickoff', 'tasks', 'build'].includes(skill) && ['standard', 'bug'].includes(t)) req(ok('brief'), 'brief not approved');
  if (['kickoff', 'tasks', 'build'].includes(skill) && t === 'full') req(ok('design'), 'design not approved');
  if (['tasks', 'build'].includes(skill) && ['standard', 'full', 'bug'].includes(t)) req(C.stageIndex(ctx.stage) >= C.stageIndex('kicked_off'), 'kickoff not done');
  if (skill === 'commit') req(ctx.stage === 'verified', 'verify has not passed');
  if (skill === 'pr') req(C.stageIndex(ctx.stage) >= C.stageIndex('committed'), 'nothing committed');
  if (skill === 'handoff') req(C.stageIndex(ctx.stage) >= C.stageIndex('pr_open'), 'PR not open');
  if (skill === 'qa-handover') req(C.stageIndex(ctx.stage) >= C.stageIndex('reviewed'), 'PR not approved and merged');
  return 'ok';
}

switch (cmd) {
  case 'init': { const k = key(); const seed = JSON.parse(readFileSync(resolve(args[1]), 'utf8')); C.init(ws, profile, k, seed); C.log(ws, profile, k, 'pickup', 'start', 'context created'); out(join(C.ticketDir(ws, profile, k), 'context.json')); break; }
  case 'use': { const k = key(); ctxOf(k); C.setActive(ws, k); out(`active: ${k}`); break; }
  case 'active': out(C.getActive(ws) || 'none'); break;
  case 'list': out(C.listTickets(ws, profile).map((k) => { const c = C.load(ws, profile, k); return `${k}  ${c.track || '-'}  ${c.stage}  next: ${nxt(c)}`; }).join('\n') || 'no tickets'); break;
  case 'get': { const c = ctxOf(key()); const v = args[1] ? args[1].split('.').reduce((o, p) => o?.[p], c) : c; out(v ?? null); break; }
  case 'set': {
    const k = key(); const c = ctxOf(k);
    if (SET_FORBIDDEN.some((f) => args[1] === f || args[1]?.startsWith(`${f}.`))) die(`"${args[1]}" is changed only by its own command or by the developer's typed approval`);
    let v; try { v = JSON.parse(args[2]); } catch { v = args[2]; }
    const parts = args[1].split('.'); const last = parts.pop();
    parts.reduce((o, p) => (o[p] ??= {}), c)[last] = v;
    C.save(ws, profile, k, c); break;
  }
  case 'track': {
    const k = key(); const c = ctxOf(k); const t = args[1];
    const lc = lifecycle();
    if (lc.problems.length) die(`lifecycle configuration has problems (run doctor):\n  ${lc.problems.join('\n  ')}`);
    if (!lc.tracks[t]) die(`track must be one of: ${Object.keys(lc.tracks).join('|')}`);
    c.track = t; c.track_base = lc.tracks[t].base; C.save(ws, profile, k, c); C.log(ws, profile, k, 'pickup', 'decision', `track ${t}`); out(`track: ${t} (${lc.tracks[t].steps.join(' > ')})`); break;
  }
  case 'gate': { const c = ctxOf(key()); out(gate(c, args[1])); break; }
  case 'stage': {
    const k = key(); const c = ctxOf(k); const s = args[1];
    if (!C.STAGES.includes(s)) die(`unknown stage ${s}`);
    if (s === 'designed') gate(c, 'kickoff');
    if (s === 'kicked_off' && !['quick', 'hotfix'].includes(c.track_base || c.track)) gate(c, 'kickoff');
    if (s === 'verified' && (c.criteria || []).some((x) => x.status !== 'verified')) die('every criterion must be verified first', 4);
    c.stage = s; C.save(ws, profile, k, c); C.log(ws, profile, k, 'stage', 'decision', `stage -> ${s}`); out(`stage: ${s} (next: ${nxt(c)})`);
    break;
  }
  case 'next': out(nxt(ctxOf(key()))); break;
  case 'step-done': {
    const k = key(); const c = ctxOf(k); const st = args[1];
    if (!st || Object.hasOwn(DONE_STAGE, st)) die('step-done is for project steps; built-in skills use "sdlc stage"');
    gate(c, st);
    (c.steps_done ||= {})[st] = { at: C.now(), result: args.slice(2).join(' ') };
    C.save(ws, profile, k, c); C.log(ws, profile, k, st, 'decision', `step ${st} done: ${args.slice(2).join(' ')}`);
    out(`${st} done (next: ${nxt(c)})`); break;
  }
  case 'flow': {
    const lc = lifecycle();
    if (args[0] && C.listTickets(ws, profile).includes(args[0])) {
      const c = ctxOf(args[0]);
      out(flow(lc, c.track).map((st) => `${stepDone(c, st) ? '[x]' : '[ ]'} ${st}${stepKind(ws, st) === 'project' ? ' (project step)' : ''}`).join('\n'));
    } else {
      const only = args[0] ? { [args[0]]: lc.tracks[args[0]] || die(`unknown track ${args[0]}`) } : lc.tracks;
      out(Object.fromEntries(Object.entries(only).map(([n, t]) => [n, `${t.builtin ? '' : `(based on ${t.base}) `}${t.description ? `${t.description}: ` : ''}${t.steps.join(' > ')}`])));
    }
    if (lc.problems.length) out({ problems: lc.problems });
    break;
  }
  case 'mode': { const k = key(); const c = ctxOf(k); c.mode = args[1] === 'readonly' ? 'readonly' : 'normal'; C.save(ws, profile, k, c); out(`mode: ${c.mode}`); break; }
  case 'doc': {
    const sub = args[0]; const k = C.checkKey(profile, args[1]); const c = ctxOf(k);
    if (sub === 'register') { const d = C.registerDoc(ws, c, args[2], args[3]); C.save(ws, profile, k, c); C.log(ws, profile, k, args[2], 'decision', `registered ${args[3]} v${d.version}`); out(`v${d.version}`); }
    else if (sub === 'status') out(Object.fromEntries(Object.entries(c.documents).map(([t, d]) => [t, `v${d.version} ${C.docValid(ws, c, t) ? 'approved' : d.status}`])));
    else die('doc register|status');
    break;
  }
  case 'budget': {
    const sub = args[0]; const k = C.checkKey(profile, args[1]); const c = ctxOf(k); const doc = args[2];
    if (sub === 'use') {
      const r = useBudget(profile, c, doc, args[3]); C.save(ws, profile, k, c);
      C.log(ws, profile, k, doc, 'budget', `${args[3]} ${r.ok ? `round ${r.n}/${r.limit}${r.extraUsed ? ' (authorized extra)' : ''}` : 'REFUSED: budget exhausted'}`);
      if (!r.ok) die(`${doc} ${args[3]} budget exhausted (${r.n}/${r.limit}). Report the open findings; more rounds need "AUTHORIZE REVIEW ${k} +1".`, 6);
      out(budgetLine(profile, c, doc));
    } else out(budgetLine(profile, c, doc));
    break;
  }
  case 'impact': { const k = key(); const c = ctxOf(k); (c.impact ||= {})[args[1]] = args.slice(2); C.save(ws, profile, k, c); out(c.impact); break; }
  case 'deviation': {
    const k = C.checkKey(profile, args[1]); const c = ctxOf(k); const id = `D${c.deviations.length + 1}`;
    c.deviations.push({ id, summary: args[2], files: args.slice(3), status: 'awaiting_approval', at: C.now() });
    C.save(ws, profile, k, c); C.log(ws, profile, k, 'build', 'deviation', `${id}: ${args[2]}`);
    out(`${id} recorded. Ask the developer to type: APPROVE DEVIATION ${k} ${id}`); break;
  }
  case 'tasks': { const k = key(); const c = ctxOf(k); c.tasks = { ...c.tasks, total: Number(args[1]), done: Number(args[2]), current: args[3] || null }; C.save(ws, profile, k, c); out(c.tasks); break; }
  case 'criterion': {
    const k = key(); const c = ctxOf(k); const [, id, status, ...ev] = args;
    const list = (c.criteria ||= []); const item = list.find((x) => x.id === id) || list[list.push({ id }) - 1];
    Object.assign(item, { status, evidence: ev.join(' ') || item.evidence, at: C.now() }); C.save(ws, profile, k, c); out(item); break;
  }
  case 'log': { const k = key(); C.log(ws, profile, k, args[1], args[2], args.slice(3).join(' ')); break; }
  case 'tracker-done': { const k = key(); const c = ctxOf(k); c.tracker_actions.push({ op: args[1], summary: args.slice(2).join(' '), at: C.now() }); C.save(ws, profile, k, c); C.log(ws, profile, k, 'sync', 'tracker', `${args[1]}: ${args.slice(2).join(' ')}`); break; }
  case 'branch-name': {
    const k = key(); const prefix = profile.branching.prefixByType[args[1]] || 'feature';
    const slug = args.slice(2).join(' ').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean).slice(0, profile.branching.slugMaxWords || 6).join('-');
    out(profile.branching.pattern.replace('{prefix}', prefix).replace('{key_lower}', k.toLowerCase()).replace('{KEY}', k).replace('{slug}', slug).replace(/[-/]$/, '')); break;
  }
  case 'redact': {
    const text = args[0] === '-' ? readFileSync(0, 'utf8') : readFileSync(resolve(args[0]), 'utf8');
    const hits = redactionHits(text, profile);
    if (hits.length) die(`redaction scan flagged: ${hits.slice(0, 10).map((h) => JSON.stringify(h)).join(', ')}`, 5);
    out('clean'); break;
  }
  case 'worklog': {
    const k = key(); const lines = readFileSync(join(C.ticketDir(ws, profile, k), 'log.md'), 'utf8').split('\n');
    const open = {}; let seconds = 0; let first = null;
    for (const l of lines) {
      const m = l.match(/^\| (\S+) \| (\S+) \| (start|end) \|/); if (!m) continue;
      const t = Date.parse(m[1]); first ??= m[1];
      if (m[3] === 'start') open[m[2]] = t; else if (open[m[2]]) { seconds += (t - open[m[2]]) / 1000; delete open[m[2]]; }
    }
    out({ proposedSeconds: Math.round(seconds), proposedHours: Math.round(seconds / 360) / 10, started: first, note: 'Skill run time only; the developer confirms or edits before posting.' }); break;
  }
  case 'stack-detect': {
    const dir = resolve(args[0] || '.'); const has = (f) => existsSync(join(dir, f));
    const s = has('composer.json') || has('artisan') ? 'php' : has('pyproject.toml') || has('requirements.txt') || has('setup.py') ? 'python' : has('package.json') ? 'node' : has('pom.xml') || has('build.gradle') || has('build.gradle.kts') ? 'java' : has('go.mod') ? 'go' : has('Gemfile') ? 'ruby' : existsSync(dir) && execFileSync('git', ['-C', dir, 'ls-files', '*.csproj'], { encoding: 'utf8' }).trim() ? 'dotnet' : has('main.tf') ? 'infra' : 'unknown';
    out(s); break;
  }
  case 'install-git-hooks': {
    const done = new Set();
    for (const [name, repo] of Object.entries(profile.repos)) {
      const dir = resolve(ws, repo.path || '.');
      let hooksDir;
      try { hooksDir = resolve(dir, execFileSync('git', ['-C', dir, 'rev-parse', '--git-path', 'hooks'], { encoding: 'utf8' }).trim()); } catch { out(`${name}: not a git repo, skipped`); continue; }
      if (done.has(hooksDir)) continue;
      done.add(hooksDir);
      mkdirSync(hooksDir, { recursive: true });
      for (const h of ['pre-commit', 'commit-msg', 'pre-push']) {
        const target = join(hooksDir, h);
        const existing = existsSync(target) ? readFileSync(target, 'utf8') : '';
        if (existing && !existing.includes('sdlc githook')) { writeFileSync(`${target}.sdlc`, hookScript(h, ws)); out(`${name}: ${h} exists; wrote ${h}.sdlc — chain it from your hook`); continue; }
        writeFileSync(target, hookScript(h, ws)); try { chmodSync(target, 0o755); } catch { /* windows */ }
      }
      out(`${name}: hooks installed in ${hooksDir}`);
    }
    break;
  }
  case 'doctor': {
    const problems = [];
    const need = ['project', 'tracker', 'repos', 'branching'];
    for (const n of need) if (!profile[n]) problems.push(`profile missing "${n}"`);
    for (const [name, repo] of Object.entries(profile.repos || {})) {
      const dir = resolve(ws, repo.path || '.');
      if (!existsSync(dir)) { problems.push(`${name}: path ${repo.path} not found`); continue; }
      for (const [sp, sub] of Object.entries(repo.subprojects || {})) {
        if (!existsSync(resolve(dir, sub.path))) problems.push(`${name}/${sp}: path ${sub.path} not found`);
        if (!loadStack(sub.stack)) problems.push(`${name}/${sp}: unknown stack "${sub.stack}"`);
      }
      if (!repo.stack || !loadStack(repo.stack)) problems.push(`${name}: unknown stack "${repo.stack}"`);
      if (!repo.commands?.test && !loadStack(repo.stack)?.commands?.test) problems.push(`${name}: no test command`);
      try {
        const hooks = resolve(dir, execFileSync('git', ['-C', dir, 'rev-parse', '--git-path', 'hooks'], { encoding: 'utf8' }).trim());
        const chained = (h) => existsSync(join(hooks, h)) && /sdlc githook|\.sdlc"/.test(readFileSync(join(hooks, h), 'utf8'));
        if (!chained('commit-msg') || !chained('pre-commit')) problems.push(`${name}: git hooks not installed (run install-git-hooks)`);
      } catch { problems.push(`${name}: not a git repo`); }
      for (const f of ['.env']) {
        if (existsSync(join(dir, f))) {
          try { execFileSync('git', ['-C', dir, 'check-ignore', '-q', f]); } catch { problems.push(`${name}: ${f} is not in .gitignore`); }
        }
      }
    }
    problems.push(...lifecycle().problems.map((p) => `lifecycle: ${p}`));
    const auth = profile.tracker?.authEnv;
    if (profile.tracker?.access === 'token' && auth && (!process.env[auth.email] || !process.env[auth.token])) problems.push(`tracker access is "token" but ${auth.email} / ${auth.token} are not set`);
    const lists = safetyLists(profile);
    out(problems.length ? { status: 'issues', problems, protectedPatterns: lists.protectedFiles.length } : { status: 'ok', repos: Object.keys(profile.repos).length, protectedPatterns: lists.protectedFiles.length });
    break;
  }
  default:
    die('usage: sdlc init|use|active|list|get|set|track|gate|stage|next|step-done|flow|mode|doc|budget|impact|deviation|tasks|criterion|log|tracker-done|branch-name|redact|worklog|stack-detect|install-git-hooks|doctor');
}

function hookScript(name, workspace) {
  const node = JSON.stringify(join(PLUGIN_ROOT, 'scripts', 'githook.mjs').split('\\').join('/'));
  return `#!/bin/sh\n# sdlc githook ${name} (installed by setup)\nSDLC_WORKSPACE=${JSON.stringify(workspace.split('\\').join('/'))} exec node ${node} ${name} "$@"\n`;
}

