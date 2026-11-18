// Particles (smoke, sparks, blood, explosion, cash sparkle) and skid marks.
// All effects are drawn by render.js; this file only owns their state.
export function createParticles() {
  return { list: [], skids: [] };
}

export function spawn(p, x, y, vx, vy, life, size, color, gravity = 0) {
  p.list.push({ x, y, vx, vy, life, maxLife: life, size, color, gravity });
}

export function burst(p, x, y, n, color, speed, life, size, gravity = 0) {
  for (let i = 0; i < n; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.3 + Math.random() * 0.7);
    spawn(p, x, y, Math.cos(a) * s, Math.sin(a) * s, life * (0.5 + Math.random() * 0.5), size * (0.6 + Math.random() * 0.8), color, gravity);
  }
}

export function explosion(p, x, y) {
  burst(p, x, y, 26, '#ff9d00', 260, 0.7, 7);
  burst(p, x, y, 18, '#ff5722', 180, 0.9, 9);
  burst(p, x, y, 14, '#555', 90, 1.6, 12);
  burst(p, x, y, 10, '#ffeb3b', 320, 0.35, 5);
}

export function smoke(p, x, y) {
  spawn(p, x, y, (Math.random() - 0.5) * 20, -30 - Math.random() * 20, 1.1, 9, '#777');
}

export function addSkid(p, x1, y1, x2, y2) {
  p.skids.push({ x1, y1, x2, y2, life: 5 });
  if (p.skids.length > 220) p.skids.splice(0, p.skids.length - 220);
}

export function stepParticles(p, dt) {
  for (let i = p.list.length - 1; i >= 0; i -= 1) {
    const q = p.list[i];
    q.life -= dt;
    if (q.life <= 0) { p.list.splice(i, 1); continue; }
    q.vy += q.gravity * dt;
    q.x += q.vx * dt;
    q.y += q.vy * dt;
    q.vx *= 0.98; q.vy *= 0.98;
  }
  for (let i = p.skids.length - 1; i >= 0; i -= 1) {
    p.skids[i].life -= dt;
    if (p.skids[i].life <= 0) p.skids.splice(i, 1);
  }
}
