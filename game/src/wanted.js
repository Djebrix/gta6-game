// The wanted system: stars rise with crimes, police respond, and the heat
// cools when the player lies low and stays out of sight.
import { WANTED } from './config.js';
import { createCar, carDistanceToPlayer } from './cars.js';
import { spawnCop } from './peds.js';
import { sfx } from './audio.js';

export function createWanted() {
  return {
    stars: 0,
    heat: 0,          // 0..1 progress toward the next star from repeated crimes
    quietTimer: 0,    // seconds without a crime
    copSpawnTimer: 0,
    copPedTimer: 0,
    flash: 0,         // star flash timer after a crime
  };
}

export function addCrime(G, stars, reason) {
  const w = G.wanted;
  w.stars = Math.min(WANTED.maxStars, w.stars + stars);
  w.quietTimer = 0;
  w.flash = 1.2;
  if (stars > 0) G.message('Wanted level up — ' + reason, 2.2);
}

/** How many police cars the current heat calls for. */
export function wantedPoliceCount(G) {
  if (G.wanted.stars === 0) return 0;
  return Math.min(WANTED.maxPoliceCars, WANTED.basePolice + (G.wanted.stars - 1) * WANTED.policePerStar);
}

function nearestPoliceDistance(G) {
  let best = Infinity;
  for (const c of G.cars) {
    if (c.police && !c.dead) best = Math.min(best, carDistanceToPlayer(G, c));
  }
  for (const p of G.peds) {
    if (p.cop) best = Math.min(best, Math.hypot(p.x - G.player.x, p.y - G.player.y));
  }
  return best;
}

export function stepWanted(G, dt, rng) {
  const w = G.wanted;
  w.flash = Math.max(0, w.flash - dt);

  // Cool down: no crime for a while and no police in sight.
  if (w.stars > 0) {
    w.quietTimer += dt;
    const near = nearestPoliceDistance(G);
    if (w.quietTimer > WANTED.decaySeconds && near > 420) {
      w.stars -= 1;
      w.quietTimer = 0;
      G.message(w.stars === 0 ? 'You lost the cops.' : 'Heat dying down…', 2);
    }
  } else {
    w.quietTimer = 0;
  }

  // Spawn police cars up to the wanted count.
  const wantCars = wantedPoliceCount(G);
  let haveCars = 0;
  for (const c of G.cars) if (c.police && !c.dead) haveCars += 1;
  w.copSpawnTimer -= dt;
  if (wantCars > haveCars && w.copSpawnTimer <= 0) {
    w.copSpawnTimer = 2.5;
    // Spawn at a road intersection a few hundred px away, off-screen if possible.
    const node = G.city.nearestNode(
      G.player.x + (rng() < 0.5 ? -1 : 1) * (380 + rng() * 260),
      G.player.y + (rng() < 0.5 ? -1 : 1) * (380 + rng() * 260),
    );
    const car = createCar(G.city, 'police', node.x, node.y, 0, { driver: 'police', rng });
    car.targetSpeed = 0;
    G.cars.push(car);
    if (haveCars === 0) sfx.sirenBlip();
  }

  // Cop peds on foot when the player is on foot and the heat is high.
  if (w.stars >= 2 && G.player.onFoot) {
    w.copPedTimer -= dt;
    let cops = 0;
    for (const p of G.peds) if (p.cop) cops += 1;
    if (w.copPedTimer <= 0 && cops < Math.min(3, w.stars - 1)) {
      w.copPedTimer = 4;
      spawnCop(G, rng);
    }
  }
}

/** Force a wanted level (missions use this to stage a chase). */
export function setWanted(G, stars) {
  G.wanted.stars = Math.max(0, Math.min(WANTED.maxStars, stars));
  G.wanted.quietTimer = 0;
  G.wanted.flash = 1.2;
}
