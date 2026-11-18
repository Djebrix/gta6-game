// HUD, minimap and every screen: title, pause, wasted, busted, mission results
// and the ending. All drawn on the same canvas as the world.
import { WORLD, V_ROADS, H_ROADS, BEACH } from './config.js';
import { clamp, money, clock } from './util.js';
import { missionObjective } from './missions.js';

function text(ctx, str, x, y, size, color, align = 'left', weight = 'bold') {
  ctx.font = weight + ' ' + size + 'px Arial, sans-serif';
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

function shadowed(ctx, str, x, y, size, color, align = 'left') {
  ctx.font = 'bold ' + size + 'px Arial, sans-serif';
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillText(str, x + 2, y + 2);
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

function panel(ctx, x, y, w, h, alpha = 0.55) {
  ctx.fillStyle = 'rgba(10,14,20,' + alpha + ')';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
}

function star(ctx, x, y, size, filled, flashing) {
  ctx.font = size + 'px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = filled ? (flashing ? '#ffea00' : '#ffc400') : 'rgba(255,255,255,0.25)';
  ctx.fillText('★', x, y);
  if (filled) {
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 1;
    ctx.strokeText('★', x, y);
  }
}

export function drawMinimap(G, x, y, w, h) {
  const ctx = G.ctx;
  const sx = w / WORLD.w, sy = h / WORLD.h;
  panel(ctx, x - 6, y - 6, w + 12, h + 12, 0.6);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  // Land and water.
  ctx.fillStyle = '#4a7a3a';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#2fa8c9';
  ctx.fillRect(x, y + BEACH.y0 * sy, w, h - BEACH.y0 * sy);
  // Roads.
  ctx.strokeStyle = '#c9c2b2';
  ctx.lineWidth = 2;
  for (const rx of V_ROADS) {
    ctx.beginPath(); ctx.moveTo(x + rx * sx, y); ctx.lineTo(x + rx * sx, y + h); ctx.stroke();
  }
  for (const ry of H_ROADS) {
    ctx.beginPath(); ctx.moveTo(x, y + ry * sy); ctx.lineTo(x + w, y + ry * sy); ctx.stroke();
  }
  // Buildings.
  ctx.fillStyle = 'rgba(30,30,40,0.55)';
  for (const b of G.city.buildings) {
    ctx.fillRect(x + b.x * sx, y + b.y * sy, Math.max(1, b.w * sx), Math.max(1, b.h * sy));
  }
  // Taxi marker.
  const tm = G.taxiMarker;
  if (tm) {
    ctx.fillStyle = '#ffd600';
    ctx.beginPath(); ctx.arc(x + tm.x * sx, y + tm.y * sy, 4, 0, Math.PI * 2); ctx.fill();
  }
  // Mission marker (pulsing).
  const mm = G.missionMarker;
  if (mm) {
    const r = 4 + Math.sin(G.time * 5) * 1.5;
    ctx.fillStyle = '#ffea00';
    ctx.beginPath(); ctx.arc(x + mm.x * sx, y + mm.y * sy, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // Police.
  for (const c of G.cars) {
    if (!c.police || c.dead) continue;
    ctx.fillStyle = Math.floor(G.time * 4) % 2 === 0 ? '#ff1744' : '#2979ff';
    ctx.beginPath(); ctx.arc(x + c.x * sx, y + c.y * sy, 3.5, 0, Math.PI * 2); ctx.fill();
  }
  // Player arrow.
  const p = G.player;
  ctx.save();
  ctx.translate(x + p.x * sx, y + p.y * sy);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
  ctx.restore();
  ctx.restore();
  // Border + N.
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 6, y - 6, w + 12, h + 12);
  text(ctx, 'N', x + w + 2, y + 2, 11, '#fff', 'left');
}

export function drawHUD(G) {
  const ctx = G.ctx;
  const w = G.view.w, h = G.view.h;
  const p = G.player;

  // Damage vignette.
  if (p.health < 40) {
    const a = (0.4 - p.health / 100) * (0.6 + 0.4 * Math.sin(G.time * 6));
    const grad = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, h * 0.75);
    grad.addColorStop(0, 'rgba(200,0,0,0)');
    grad.addColorStop(1, 'rgba(200,0,0,' + clamp(a, 0, 0.45) + ')');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  // Top-left: cash, health, ammo.
  panel(ctx, 12, 12, 210, 66, 0.55);
  text(ctx, money(p.cash), 24, 38, 22, '#7CFC00');
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.roundRect(24, 48, 186, 14, 7); ctx.fill();
  ctx.fillStyle = p.health > 50 ? '#4caf50' : p.health > 25 ? '#ff9800' : '#f44336';
  ctx.beginPath(); ctx.roundRect(24, 48, 186 * clamp(p.health / 100, 0, 1), 14, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(24, 48, 186, 14, 7); ctx.stroke();
  if (p.pistol) text(ctx, 'PISTOL  ' + p.mag + '/∞', 24, 96, 13, '#fff');

  // Top-right: wanted stars.
  const flashing = G.wanted.flash > 0 && Math.floor(G.time * 6) % 2 === 0;
  panel(ctx, w - 190, 12, 178, 44, 0.55);
  for (let i = 0; i < 5; i += 1) {
    star(ctx, w - 172 + i * 34, 35, 28, i < G.wanted.stars, flashing);
  }
  if (G.wanted.stars > 0) {
    text(ctx, 'WANTED', w - 100, 72, 12, '#ff5252', 'center');
  }

  // Top-centre: mission objective (+ timer).
  const obj = missionObjective(G);
  ctx.font = 'bold 15px Arial, sans-serif';
  const ow = Math.min(w - 40, ctx.measureText(obj).width + 28);
  panel(ctx, (w - ow) / 2, 12, ow, 34, 0.55);
  shadowed(ctx, obj, w / 2, 34, 15, '#fff', 'center');
  const m = G.missions.active;
  if (m && m.timer > 0) {
    text(ctx, clock(m.timer), w / 2, 62, 20, m.timer < 20 ? '#ff5252' : '#fff', 'center');
  }

  // Minimap bottom-left.
  drawMinimap(G, 18, h - 148, 190, 130);

  // Speed when driving.
  if (p.car) {
    const mph = Math.round(Math.abs(p.car.speed) * 0.18);
    shadowed(ctx, mph + ' mph', w - 24, h - 24, 26, '#fff', 'right');
    if (p.car.health < 100) {
      text(ctx, 'CAR ' + Math.max(0, Math.round(p.car.health)) + '%', w - 24, h - 48, 13, p.car.health < 40 ? '#ff5252' : '#fff', 'right');
    }
  }

  // Context prompt.
  if (G.prompt) {
    ctx.font = 'bold 15px Arial, sans-serif';
    const pw = ctx.measureText(G.prompt).width + 28;
    panel(ctx, (w - pw) / 2, h - 52, pw, 32, 0.6);
    shadowed(ctx, G.prompt, w / 2, h - 30, 15, '#ffe082', 'center');
  }

  // Centre message.
  if (G.messageText && G.messageTimer > 0) {
    const a = clamp(G.messageTimer, 0, 1);
    ctx.globalAlpha = a;
    ctx.font = 'bold 30px Arial, sans-serif';
    const mw = ctx.measureText(G.messageText).width + 40;
    panel(ctx, (w - mw) / 2, h * 0.32 - 26, mw, 52, 0.7);
    shadowed(ctx, G.messageText, w / 2, h * 0.32 + 8, 30, '#fff', 'center');
    ctx.globalAlpha = 1;
  }
}

function menuList(G, items, selected, topY) {
  const ctx = G.ctx;
  const w = G.view.w;
  G.menuRects = [];
  items.forEach((item, i) => {
    const y = topY + i * 52;
    const isSel = i === selected;
    ctx.font = (isSel ? 'bold ' : '') + '22px Arial, sans-serif';
    const tw = ctx.measureText(item).width + 36;
    if (isSel) {
      ctx.fillStyle = 'rgba(255,193,7,0.9)';
      ctx.beginPath(); ctx.roundRect((w - tw) / 2, y - 30, tw, 42, 8); ctx.fill();
      shadowed(ctx, item, w / 2, y, 22, '#111', 'center');
    } else {
      shadowed(ctx, item, w / 2, y, 22, 'rgba(255,255,255,0.85)', 'center');
    }
    G.menuRects.push({ x: (w - tw) / 2, y: y - 30, w: tw, h: 42, index: i });
  });
}

export function drawTitle(G) {
  const ctx = G.ctx;
  const w = G.view.w, h = G.view.h;
  // Sun-soaked gradient over the city.
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(10,20,40,0.25)');
  grad.addColorStop(0.55, 'rgba(10,20,40,0.05)');
  grad.addColorStop(1, 'rgba(10,20,40,0.72)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  // Sun.
  ctx.fillStyle = 'rgba(255,214,100,0.9)';
  ctx.beginPath(); ctx.arc(w - 190, 110, 52, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,214,100,0.25)';
  ctx.beginPath(); ctx.arc(w - 190, 110, 78, 0, Math.PI * 2); ctx.fill();

  shadowed(ctx, 'SOLMAR', w / 2, h * 0.30, 92, '#ffd54f', 'center');
  shadowed(ctx, 'A  S U N - S O A K E D   C R I M E   S T O R Y', w / 2, h * 0.30 + 44, 17, '#fff', 'center');
  menuList(G, G.menu.items, G.menu.selected, h * 0.52);
  const y0 = h * 0.52 + G.menu.items.length * 52 + 26;
  shadowed(ctx, 'WASD move / drive   •   E enter & steal cars   •   F punch   •   Click shoot   •   Space handbrake', w / 2, y0, 14, 'rgba(255,255,255,0.8)', 'center');
  shadowed(ctx, 'P pause   •   M mute   •   Progress saves automatically', w / 2, y0 + 24, 14, 'rgba(255,255,255,0.8)', 'center');
  shadowed(ctx, 'An original game. Not affiliated with Rockstar Games or Grand Theft Auto.', w / 2, h - 18, 12, 'rgba(255,255,255,0.55)', 'center');
}

export function drawPause(G) {
  const ctx = G.ctx;
  const w = G.view.w, h = G.view.h;
  ctx.fillStyle = 'rgba(8,12,20,0.62)';
  ctx.fillRect(0, 0, w, h);
  shadowed(ctx, 'PAUSED', w / 2, h * 0.24, 54, '#fff', 'center');
  shadowed(ctx, 'Marco Reyes  •  ' + money(G.player.cash) + '  •  Missions done: ' + G.missions.completed.length + ' / 5', w / 2, h * 0.24 + 36, 16, '#ffe082', 'center');
  menuList(G, G.menu.items, G.menu.selected, h * 0.42);
}

export function drawBigScreen(G, title, subtitle, color) {
  const ctx = G.ctx;
  const w = G.view.w, h = G.view.h;
  ctx.fillStyle = 'rgba(8,10,16,0.55)';
  ctx.fillRect(0, 0, w, h);
  shadowed(ctx, title, w / 2, h * 0.42, 72, color, 'center');
  if (subtitle) shadowed(ctx, subtitle, w / 2, h * 0.42 + 46, 20, '#fff', 'center');
  shadowed(ctx, 'Press Enter to continue', w / 2, h * 0.42 + 92, 16, 'rgba(255,255,255,0.75)', 'center');
}

export function drawHowTo(G) {
  const ctx = G.ctx;
  const w = G.view.w, h = G.view.h;
  ctx.fillStyle = 'rgba(8,12,20,0.78)';
  ctx.fillRect(0, 0, w, h);
  shadowed(ctx, 'HOW TO PLAY', w / 2, 90, 44, '#ffd54f', 'center');
  const lines = [
    'You are Marco Reyes, a wheelman in Solmar. Lena runs the garage;',
    'take her jobs, earn cash, and do not get caught.',
    '',
    'ON FOOT:  WASD move, Shift run, F punch, mouse click shoots (once you own a pistol).',
    'IN A CAR:  W accelerate, S brake / reverse, A D steer, Space handbrake.',
    'E gets in a car — or steals one. Stealing, hitting people and shooting raise your wanted level.',
    'Police chase you while you have stars. Lie low and out of sight and the heat cools off.',
    'Missions start at the yellow M at the garage. Finish all five to run the city.',
    'Between jobs, stop by a yellow ! for a taxi fare.',
    'Your car is repaired at the garage ($50). Health comes back when the heat is off.',
    '',
    'P pause   •   M mute   •   R restart mission',
  ];
  lines.forEach((line, i) => {
    shadowed(ctx, line, w / 2, 150 + i * 30, line === '' ? 14 : 16, '#fff', 'center');
  });
  shadowed(ctx, 'Press Esc or Enter to go back', w / 2, h - 60, 16, '#ffe082', 'center');
}
