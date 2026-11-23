import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', 'template', 'scripts', 'md-to-adf.mjs');
const { mdToAdf, buildComments, ccParagraph, textLength } = await import(pathToFileURL(SCRIPT).href);

const walk = (n, f) => { f(n); (Array.isArray(n) ? n : n && n.content ? n.content : []).forEach((c) => walk(c, f)); };
const types = (doc) => { const t = []; walk(doc, (n) => n && n.type && t.push(n.type)); return t; };

test('md-to-adf: headings, paragraphs and inline marks', () => {
  const doc = mdToAdf('# Title\n\nSome **bold**, `code`, _em_ and a [link](https://example.com/x).\n');
  assert.equal(doc.type, 'doc');
  assert.equal(doc.content[0].type, 'heading');
  assert.equal(doc.content[0].attrs.level, 1);
  const marks = doc.content[1].content.flatMap((n) => (n.marks || []).map((m) => m.type));
  assert.deepEqual(marks.sort(), ['code', 'em', 'link', 'strong']);
});

test('md-to-adf: backticks inside bold text are not left as literal characters', () => {
  const json = JSON.stringify(mdToAdf('- **P4 Pass `isThirdParty` per recipient.** More text.'));
  assert.ok(!json.includes('`'), 'no literal backtick');
  assert.ok(json.includes('"text":"P4 Pass isThirdParty per recipient."'));
});

test('md-to-adf: tables, nested lists, task items, code blocks and rules', () => {
  const md = ['| A | B |', '|---|---|', '| 1 | 2 |', '', '- one', '  - nested', '- two', '', '1. first', '2. second', '', '- [ ] todo', '- [x] done', '', '```js', 'const a = 1;', '```', '', '---'].join('\n');
  const t = types(mdToAdf(md));
  for (const want of ['table', 'tableHeader', 'tableCell', 'bulletList', 'orderedList', 'codeBlock', 'rule']) assert.ok(t.includes(want), want);
  const doc = mdToAdf('- one\n  - nested\n- two\n');
  assert.equal(doc.content[0].content[0].content[1].type, 'bulletList', 'nested list sits inside the first item');
  const tasks = JSON.stringify(mdToAdf('- [ ] todo\n- [x] done'));
  assert.ok(tasks.includes('☐ todo') && tasks.includes('☑ done'));
});

test('md-to-adf: never produces an empty text node', () => {
  const md = '# T\n\n| a | |\n|---|---|\n| | b |\n\n- \n\n**x**\n';
  walk(mdToAdf(md), (n) => { if (n && n.type === 'text') assert.ok(n.text.length > 0); });
});

test('md-to-adf: the CC line holds a real mention node, not plain text', () => {
  const [c] = buildComments({ cc: { id: 'acc-123', name: 'Indhuja' }, files: [{ md: '# A\n\ntext' }, { md: '# P\n\ntext' }] });
  const first = c.content[0];
  assert.equal(first.content[0].text, 'CC: ');
  assert.deepEqual(first.content[1], { type: 'mention', attrs: { id: 'acc-123', text: '@Indhuja' } });
  assert.ok(!JSON.stringify(first.content.filter((n) => n.type === 'text')).includes('@Indhuja'), 'the name is not written as text');
  assert.deepEqual(ccParagraph({ id: 'x', name: 'Y' }, 'n').content[1].type, 'mention');
});

test('md-to-adf: one comment when it fits, two (analysis with the CC, then plan) when it is too long', () => {
  const big = (word) => `# ${word}\n\n${'text '.repeat(2000)}`;
  const cc = { id: 'a', name: 'Indhuja' };
  assert.equal(buildComments({ cc, files: [{ md: '# A\n\nshort' }, { md: '# P\n\nshort' }] }).length, 1);
  const two = buildComments({ cc, files: [{ md: big('Analysis') }, { md: big('Plan') }], max: 12000 });
  assert.equal(two.length, 2);
  assert.ok(JSON.stringify(two[0]).includes('"mention"'));
  assert.ok(!JSON.stringify(two[1]).includes('"mention"'));
  assert.ok(textLength(two[1]) > 0);
});

test('md-to-adf: command line prints the comments as JSON', () => {
  const dir = mkdtempSync(join(tmpdir(), 'adf-test-'));
  const a = join(dir, 'a.md');
  const p = join(dir, 'p.md');
  writeFileSync(a, '# Analysis\n\n- point\n');
  writeFileSync(p, '# Plan\n\n1. step\n');
  const r = spawnSync(process.execPath, [SCRIPT, '--cc', 'acc-9|Indhuja', a, p], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.equal(out.comments.length, 1);
  assert.ok(JSON.stringify(out.comments[0]).includes('"id":"acc-9"'));
  assert.equal(spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8' }).status, 2);
  assert.equal(spawnSync(process.execPath, [SCRIPT, '--cc', 'nobar', a], { encoding: 'utf8' }).status, 2);
});
