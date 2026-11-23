#!/usr/bin/env node
// Extract evenly spaced frames from a screen recording so they can be read as images.
//   node frames.mjs <video> [--max 12] [--width 1280] [--out <dir>]
// Needs ffmpeg on PATH, or the Python package imageio-ffmpeg (which bundles one). Prints JSON.
// Env (for wrappers and tests): SDLC_FFMPEG = program to run, SDLC_FFMPEG_ARGS = JSON array of leading arguments.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';

const die = (msg, code = 1) => { process.stderr.write(`frames: ${msg}\n`); process.exit(code); };
const argv = process.argv.slice(2);
const opt = (name, dflt) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : dflt; };
const video = argv.find((a, i) => !a.startsWith('--') && !(argv[i - 1] || '').startsWith('--'));
if (!video) die('usage: frames.mjs <video> [--max 12] [--width 1280] [--out <dir>]', 2);
const file = resolve(video);
if (!existsSync(file) || !statSync(file).isFile()) die(`not a file: ${file}`, 2);
const max = Math.max(1, Math.min(30, Number(opt('max', 12)) || 12));
const width = Math.max(320, Math.min(1920, Number(opt('width', 1280)) || 1280));

function findFfmpeg() {
  if (process.env.SDLC_FFMPEG) return { exe: process.env.SDLC_FFMPEG, lead: JSON.parse(process.env.SDLC_FFMPEG_ARGS || '[]') };
  for (const exe of ['ffmpeg', 'ffmpeg.exe']) {
    if (spawnSync(exe, ['-version'], { encoding: 'utf8' }).status === 0) return { exe, lead: [] };
  }
  for (const py of ['python', 'python3', 'py']) {
    const r = spawnSync(py, ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())'], { encoding: 'utf8' });
    if (r.status === 0 && r.stdout.trim()) return { exe: r.stdout.trim(), lead: [] };
  }
  return null;
}

const ff = findFfmpeg();
if (!ff) die('no ffmpeg found. Install ffmpeg (for example: winget install Gyan.FFmpeg) or the Python package imageio-ffmpeg (pip install imageio-ffmpeg), then run again.', 3);
const run = (args) => spawnSync(ff.exe, [...ff.lead, '-hide_banner', ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

// ffmpeg prints "Duration: HH:MM:SS.xx" to stderr when it is given an input and no output.
const probe = run(['-i', file]);
const m = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(`${probe.stderr || ''}${probe.stdout || ''}`);
const duration = m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0;
const count = duration > 0 ? Math.max(1, Math.min(max, Math.ceil(duration))) : max;
const fps = duration > 0 ? `${count}/${duration.toFixed(3)}` : '1/3';

const st = statSync(file);
const out = resolve(opt('out', join(tmpdir(), 'sdlc-frames', createHash('sha1').update(`${file}|${st.size}|${st.mtimeMs}`).digest('hex').slice(0, 10))));
mkdirSync(out, { recursive: true });
const pattern = join(out, 'frame_%02d.jpg');
const r = run(['-loglevel', 'error', '-y', '-i', file, '-vf', `fps=${fps},scale=${width}:-2`, '-frames:v', String(count), '-q:v', '4', pattern]);
if (r.status !== 0) die(`ffmpeg failed: ${(r.stderr || '').trim().slice(0, 300)}`, 4);
const frames = readdirSync(out).filter((f) => /^frame_\d+\.jpg$/.test(f)).sort().map((f) => join(out, f));
if (!frames.length) die('ffmpeg produced no frames', 4);
console.log(JSON.stringify({ video: file, durationSeconds: duration || null, frames }, null, 2));
