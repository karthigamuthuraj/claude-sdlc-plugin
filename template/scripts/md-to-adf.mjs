#!/usr/bin/env node
// Turn the analysis and plan markdown files into Jira comments (Atlassian Document Format) that start with
// "CC:" and a real @mention of the general assignee (a Jira mention node, never plain text).
//   node md-to-adf.mjs --cc "<accountId>|<display name>" [--max 28000] [--note "text"] <analysis.md> <plan.md>
// Prints JSON: { comments: [ <ADF doc>, ... ], characters: [n, ...] }. One comment when the text fits in --max,
// otherwise two (the analysis with the CC line, then the plan). Supports headings, paragraphs, bold, italic,
// inline code, links, bullet/numbered/task lists (nested), tables, code blocks, quotes and rules.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

function inline(text) {
  const out = [];
  const push = (t, marks) => { if (t) out.push(marks ? { type: 'text', text: t, marks } : { type: 'text', text: t }); };
  const re = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\((https?:[^)\s]+)\)|\*([^*\s][^*]*?)\*|(?<![A-Za-z0-9])_([^_]+)_(?![A-Za-z0-9])/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) push(text.slice(last, m.index));
    if (m[1]) push(m[1].replace(/`/g, ''), [{ type: 'strong' }]); // ADF cannot combine the code mark with bold, so drop the backticks
    else if (m[2]) push(m[2], [{ type: 'code' }]);
    else if (m[3]) push(m[3], [{ type: 'link', attrs: { href: m[4] } }]);
    else push(m[5] || m[6], [{ type: 'em' }]);
    last = re.lastIndex;
  }
  push(text.slice(last));
  return out;
}

const paragraph = (text) => ({ type: 'paragraph', content: inline(text) });
const itemRe = /^(\s*)([-*]|\d+\.)\s+(.*)$/;

function parseList(lines, start) {
  const first = itemRe.exec(lines[start]);
  const indent = first[1].length;
  const ordered = /\d/.test(first[2]);
  const items = [];
  let i = start;
  while (i < lines.length) {
    const m = itemRe.exec(lines[i]);
    if (!m || m[1].length < indent) break;
    if (m[1].length > indent) {
      const [sub, next] = parseList(lines, i);
      if (items.length) items[items.length - 1].content.push(sub);
      i = next;
      continue;
    }
    if (/\d/.test(m[2]) !== ordered) break;
    let text = m[3].replace(/^\[ \]\s*/, '☐ ').replace(/^\[[xX]\]\s*/, '☑ ');
    i++;
    while (i < lines.length && lines[i].trim() && !itemRe.test(lines[i]) && /^\s{2,}/.test(lines[i])) { text += ` ${lines[i].trim()}`; i++; }
    items.push({ type: 'listItem', content: [paragraph(text)] });
  }
  return [{ type: ordered ? 'orderedList' : 'bulletList', content: items }, i];
}

const cells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

export function mdToAdf(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const content = [];
  const blockStart = (l) => /^(#{1,6}\s|```|>|\s*([-*]|\d+\.)\s|\s*\|)/.test(l) || /^(-{3,}|\*{3,})\s*$/.test(l.trim());
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    let m = /^```(\w*)\s*$/.exec(line.trim());
    if (m) {
      const body = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i].trim())) body.push(lines[i++]);
      i++;
      const text = body.join('\n');
      content.push({ type: 'codeBlock', attrs: m[1] ? { language: m[1] } : {}, content: text ? [{ type: 'text', text }] : [] });
      continue;
    }
    m = /^(#{1,6})\s+(.*)$/.exec(line);
    if (m) { content.push({ type: 'heading', attrs: { level: m[1].length }, content: inline(m[2]) }); i++; continue; }
    if (/^(-{3,}|\*{3,})\s*$/.test(line.trim())) { content.push({ type: 'rule' }); i++; continue; }
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      const rows = [{ cells: cells(line), header: true }];
      i += 2;
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push({ cells: cells(lines[i++]), header: false });
      content.push({
        type: 'table',
        attrs: { isNumberColumnEnabled: false, layout: 'default' },
        content: rows.map((r) => ({
          type: 'tableRow',
          content: r.cells.map((c) => ({ type: r.header ? 'tableHeader' : 'tableCell', attrs: {}, content: [paragraph(c)] })),
        })),
      });
      continue;
    }
    if (/^>\s?/.test(line)) {
      const quote = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) quote.push(lines[i++].replace(/^>\s?/, ''));
      content.push({ type: 'blockquote', content: [paragraph(quote.join(' '))] });
      continue;
    }
    if (itemRe.test(line)) { const [list, next] = parseList(lines, i); content.push(list); i = next; continue; }
    const para = [];
    while (i < lines.length && lines[i].trim() && !(para.length && blockStart(lines[i]))) para.push(lines[i++].trim());
    content.push(paragraph(para.join(' ')));
  }
  return { version: 1, type: 'doc', content };
}

export function textLength(node) {
  if (Array.isArray(node)) return node.reduce((n, c) => n + textLength(c), 0);
  if (!node || typeof node !== 'object') return 0;
  if (node.type === 'text') return node.text.length;
  return textLength(node.content || []);
}

export function ccParagraph(cc, note) {
  return {
    type: 'paragraph',
    content: [
      { type: 'text', text: 'CC: ' },
      { type: 'mention', attrs: { id: cc.id, text: `@${cc.name}` } },
      { type: 'text', text: ` - ${note}` },
    ],
  };
}

// files: [{ md }] in posting order (analysis first, plan second). Returns the ADF comments to post.
export function buildComments({ cc, files, max = 28000, note = 'the requirements analysis and implementation plan are ready for your review.' }) {
  const docs = files.map((f) => mdToAdf(f.md));
  const head = cc ? [ccParagraph(cc, note)] : [];
  const doc = (content) => ({ version: 1, type: 'doc', content });
  const combined = doc([...head, ...docs.flatMap((d, k) => (k ? [{ type: 'rule' }, ...d.content] : d.content))]);
  if (textLength(combined) <= max || docs.length < 2) return [combined];
  return [doc([...head, ...docs[0].content]), ...docs.slice(1).map((d) => doc(d.content))];
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const argv = process.argv.slice(2);
  const die = (msg) => { process.stderr.write(`md-to-adf: ${msg}\n`); process.exit(2); };
  const opt = (name) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : undefined; };
  const paths = argv.filter((a, i) => !a.startsWith('--') && !(argv[i - 1] || '').startsWith('--'));
  if (!paths.length) die('usage: md-to-adf.mjs --cc "<accountId>|<display name>" [--max 28000] [--note "text"] <analysis.md> <plan.md>');
  let cc;
  if (opt('cc')) {
    const [id, ...name] = opt('cc').split('|');
    if (!id || !name.length) die('--cc needs "<accountId>|<display name>"');
    cc = { id, name: name.join('|') };
  }
  const files = paths.map((p) => ({ md: readFileSync(p, 'utf8') }));
  const max = Number(opt('max')) || 28000;
  const comments = buildComments({ cc, files, max, note: opt('note') || undefined });
  console.log(JSON.stringify({ comments, characters: comments.map(textLength) }));
}
