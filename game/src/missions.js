// Missions and the story: Marco Reyes, a wheelman for hire in Solmar, works his
// way up from a stolen sedan to the biggest score in the city. Plus a taxi side
// hustle for cash between jobs. All original characters and places.
import { GARAGE, HOSPITAL, STORE, MARINA_PICKUP, SAFEHOUSE } from './config.js';
import { dist, money } from './util.js';
import { setWanted } from './wanted.js';
import { sfx } from './audio.js';

export const MISSIONS = [
  {
    id: 0, name: 'Wheels Up', reward: 150,
    brief: 'Lena needs a car moved to the chop shop. Get in a car and take it there.',
  },
  {
    id: 1, name: 'The Pickup', reward: 300,
    brief: 'A package is waiting at the Marina. Collect it and bring it back to the garage — fast.',
  },
  {
    id: 2, name: 'Heat Wave', reward: 400,
    brief: 'The cops are onto you. Lose the heat and get to the safehouse in one piece.',
  },
  {
    id: 3, name: 'Smash & Grab', reward: 800,
    brief: 'Hit the jewelry store downtown, grab the goods, then shake the cops and get home.',
  },
  {
    id: 4, name: 'The Long Way Home', reward: 1200,
    brief: 'Five checkpoints, one city, no shortcuts. Beat the clock and you are the king of Solmar.',
  },
];

const RACE_POINTS = [
  { x: 450, y: 150 }, { x: 2250, y: 150 }, { x: 2250, y: 1450 },
  { x: 150, y: 1450 }, { x: 1350, y: 930 },
];

export function createMissions() {
  return {
    active: null,      // { def, step, timer, target, progress, checkpoint }
    unlocked: 0,
    completed: [],
    taxi: null,        // { dest, timer, fare, client }
    taxiTimer: 20,     // seconds until the next fare offer
  };
}

export function missionMarker(G) {
  const m = G.missions.active;
  if (!m) {
    // The garage marker invites the next mission.
    if (G.missions.unlocked < MISSIONS.length) return { x: GARAGE.x, y: GARAGE.y, label: 'M', kind: 'mission' };
    return null;
  }
  if (m.target) return { x: m.target.x, y: m.target.y, label: '', kind: 'target' };
  return null;
}

export function missionObjective(G) {
  const m = G.missions.active;
  if (!m) {
    if (G.missions.unlocked >= MISSIONS.length) return 'All missions done — you run Solmar now.';
    return 'Go to the M marker at Lena\'s garage to start: ' + MISSIONS[G.missions.unlocked].name;
  }
  return m.objective;
}

export function startMission(G, id) {
  const def = MISSIONS[id];
  if (!def) return;
  const m = { def, step: 0, timer: 0, target: null, progress: 0, checkpoint: 0, objective: def.brief };
  G.missions.active = m;
  sfx.pickup();
  if (id === 0) {
    m.objective = 'Get in a car';
  } else if (id === 1) {
    m.target = { x: MARINA_PICKUP.x, y: MARINA_PICKUP.y };
    m.objective = 'Drive to the Marina pickup';
  } else if (id === 2) {
    setWanted(G, 3);
    m.timer = 120;
    m.target = { x: SAFEHOUSE.x, y: SAFEHOUSE.y };
    m.objective = 'Reach the safehouse — lose the heat';
  } else if (id === 3) {
    m.target = { x: STORE.x, y: STORE.y };
    m.objective = 'Get to the jewelry store downtown';
  } else if (id === 4) {
    m.timer = 150;
    m.checkpoint = 0;
    m.target = RACE_POINTS[0];
    m.objective = 'Checkpoint 1 of 5 — go!';
  }
  G.message(def.name + ' — ' + def.brief, 4);
}

export function completeMission(G) {
  const m = G.missions.active;
  if (!m) return;
  const reward = m.def.reward;
  G.player.cash += reward;
  G.save.earned += reward;
  G.missions.completed.push(m.def.id);
  G.missions.unlocked = Math.max(G.missions.unlocked, m.def.id + 1);
  G.missions.active = null;
  setWanted(G, 0);
  sfx.missionPass();
  sfx.cash();
  G.message('MISSION PASSED — ' + m.def.name + '  +' + money(reward), 4);
  G.onMissionPassed(m.def);
}

export function failMission(G, reason) {
  const m = G.missions.active;
  if (!m) return;
  G.missions.active = null;
  setWanted(G, 0);
  sfx.missionFail();
  G.message('MISSION FAILED — ' + reason, 3.5);
  G.onMissionFailed(m.def, reason);
}

function inRadius(G, target, radius) {
  return target && dist(G.player.x, G.player.y, target.x, target.y) < radius;
}

export function stepMissions(G, dt, rng) {
  const M = G.missions;
  const m = M.active;

  // --- mission start: walk/drive into the garage marker --------------------
  if (!m && M.unlocked < MISSIONS.length) {
    if (dist(G.player.x, G.player.y, GARAGE.x, GARAGE.y) < 70) {
      startMission(G, M.unlocked);
    }
  }

  // --- active mission -------------------------------------------------------
  if (m) {
    if (m.timer > 0) {
      m.timer -= dt;
      if (m.timer <= 0) { failMission(G, 'out of time'); return; }
    }
    const id = m.def.id;
    if (id === 0) {
      if (m.step === 0) {
        if (!G.player.onFoot) {
          m.step = 1;
          m.target = { x: 780, y: 700 };
          m.objective = 'Drive to the chop shop';
        }
      } else if (inRadius(G, m.target, 70)) {
        completeMission(G);
        return;
      }
    } else if (id === 1) {
      if (m.step === 0 && inRadius(G, m.target, 70)) {
        m.step = 1;
        m.timer = 100;
        m.target = { x: GARAGE.x, y: GARAGE.y };
        m.objective = 'Deliver the package to the garage — fast!';
        sfx.pickup();
        G.message('Package collected. Go!', 2);
      } else if (m.step === 1 && inRadius(G, m.target, 70)) {
        completeMission(G);
        return;
      }
    } else if (id === 2) {
      if (inRadius(G, m.target, 70)) {
        setWanted(G, 0);
        completeMission(G);
        return;
      }
      if (G.wanted.stars === 0) { completeMission(G); return; }
    } else if (id === 3) {
      if (m.step === 0) {
        if (inRadius(G, m.target, 70)) {
          m.step = 1;
          m.progress = 0;
          m.objective = 'Grab the goods — stay in the circle!';
        }
      } else if (m.step === 1) {
        if (inRadius(G, m.target, 70)) {
          m.progress += dt;
          m.objective = 'Grabbing the goods… ' + Math.ceil(6 - m.progress) + 's';
          if (m.progress >= 6) {
            m.step = 2;
            setWanted(G, 3);
            m.target = { x: GARAGE.x, y: GARAGE.y };
            m.objective = 'Cops! Get the loot back to the garage';
            sfx.sirenBlip();
          }
        } else {
          m.progress = Math.max(0, m.progress - dt * 2);
        }
      } else if (m.step === 2 && inRadius(G, m.target, 70)) {
        completeMission(G);
        return;
      }
    } else if (id === 4) {
      if (inRadius(G, m.target, 80)) {
        m.checkpoint += 1;
        sfx.pickup();
        if (m.checkpoint >= RACE_POINTS.length) { completeMission(G); return; }
        m.target = RACE_POINTS[m.checkpoint];
        m.objective = 'Checkpoint ' + (m.checkpoint + 1) + ' of 5 — go!';
      }
    }
  }

  // --- taxi side hustle ------------------------------------------------------
  if (!m && !M.taxi) {
    M.taxiTimer -= dt;
    if (M.taxiTimer <= 0) {
      M.taxiTimer = 30 + rng() * 20;
      // Offer a fare: a client waits at a sidewalk near the player.
      const a = rng() * Math.PI * 2;
      const x = G.player.x + Math.cos(a) * 260;
      const y = G.player.y + Math.sin(a) * 260;
      if (x > 30 && x < G.city.w - 30 && y > 30 && y < G.city.h - 60 && !G.city.buildingAt(x, y)) {
        const node = G.city.nearestNode(G.player.x + (rng() - 0.5) * 900, G.player.y + (rng() - 0.5) * 900);
        M.taxi = {
          client: { x, y },
          dest: { x: node.x, y: node.y },
          timer: 75,
          fare: 80 + Math.floor(rng() * 8) * 10,
          picked: false,
        };
        G.message('Taxi fare nearby — stop by the yellow !', 3);
      }
    }
  }
  if (M.taxi) {
    const t = M.taxi;
    t.timer -= dt;
    if (t.timer <= 0) {
      M.taxi = null;
      G.message('Fare cancelled — too slow.', 2.5);
    } else if (!t.picked) {
      if (G.player.car && dist(G.player.x, G.player.y, t.client.x, t.client.y) < 56 && Math.abs(G.player.car.speed) < 30) {
        t.picked = true;
        G.message('Passenger aboard — take them to the marker.', 2.5);
        sfx.pickup();
      }
    } else if (dist(G.player.x, G.player.y, t.dest.x, t.dest.y) < 70) {
      G.player.cash += t.fare;
      G.save.earned += t.fare;
      sfx.cash();
      G.message('Fare complete  +' + money(t.fare), 2.5);
      M.taxi = null;
    }
  }
}

export function taxiMarker(G) {
  const t = G.missions.taxi;
  if (!t) return null;
  return t.picked ? { x: t.dest.x, y: t.dest.y, label: '$', kind: 'taxi' }
    : { x: t.client.x, y: t.client.y, label: '!', kind: 'taxi' };
}

export function hospitalSpot() { return HOSPITAL; }
