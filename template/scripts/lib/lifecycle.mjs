// Lifecycle: built-in tracks plus project/edition customisation (new tracks, extra steps).
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { PLUGIN_ROOT, readJson } from './workspace.mjs';
import { stageIndex } from './context.mjs';

export const BUILTIN_TRACKS = {
  quick: ['pickup', 'tasks', 'build', 'verify', 'commit', 'pr', 'handoff', 'review'],
  standard: ['pickup', 'analyze', 'design', 'kickoff', 'tasks', 'build', 'verify', 'commit', 'pr', 'handoff', 'review', 'qa-handover'],
  full: ['pickup', 'analyze', 'design', 'kickoff', 'tasks', 'build', 'verify', 'commit', 'pr', 'handoff', 'review', 'qa-handover'],
  bug: ['pickup', 'logs', 'rca', 'analyze', 'design', 'kickoff', 'tasks', 'build', 'verify', 'commit', 'pr', 'handoff', 'review', 'qa-handover'],
  hotfix: ['pickup', 'logs', 'rca', 'tasks', 'build', 'verify', 'commit', 'pr', 'handoff', 'review', 'qa-handover'],
};
export const DONE_STAGE = {
  pickup: 'picked_up', logs: 'investigated', rca: 'investigated', analyze: 'analyzed', design: 'designed',
  kickoff: 'kicked_off', tasks: 'tasks_ready', build: 'building', verify: 'verified', commit: 'committed',
  pr: 'pr_open', handoff: 'handed_off', review: 'reviewed', 'qa-handover': 'qa_handed_over',
};
// Steps every track keeps: they carry the safety gates.
export const REQUIRED_STEPS = ['pickup', 'build', 'verify', 'commit'];
const NAME = /^[a-z][a-z0-9-]{1,40}$/;

const isBuiltinStep = (s) => Object.hasOwn(DONE_STAGE, s);

// Merge order: built-in -> edition custom/lifecycle.json -> project.json "lifecycle".
export function loadLifecycle(ws, profile) {
  const editionFile = join(PLUGIN_ROOT, 'custom', 'lifecycle.json');
  const layers = [existsSync(editionFile) ? readJson(editionFile) : {}, profile?.lifecycle || {}];
  const steps = {}; const trackDefs = {}; const inserts = [];
  for (const l of layers) {
    Object.assign(steps, l.steps || {});
    for (const [n, t] of Object.entries(l.tracks || {})) trackDefs[n] = { ...(trackDefs[n] || {}), ...t };
    inserts.push(...(l.insert || []));
  }
  const problems = [];
  const tracks = {};
  for (const [n, s] of Object.entries(BUILTIN_TRACKS)) tracks[n] = { base: n, steps: [...s], builtin: true };
  for (const [n, def] of Object.entries(trackDefs)) {
    if (!NAME.test(n)) { problems.push(`track "${n}": use lowercase letters, digits and dashes`); continue; }
    const base = BUILTIN_TRACKS[n] ? n : def.base || 'standard';
    if (!BUILTIN_TRACKS[base]) { problems.push(`track "${n}": base "${base}" must be a built-in track`); continue; }
    const list = def.steps ? [...def.steps] : [...(tracks[n]?.steps || BUILTIN_TRACKS[base])];
    tracks[n] = { base, steps: list, description: def.description, builtin: Boolean(BUILTIN_TRACKS[n]) };
    applyEdits(tracks[n], def.insert || [], def.remove || [], `track "${n}"`, problems);
  }
  for (const ins of inserts) {
    const targets = ins.tracks || Object.keys(tracks);
    for (const t of targets) {
      if (!tracks[t]) { problems.push(`insert ${JSON.stringify(ins.steps)}: unknown track "${t}"`); continue; }
      applyEdits(tracks[t], [ins], [], `track "${t}"`, problems);
    }
  }
  const lc = { tracks, steps, problems };
  for (const [n, t] of Object.entries(tracks)) {
    for (const r of REQUIRED_STEPS) if (!t.steps.includes(r)) problems.push(`track "${n}": required step "${r}" was removed`);
    const dup = t.steps.find((s, i) => t.steps.indexOf(s) !== i);
    if (dup) problems.push(`track "${n}": step "${dup}" appears twice`);
    for (const s of t.steps) {
      if (isBuiltinStep(s)) continue;
      if (!NAME.test(s)) problems.push(`step "${s}": use lowercase letters, digits and dashes`);
      else if (!stepKind(ws, s)) problems.push(`step "${s}" (track "${n}"): no skill <plugin>/skills/${s}/SKILL.md and no .sdlc/steps/${s}.md`);
    }
  }
  return lc;
}

function applyEdits(track, inserts, removes, where, problems) {
  for (const r of removes) {
    if (REQUIRED_STEPS.includes(r)) { problems.push(`${where}: "${r}" cannot be removed`); continue; }
    track.steps = track.steps.filter((s) => s !== r);
  }
  for (const ins of inserts) {
    const add = [].concat(ins.steps || ins.step || []).filter((s) => !track.steps.includes(s));
    const anchor = ins.after || ins.before;
    const i = track.steps.indexOf(anchor);
    if (!anchor || i < 0) { problems.push(`${where}: insert anchor "${anchor}" not in the track`); continue; }
    track.steps.splice(ins.after ? i + 1 : i, 0, ...add);
  }
}

// "skill" = a skill in this plugin; "project" = instructions in <ws>/.sdlc/steps/<name>.md run by the step skill.
export function stepKind(ws, name) {
  if (isBuiltinStep(name)) return 'builtin';
  if (ws && existsSync(join(ws, '.sdlc', 'steps', `${name}.md`))) return 'project';
  if (existsSync(join(PLUGIN_ROOT, 'skills', name, 'SKILL.md'))) return 'skill';
  return null;
}

export function trackOf(lc, name) {
  return lc.tracks[name] || null;
}
export function baseTrack(lc, name) {
  return lc.tracks[name]?.base || name;
}
export function flow(lc, name) {
  return (lc.tracks[name] || lc.tracks.standard).steps;
}

export function stepDone(ctx, step) {
  if (!isBuiltinStep(step)) return Boolean(ctx.steps_done?.[step]);
  if (step === 'rca') return ctx.documents?.rca?.status === 'approved' && stageIndex(ctx.stage) >= stageIndex('investigated');
  if (step === 'build') return stageIndex(ctx.stage) > stageIndex('building');
  return stageIndex(ctx.stage) >= stageIndex(DONE_STAGE[step]);
}

// Custom steps placed before `step` in the flow that are required and not yet done.
export function pendingBefore(lc, ctx, step) {
  const steps = flow(lc, ctx.track);
  const i = steps.indexOf(step);
  if (i < 0) return [];
  return steps.slice(0, i).filter((s) => !isBuiltinStep(s) && lc.steps[s]?.required !== false && !stepDone(ctx, s));
}

export function invocation(ws, step) {
  return stepKind(ws, step) === 'project' ? `step ${step}` : step;
}
