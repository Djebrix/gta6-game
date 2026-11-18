// SOLMAR's city: road grid, blocks, buildings, parks, beach and marina, plus the
// intersection graph traffic drives on. All generated from one seed, so the same
// seed always builds the same city.
import { WORLD, V_ROADS, H_ROADS, ROAD_W, SIDEWALK, BEACH, PALETTE, DISTRICTS } from './config.js';
import { mulberry32, pick, range, rangeInt, chance } from './random.js';
import { rectsOverlap } from './util.js';

const BLOCK_MARGIN = 26; // gap between a block's edge and its first building

function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
  }
  return null;
}

export function buildCity(seed) {
  const rng = mulberry32(seed);
  const city = {
    seed,
    w: WORLD.w,
    h: WORLD.h,
    buildings: [],
    trees: [],
    lamps: [],
    parks: [],
    plazas: [],
    boats: [],
    nodes: [],       // intersections {x, y, id}
    nodeByKey: new Map(),
    edges: [],       // {a, b, horizontal} between node ids
  };

  // --- intersections and the road graph -------------------------------------
  for (const y of H_ROADS) {
    for (const x of V_ROADS) {
      const id = city.nodes.length;
      city.nodes.push({ x, y, id });
      city.nodeByKey.set(x + ',' + y, id);
    }
  }
  const nodeId = (x, y) => city.nodeByKey.get(x + ',' + y);
  for (let r = 0; r < H_ROADS.length; r += 1) {
    for (let c = 0; c < V_ROADS.length; c += 1) {
      const a = nodeId(V_ROADS[c], H_ROADS[r]);
      if (c + 1 < V_ROADS.length) city.edges.push({ a, b: nodeId(V_ROADS[c + 1], H_ROADS[r]), horizontal: true });
      if (r + 1 < H_ROADS.length) city.edges.push({ a, b: nodeId(V_ROADS[c], H_ROADS[r + 1]), horizontal: false });
    }
  }

  // --- blocks ----------------------------------------------------------------
  // A block is the land between four roads. Special blocks become park / plaza /
  // marina; the rest get buildings.
  const blockRect = (c, r) => ({
    x: V_ROADS[c] + ROAD_W / 2 + SIDEWALK + BLOCK_MARGIN,
    y: H_ROADS[r] + ROAD_W / 2 + SIDEWALK + BLOCK_MARGIN,
    w: V_ROADS[c + 1] - V_ROADS[c] - ROAD_W - 2 * SIDEWALK - 2 * BLOCK_MARGIN,
    h: H_ROADS[r + 1] - H_ROADS[r] - ROAD_W - 2 * SIDEWALK - 2 * BLOCK_MARGIN,
  });

  // (col,row) of the special blocks: park, plaza, marina yard.
  const parkBlocks = [[1, 3], [5, 1]];
  const plazaBlocks = [[3, 2]];
  const isSpecial = (c, r, list) => list.some(([a, b]) => a === c && b === r);

  for (let r = 0; r < H_ROADS.length - 1; r += 1) {
    for (let c = 0; c < V_ROADS.length - 1; c += 1) {
      const b = blockRect(c, r);
      if (b.w <= 40 || b.h <= 40) continue;
      // The beachfront row is sand, not buildings.
      if (H_ROADS[r + 1] >= BEACH.y0) continue;
      if (isSpecial(c, r, parkBlocks)) {
        city.parks.push({ ...b });
        for (let i = 0; i < 9; i += 1) {
          city.trees.push({ x: range(rng, b.x + 14, b.x + b.w - 14), y: range(rng, b.y + 14, b.y + b.h - 14), s: range(rng, 9, 15), palm: false });
        }
        continue;
      }
      if (isSpecial(c, r, plazaBlocks)) {
        city.plazas.push({ ...b, fountain: { x: b.x + b.w / 2, y: b.y + b.h / 2, r: 26 } });
        for (let i = 0; i < 4; i += 1) {
          city.trees.push({ x: range(rng, b.x + 14, b.x + b.w - 14), y: range(rng, b.y + 14, b.y + b.h - 14), s: range(rng, 8, 12), palm: true });
        }
        continue;
      }
      // Marina yard on the far east block: docks and boats, no buildings.
      if (c === V_ROADS.length - 2 && r === 1) {
        for (let i = 0; i < 4; i += 1) {
          city.boats.push({ x: b.x + 20 + i * 52, y: b.y + 30 + (i % 2) * 70, w: 34, h: 14, angle: 0.35 });
        }
        continue;
      }
      const d = districtAt(b.x + b.w / 2, b.y + b.h / 2);
      const tall = d ? d.tall : false;
      // 1-3 buildings per block, laid out in a row or a pair.
      const count = tall ? rangeInt(rng, 1, 2) : rangeInt(rng, 1, 3);
      const slots = [];
      if (count === 1) slots.push({ x: b.x, y: b.y, w: b.w, h: b.h });
      else if (count === 2) {
        const vertical = b.w > b.h;
        if (vertical) {
          const cut = b.w * range(rng, 0.42, 0.58);
          slots.push({ x: b.x, y: b.y, w: cut - 10, h: b.h }, { x: b.x + cut + 10, y: b.y, w: b.w - cut - 10, h: b.h });
        } else {
          const cut = b.h * range(rng, 0.42, 0.58);
          slots.push({ x: b.x, y: b.y, w: b.w, h: cut - 10 }, { x: b.x, y: b.y + cut + 10, w: b.w, h: b.h - cut - 10 });
        }
      } else {
        const cut1 = b.w * 0.34, cut2 = b.w * 0.67;
        slots.push(
          { x: b.x, y: b.y, w: cut1 - 8, h: b.h },
          { x: b.x + cut1 + 4, y: b.y, w: cut2 - cut1 - 8, h: b.h },
          { x: b.x + cut2 + 4, y: b.y, w: b.w - cut2 - 4, h: b.h },
        );
      }
      for (const s of slots) {
        if (s.w < 34 || s.h < 34) continue;
        const inset = range(rng, 2, 8);
        const height = tall ? rangeInt(rng, 22, 46) : rangeInt(rng, 8, 20);
        city.buildings.push({
          x: s.x + inset, y: s.y + inset, w: s.w - inset * 2, h: s.h - inset * 2,
          height,
          color: pick(rng, PALETTE.roofs),
          glass: chance(rng, 0.45) && tall,
          district: d ? d.name : '',
        });
      }
      // Street trees along the block's corners.
      if (chance(rng, 0.6)) {
        city.trees.push({ x: b.x + 6, y: b.y + 6, s: range(rng, 8, 12), palm: chance(rng, 0.5) });
      }
    }
  }

  // Palm trees along the beachfront road.
  for (let x = 220; x < WORLD.w - 120; x += 130) {
    city.trees.push({ x: x + range(rng, -20, 20), y: BEACH.y0 - 26, s: range(rng, 10, 14), palm: true });
  }
  // Lamps at every intersection corner.
  for (const n of city.nodes) {
    city.lamps.push({ x: n.x - ROAD_W / 2 - 6, y: n.y - ROAD_W / 2 - 6 });
  }

  // --- helpers ---------------------------------------------------------------
  city.roadAt = (x, y) => {
    for (const rx of V_ROADS) if (Math.abs(x - rx) <= ROAD_W / 2) return true;
    for (const ry of H_ROADS) if (Math.abs(y - ry) <= ROAD_W / 2) return true;
    return false;
  };
  city.onBeach = (x, y) => y >= BEACH.y0 && y < BEACH.sandTo;
  city.inWater = (x, y) => y >= BEACH.sandTo;
  city.buildingAt = (x, y) => {
    for (const b of city.buildings) {
      if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) return b;
    }
    return null;
  };
  city.blockedRects = city.buildings; // cars and peds collide with buildings
  city.overlapsBuilding = (rect) => {
    for (const b of city.buildings) if (rectsOverlap(rect, b)) return true;
    return false;
  };
  // Nearest intersection to a point (for police spawns and routing).
  city.nearestNode = (x, y) => {
    let best = null, bestD = Infinity;
    for (const n of city.nodes) {
      const d = (n.x - x) ** 2 + (n.y - y) ** 2;
      if (d < bestD) { bestD = d; best = n; }
    }
    return best;
  };
  // A random point on a sidewalk (for pedestrian spawns).
  city.randomSidewalk = (rngFn) => {
    const c = rangeInt(rngFn, 0, V_ROADS.length - 2);
    const r = rangeInt(rngFn, 0, H_ROADS.length - 2);
    const side = rangeInt(rngFn, 0, 3);
    const x0 = V_ROADS[c] + ROAD_W / 2 + 4, x1 = V_ROADS[c + 1] - ROAD_W / 2 - 4;
    const y0 = H_ROADS[r] + ROAD_W / 2 + 4, y1 = H_ROADS[r + 1] - ROAD_W / 2 - 4;
    if (side === 0) return { x: range(rngFn, x0, x1), y: y0 };
    if (side === 1) return { x: range(rngFn, x0, x1), y: y1 };
    if (side === 2) return { x: x0, y: range(rngFn, y0, y1) };
    return { x: x1, y: range(rngFn, y0, y1) };
  };
  return city;
}
