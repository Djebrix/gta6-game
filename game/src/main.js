// SOLMAR — entry point. Boots the world, runs the loop, owns the screens
// (title, play, pause, wasted, busted, results, ending) and the save.
// The game itself lives in the modules under src/; this file only wires them.
import { buildCity } from './city.js';
import { createInput } from './input.js';
import { createPlayer, spawnStarterCar } from './player.js';
import { createWanted, addCrime } from './wanted.js';
import { createMissions, missionMarker, taxiMarker, MISSIONS, startMission } from './missions.js';
import { createParticles } from './particles.js';
import { buildBackground, drawWorld } from './render.js';
import { drawHUD, drawTitle, drawPause, drawBigScreen, drawHowTo } from './hud.js';
import { stepWorld } from './sim.js';
import { stageShot } from './shots.js';
import { loadSave, storeSave } from './save.js';
import { mulberry32, rangeInt } from './random.js';
import { createCar } from './cars.js';
import { createPed } from './peds.js';
import { unlockAudio, setMuted, isMuted, engine, siren, sfx } from './audio.js';
import { GARAGE } from './config.js';
import { money } from './util.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(window.location.search);
const SHOT = params.get('shot') || '';
// A ?seed= pins the world (screenshots); live play gets a fresh world each load.
const SEED = Number(params.get('seed') || String((Math.random() * 2 ** 31) | 0));

const G = {
  ctx,
  view: { w: 1280, h: 720, scale: 1, dpr: 1 },
  city: null,
  bgCanvas: null,
  player: null,
  cars: [],
  peds: [],
  wanted: null,
  missions: null,
  particles: null,
  camera: { x: 1350, y: 930, shake: 0 },
  time: 0,
  screen: 'title',
  returnScreen: 'title',
  menu: { items: [], selected: 0 },
  menuRects: [],
  messageText: '',
  messageTimer: 0,
  prompt: '',
  shotLine: null,
  save: { cash: 0, unlocked: 0, completed: [], earned: 0, muted: false },
  rng: mulberry32(SEED),
  repairCd: 0,
  bustTimer: 0,
  lastPassed: null,
  lastFailed: null,
  saveTimer: 0,
  missionMarker: null,
  taxiMarker: null,
};

G.crime = (stars, reason) => addCrime(G, stars, reason);
G.message = (text, dur = 3) => { G.messageText = text; G.messageTimer = dur; };
G.wasted = () => {
  if (G.screen !== 'play') return;
  G.screen = 'wasted';
  sfx.wasted();
  G.player.cash = Math.max(0, G.player.cash - 100);
  G.saveGame();
};
G.busted = () => {
  if (G.screen !== 'play') return;
  G.screen = 'busted';
  sfx.missionFail();
  G.player.cash = Math.max(0, G.player.cash - 100);
  G.saveGame();
};
G.onMissionPassed = (def) => {
  G.lastPassed = def;
  G.saveGame();
  G.screen = def.id === MISSIONS.length - 1 ? 'ending' : 'passed';
};
G.onMissionFailed = (def, reason) => {
  G.lastFailed = { def, reason };
  G.screen = 'failed';
};
G.saveGame = () => {
  G.save.cash = G.player.cash;
  G.save.unlocked = G.missions.unlocked;
  G.save.completed = G.missions.completed;
  G.save.earned = G.save.earned;
  G.save.muted = isMuted();
  storeSave(G.save);
};

const input = createInput(canvas);

// --- world setup --------------------------------------------------------------

function spawnTraffic(G, n) {
  const types = ['sedan', 'sedan', 'sedan', 'taxi', 'sport', 'truck', 'van'];
  for (let i = 0; i < n; i += 1) {
    const node = G.city.nodes[rangeInt(G.rng, 0, G.city.nodes.length - 1)];
    const type = types[rangeInt(G.rng, 0, types.length - 1)];
    const car = createCar(G.city, type, node.x + (G.rng() - 0.5) * 20, node.y + (G.rng() - 0.5) * 20, G.rng() * Math.PI * 2, { driver: 'traffic', rng: G.rng });
    G.cars.push(car);
  }
}

function resetWorld(seed, save) {
  G.rng = mulberry32(seed);
  G.city = buildCity(seed);
  G.bgCanvas = buildBackground(G.city);
  // The player starts on the sidewalk beside the starter car (40 px away,
  // inside the 56 px enter radius), facing it.
  G.player = createPlayer(GARAGE.x + 10, GARAGE.y + 55);
  G.player.cash = save.cash;
  G.cars = [];
  G.peds = [];
  G.wanted = createWanted();
  G.missions = createMissions();
  G.missions.unlocked = save.unlocked;
  G.missions.completed = [...save.completed];
  G.particles = createParticles();
  G.camera = { x: G.player.x, y: G.player.y, shake: 0 };
  G.time = 0;
  G.messageText = '';
  G.messageTimer = 0;
  G.shotLine = null;
  G.bustTimer = 0;
  spawnStarterCar(G);
  // A few parked cars to steal, tucked on the sidewalk beside the road.
  const parked = [
    { x: 1100, y: 760, a: 0, t: 'sedan' },
    { x: 1700, y: 1250, a: Math.PI / 2, t: 'van' },
    { x: 500, y: 470, a: Math.PI, t: 'truck' },
    { x: 2000, y: 730, a: -Math.PI / 2, t: 'sport' },
  ];
  for (const p of parked) {
    G.cars.push(createCar(G.city, p.t, p.x, p.y, p.a, { driver: 'none', rng: G.rng }));
  }
  spawnTraffic(G, 26);
  for (let i = 0; i < 44; i += 1) G.peds.push(createPed(G.city, G.rng));
}

// --- menus ---------------------------------------------------------------------

function setMenu(items) {
  G.menu = { items, selected: 0 };
}

function titleMenu() {
  const items = ['New Game'];
  if (G.save.unlocked > 0 || G.save.completed.length > 0 || G.save.cash > 0) items.push('Continue');
  items.push('How to Play');
  setMenu(items);
}

function handleMenu() {
  const items = G.menu.items;
  if (input.wasPressed('ArrowUp') || input.wasPressed('w')) {
    G.menu.selected = (G.menu.selected + items.length - 1) % items.length;
    sfx.click();
  }
  if (input.wasPressed('ArrowDown') || input.wasPressed('s')) {
    G.menu.selected = (G.menu.selected + 1) % items.length;
    sfx.click();
  }
  if (input.mouse.pressed) {
    for (const r of G.menuRects) {
      if (input.mouse.x >= r.x && input.mouse.x <= r.x + r.w && input.mouse.y >= r.y && input.mouse.y <= r.y + r.h) {
        G.menu.selected = r.index;
        return r.index;
      }
    }
  }
  if (input.wasPressed('Enter')) return G.menu.selected;
  return -1;
}

// --- screens --------------------------------------------------------------------

function startNewGame() {
  const fresh = { cash: 0, unlocked: 0, completed: [], earned: 0, muted: G.save.muted };
  G.save = fresh;
  resetWorld(SEED, fresh);
  G.screen = 'play';
  G.message('Welcome to Solmar, Marco. Lena is waiting at the garage — follow the M.', 5);
  sfx.missionPass();
}

function continueGame() {
  resetWorld(SEED, G.save);
  G.screen = 'play';
  G.message('Welcome back, Marco.', 3);
}

function respawn(kind) {
  // Wasted: the hospital. Busted: the police station steps.
  G.player.health = 100;
  G.player.x = kind === 'wasted' ? 1380 : 480;
  G.player.y = kind === 'wasted' ? 760 : 1150;
  G.player.onFoot = true;
  G.player.car = null;
  G.player.invuln = 2;
  G.wanted.stars = 0;
  G.wanted.quietTimer = 0;
  for (const c of G.cars) if (c.police) c.dead = true;
  for (const p of G.peds) if (p.cop) p.dead = true;
  G.camera.x = G.player.x;
  G.camera.y = G.player.y;
  G.screen = 'play';
  G.message(kind === 'wasted' ? 'Patched up at Solmar General. -$100' : 'Released with a warning. -$100', 3);
}

function updatePrompt() {
  const p = G.player;
  if (G.screen !== 'play') { G.prompt = ''; return; }
  if (p.onFoot) {
    let best = null, bestD = 56;
    for (const c of G.cars) {
      if (c.dead) continue;
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d < bestD) { bestD = d; best = c; }
    }
    if (best) {
      G.prompt = best.driver === 'traffic' ? 'E — Steal car' : 'E — Get in car';
      return;
    }
    if (p.health < 100 && Math.hypot(p.x - 1380, p.y - 700) < 90) { G.prompt = 'Hospital — healing…'; return; }
  } else if (p.car) {
    if (Math.abs(p.car.speed) < 40) { G.prompt = 'E — Get out of the car'; return; }
    if (p.car.health < 100 && Math.hypot(p.x - GARAGE.x, p.y - GARAGE.y) < 90) { G.prompt = 'Garage — repairing… ($50)'; return; }
  }
  G.prompt = '';
}

function step(dt) {
  // Global keys.
  if (input.wasPressed('m')) {
    setMuted(!isMuted());
    G.message(isMuted() ? 'Sound off' : 'Sound on', 1.5);
  }
  if (G.screen === 'title') {
    const pick = handleMenu();
    if (pick >= 0) {
      unlockAudio();
      const item = G.menu.items[pick];
      if (item === 'New Game') startNewGame();
      else if (item === 'Continue') continueGame();
      else if (item === 'How to Play') { G.returnScreen = 'title'; G.screen = 'howto'; }
    }
    // Slow drift over the city behind the title.
    G.camera.x = 1350 + Math.sin(G.time * 0.05) * 120;
    G.camera.y = 930 + Math.cos(G.time * 0.04) * 80;
    G.time += dt;
    return;
  }
  if (G.screen === 'howto') {
    if (input.wasPressed('Escape') || input.wasPressed('Enter')) G.screen = G.returnScreen;
    return;
  }
  if (G.screen === 'pause') {
    const pick = handleMenu();
    if (pick >= 0) {
      const item = G.menu.items[pick];
      if (item === 'Resume') G.screen = 'play';
      else if (item === 'Restart Mission') {
        if (G.missions.active) { const id = G.missions.active.def.id; G.missions.active = null; G.screen = 'play'; startMission(G, id); }
        else G.screen = 'play';
      } else if (item === 'How to Play') { G.returnScreen = 'pause'; G.screen = 'howto'; }
      else if (item === 'Sound: On' || item === 'Sound: Off') { setMuted(!isMuted()); setMenu(pauseItems()); }
      else if (item === 'Quit to Title') { G.saveGame(); G.screen = 'title'; titleMenu(); resetWorld(SEED, G.save); }
    }
    if (input.wasPressed('Escape') || input.wasPressed('p')) G.screen = 'play';
    return;
  }
  if (G.screen === 'wasted' || G.screen === 'busted') {
    if (input.wasPressed('Enter')) respawn(G.screen);
    return;
  }
  if (G.screen === 'passed' || G.screen === 'failed') {
    if (input.wasPressed('Enter')) G.screen = 'play';
    return;
  }
  if (G.screen === 'ending') {
    if (input.wasPressed('Enter')) { G.saveGame(); G.screen = 'title'; titleMenu(); }
    return;
  }

  // Play.
  if (input.wasPressed('Escape') || input.wasPressed('p')) {
    G.screen = 'pause';
    setMenu(pauseItems());
    G.saveGame();
    return;
  }
  if (input.wasPressed('r') && G.missions.active) {
    const id = G.missions.active.def.id;
    G.missions.active = null;
    startMission(G, id);
    G.message('Mission restarted.', 2);
  }

  stepWorld(G, input, dt, G.rng);
  updatePrompt();

  // Busted: a police car sitting on the on-foot player for a while.
  if (G.player.onFoot && G.wanted.stars >= 1) {
    let near = false;
    for (const c of G.cars) {
      if (c.police && !c.dead && Math.hypot(c.x - G.player.x, c.y - G.player.y) < 46) { near = true; break; }
    }
    if (near) {
      G.bustTimer += dt;
      if (G.bustTimer > 1.4) { G.bustTimer = 0; G.busted(); }
    } else G.bustTimer = 0;
  } else G.bustTimer = 0;

  // Markers for the HUD and minimap.
  G.missionMarker = missionMarker(G);
  G.taxiMarker = taxiMarker(G);

  // Audio: engine hum and sirens.
  const pc = G.player.car;
  engine(pc ? Math.abs(pc.speed) / 470 : 0, !!pc);
  let policeNear = false;
  for (const c of G.cars) {
    if (c.police && !c.dead && Math.hypot(c.x - G.player.x, c.y - G.player.y) < 520) { policeNear = true; break; }
  }
  siren(policeNear && G.wanted.stars > 0, dt);

  // Autosave every few seconds.
  G.saveTimer += dt;
  if (G.saveTimer > 5) { G.saveTimer = 0; G.saveGame(); }
}

function pauseItems() {
  const items = ['Resume'];
  if (G.missions.active) items.push('Restart Mission');
  items.push('How to Play');
  items.push(isMuted() ? 'Sound: Off' : 'Sound: On');
  items.push('Quit to Title');
  return items;
}

function render() {
  const view = G.view;
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  ctx.clearRect(0, 0, view.w, view.h);
  if (G.screen === 'title' || G.screen === 'howto' && G.returnScreen === 'title') {
    drawWorld(G);
    drawTitle(G);
    if (G.screen === 'howto') drawHowTo(G);
    return;
  }
  drawWorld(G);
  if (G.screen === 'play') {
    drawHUD(G);
  } else if (G.screen === 'pause') {
    drawHUD(G);
    drawPause(G);
  } else if (G.screen === 'howto') {
    drawHUD(G);
    drawHowTo(G);
  } else if (G.screen === 'wasted') {
    drawHUD(G);
    drawBigScreen(G, 'WASTED', 'The city chews up another wheelman.', '#ff5252');
  } else if (G.screen === 'busted') {
    drawHUD(G);
    drawBigScreen(G, 'BUSTED', 'The Solmar PD has you — this time.', '#42a5f5');
  } else if (G.screen === 'passed' && G.lastPassed) {
    drawHUD(G);
    drawBigScreen(G, 'MISSION PASSED', G.lastPassed.name + '  •  +' + money(G.lastPassed.reward), '#7CFC00');
  } else if (G.screen === 'failed' && G.lastFailed) {
    drawHUD(G);
    drawBigScreen(G, 'MISSION FAILED', G.lastFailed.reason, '#ff5252');
  } else if (G.screen === 'ending') {
    drawHUD(G);
    drawBigScreen(G, 'KING OF SOLMAR', 'All five jobs done. Total earned: ' + money(G.save.earned), '#ffd54f');
  }
}

// --- sizing --------------------------------------------------------------------

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (SHOT) {
    // Fixed frame for screenshots.
    canvas.style.width = '1280px';
    canvas.style.height = '720px';
    canvas.width = 1280;
    canvas.height = 720;
    G.view = { w: 1280, h: 720, scale: 720 / 780, dpr: 1 };
    return;
  }
  const w = window.innerWidth, h = window.innerHeight;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  G.view = { w, h, scale: h / 780, dpr };
}
window.addEventListener('resize', resize);

// --- boot ----------------------------------------------------------------------

function boot() {
  const saved = loadSave();
  if (saved) G.save = saved;
  if (saved && saved.muted) setMuted(true);
  resize();
  resetWorld(SEED, G.save);
  titleMenu();

  if (SHOT) {
    // Stage one deterministic scene and keep painting it: a resize event
    // reassigns the canvas size (which clears it), so a single render is not
    // enough — repaint the same frozen frame every frame.
    G.screen = stageShot(G, SHOT);
    G.missionMarker = missionMarker(G);
    G.taxiMarker = taxiMarker(G);
    document.title = 'SOLMAR — ' + SHOT;
    render();
    requestAnimationFrame(function repaint() {
      render();
      requestAnimationFrame(repaint);
    });
    return;
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(1 / 30, Math.max(0.0001, (now - last) / 1000));
    last = now;
    unlockAudio();
    input.beginStep();
    step(dt);
    render();
    input.consume();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

boot();

// Debug/testing handle: the live game state (read-only from the console).
window.__solmar = G;
