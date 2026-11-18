// SOLMAR — a gta6-01 entry (Node 22, standard library only). The game is this
// directory's game/ folder: plain static files a desktop browser loads offline
// (game/index.html and its ES modules, no library and no network request), and
// this program hands it in. It copies game/ and screenshots/ from beside this
// file to /output and writes /output/dossier.json, the summary the judge reads,
// with the vendored make.fun library. SOLMAR is an original top-down open-world
// crime game: a sun-soaked coastal city to explore on foot and by car, traffic
// and pedestrians, cars to steal and drive, a wanted level with police who
// respond, five story missions, combat, a HUD with a minimap, a start screen
// and a save — all drawn by its own code, no borrowed assets.
//
// Rebuilt in a sealed recorded session (the entry's own files, written out
// again here and re-verified): the game, the screenshots and this hand-in
// program are all produced inside the recording the submission carries.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The caps below mirror the scorer's own gates (reference/gate.json): only
// text_max_bytes shapes the bytes the dossier carries. The rest refuse an
// entry the scorer would refuse — more than 4 screenshots, or one over
// 256 KiB; more than 993 files under game/, or 48 MiB of game files in all,
// or a path under game/ over 1000 bytes. (The /output directory itself is
// capped at 1000 entries by the container, and game/ counts beside its
// screenshots/ and dossier.json.)


import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

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