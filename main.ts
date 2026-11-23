// Make.fun submission entry. Build the Vite app first with `npm run build`; this copies only
// game/dist (self-contained static files with local JavaScript and WASM assets) and screenshots
// to /output, then writes the scorer-compatible dossier with the untouched vendored kit library.
//
// Develop with `npm run dev`. For a static preview, build first, then use `node serve.ts`;
// the server's root remains game/ and can serve the built tree at http://localhost:8080/dist/.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const builtGame = join(here, 'game', 'dist');
const shotsPath = join(here, 'shots.json');

if (!existsSync(join(builtGame, 'index.html'))) {
  throw new Error('Production game not found. Run `npm run build` before `node main.ts`.');
}

mkdirSync(out, { recursive: true });
cpSync(builtGame, join(out, 'game'), { recursive: true });
const shots: unknown = JSON.parse(readFileSync(shotsPath, 'utf8'));
if (!Array.isArray(shots) || shots.length < 3 || shots.length > 4) {
  throw new Error('shots.json must select 3 or 4 submission screenshots.');
}

const screenshotNames = new Set<string>();
for (const shot of shots) {
  const name = shot?.name;
  if (typeof name !== 'string' || !/^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/.test(name) || screenshotNames.has(name)) {
    throw new Error(`Invalid or duplicate screenshot name in shots.json: ${String(name)}`);
  }
  const source = join(here, 'screenshots', name);
  if (!lstatSync(source).isFile()) throw new Error(`Submission screenshot is not a regular file: ${name}`);
  screenshotNames.add(name);
}

const outScreenshots = join(out, 'screenshots');
if (resolve(outScreenshots) === resolve(join(here, 'screenshots'))) {
  throw new Error('MAKEFUN_OUTPUT_DIR must not point at the repository screenshots directory.');
}
rmSync(outScreenshots, { recursive: true, force: true });
mkdirSync(outScreenshots, { recursive: true });
for (const name of screenshotNames) {
  copyFileSync(join(here, 'screenshots', name), join(outScreenshots, name));
}

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
