# SOLMAR — A Sun-Soaked Crime Story

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Djebrix/gta6-game/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard)
[![reward](https://make.fun/badge/gta6-01/Djebrix/gta6-game/reward.svg)](https://make.fun/bounty/gta6-01)

An original open-world crime game in the spirit of GTA 6, built for the [make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01). You are Marco Reyes, a wheelman for hire in Solmar — a sun-soaked coastal city of downtown towers, an old town, a marina and a beachfront. Explore it on foot and by car, steal what you need, run from the Solmar PD, and finish all five of Lena's jobs to run the city.

## How to play

Open `game/index.html` in desktop Chrome (or serve `game/` with any static server — `node serve.ts` serves it at http://localhost:8080). No network, no build step.

- **On foot:** WASD move, Shift run, F punch, mouse click shoots (once you own a pistol).
- **In a car:** W accelerate, S brake / reverse, A D steer, Space handbrake.
- **E** gets in a car — or steals one. Stealing, hitting people and shooting raise your wanted level.
- **Missions** start at the yellow **M** at Lena's garage. Five jobs, each with its own objective and timer.
- **Taxi fares:** stop by a yellow **!** between jobs for quick cash.
- **P** pause, **M** mute, **R** restart mission. Progress saves automatically.

## What is in the game

- A 2,600 × 1,900 open city: downtown, old town, marina, beachfront, parks and a plaza.
- Traffic that follows the road grid, pedestrians on the sidewalks, parked cars to steal.
- A wanted system (0–5 stars): police cars chase and ram, cops on foot chase and punch, and the heat cools off when you lie low.
- Five story missions (steal and deliver, a timed pickup, losing a 3-star heat, a smash-and-grab, a five-checkpoint race) plus a taxi side hustle.
- Combat on foot (fists and a pistol), car damage and explosions, a garage that repairs your ride.
- HUD with cash, health, wanted stars, a live minimap, mission objectives and timers.
- Synthesised sound (engine, sirens, gunshots, jingles) — no audio files, everything generated in code.

## Structure

- `game/index.html` — the page, one canvas.
- `game/src/main.js` — boot, loop, screens, menus, save wiring.
- `game/src/city.js` — the city generator (roads, blocks, buildings, beach, marina).
- `game/src/sim.js` — one simulation tick, shared by live play and the screenshot stager.
- `game/src/cars.js` — driving physics, traffic AI, police AI, collisions.
- `game/src/peds.js` — pedestrians and cops on foot.
- `game/src/player.js` — the player on foot and in a car, combat, stealing.
- `game/src/wanted.js` — the wanted system.
- `game/src/missions.js` — the five story missions and the taxi hustle.
- `game/src/render.js` — the city background and the live world layer.
- `game/src/hud.js` — HUD, minimap and screens.
- `game/src/shots.js` — deterministic screenshot scenes (`?shot=start|play|chase|mission`).
- `game/src/audio.js` — synthesised WebAudio sound. `game/src/input.js`, `game/src/particles.js`, `game/src/save.js`, `game/src/config.js`, `game/src/random.js`, `game/src/util.js` — support.

`main.ts` hands the game in: it copies `game/` and `screenshots/` to `/output` and writes `dossier.json` with the kit's `vendor/makefun-game.ts`.

## Originality

Every name, character, place, line of code and sound in SOLMAR is original, made for this entry. It is not affiliated with Rockstar Games or Grand Theft Auto, and it uses nothing from any commercial game.
