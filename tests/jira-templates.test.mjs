import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'template', 'templates', 'jira');
const versions = readdirSync(ROOT, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);

test('jira templates: v1 and v2 exist and every version has bug, story, task and default', () => {
  assert.ok(versions.includes('v1') && versions.includes('v2'));
  for (const v of versions) for (const f of ['bug', 'story', 'task', 'default']) assert.ok(existsSync(join(ROOT, v, `${f}.md`)), `${v}/${f}.md`);
});

test('jira templates: placeholders are balanced and well formed', () => {
  for (const v of versions) {
    for (const f of readdirSync(join(ROOT, v))) {
      const text = readFileSync(join(ROOT, v, f), 'utf8');
      assert.equal((text.match(/\{\{/g) || []).length, (text.match(/\}\}/g) || []).length, `${v}/${f}`);
      for (const m of text.matchAll(/\{\{(\??)([a-z_]+)\}\}/g)) assert.ok(m[2], `${v}/${f}`);
      assert.equal((text.match(/\{\{(?!\??[a-z_]+\}\})/g) || []).length, 0, `${v}/${f} has a malformed placeholder`);
    }
  }
});

test('jira templates: v2 keeps the section structure of the reference skill', () => {
  const h = (f) => [...readFileSync(join(ROOT, 'v2', f), 'utf8').matchAll(/^## (.+)$/gm)].map((m) => m[1]);
  assert.deepEqual(h('bug.md').slice(0, 6), ['Bug Summary', 'Environment', 'Steps to Reproduce', 'Expected Behavior', 'Actual Behavior', 'Screenshots / Logs']);
  assert.deepEqual(h('story.md').slice(0, 3), ['User Story', 'Context', 'Acceptance Criteria']);
  assert.ok(h('task.md').includes('Definition of Done'));
  assert.ok(h('epic.md').includes('Success Metrics') && h('epic.md').includes('Timeline'));
});
