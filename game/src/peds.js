// Pedestrians: they stroll the sidewalks, flee from danger, and (as cops) chase
// the player when the heat is on. All original characters, no one from any game.
import { PLAYER } from './config.js';
import { clamp, dist } from './util.js';
import { burst } from './particles.js';
import { sfx } from './audio.js';
import { hurtPlayer } from './cars.js';

const PED_COLORS = ['#e74c3c', '#3498db', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#fd79a8', '#00cec9', '#ffeaa7', '#636e72'];
const NAMES = ['Milo', 'Ana', 'Rosa', 'Tomas', 'Luz', 'Diego', 'Carmen', 'Pablo', 'Nina', 'Oscar', 'Lola', 'Rico', 'Sofia', 'Hugo', 'Marta'];

let nextPedId = 1;

export function createPed(city, rng, x, y, opts = {}) {
  const p = city.randomSidewalk(rng);
  return {
    id: nextPedId += 1,
    x: x !== undefined ? x : p.x,
    y: y !== undefined ? y : p.y,
    angle: rng() * Math.PI * 2,
    speed: 0,
    walkSpeed: 28 + rng() * 26,
    color: PED_COLORS[Math.floor(rng() * PED_COLORS.length)],
    name: NAMES[Math.floor(rng() * NAMES.length)],
    target: null,
    wait: rng() * 2,
    down: false,
    downTimer: 0,
    vx: 0, vy: 0,
    cop: opts.cop || false,
    flee: 0,
    punchCd: 0,
    dead: false,
  };
}

function nearestSidewalkPoint(city, rng) {
  return city.randomSidewalk(rng);
}

/** A pedestrian's next stroll target, a point on a nearby sidewalk. */
function pickStrollTarget(G, ped, rng) {
  const t = nearestSidewalkPoint(G.city, rng);
  // Keep it near the ped so they stay in their neighbourhood.
  const dx = t.x - ped.x, dy = t.y - ped.y;
  const d = Math.hypot(dx, dy);
  if (d > 500) return { x: ped.x + (dx / d) * 400, y: ped.y + (dy / d) * 400 };
  return t;
}

export function stepPed(G, ped, dt, rng) {
  if (ped.down) {
    ped.downTimer -= dt;
    ped.x += ped.vx * dt; ped.y += ped.vy * dt;
    ped.vx *= 0.9; ped.vy *= 0.9;
    if (ped.downTimer <= 0) { ped.down = false; ped.flee = 2.5; }
    return;
  }
  ped.punchCd = Math.max(0, ped.punchCd - dt);

  const px = G.player.x, py = G.player.y;
  const dPlayer = dist(ped.x, ped.y, px, py);

  if (ped.cop) {
    // Cops run the player down and punch; they give up if the player escapes far.
    if (dPlayer > 700) { ped.dead = true; return; }
    const want = Math.atan2(py - ped.y, px - ped.x);
    ped.angle = want;
    ped.speed = 200;
    ped.x += Math.cos(want) * ped.speed * dt;
    ped.y += Math.sin(want) * ped.speed * dt;
    if (dPlayer < 26 && ped.punchCd <= 0) {
      ped.punchCd = 0.9;
      hurtPlayer(G, 10);
      sfx.punch();
      burst(G.particles, px, py, 5, '#fff', 80, 0.3, 3);
      G.camera.shake = Math.max(G.camera.shake, 3);
    }
    return;
  }

  // Flee from a fast car or a punching player.
  let fleeX = 0, fleeY = 0, fleeing = false;
  const pc = G.player.car;
  if (pc && Math.abs(pc.speed) > 80) {
    const d = dist(ped.x, ped.y, pc.x, pc.y);
    if (d < 110) { fleeing = true; fleeX = ped.x - pc.x; fleeY = ped.y - pc.y; }
  }
  if (!G.player.car && dPlayer < 40 && G.player.punching) {
    fleeing = true; fleeX = ped.x - px; fleeY = ped.y - py;
  }
  if (fleeing) {
    const d = Math.hypot(fleeX, fleeY) || 1;
    ped.angle = Math.atan2(fleeY, fleeX);
    ped.speed = 150;
    ped.x += (fleeX / d) * ped.speed * dt;
    ped.y += (fleeY / d) * ped.speed * dt;
    ped.flee = 1;
    return;
  }

  // Stroll: walk to the target, wait a moment, pick a new one.
  if (ped.wait > 0) { ped.wait -= dt; ped.speed = 0; return; }
  if (!ped.target) ped.target = pickStrollTarget(G, ped, rng);
  const dx = ped.target.x - ped.x, dy = ped.target.y - ped.y;
  const d = Math.hypot(dx, dy);
  if (d < 12) { ped.target = null; ped.wait = 0.5 + rng() * 3; return; }
  ped.angle = Math.atan2(dy, dx);
  ped.speed = ped.walkSpeed;
  ped.x += Math.cos(ped.angle) * ped.speed * dt;
  ped.y += Math.sin(ped.angle) * ped.speed * dt;
  // Stay out of buildings and water.
  const b = G.city.buildingAt(ped.x, ped.y);
  if (b || G.city.inWater(ped.x, ped.y)) {
    ped.x -= Math.cos(ped.angle) * ped.speed * dt * 2;
    ped.y -= Math.sin(ped.angle) * ped.speed * dt * 2;
    ped.target = pickStrollTarget(G, ped, rng);
  }
  ped.x = clamp(ped.x, 10, G.city.w - 10);
  ped.y = clamp(ped.y, 10, G.city.h - 30);
}

/** Keep the street populated; cops are spawned by the wanted system. */
export function stepPeds(G, dt, rng) {
  for (let i = G.peds.length - 1; i >= 0; i -= 1) {
    const ped = G.peds[i];
    stepPed(G, ped, dt, rng);
    if (ped.dead) G.peds.splice(i, 1);
  }
  // Top the crowd back up near the camera.
  const want = 46;
  if (G.peds.length < want && rng() < dt * 3) {
    const a = rng() * Math.PI * 2;
    const r = 500 + rng() * 300;
    const x = G.camera.x + Math.cos(a) * r;
    const y = G.camera.y + Math.sin(a) * r;
    if (x > 20 && x < G.city.w - 20 && y > 20 && y < G.city.h - 40 && !G.city.buildingAt(x, y)) {
      G.peds.push(createPed(G.city, rng, x, y));
    }
  }
}

/** Spawn a cop on foot near the player (called by the wanted system). */
export function spawnCop(G, rng) {
  const node = G.city.nearestNode(G.player.x + (rng() - 0.5) * 500, G.player.y + (rng() - 0.5) * 500);
  const cop = createPed(G.city, rng, node.x, node.y, { cop: true });
  cop.color = '#1c2733';
  cop.name = 'Officer';
  G.peds.push(cop);
  return cop;
}

export function playerPunchRange() { return PLAYER.radius + 26; }
