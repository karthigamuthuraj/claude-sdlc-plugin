// Which skill comes next for a ticket, following its track (built-in or customised).
import { loadLifecycle, flow, stepDone, invocation } from './lifecycle.mjs';

export function nextSkill(ctx, ws = null, profile = null) {
  const lc = loadLifecycle(ws, profile);
  if (ctx.stage === 'building') return 'build (open tasks) or verify (all tasks done)';
  const next = flow(lc, ctx.track).find((s) => !stepDone(ctx, s));
  return next ? invocation(ws, next) : 'done (people take it from here)';
}
