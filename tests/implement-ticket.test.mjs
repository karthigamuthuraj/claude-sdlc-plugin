import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const CORE = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(CORE, p), 'utf8');
const shared = read('template/skills/implement-ticket/SKILL.md');
const wrapper = read('skills/implement-ticket/SKILL.md');
const config = JSON.parse(read('template/config/ticket-implementation.json'));
const schema = JSON.parse(read('template/schema/profile.schema.json'));
const models = JSON.parse(read('template/config/models.json'));

test('implement-ticket: the shared skill, the core wrapper and the config exist and are valid', () => {
  for (const f of ['template/skills/implement-ticket/SKILL.md', 'skills/implement-ticket/SKILL.md', 'template/config/ticket-implementation.json']) assert.ok(existsSync(join(CORE, f)), f);
  assert.match(shared, /^---\nname: implement-ticket\n/);
  assert.match(wrapper, /^---\nname: implement-ticket\n/);
  assert.match(wrapper, /template\/skills\/implement-ticket\/SKILL\.md/);
  assert.match(wrapper, /~\/\.claude\/sdlc-core\/ticket-implementation\.json/);
  assert.equal(models.skills['implement-ticket'].model, 'opus');
});

test('implement-ticket: every setting in the shipped config is documented in the skill and the schema', () => {
  const props = schema.properties.ticketImplementation.properties;
  const keys = (o, prefix = '') => Object.entries(o).filter(([k]) => !k.startsWith('_')).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) && k !== 'typePrefixes' ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]));
  const leaves = keys(config);
  assert.ok(leaves.length >= 15, 'the config exposes the behaviour as settings');
  for (const k of leaves) {
    const [group, name] = k.split('.');
    assert.ok(props[group], `schema has ${group}`);
    if (name && props[group].properties) assert.ok(props[group].properties[name], `schema has ${k}`);
    assert.ok(shared.includes(`\`${k.split('.').slice(-1)[0]}\``) || shared.includes(`\`${k}\``) || shared.includes(`\`${group}\``), `skill documents ${k}`);
  }
});

test('implement-ticket: defaults match the requested behaviour', () => {
  assert.deepEqual(config.plan.sources, ['comment', 'localFile']);
  assert.equal(config.plan.checkParent, true, 'a sub-task reads its parent');
  assert.equal(config.plan.ccPrefix, 'CC:');
  assert.equal(config.status.transition, true);
  assert.equal(config.status.to, 'In Progress');
  assert.ok(config.status.from.includes('To Do'));
  assert.equal(config.impact.check, true);
  assert.equal(config.impact.askWhen, 'always');
  assert.ok(config.impact.include.includes('callers'));
  assert.equal(config.implementation.stopOnNewImpact, true);
  assert.ok(!JSON.stringify(config).match(/"to":\s*"(Done|Closed|Resolved)"/), 'never targets a human-only status');
});

test('implement-ticket: the skill orders status, impact check, approval and code correctly', () => {
  const at = (re) => { const m = re.exec(shared); assert.ok(m, `${re} is in the skill`); return m.index; };
  const plan = at(/\*\*Find the plan\*\*/);
  const move = at(/\*\*Move the ticket to In Progress\*\*/);
  const impact = at(/\*\*Check the code and the impact\*\*/);
  const approve = at(/\*\*Show the impact check and get approval\.\*\*/);
  const implement = at(/\*\*Implement\*\*, in plan order/);
  assert.ok(plan < move && move < impact && impact < approve && approve < implement);
  assert.match(shared, /\| Planned change \| Affected method \(file:line\) \| Why it would break \| Proposed solution \|/);
  assert.match(shared, /No code change before approval/);
  assert.match(shared, /no setting turns the approval off/);
  assert.match(shared, /A sub-task/);
  assert.match(shared, /read the parent too/);
  assert.match(shared, /Never push, merge, rebase/);
  assert.match(shared, /human-only status/);
});

test('implement-ticket: the feature branch is configurable (base, release lookup, name format)', () => {
  const b = config.branch;
  assert.equal(b.mode, 'create');
  assert.equal(b.pattern, 'feature/{KEY}');
  assert.equal(b.base, 'release');
  assert.equal(b.releasePattern, 'release/*');
  assert.equal(b.releaseOrder, 'version');
  assert.ok(b.fetch && b.remote && b.fallbackBase && b.typePrefixes.default);
  assert.ok(schema.properties.ticketImplementation.properties.branch.properties.base);
  assert.match(shared, /branch-tools\.mjs base/);
  assert.match(shared, /branch-tools\.mjs name/);
  assert.match(shared, /Create the feature branch first/);
  assert.match(shared, /--no-track/);
  assert.ok(shared.indexOf('Resolve the feature branch') < shared.indexOf('Show the impact check and get approval'), 'resolved read-only before the approval');
  assert.ok(shared.indexOf('Show the impact check and get approval') < shared.indexOf('Create the feature branch first'), 'created only after the approval');
});

test('implement-ticket: tests, verification against the plan, report and the commit with co-author and branch', () => {
  assert.equal(config.verify.planScenarios, true);
  assert.equal(config.verify.relatedMethods, true);
  assert.equal(config.verify.apiChecks, 'documented');
  assert.equal(config.implementation.addTests, true);
  assert.equal(config.implementation.runVerify, true);
  const c = config.commit;
  assert.equal(c.mode, 'ask');
  assert.equal(c.coAuthor, true);
  assert.equal(c.coAuthorSource, 'git');
  assert.equal(c.includeBranch, true);
  assert.match(c.branchLine, /\{branch\}/);
  assert.match(c.subject, /\{KEY\}/);
  assert.deepEqual(c.extraTrailers, [], 'no AI or tool trailer unless the team lists one');
  const props = schema.properties.ticketImplementation.properties;
  assert.ok(props.verify.properties.planScenarios && props.commit.properties.coAuthor && props.commit.properties.branchLine);

  const at = (s) => { const i = shared.indexOf(s); assert.ok(i >= 0, `${s} is in the skill`); return i; };
  const implement = at('**Implement**, in plan order');
  const tests = at('**Write the test cases with the code**');
  const verify = at('**Verify against the plan**');
  const report = at('**Report to the developer and ask:**');
  const commit = at('**Commit, only after the developer chose to commit**');
  assert.ok(implement < tests && tests < verify && verify < report && report < commit);
  assert.match(shared, /open the plan again/);
  assert.match(shared, /Check every related method and API/);
  assert.match(shared, /\| Plan scenario or criterion \| Test \(file\) \| Result \|/);
  assert.match(shared, /\| Related method or API \| How it was checked \| Result \|/);
  assert.match(shared, /git config user\.name/);
  assert.match(shared, /git config user\.email/);
  assert.match(shared, /Co-authored-by: <user\.name> <user\.email>/);
  assert.match(shared, /Branch: <branch name>/);
  assert.match(shared, /never `--no-verify` or `--amend`/);
  assert.match(shared, /this skill never pushes/);
  assert.match(shared, /never invent one/);
  assert.match(shared, /no "generated by" line/);
});
