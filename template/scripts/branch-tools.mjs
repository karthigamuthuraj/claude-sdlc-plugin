#!/usr/bin/env node
// Read-only branch helpers for implement-ticket, so the base branch and the feature branch name are worked out the same way every time.
//   node branch-tools.mjs base --base <name|release|current> [--release-pattern release/*] [--order version|newest-commit]
//                              [--remote origin] [--fallback development] [--cwd <dir>]
//   node branch-tools.mjs name --pattern feature/{KEY} --key BLMFAI-1252 [--type Bug] [--type-map '{"Bug":"bugfix","default":"feature"}']
//                              [--summary "text"] [--slug-max 6] [--cwd <dir>]
// base: prints {base, ref, source, sha, candidates}. source is release, named, fallback or current; ref is what to branch from.
// name: prints {name, valid}; valid is false for a name git refuses. Prints JSON. Exit 0 ok, 2 usage, 3 nothing usable.
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const versionKey = (name) => (String(name).match(/\d+/g) || []).map(Number);

// Numbers are compared one by one, so release-1.6.10 is newer than release-1.6.9.
export function compareVersions(a, b) {
  const x = versionKey(a);
  const y = versionKey(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? -1) - (y[i] ?? -1);
    if (d) return d;
  }
  return 0;
}

export const globToRegExp = (glob) => new RegExp(`^${String(glob).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')}$`);

// candidates: [{ name, date }] (date = commit time in seconds). Newest first.
export function rankReleases(candidates, order = 'version') {
  const byVersion = (a, b) => compareVersions(b.name, a.name) || (b.date || 0) - (a.date || 0);
  const byDate = (a, b) => (b.date || 0) - (a.date || 0) || compareVersions(b.name, a.name);
  return [...candidates].sort(order === 'newest-commit' ? byDate : byVersion);
}

const words = (text, max) => String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean).slice(0, max).join('-');

export function branchName({ pattern = 'feature/{KEY}', key, type = '', typeMap = {}, summary = '', slugMax = 6 }) {
  const lower = Object.fromEntries(Object.entries(typeMap).map(([k, v]) => [k.toLowerCase(), v]));
  const prefix = lower[String(type).toLowerCase()] || lower.default || 'feature';
  const number = (String(key).match(/(\d+)$/) || [, ''])[1];
  const values = { KEY: key, key: String(key).toLowerCase(), key_lower: String(key).toLowerCase(), number, type: prefix, prefix, slug: words(summary, slugMax) };
  const name = pattern.replace(/\{(\w+)\}/g, (m, k) => (k in values ? values[k] : m)).replace(/\s+/g, '-').replace(/\/{2,}/g, '/').replace(/[-/]+$/, '');
  return name;
}

function git(args, cwd) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
}

function refs(prefix, cwd) {
  const r = git(['for-each-ref', '--format=%(refname)|%(committerdate:unix)', prefix], cwd);
  if (!r.ok || !r.out) return [];
  return r.out.split('\n').map((line) => { const i = line.lastIndexOf('|'); return { refname: line.slice(0, i), date: Number(line.slice(i + 1)) || 0 }; });
}

export function resolveBase({ base = 'development', releasePattern = 'release/*', order = 'version', remote = 'origin', fallback = 'development', cwd = process.cwd() }) {
  const sha = (ref) => git(['rev-parse', '--short', ref], cwd).out;
  const exists = (ref) => git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], cwd).ok;
  const named = (name, source) => {
    for (const ref of [`${remote}/${name}`, name]) if (exists(ref)) return { base: name, ref, source, sha: sha(ref), candidates: [] };
    return null;
  };
  if (base === 'current') {
    const cur = git(['branch', '--show-current'], cwd).out;
    if (!cur) return null;
    return { base: cur, ref: cur, source: 'current', sha: sha(cur), candidates: [] };
  }
  if (base === 'release') {
    const rx = globToRegExp(releasePattern);
    const remotePrefix = `refs/remotes/${remote}/`;
    let found = refs(remotePrefix, cwd).map((r) => ({ name: r.refname.slice(remotePrefix.length), date: r.date })).filter((r) => r.name !== 'HEAD' && rx.test(r.name));
    let isRemote = true;
    if (!found.length) { found = refs('refs/heads/', cwd).map((r) => ({ name: r.refname.slice('refs/heads/'.length), date: r.date })).filter((r) => rx.test(r.name)); isRemote = false; }
    if (found.length) {
      const ranked = rankReleases(found, order);
      const top = ranked[0];
      const ref = isRemote ? `${remote}/${top.name}` : top.name;
      return { base: top.name, ref, source: 'release', sha: sha(ref), candidates: ranked.slice(0, 3).map((c) => c.name) };
    }
    return named(fallback, 'fallback');
  }
  return named(base, 'named') || (fallback && fallback !== base ? named(fallback, 'fallback') : null);
}

export function isValidBranchName(name, cwd = process.cwd()) {
  const r = spawnSync('git', ['check-ref-format', '--branch', name], { cwd, encoding: 'utf8', windowsHide: true });
  return r.status === 0;
}

// Command line
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
  const out = (obj, code = 0) => { console.log(JSON.stringify(obj, null, 2)); process.exitCode = code; };
  const cwd = opt('cwd', process.cwd());
  if (cmd === 'base') {
    const res = resolveBase({ base: opt('base', 'development'), releasePattern: opt('release-pattern', 'release/*'), order: opt('order', 'version'), remote: opt('remote', 'origin'), fallback: opt('fallback', 'development'), cwd });
    if (res) out(res); else out({ ok: false, error: 'no usable base branch found (no release branch, the base and the fallback do not exist)' }, 3);
  } else if (cmd === 'name') {
    if (!opt('key')) out({ ok: false, error: 'usage: branch-tools.mjs name --pattern <pattern> --key <KEY> [--type ..] [--type-map JSON] [--summary ..] [--slug-max N]' }, 2);
    else {
      let typeMap = {};
      try { typeMap = JSON.parse(opt('type-map', '{}')); } catch { /* use the default prefix */ }
      const name = branchName({ pattern: opt('pattern', 'feature/{KEY}'), key: opt('key'), type: opt('type', ''), typeMap, summary: opt('summary', ''), slugMax: Number(opt('slug-max', 6)) });
      out({ name, valid: Boolean(name) && isValidBranchName(name, cwd) });
    }
  } else {
    out({ ok: false, error: 'usage: branch-tools.mjs base|name ...' }, 2);
  }
}
