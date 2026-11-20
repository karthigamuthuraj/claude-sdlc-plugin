// Workspace discovery, profile loading, stack packs and file-pattern matching.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve, relative, sep, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

// Walk up from `start` until a folder containing .sdlc/project.json is found.
export function findWorkspace(start = process.cwd()) {
  if (process.env.SDLC_WORKSPACE) return resolve(process.env.SDLC_WORKSPACE);
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, '.sdlc', 'project.json'))) return dir;
    const up = dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

export function loadProfile(workspace) {
  const path = join(workspace, '.sdlc', 'project.json');
  if (!existsSync(path)) throw new Error(`no profile at ${path}; run setup first`);
  return readJson(path);
}

export function loadStack(name) {
  const path = join(PLUGIN_ROOT, 'stacks', `${name}.json`);
  return existsSync(path) ? readJson(path) : null;
}

export function coreSafety() {
  return readJson(join(PLUGIN_ROOT, 'config', 'safety.json'));
}

// Glob → RegExp. Supports **, *, ? and matching on basename when the pattern has no slash.
export function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') { re += '.*'; i++; if (glob[i + 1] === '/') i++; }
      else re += '[^/]*';
    } else if (c === '?') re += '[^/]';
    else if ('\\^$+.()|{}[]'.includes(c)) re += `\\${c}`;
    else re += c;
  }
  return new RegExp(`^${re}$`, 'i');
}

export function matchesAny(filePath, patterns) {
  const norm = filePath.split(sep).join('/').replace(/^\.\//, '');
  const base = basename(norm);
  return patterns.some((p) => {
    const rx = globToRegExp(p.replace(/\/$/, '/**'));
    return p.includes('/') ? rx.test(norm) || rx.test(`/${norm}`) || norm.split('/').some((_, i, a) => rx.test(a.slice(i).join('/'))) : rx.test(base);
  });
}

// The repo (from the profile) that contains `absPath`, or null. Longest path wins; a repo with
// path "" or "." is the workspace root itself. A repo's `subprojects` (same Git repo, other stack)
// override its stack and commands for files under their path. Files under .sdlc/ belong to no repo.
export function repoOf(profile, workspace, absPath) {
  let rel = relative(workspace, resolve(absPath)).split(sep).join('/');
  if (rel.startsWith('..') || rel === '.sdlc' || rel.startsWith('.sdlc/')) return null;
  let worktree = false;
  const wt = rel.match(/^\.worktrees\/([^/]+)\/?(.*)$/);
  const entries = Object.entries(profile.repos || {});
  if (wt) {
    const hit = entries.find(([name]) => wt[1] === name || wt[1].startsWith(`${name}-`));
    if (!hit) return null;
    const rp = normPath(hit[1].path);
    rel = rp ? `${rp}/${wt[2]}`.replace(/\/$/, '') : wt[2];
    worktree = true;
  }
  const sorted = entries.sort((a, b) => normPath(b[1].path).length - normPath(a[1].path).length);
  for (const [name, repo] of sorted) {
    const rp = normPath(repo.path);
    if (rp && rel !== rp && !rel.startsWith(`${rp}/`)) continue;
    const inRepo = rp ? rel.slice(rp.length + 1) : rel;
    const sub = Object.values(repo.subprojects || {})
      .filter((sp) => inRepo === normPath(sp.path) || inRepo.startsWith(`${normPath(sp.path)}/`))
      .sort((a, b) => normPath(b.path).length - normPath(a.path).length)[0];
    const effective = sub ? { ...repo, stack: sub.stack, commands: { ...(sub.commands || {}) }, subproject: normPath(sub.path) } : repo;
    return { name, repo: effective, rel: inRepo, worktree };
  }
  return null;
}

const normPath = (p) => (p || '').replace(/^\.\/?/, '').replace(/\/$/, '');

// Protected-file and template lists: core minimum + every stack used + project.
export function safetyLists(profile) {
  const core = coreSafety();
  const protectedFiles = [...core.protectedFiles];
  const templates = [...core.templates];
  const stacks = Object.values(profile?.repos || {}).flatMap((r) => [r.stack, ...Object.values(r.subprojects || {}).map((s) => s.stack)]);
  for (const name of new Set(stacks.filter(Boolean))) {
    const stack = loadStack(name);
    if (stack) {
      protectedFiles.push(...(stack.config?.secret || []));
      templates.push(...(stack.config?.templates || []));
    }
  }
  protectedFiles.push(...(profile?.protectedFiles || []));
  templates.push(...(profile?.templateExceptions || []));
  return { protectedFiles: [...new Set(protectedFiles)], templates: [...new Set(templates)], guardrails: core.guardrails };
}

export function isProtected(filePath, lists) {
  if (matchesAny(filePath, lists.templates)) return false;
  return matchesAny(filePath, lists.protectedFiles);
}
