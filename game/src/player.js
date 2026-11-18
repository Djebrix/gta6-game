// The player: on foot (walk, run, punch, shoot) and in a car (enter, exit,
// steal). All original: Marco Reyes, a wheelman for hire in Solmar.
import { PLAYER } from './config.js';
import { clamp, dist, circleRectPush } from './util.js';
import { burst } from './particles.js';
import { sfx } from './audio.js';
import { carRadius, createCar } from './cars.js';
import { playerPunchRange } from './peds.js';

export function createPlayer(x, y) {
  return {
    x, y,
    angle: Math.PI, // facing west, toward the starter car beside the garage
    speed: 0,
    onFoot: true,
    car: null,
    health: PLAYER.health,
    cash: 0,
    pistol: false,
    ammo: 0,
    mag: PLAYER.pistolMag,
    punching: false,
    punchTimer: 0,
    punchCd: 0,
    shootCd: 0,
    invuln: 0,
    lastHurt: -99,
    aimX: x - 100, aimY: y,
  };
}

export function nearestCar(G, maxD) {
  let best = null, bestD = maxD;
  for (const c of G.cars) {
    if (c.dead) continue;
    const d = dist(G.player.x, G.player.y, c.x, c.y);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

export function stepPlayerOnFoot(G, dt, input, rng) {
  const p = G.player;
  const ax = input.axis();
  const run = input.down('Shift');
  const speed = run ? PLAYER.runSpeed : PLAYER.walkSpeed;
  const mx = ax.x, my = ax.y;
  const len = Math.hypot(mx, my);
  if (len > 0) {
    p.x += (mx / len) * speed * dt;
    p.y += (my / len) * speed * dt;
    p.angle = Math.atan2(my, mx);
    p.speed = speed;
  } else p.speed = 0;

  // Collide with buildings and water.
  for (const b of G.city.buildings) {
    const push = circleRectPush(p.x, p.y, PLAYER.radius, b);
    if (push) { p.x += push.x; p.y += push.y; }
  }
  if (p.y > 1820 - PLAYER.radius) p.y = 1820 - PLAYER.radius;
  p.x = clamp(p.x, PLAYER.radius, G.city.w - PLAYER.radius);
  p.y = clamp(p.y, PLAYER.radius, G.city.h - PLAYER.radius - 10);

  // Aim with the mouse (for shooting).
  p.aimX = G.camera.x + (input.mouse.x - G.view.w / 2) / G.view.scale;
  p.aimY = G.camera.y + (input.mouse.y - G.view.h / 2) / G.view.scale;

  p.punchCd = Math.max(0, p.punchCd - dt);
  p.shootCd = Math.max(0, p.shootCd - dt);
  p.punching = false;

  // Punch.
  if (input.wasPressed('f') && p.punchCd <= 0) {
    p.punching = true;
    p.punchTimer = 0.22;
    p.punchCd = 0.38;
    sfx.punch();
    const range = playerPunchRange();
    for (const ped of G.peds) {
      if (ped.down || ped.cop) continue;
      const d = dist(p.x, p.y, ped.x, ped.y);
      if (d < range) {
        ped.down = true;
        ped.downTimer = 2.2;
        ped.vx = Math.cos(p.angle) * 220;
        ped.vy = Math.sin(p.angle) * 220;
        burst(G.particles, ped.x, ped.y, 6, '#fff', 90, 0.3, 3);
        if (G.crime) G.crime(1, 'assault');
      }
    }
    for (const ped of G.peds) {
      if (!ped.cop || ped.down) continue;
      const d = dist(p.x, p.y, ped.x, ped.y);
      if (d < range) {
        ped.down = true;
        ped.downTimer = 3;
        ped.vx = Math.cos(p.angle) * 260;
        ped.vy = Math.sin(p.angle) * 260;
        burst(G.particles, ped.x, ped.y, 8, '#1c2733', 110, 0.4, 4);
        if (G.crime) G.crime(1, 'hit a cop');
      }
    }
  }
  if (p.punchTimer > 0) p.punchTimer -= dt;

  // Shoot with the mouse (pistol only).
  if (p.pistol && input.mouse.pressed && p.shootCd <= 0) {
    p.shootCd = 0.28;
    if (p.mag > 0) {
      p.mag -= 1;
      sfx.shot();
      const a = Math.atan2(p.aimY - p.y, p.aimX - p.x);
      const tx = p.x + Math.cos(a) * PLAYER.pistolRange;
      const ty = p.y + Math.sin(a) * PLAYER.pistolRange;
      burst(G.particles, p.x + Math.cos(a) * 22, p.y + Math.sin(a) * 22, 3, '#ffe082', 200, 0.12, 3);
      // Hit the first ped or police car along the shot.
      let bestD = PLAYER.pistolRange, hitPed = null, hitCar = null;
      for (const ped of G.peds) {
        const d = dist(p.x, p.y, ped.x, ped.y);
        if (d < bestD) {
          const ang = Math.atan2(ped.y - p.y, ped.x - p.x);
          if (Math.abs(ang - a) < 0.14 || Math.abs(Math.abs(ang - a) - Math.PI * 2) < 0.14) { bestD = d; hitPed = ped; hitCar = null; }
        }
      }
      for (const c of G.cars) {
        if (c.dead) continue;
        const d = dist(p.x, p.y, c.x, c.y);
        if (d < bestD) {
          const ang = Math.atan2(c.y - p.y, c.x - p.x);
          if (Math.abs(ang - a) < 0.14 || Math.abs(Math.abs(ang - a) - Math.PI * 2) < 0.14) { bestD = d; hitCar = c; hitPed = null; }
        }
      }
      if (hitPed) {
        hitPed.down = true;
        hitPed.downTimer = 4;
        hitPed.vx = Math.cos(a) * 160; hitPed.vy = Math.sin(a) * 160;
        burst(G.particles, hitPed.x, hitPed.y, 8, '#c0392b', 100, 0.5, 4);
        if (hitPed.cop && G.crime) G.crime(2, 'shot a cop');
        else if (G.crime) G.crime(1, 'shooting');
      } else if (hitCar) {
        burst(G.particles, hitCar.x, hitCar.y, 6, '#ffb300', 120, 0.3, 3);
        if (hitCar.police && G.crime) G.crime(1, 'shot at police');
      }
      G.shotLine = { x1: p.x, y1: p.y, x2: p.x + Math.cos(a) * bestD, y2: p.y + Math.sin(a) * bestD, life: 0.08 };
      G.camera.shake = Math.max(G.camera.shake, 2);
    } else {
      // Auto reload.
      p.mag = PLAYER.pistolMag;
      p.ammo = Math.max(0, p.ammo - 0);
      sfx.click();
    }
  }

  // Enter / steal a car is handled centrally in sim.js (one press, one action).
}

export function enterCar(G, car) {
  const p = G.player;
  if (car.driver === 'traffic') {
    // Jack it: the driver bails and runs, and the law notices.
    const driver = { id: -1, x: car.x + 30, y: car.y + 30, angle: 0, speed: 0, walkSpeed: 60, color: '#e67e22', name: 'Driver', target: null, wait: 0, down: false, downTimer: 0, vx: 0, vy: 0, cop: false, flee: 3, punchCd: 0, dead: false };
    G.peds.push(driver);
    if (G.crime) G.crime(1, 'stole a car');
    G.message('Car jacked! The cops are coming.', 2);
  }
  car.driver = 'player';
  p.car = car;
  p.onFoot = false;
  p.x = car.x; p.y = car.y;
  sfx.door();
}

export function exitCar(G) {
  const p = G.player;
  const car = p.car;
  if (!car || Math.abs(car.speed) > 40) return;
  car.driver = 'none';
  p.car = null;
  p.onFoot = true;
  // Step out to the driver's side.
  const side = car.angle + Math.PI / 2;
  p.x = car.x + Math.cos(side) * 34;
  p.y = car.y + Math.sin(side) * 34;
  p.angle = car.angle;
  sfx.door();
}

/** Give the player a parked starter car at the garage: on the road beside it,
 * facing north along the road, so pressing W drives straight up the street. */
export function spawnStarterCar(G) {
  const car = createCar(G.city, 'sedan', 450, 1280, -Math.PI / 2, { driver: 'none', color: '#2e6da4' });
  G.cars.push(car);
  return car;
}
