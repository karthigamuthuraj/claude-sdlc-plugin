import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const FRAMES = join(HERE, '..', 'template', 'scripts', 'frames.mjs');
const dir = mkdtempSync(join(tmpdir(), 'frames-test-'));

// A stand-in for ffmpeg: answers -version, reports a 30 s duration when probed, and writes -frames:v files.
const fake = join(dir, 'fake-ffmpeg.mjs');
writeFileSync(fake, `
import { writeFileSync } from 'node:fs';
const a = process.argv.slice(2);
if (a.includes('-version')) { console.log('ffmpeg version fake'); process.exit(0); }
const pattern = a[a.length - 1];
if (!pattern.includes('%02d')) { process.stderr.write('  Duration: 00:00:30.00, start: 0.000000, bitrate: 1000 kb/s\\n'); process.exit(1); }
const n = Number(a[a.indexOf('-frames:v') + 1]);
for (let i = 1; i <= n; i++) writeFileSync(pattern.replace('%02d', String(i).padStart(2, '0')), 'x');
process.stdout.write(a.join(' ') + '\\n');
`);
const video = join(dir, 'clip.mp4');
writeFileSync(video, 'not a real video');
const env = { ...process.env, SDLC_FFMPEG: process.execPath, SDLC_FFMPEG_ARGS: JSON.stringify([fake]) };
const run = (args, e = env) => spawnSync(process.execPath, [FRAMES, ...args], { encoding: 'utf8', env: e });

test('frames: extracts evenly spaced frames and reports the duration', () => {
  const r = run([video, '--max', '8', '--out', join(dir, 'out')]);
  assert.equal(r.status, 0, r.stderr);
  const j = JSON.parse(r.stdout);
  assert.equal(j.durationSeconds, 30);
  assert.equal(j.frames.length, 8);
  assert.ok(j.frames.every((f) => existsSync(f)));
  assert.equal(readdirSync(join(dir, 'out')).length, 8);
});

test('frames: --max is capped at 30 frames', () => {
  const short = join(dir, 'short.mp4');
  writeFileSync(short, 'x');
  const lowCount = spawnSync(process.execPath, [FRAMES, short, '--max', '50', '--out', join(dir, 'out2')], { encoding: 'utf8', env });
  assert.equal(lowCount.status, 0, lowCount.stderr);
  assert.equal(JSON.parse(lowCount.stdout).frames.length, 30, 'capped at 30 frames');
});

test('frames: usage and missing file errors', () => {
  assert.equal(run([]).status, 2);
  assert.equal(run([join(dir, 'missing.mp4')]).status, 2);
});
