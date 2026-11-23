import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'template');
const SETS = join(ROOT, 'templates', 'analysis');
const sets = readdirSync(SETS, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
const FILES = ['requirements-analysis.md', 'implementation-plan.md'];
const config = JSON.parse(readFileSync(join(ROOT, 'config', 'ticket-analysis.json'), 'utf8'));

test('analysis templates: standard and detailed exist, each with the two files', () => {
  assert.ok(sets.includes('standard') && sets.includes('detailed'));
  for (const s of sets) for (const f of FILES) assert.ok(existsSync(join(SETS, s, f)), `${s}/${f}`);
});

test('analysis templates: the configured template set and file names are real', () => {
  assert.ok(sets.includes(config.templateSet), `templateSet ${config.templateSet} has a folder`);
  assert.match(config.files.analysis, /\{key\}.*requirements-analysis/);
  assert.match(config.files.plan, /\{key\}.*implementation-plan/);
  assert.equal(config.ccGeneralAssignee, true);
});

test('analysis templates: placeholders are balanced and well formed', () => {
  for (const s of sets) for (const f of FILES) {
    const text = readFileSync(join(SETS, s, f), 'utf8');
    assert.equal((text.match(/\{\{/g) || []).length, (text.match(/\}\}/g) || []).length, `${s}/${f}`);
    assert.equal((text.match(/\{\{(?!\??[a-z_]+\}\})/g) || []).length, 0, `${s}/${f} has a malformed placeholder`);
  }
});

test('analysis templates: detailed adds sections to standard and both keep the core ones', () => {
  const h = (set, f) => [...readFileSync(join(SETS, set, f), 'utf8').matchAll(/^## (?:\d+\. )?(.+)$/gm)].map((m) => m[1]);
  for (const f of FILES) assert.ok(h('detailed', f).length > h('standard', f).length, f);
  for (const set of ['standard', 'detailed']) {
    assert.ok(h(set, 'requirements-analysis.md').includes('Acceptance criteria'));
    assert.ok(h(set, 'requirements-analysis.md').includes('Open questions'));
    assert.ok(h(set, 'implementation-plan.md').includes('Impact on existing flows'));
    assert.ok(h(set, 'implementation-plan.md').includes('Test plan'));
  }
});

test('analysis templates: the filled-in files convert to a Jira comment with the mention', async () => {
  const { buildComments } = await import(pathToFileURL(join(ROOT, 'scripts', 'md-to-adf.mjs')).href);
  const fill = (text) => text.replace(/\{\{\??([a-z_]+)\}\}/g, 'To be confirmed');
  const files = FILES.map((f) => ({ md: fill(readFileSync(join(SETS, 'detailed', f), 'utf8')) }));
  const comments = buildComments({ cc: { id: 'acc-1', name: 'Indhuja' }, files });
  assert.equal(comments.length, 1);
  const json = JSON.stringify(comments[0]);
  assert.ok(json.includes('"type":"mention"') && json.includes('"table"') && json.includes('"heading"'));
});

test('analysis skill: the files must end with a line naming the template set and template', () => {
  const skill = readFileSync(join(ROOT, 'skills', 'analyse-and-plan-ticket', 'SKILL.md'), 'utf8');
  assert.match(skill, /Template: analysis\/<templateSet>\/<template file>/);
  assert.match(skill, /Template: analysis\/standard\/requirements-analysis\.md/);
  assert.match(skill, /Template: analysis\/standard\/implementation-plan\.md/);
});

test('analysis templates and skill: open questions are asked, and the answers have a section', () => {
  for (const set of ['standard', 'detailed']) {
    const text = readFileSync(join(SETS, set, 'requirements-analysis.md'), 'utf8');
    assert.match(text, /## \d+\. Answers from the developer\r?\n\{\{\?developer_answers\}\}/, set);
    assert.ok(text.indexOf('Answers from the developer') < text.indexOf('Open questions'), `${set}: answers come before the remaining questions`);
  }
  const skill = readFileSync(join(ROOT, 'skills', 'analyse-and-plan-ticket', 'SKILL.md'), 'utf8');
  assert.match(skill, /Ask, do not park questions/);
  assert.match(skill, /Answers from the developer/);
});

test('analysis skill: the skill, its core command and the model entry exist', () => {
  assert.ok(existsSync(join(ROOT, 'skills', 'analyse-and-plan-ticket', 'SKILL.md')));
  assert.ok(existsSync(join(ROOT, '..', 'skills', 'analyse-and-plan-ticket', 'SKILL.md')));
  const models = readFileSync(join(ROOT, 'config', 'models.json'), 'utf8');
  assert.match(models, /"analyse-and-plan-ticket"/);
  assert.ok(homedir());
});
