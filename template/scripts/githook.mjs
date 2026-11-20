#!/usr/bin/env node
// Git hooks for people and Claude alike: node githook.mjs <pre-commit|commit-msg|pre-push> [args]
import { execFileSync, execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { findWorkspace, loadProfile, safetyLists, isProtected, matchesAny, repoOf, loadStack, coreSafety } from './lib/workspace.mjs';
import { realLookingValues } from './lib/rules.mjs';

const [hook, ...args] = process.argv.slice(2);
const fail = (msg) => { process.stderr.write(`[sdlc ${hook}] ${msg}\n`); process.exit(1); };
const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();

const ws = findWorkspace();
const profile = ws ? loadProfile(ws) : null;
const lists = safetyLists(profile);
const protectedBranches = profile?.branching?.protected || coreSafety().protectedBranches;
const branch = (() => { try { return git('rev-parse', '--abbrev-ref', 'HEAD'); } catch { return ''; } })();

if (hook === 'pre-commit') {
  if (matchesAny(branch, protectedBranches)) fail(`commits to ${branch} are not allowed; use a task branch`);
  const staged = git('diff', '--cached', '--name-only', '--diff-filter=ACMR').split('\n').filter(Boolean);
  const bad = staged.filter((f) => isProtected(f, lists));
  if (bad.length) fail(`protected files staged: ${bad.join(', ')}`);
  const diff = git('diff', '--cached', '-U0');
  const added = diff.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).join('\n');
  const secrets = realLookingValues(added);
  if (secrets.length) fail(`possible secrets in staged changes: ${secrets.slice(0, 5).join(', ')}`);
  const debug = added.split('\n').filter((l) => /\b(console\.log|debugger;|breakpoint\(\)|pdb\.set_trace|print\(\s*["']DEBUG)/.test(l));
  if (debug.length) fail(`debug statements in staged changes:\n${debug.slice(0, 5).join('\n')}`);
  // Repo-specific quick checks (for example lint on staged files) from the profile or stack pack.
  const top = git('rev-parse', '--show-toplevel');
  const r = ws && repoOf(profile, ws, top);
  const pre = r && (r.repo.commands?.preCommit ?? loadStack(r.repo.stack)?.commands?.preCommit);
  if (pre) {
    const files = staged.map((f) => JSON.stringify(f)).join(' ');
    try { execSync(pre.replaceAll('{files}', files), { cwd: top, stdio: 'inherit', timeout: 300000 }); } catch { fail(`pre-commit check failed: ${pre}`); }
  }
  process.exit(0);
}

if (hook === 'commit-msg') {
  const msg = readFileSync(args[0], 'utf8');
  // project.json -> commitMessagePattern overrides the default "<KEY>: summary".
  const keyRx = profile?.commitMessagePattern || (profile?.tracker?.keyPattern || '^[A-Z][A-Z0-9]+-\\d+$').replace(/\$$/, ':');
  if (!new RegExp(keyRx).test(msg.trim())) fail(`commit message must match ${keyRx} (start with the ticket key)`);
  process.exit(0);
}

if (hook === 'pre-push') {
  const lines = readFileSync(0, 'utf8').split('\n').filter(Boolean);
  for (const l of lines) {
    const [, , remoteRef] = l.split(' ');
    const target = (remoteRef || '').replace('refs/heads/', '');
    if (target && matchesAny(target, protectedBranches)) fail(`pushing to protected branch ${target} is not allowed`);
  }
  process.exit(0);
}

fail(`unknown hook ${hook}`);
