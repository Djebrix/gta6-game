// Screenshot scenes: each one plays the real rules forward from a fresh world
// for a fixed number of steps, steered by a simple autopilot, so the frame is
// what a short game really looks like. The same seed always stages the same
// scene. ?shot=start|play|chase|mission (any other name is start).
import { GARAGE } from './config.js';
import { angleDiff, clamp, dist } from './util.js';
import { stepWorld } from './sim.js';
import { enterCar } from './player.js';
import { startMission } from './missions.js';
import { setWanted } from './wanted.js';

const STEP = 1 / 60;
const PLAY_SECONDS = 16;
const CHASE_SECONDS = 12;
const MISSION_SECONDS = 13;

/** A fake input object the autopilot drives through stepWorld. */
function fakeInput() {
  const state = { x: 0, y: 0, space: false };
  return {
    state,
    axis: () => ({ x: state.x, y: state.y }),
    down: (name) => (name === ' ' ? state.space : false),
    wasPressed: () => false,
    mouse: { x: 0, y: 0, down: false, pressed: false },
    consume: () => {},
  };
}

/** Steer the player's car along the road graph toward `dest` (greedy routing). */
function driveToward(G, car, dest, input, aggressive) {
  if (car._shotNode === undefined) car._shotNode = G.city.nearestNode(car.x, car.y).id;
  let node = G.city.nodes[car._shotNode];
  if (dist(car.x, car.y, node.x, node.y) < 36) {
    const neighbours = [];
    for (const e of G.city.edges) {
      if (e.a === node.id) neighbours.push(G.city.nodes[e.b]);
      else if (e.b === node.id) neighbours.push(G.city.nodes[e.a]);
    }
    const from = car._shotFrom;
    const cands = neighbours.filter((n) => n.id !== from);
    const pool = cands.length > 0 ? cands : neighbours;
    pool.sort((a, b) => dist(a.x, a.y, dest.x, dest.y) - dist(b.x, b.y, dest.x, dest.y));
    const next = pool[0];
    car._shotFrom = node.id;
    car._shotNode = next.id;
    node = next;
  }
  // Aim at the node, offset to the right-hand lane.
  const dx = node.x - car.x, dy = node.y - car.y;
  const d = Math.hypot(dx, dy) || 1;
  const aimX = node.x + (dy / d) * 15;
  const aimY = node.y - (dx / d) * 15;
  const want = Math.atan2(aimY - car.y, aimX - car.x);
  const turn = angleDiff(car.angle, want);
  input.state.x = clamp(turn * 2.2, -1, 1);
  input.state.y = Math.abs(turn) < 0.9 ? 1 : 0.25;
  input.state.space = Math.abs(turn) > 1.4 && Math.abs(car.speed) > 200;
  if (aggressive && dist(car.x, car.y, dest.x, dest.y) < 200) input.state.y = 1;
}

/** Put the player in the starter car and point the autopilot at `dest`. */
function stageDrive(G, dest, seconds, wantedStars) {
  const input = fakeInput();
  const starter = G.cars.find((c) => c.driver === 'none' && !c.police);
  if (starter) {
    G.player.x = starter.x; G.player.y = starter.y;
    enterCar(G, starter);
  }
  if (wantedStars) setWanted(G, wantedStars);
  for (let i = 0; i < seconds / STEP; i += 1) {
    if (G.player.car) driveToward(G, G.player.car, dest, input, true);
    stepWorld(G, input, STEP, G.rng);
    input.consume();
  }
}

/**
 * Set the world to the named scene and return the screen to draw over it.
 * `G` must already hold a fresh world (reset by the caller). Particles are
 * cleared at the end: they are spawned with Math.random, so they would make
 * the frame differ from run to run.
 */
export function stageShot(G, name) {
  let screen = 'title';
  if (name === 'play') {
    stageDrive(G, { x: 1350, y: 930 }, PLAY_SECONDS, 0);
    screen = 'play';
  } else if (name === 'chase') {
    stageDrive(G, { x: 450, y: 150 }, CHASE_SECONDS, 3);
    screen = 'play';
  } else if (name === 'mission') {
    startMission(G, 1);
    stageDrive(G, { x: 2220, y: 440 }, MISSION_SECONDS, 0);
    screen = 'play';
  } else {
    // start: the title screen over downtown, camera parked above the city.
    G.camera.x = 1350;
    G.camera.y = 930;
  }
  G.particles.list.length = 0;
  G.particles.skids.length = 0;
  // Camera shake is driven by Math.random in the render, so zero it: a
  // frozen screenshot must not wobble.
  G.camera.shake = 0;
  return screen;
}

export { GARAGE };
