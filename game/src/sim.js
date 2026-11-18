// One simulation tick: player, traffic, police, pedestrians, wanted level,
// missions, collisions, particles, camera and recovery. The live loop and the
// screenshot stager both step the world through here, so a staged frame is a
// frame of the real game.
import { GARAGE, HOSPITAL } from './config.js';
import { clamp, dist } from './util.js';
import { stepPlayerCar, stepTrafficCar, stepPoliceCar, stepCarCleanup, resolveCarCollisions } from './cars.js';
import { stepPeds } from './peds.js';
import { stepWanted } from './wanted.js';
import { stepMissions } from './missions.js';
import { stepParticles } from './particles.js';
import { stepPlayerOnFoot, exitCar, enterCar, nearestCar } from './player.js';

export function stepWorld(G, input, dt, rng) {
  G.time += dt;
  const p = G.player;

  // Enter / exit a car: one press, one action, handled here so a single
  // press can never enter and exit on the same tick.
  if (input.wasPressed('e')) {
    if (p.onFoot) {
      const car = nearestCar(G, 56);
      if (car) enterCar(G, car);
    } else if (p.car && Math.abs(p.car.speed) < 40) {
      exitCar(G);
    }
  }

  // Player.
  if (p.onFoot) stepPlayerOnFoot(G, dt, input, rng);
  else if (p.car) stepPlayerCar(G, p.car, input, dt);
  p.invuln = Math.max(0, p.invuln - dt);

  // Traffic and police.
  for (const car of G.cars) {
    if (car.dead) continue;
    if (car.driver === 'traffic') stepTrafficCar(G, car, dt, rng);
    else if (car.driver === 'police') stepPoliceCar(G, car, dt);
  }
  resolveCarCollisions(G, dt);
  stepCarCleanup(G, dt);
  stepPeds(G, dt, rng);
  stepWanted(G, dt, rng);
  stepMissions(G, dt, rng);
  stepParticles(G.particles, dt);

  // Shot tracer and message timers.
  if (G.shotLine) {
    G.shotLine.life -= dt;
    if (G.shotLine.life <= 0) G.shotLine = null;
  }
  if (G.messageTimer > 0) G.messageTimer -= dt;
  if (G.messageTimer <= 0) G.messageText = '';

  // Health comes back when the heat is off and nobody hurt the player lately.
  if (p.health > 0 && p.health < 100 && G.wanted.stars === 0 && G.time - p.lastHurt > 8) {
    p.health = Math.min(100, p.health + 3 * dt);
  }

  // The garage repairs the player's car ($50) and the hospital heals the player.
  if (p.car && p.car.health < 100 && dist(p.x, p.y, GARAGE.x, GARAGE.y) < 90) {
    G.repairCd = Math.max(0, (G.repairCd || 0) - dt);
    if (p.cash >= 50 && G.repairCd <= 0) {
      p.cash -= 50;
      p.car.health = 100;
      p.car.smoking = false;
      G.repairCd = 5;
      G.message('Car repaired  -$50', 2);
    }
  }
  if (p.health > 0 && p.health < 100 && dist(p.x, p.y, HOSPITAL.x, HOSPITAL.y) < 90) {
    p.health = Math.min(100, p.health + 25 * dt);
  }

  // Camera follows the player, clamped so the view never leaves the city.
  const halfW = G.view.w / (2 * G.view.scale);
  const halfH = G.view.h / (2 * G.view.scale);
  const tx = clamp(p.x, halfW, G.city.w - halfW);
  const ty = clamp(p.y, halfH, G.city.h - halfH);
  G.camera.x += (tx - G.camera.x) * Math.min(1, 5 * dt);
  G.camera.y += (ty - G.camera.y) * Math.min(1, 5 * dt);
  G.camera.shake = Math.max(0, G.camera.shake - dt * 22);
}
