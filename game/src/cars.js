// Cars: driving physics, traffic that follows the road graph, police that chase,
// collisions with buildings, cars and pedestrians, and stealing.
import { CAR_TYPES } from './config.js';
import { clamp, angleDiff, circleRectPush, dist } from './util.js';
import { burst, smoke, addSkid, explosion } from './particles.js';
import { sfx } from './audio.js';

let nextId = 1;

export function createCar(city, type, x, y, angle, opts = {}) {
  const def = CAR_TYPES[type];
  // Colour from the caller's rng when one is given, so a seeded world is
  // deterministic; live play passes Math.random.
  const rng = opts.rng || Math.random;
  return {
    id: nextId += 1,
    type,
    x, y, angle,
    speed: 0,
    color: opts.color || def.colors[Math.floor(rng() * def.colors.length)],
    police: type === 'police',
    driver: opts.driver || 'none', // 'player' | 'traffic' | 'police' | 'none'
    health: 100,
    smoking: false,
    // traffic AI
    target: null,      // {x, y} intersection the car drives toward
    targetSpeed: 0,
    wait: 0,
    // police AI
    stuck: 0,
    lastX: x, lastY: y,
    dead: false,
  };
}

export function carRadius(car) {
  return Math.max(CAR_TYPES[car.type].w, CAR_TYPES[car.type].h) * 0.32;
}

/** A parked car the player can take without raising the alarm. */
export function spawnParked(city, rng, x, y, angle, type) {
  return createCar(city, type, x, y, angle, { driver: 'none', rng });
}

// --- physics ---------------------------------------------------------------

/** Advance one car by its speed and heading; returns distance moved. */
function integrate(car, dt) {
  const dx = Math.cos(car.angle) * car.speed * dt;
  const dy = Math.sin(car.angle) * car.speed * dt;
  car.x += dx;
  car.y += dy;
  return Math.abs(dx) + Math.abs(dy);
}

/** Keep a car out of buildings, water and the world edge. Returns true on a hit. */
export function collideWorld(city, car, dt) {
  const r = carRadius(car);
  let hit = false;
  for (const b of city.buildings) {
    const push = circleRectPush(car.x, car.y, r, b);
    if (push) {
      car.x += push.x; car.y += push.y;
      hit = true;
    }
  }
  // Water blocks cars; sand slows them.
  if (car.y > 1820 - r) { car.y = 1820 - r; hit = true; }
  car.x = clamp(car.x, r, city.w - r);
  car.y = clamp(car.y, r, city.h - r);
  return hit;
}

function onSand(city, car) {
  return car.y > 1710;
}

// --- player driving ----------------------------------------------------------

export function stepPlayerCar(G, car, input, dt) {
  const def = CAR_TYPES[car.type];
  const ax = input.axis();
  const sand = onSand(G.city, car);
  const top = def.maxSpeed * (sand ? 0.55 : 1);
  const handbrake = input.down(' ');
  // Throttle / brake / reverse.
  if (ax.y > 0) car.speed += def.accel * dt * (car.speed < 0 ? 2.2 : 1);
  else if (ax.y < 0) {
    if (car.speed > 5) car.speed -= def.accel * 1.6 * dt;
    else car.speed -= def.accel * 0.7 * dt;
  } else {
    car.speed -= car.speed * 1.4 * dt;
  }
  if (handbrake) {
    car.speed -= car.speed * 4.5 * dt;
    if (Math.abs(car.speed) > 120 && G.rng() < 0.35) {
      addSkid(G.particles, car.x, car.y, car.x - Math.cos(car.angle) * 8, car.y - Math.sin(car.angle) * 8);
    }
  }
  car.speed = clamp(car.speed, -def.reverse, top);
  // Steering: stronger at speed, reversed when reversing.
  const steer = ax.x * def.turn * clamp(Math.abs(car.speed) / 90, 0, 1) * (handbrake ? 1.25 : 1);
  car.angle += steer * dt * (car.speed >= 0 ? 1 : -1);
  const moved = integrate(car, dt);
  if (collideWorld(G.city, car, dt) && Math.abs(car.speed) > 140) {
    car.speed *= -0.25;
    damageCar(G, car, 8);
    sfx.crash();
    burst(G.particles, car.x, car.y, 8, '#ffb300', 120, 0.4, 4);
  } else if (Math.abs(car.speed) > 200 && G.rng() < dt * 2) {
    smoke(G.particles, car.x - Math.cos(car.angle) * 20, car.y - Math.sin(car.angle) * 20);
  }
  return moved;
}

// --- traffic -----------------------------------------------------------------

function pickNextTarget(city, car, rng) {
  const node = city.nearestNode(car.x, car.y);
  // Outgoing edges from this intersection, as neighbour positions.
  const options = [];
  for (const e of city.edges) {
    const other = e.a === node.id ? city.nodes[e.b] : e.b === node.id ? city.nodes[e.a] : null;
    if (other) options.push(other);
  }
  if (options.length === 0) return null;
  // Prefer going straight-ish: skip the node we just came from when possible.
  const from = car._fromNode;
  const forward = options.filter((o) => o.id !== from);
  const pool = forward.length > 0 && rng() < 0.8 ? forward : options;
  const next = pool[Math.floor(rng() * pool.length)];
  car._fromNode = node.id;
  return { x: next.x, y: next.y };
}

function carAhead(G, car, rangePx) {
  const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
  let best = Infinity;
  for (const o of G.cars) {
    if (o === car || o.dead) continue;
    const dx = o.x - car.x, dy = o.y - car.y;
    const along = dx * fx + dy * fy;
    if (along < 0 || along > rangePx) continue;
    const side = Math.abs(dx * -fy + dy * fx);
    if (side < 26 && along < best) best = along;
  }
  return best;
}

export function stepTrafficCar(G, car, dt, rng) {
  const def = CAR_TYPES[car.type];
  if (!car.target) car.target = pickNextTarget(G.city, car, rng) || { x: car.x, y: car.y };
  const dx = car.target.x - car.x, dy = car.target.y - car.y;
  const d = Math.hypot(dx, dy);
  if (d < 34) {
    car.target = pickNextTarget(G.city, car, rng) || car.target;
    return;
  }
  // Right-hand lane: offset the target point sideways.
  const want = Math.atan2(dy, dx);
  const turn = angleDiff(car.angle, want);
  const ahead = carAhead(G, car, 70);
  const targetSpeed = ahead < 70 ? Math.max(0, (ahead - 30) * 2) : def.maxSpeed * 0.55;
  car.speed += clamp(targetSpeed - car.speed, -def.accel * dt, def.accel * 0.6 * dt);
  car.angle += clamp(turn, -def.turn * 0.55 * dt, def.turn * 0.55 * dt);
  integrate(car, dt);
  collideWorld(G.city, car, dt);
}

// --- police ------------------------------------------------------------------

export function stepPoliceCar(G, car, dt) {
  const def = CAR_TYPES[car.type];
  const p = G.player;
  const dx = p.x - car.x, dy = p.y - car.y;
  const d = Math.hypot(dx, dy);
  const want = Math.atan2(dy, dx);
  const turn = angleDiff(car.angle, want);
  const speedTarget = d > 90 ? def.maxSpeed : def.maxSpeed * 0.55;
  car.speed += clamp(speedTarget - car.speed, -def.accel * dt, def.accel * 0.8 * dt);
  car.angle += clamp(turn, -def.turn * dt, def.turn * dt);
  integrate(car, dt);
  if (collideWorld(G.city, car, dt) && Math.abs(car.speed) > 120) {
    car.speed *= -0.2;
    damageCar(G, car, 5);
    sfx.crash();
  }
  // Stuck detection: if barely moving while trying, reverse out for a moment.
  if (Math.abs(car.speed) < 20 && d > 120) {
    car.stuck += dt;
    if (car.stuck > 1.2) { car.speed = -120; car.stuck = 0; }
  } else car.stuck = 0;
  // Ram the player: a hard hit hurts and shakes the camera.
  if (d < 44 && Math.abs(car.speed) > 60) {
    if (p.car) damageCar(G, p.car, 12);
    else hurtPlayer(G, 12);
    G.camera.shake = Math.max(G.camera.shake, 7);
    sfx.crash();
    burst(G.particles, p.x, p.y, 10, '#ff5722', 140, 0.4, 5);
    car.speed *= 0.4;
  }
}

// --- damage, death -----------------------------------------------------------

export function damageCar(G, car, amount) {
  if (car.dead) return;
  car.health -= amount;
  if (car.health <= 60 && !car.smoking) car.smoking = true;
  if (car.health <= 0) {
    car.dead = true;
    explosion(G.particles, car.x, car.y);
    G.camera.shake = Math.max(G.camera.shake, 12);
    sfx.crash();
    if (G.player.car === car) {
      // Eject the player onto the street.
      G.player.car = null;
      G.player.onFoot = true;
      G.player.x = car.x + 40;
      G.player.y = car.y + 40;
      hurtPlayer(G, 20);
      G.message('Your ride blew up!', 2.5);
    }
    if (car.police && G.crime) G.crime(1, 'cop car destroyed');
  }
}

export function hurtPlayer(G, amount) {
  if (G.player.invuln > 0 || G.screen !== 'play') return;
  G.player.health -= amount;
  G.player.invuln = 0.4;
  G.player.lastHurt = G.time;
  if (G.player.health <= 0) {
    G.player.health = 0;
    G.wasted();
  }
}

/** Remove dead cars (wrecks fade) and keep the traffic count topped up. */
export function stepCarCleanup(G, dt) {
  for (let i = G.cars.length - 1; i >= 0; i -= 1) {
    const c = G.cars[i];
    if (c.dead) {
      c.deadTimer = (c.deadTimer || 0) + dt;
      if (c.deadTimer > 6) G.cars.splice(i, 1);
    }
  }
}

// --- car-vs-car and car-vs-ped collisions ------------------------------------

export function resolveCarCollisions(G, dt) {
  const cars = G.cars;
  for (let i = 0; i < cars.length; i += 1) {
    const a = cars[i];
    if (a.dead) continue;
    const ra = carRadius(a);
    for (let j = i + 1; j < cars.length; j += 1) {
      const b = cars[j];
      if (b.dead) continue;
      const rb = carRadius(b);
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = ra + rb - 4;
      if (d > 0.01 && d < min) {
        const nx = dx / d, ny = dy / d;
        const push = (min - d) / 2;
        a.x -= nx * push; a.y -= ny * push;
        b.x += nx * push; b.y += ny * push;
        const rel = Math.abs(a.speed - b.speed);
        if (rel > 90) {
          const avg = (a.speed + b.speed) / 2;
          a.speed = avg; b.speed = avg;
          damageCar(G, a, rel * 0.03);
          damageCar(G, b, rel * 0.03);
          sfx.crash();
          burst(G.particles, (a.x + b.x) / 2, (a.y + b.y) / 2, 6, '#ffb300', 100, 0.35, 4);
          if ((a.police || b.police) && (a === G.player.car || b === G.player.car) && G.crime) {
            G.crime(1, 'hit a cop car');
          }
        }
      }
    }
  }
  // Player-driven car vs pedestrians.
  const pc = G.player.car;
  if (pc) {
    const r = carRadius(pc);
    for (const ped of G.peds) {
      if (ped.down || ped.cop) continue;
      const d = dist(pc.x, pc.y, ped.x, ped.y);
      if (d < r + 10 && Math.abs(pc.speed) > 70) {
        ped.down = true;
        ped.downTimer = 2.5;
        ped.vx = Math.cos(pc.angle) * pc.speed * 0.5;
        ped.vy = Math.sin(pc.angle) * pc.speed * 0.5;
        burst(G.particles, ped.x, ped.y, 8, '#c0392b', 90, 0.5, 4);
        if (G.crime) G.crime(1, 'hit a pedestrian');
        G.camera.shake = Math.max(G.camera.shake, 4);
        sfx.crash();
      }
    }
  }
}

export function carDistanceToPlayer(G, car) {
  return dist(car.x, car.y, G.player.x, G.player.y);
}
