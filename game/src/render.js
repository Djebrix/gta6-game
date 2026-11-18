// World rendering: a pre-rendered city background (ground, roads, buildings in
// fake 3D) plus the live layer — cars, pedestrians, the player, particles and
// mission markers. The background is drawn once per city into an offscreen
// canvas, so each frame is one blit plus the moving pieces.
import { WORLD, V_ROADS, H_ROADS, ROAD_W, SIDEWALK, BEACH, PALETTE, CAR_TYPES } from './config.js';
import { clamp, hashRand } from './util.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function buildBackground(city) {
  const bg = document.createElement('canvas');
  bg.width = city.w;
  bg.height = city.h;
  const c = bg.getContext('2d');

  // Grass base.
  c.fillStyle = PALETTE.grass;
  c.fillRect(0, 0, city.w, city.h);
  // Mow stripes for a little texture.
  c.fillStyle = PALETTE.grassDark;
  for (let y = 0; y < city.h; y += 120) c.fillRect(0, y, city.w, 60);

  // Beach sand and water along the south edge.
  c.fillStyle = PALETTE.sand;
  c.fillRect(0, BEACH.y0, city.w, BEACH.sandTo - BEACH.y0);
  c.fillStyle = PALETTE.sandDark;
  for (let x = 0; x < city.w; x += 90) c.fillRect(x, BEACH.y0 + 8, 44, 4);
  c.fillStyle = PALETTE.water;
  c.fillRect(0, BEACH.sandTo, city.w, BEACH.waterTo - BEACH.sandTo);
  c.fillStyle = PALETTE.waterDeep;
  for (let x = 0; x < city.w; x += 160) c.fillRect(x, BEACH.sandTo + 26, 90, 6);

  // Roads: asphalt strips.
  c.fillStyle = PALETTE.asphalt;
  for (const x of V_ROADS) c.fillRect(x - ROAD_W / 2, 0, ROAD_W, city.h);
  for (const y of H_ROADS) c.fillRect(0, y - ROAD_W / 2, city.w, ROAD_W);
  // The beachfront road runs along the sand.
  c.fillStyle = PALETTE.asphaltLight;
  for (const x of V_ROADS) c.fillRect(x - ROAD_W / 2, 0, ROAD_W, 6);
  // Centre dashes.
  c.fillStyle = PALETTE.lane;
  for (const x of V_ROADS) {
    for (let y = 20; y < city.h; y += 64) c.fillRect(x - 2, y, 4, 30);
  }
  for (const y of H_ROADS) {
    for (let x = 20; x < city.w; x += 64) c.fillRect(x, y - 2, 30, 4);
  }

  // Sidewalks: a light ring around every block.
  c.fillStyle = PALETTE.sidewalk;
  for (let r = 0; r < H_ROADS.length - 1; r += 1) {
    for (let col = 0; col < V_ROADS.length - 1; col += 1) {
      const x0 = V_ROADS[col] + ROAD_W / 2;
      const y0 = H_ROADS[r] + ROAD_W / 2;
      const x1 = V_ROADS[col + 1] - ROAD_W / 2;
      const y1 = H_ROADS[r + 1] - ROAD_W / 2;
      if (y0 >= BEACH.y0) continue;
      c.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
  }

  // Parks and plazas.
  for (const p of city.parks) {
    c.fillStyle = PALETTE.park;
    c.fillRect(p.x - 20, p.y - 20, p.w + 40, p.h + 40);
    c.fillStyle = '#5d8f47';
    c.beginPath(); c.arc(p.x + p.w / 2, p.y + p.h / 2, 18, 0, Math.PI * 2); c.fill();
  }
  for (const p of city.plazas) {
    c.fillStyle = PALETTE.plaza;
    c.fillRect(p.x - 20, p.y - 20, p.w + 40, p.h + 40);
    c.fillStyle = '#7fc4e0';
    c.beginPath(); c.arc(p.fountain.x, p.fountain.y, p.fountain.r, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#b8dcef';
    c.beginPath(); c.arc(p.fountain.x, p.fountain.y, p.fountain.r - 8, 0, Math.PI * 2); c.fill();
  }

  // Marina water and boats (east block).
  c.fillStyle = PALETTE.water;
  c.fillRect(2250 + ROAD_W / 2, 410 + ROAD_W / 2, 2600 - 2250 - ROAD_W / 2 - 10, 260);
  for (const b of city.boats) {
    c.save();
    c.translate(b.x, b.y); c.rotate(b.angle);
    c.fillStyle = '#f5f5f5'; roundRect(c, -b.w / 2, -b.h / 2, b.w, b.h, 6); c.fill();
    c.fillStyle = '#2e6da4'; c.fillRect(-b.w / 2 + 4, -b.h / 2 + 3, b.w - 8, 4);
    c.restore();
  }

  // Buildings: shadow, side face, roof — a fake 3D that reads top-down.
  for (const b of city.buildings) {
    const hx = b.height * 0.28, hy = b.height * 0.5;
    // Shadow.
    c.fillStyle = 'rgba(0,0,0,0.18)';
    c.fillRect(b.x + 6, b.y + 8, b.w, b.h);
    // Side faces.
    c.fillStyle = PALETTE.buildingSide;
    c.beginPath();
    c.moveTo(b.x, b.y + b.h); c.lineTo(b.x - hx, b.y + b.h - hy);
    c.lineTo(b.x + b.w - hx, b.y + b.h - hy); c.lineTo(b.x + b.w, b.y + b.h);
    c.closePath(); c.fill();
    c.fillStyle = '#7d7568';
    c.beginPath();
    c.moveTo(b.x + b.w, b.y); c.lineTo(b.x + b.w - hx, b.y - hy);
    c.lineTo(b.x + b.w - hx, b.y + b.h - hy); c.lineTo(b.x + b.w, b.y + b.h);
    c.closePath(); c.fill();
    // Roof.
    c.fillStyle = b.color;
    c.fillRect(b.x - hx, b.y - hy, b.w, b.h);
    c.strokeStyle = 'rgba(0,0,0,0.25)';
    c.lineWidth = 2;
    c.strokeRect(b.x - hx, b.y - hy, b.w, b.h);
    // Roof details: glass towers get windows, others get an AC box.
    if (b.glass) {
      c.fillStyle = 'rgba(255,255,255,0.35)';
      const cols = Math.max(2, Math.floor(b.w / 26));
      const rows = Math.max(2, Math.floor(b.h / 26));
      for (let i = 0; i < cols; i += 1) {
        for (let j = 0; j < rows; j += 1) {
          c.fillRect(b.x - hx + 8 + i * ((b.w - 16) / cols), b.y - hy + 8 + j * ((b.h - 16) / rows), 10, 7);
        }
      }
    } else {
      c.fillStyle = 'rgba(0,0,0,0.25)';
      c.fillRect(b.x - hx + b.w / 2 - 8, b.y - hy + b.h / 2 - 6, 16, 12);
    }
    if (b.height >= 40) {
      // Helipad on the tallest towers.
      c.strokeStyle = '#fff';
      c.lineWidth = 2;
      c.beginPath(); c.arc(b.x - hx + b.w / 2, b.y - hy + b.h / 2, 13, 0, Math.PI * 2); c.stroke();
      c.fillStyle = '#fff';
      c.font = 'bold 13px Arial';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('H', b.x - hx + b.w / 2, b.y - hy + b.h / 2 + 1);
    }
  }

  // Trees and lamps.
  for (const t of city.trees) {
    c.fillStyle = 'rgba(0,0,0,0.2)';
    c.beginPath(); c.arc(t.x + 4, t.y + 5, t.s, 0, Math.PI * 2); c.fill();
    if (t.palm) {
      c.strokeStyle = '#7a5a34'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(t.x, t.y + 6); c.lineTo(t.x + 2, t.y - 6); c.stroke();
      c.fillStyle = PALETTE.palm;
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI * 2;
        c.beginPath(); c.ellipse(t.x + Math.cos(a) * 7, t.y - 6 + Math.sin(a) * 5, 9, 4, a, 0, Math.PI * 2); c.fill();
      }
    } else {
      c.fillStyle = PALETTE.tree;
      c.beginPath(); c.arc(t.x, t.y, t.s, 0, Math.PI * 2); c.fill();
      c.fillStyle = PALETTE.treeLight;
      c.beginPath(); c.arc(t.x - 3, t.y - 3, t.s * 0.55, 0, Math.PI * 2); c.fill();
    }
  }
  for (const l of city.lamps) {
    c.fillStyle = '#444';
    c.fillRect(l.x - 1, l.y - 1, 3, 3);
  }
  return bg;
}

// --- live layer ---------------------------------------------------------------

function drawCar(ctx, car, time) {
  const def = CAR_TYPES[car.type];
  ctx.save();
  ctx.translate(car.x, car.y);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(3, 5, def.w / 2, def.h / 2 + 2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(car.angle);
  const w = def.w, h = def.h;
  // Body.
  ctx.fillStyle = car.dead ? '#222' : car.color;
  roundRect(ctx, -w / 2, -h / 2, w, h, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  if (!car.dead) {
    // Windshield and rear window.
    ctx.fillStyle = '#bfe3ef';
    ctx.fillRect(w * 0.12, -h / 2 + 3, w * 0.2, h - 6);
    ctx.fillRect(-w * 0.34, -h / 2 + 3, w * 0.14, h - 6);
    // Wheels.
    ctx.fillStyle = '#111';
    const wy = h / 2 - 2;
    ctx.fillRect(-w * 0.32, -wy - 3, 10, 5);
    ctx.fillRect(w * 0.18, -wy - 3, 10, 5);
    ctx.fillRect(-w * 0.32, wy - 2, 10, 5);
    ctx.fillRect(w * 0.18, wy - 2, 10, 5);
    // Headlights / taillights.
    ctx.fillStyle = '#ffe082';
    ctx.fillRect(w / 2 - 2, -h / 2 + 3, 3, 4);
    ctx.fillRect(w / 2 - 2, h / 2 - 7, 3, 4);
    ctx.fillStyle = '#e53935';
    ctx.fillRect(-w / 2 - 1, -h / 2 + 3, 3, 4);
    ctx.fillRect(-w / 2 - 1, h / 2 - 7, 3, 4);
    if (car.type === 'taxi') {
      ctx.fillStyle = '#111';
      for (let i = 0; i < 5; i += 1) ctx.fillRect(-w * 0.1 + i * 6, -h / 2 + 1, 3, 3);
      ctx.fillRect(-w * 0.1, h / 2 - 4, 3, 3);
    }
    if (car.police) {
      // Flashing light bar.
      const phase = Math.floor(time * 4) % 2 === 0;
      ctx.fillStyle = phase ? '#ff1744' : '#2979ff';
      ctx.fillRect(-4, -h / 2 + 1, 8, 5);
      ctx.fillStyle = phase ? '#2979ff' : '#ff1744';
      ctx.fillRect(-4, h / 2 - 6, 8, 5);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 7px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('POLICE', 0, 2);
    }
    if (car.smoking) {
      // Deterministic puff size (a hash of the car and the clock), so a
      // frozen screenshot is byte-identical every time.
      ctx.fillStyle = 'rgba(90,90,90,0.7)';
      ctx.beginPath(); ctx.arc(-w * 0.2, 0, 5 + hashRand(car.x, car.y, Math.floor(time * 12)) * 3, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

function drawPed(ctx, ped, time) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(2, 3, 9, 7, 0, 0, Math.PI * 2); ctx.fill();
  if (ped.down) {
    ctx.rotate(ped.angle);
    ctx.fillStyle = ped.color;
    roundRect(ctx, -12, -5, 24, 10, 5);
    ctx.fill();
    ctx.restore();
    return;
  }
  const bob = Math.sin(time * 8 + ped.id) * (ped.speed > 5 ? 1.5 : 0);
  ctx.fillStyle = ped.color;
  ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f1c27d';
  ctx.beginPath(); ctx.arc(Math.cos(ped.angle) * 3, Math.sin(ped.angle) * 3 + bob * 0.3, 4.5, 0, Math.PI * 2); ctx.fill();
  if (ped.cop) {
    ctx.fillStyle = '#0d1b2a';
    ctx.beginPath(); ctx.arc(Math.cos(ped.angle) * 3, Math.sin(ped.angle) * 3, 5, 0, Math.PI); ctx.fill();
  }
  ctx.restore();
}

function drawPlayer(ctx, G, time) {
  const p = G.player;
  if (!p.onFoot) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(2, 4, 12, 9, 0, 0, Math.PI * 2); ctx.fill();
  // Marco: orange jacket, easy to spot in a crowd.
  ctx.fillStyle = '#e65100';
  ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#bf360c';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#f1c27d';
  ctx.beginPath(); ctx.arc(Math.cos(p.angle) * 4, Math.sin(p.angle) * 4, 5.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3e2723';
  ctx.beginPath(); ctx.arc(Math.cos(p.angle) * 4 - 1, Math.sin(p.angle) * 4 - 2, 5, Math.PI, Math.PI * 2); ctx.fill();
  if (p.pistol) {
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(Math.cos(p.angle) * 8, Math.sin(p.angle) * 8);
    ctx.lineTo(Math.cos(p.angle) * 20, Math.sin(p.angle) * 20);
    ctx.stroke();
  }
  if (p.punchTimer > 0) {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(Math.cos(p.angle) * 22, Math.sin(p.angle) * 22, 7, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawMarker(ctx, x, y, label, kind, time) {
  const pulse = 1 + Math.sin(time * 4) * 0.12;
  const color = kind === 'taxi' ? '#ffd600' : '#ffea00';
  ctx.save();
  ctx.translate(x, y);
  // Beam.
  const grad = ctx.createLinearGradient(0, -90, 0, 0);
  grad.addColorStop(0, 'rgba(255,234,0,0)');
  grad.addColorStop(1, 'rgba(255,234,0,0.35)');
  ctx.fillStyle = grad;
  ctx.fillRect(-14, -90, 28, 90);
  // Ring on the ground.
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(0, 0, 44 * pulse, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(255,234,0,0.18)';
  ctx.beginPath(); ctx.arc(0, 0, 44 * pulse, 0, Math.PI * 2); ctx.fill();
  if (label) {
    ctx.fillStyle = color;
    ctx.font = 'bold 34px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, -52);
  }
  ctx.restore();
}

export function drawWorld(G) {
  const ctx = G.ctx;
  const view = G.view;
  const cam = G.camera;
  ctx.save();
  // Camera transform (shake applied).
  const sx = (Math.random() - 0.5) * cam.shake;
  const sy = (Math.random() - 0.5) * cam.shake;
  ctx.translate(view.w / 2, view.h / 2);
  ctx.scale(view.scale, view.scale);
  ctx.translate(-cam.x + sx, -cam.y + sy);

  // Static city.
  ctx.drawImage(G.bgCanvas, 0, 0);

  // Animated water shimmer on the beach.
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i += 1) {
    const y = BEACH.sandTo + 12 + i * 12;
    ctx.beginPath();
    for (let x = 0; x <= WORLD.w; x += 40) {
      const yy = y + Math.sin(x * 0.01 + G.time * 1.4 + i) * 3;
      if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }

  // Skid marks.
  ctx.strokeStyle = 'rgba(20,20,20,0.35)';
  ctx.lineWidth = 4;
  for (const s of G.particles.skids) {
    ctx.globalAlpha = clamp(s.life / 5, 0, 0.5);
    ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Mission / taxi markers under the cars.
  const mm = G.missionMarker;
  if (mm) drawMarker(ctx, mm.x, mm.y, mm.label, mm.kind, G.time);
  const tm = G.taxiMarker;
  if (tm) drawMarker(ctx, tm.x, tm.y, tm.label, tm.kind, G.time);

  // Cars, sorted by y for a little depth.
  const cars = [...G.cars].sort((a, b) => a.y - b.y);
  for (const car of cars) drawCar(ctx, car, G.time);

  // Pedestrians.
  for (const ped of G.peds) drawPed(ctx, ped, G.time);

  // Player.
  drawPlayer(ctx, G, G.time);
  // Arrow over the player's car.
  if (G.player.car) {
    const c = G.player.car;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(c.x, c.y - 34 + Math.sin(G.time * 5) * 3);
    ctx.lineTo(c.x - 8, c.y - 46 + Math.sin(G.time * 5) * 3);
    ctx.lineTo(c.x + 8, c.y - 46 + Math.sin(G.time * 5) * 3);
    ctx.closePath(); ctx.fill();
  }

  // Shot tracer.
  if (G.shotLine && G.shotLine.life > 0) {
    ctx.strokeStyle = 'rgba(255,240,150,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(G.shotLine.x1, G.shotLine.y1);
    ctx.lineTo(G.shotLine.x2, G.shotLine.y2);
    ctx.stroke();
  }

  // Particles.
  for (const q of G.particles.list) {
    ctx.globalAlpha = clamp(q.life / q.maxLife, 0, 1);
    ctx.fillStyle = q.color;
    ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (0.5 + q.life / q.maxLife), 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Drifting clouds (soft shadows on the city).
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  for (let i = 0; i < 5; i += 1) {
    const cx = ((i * 520 + G.time * 12) % (WORLD.w + 400)) - 200;
    const cy = 200 + i * 300;
    ctx.beginPath(); ctx.ellipse(cx, cy, 180, 60, 0, 0, Math.PI * 2); ctx.fill();
  }

  ctx.restore();
}

export { roundRect };
