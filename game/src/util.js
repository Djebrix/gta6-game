// Small math and collision helpers shared by every system.
export const TAU = Math.PI * 2;

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
export function dist(ax, ay, bx, by) { return Math.sqrt(dist2(ax, ay, bx, by)); }

/** Deterministic pseudo-random in [0,1) from three numbers: same inputs, same output. */
export function hashRand(x, y, t) {
  const s = Math.sin(x * 12.9898 + y * 78.233 + t * 0.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Shortest signed turn from angle `a` toward angle `b`. */
export function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

/** Circle vs axis-aligned rect: push the circle out, return the push vector or null. */
export function circleRectPush(cx, cy, r, rect) {
  const nx = clamp(cx, rect.x, rect.x + rect.w);
  const ny = clamp(cy, rect.y, rect.y + rect.h);
  const dx = cx - nx, dy = cy - ny;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return null;
  if (d2 > 0.0001) {
    const d = Math.sqrt(d2);
    return { x: (dx / d) * (r - d), y: (dy / d) * (r - d) };
  }
  // Centre inside the rect: push out along the smallest penetration axis.
  const left = cx - rect.x, right = rect.x + rect.w - cx;
  const top = cy - rect.y, bottom = rect.y + rect.h - cy;
  const m = Math.min(left, right, top, bottom);
  if (m === left) return { x: -(left + r), y: 0 };
  if (m === right) return { x: right + r, y: 0 };
  if (m === top) return { x: 0, y: -(top + r) };
  return { x: 0, y: bottom + r };
}

export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Format cash as $1,250. */
export function money(n) { return '$' + Math.floor(n).toLocaleString('en-US'); }

/** Format seconds as M:SS. */
export function clock(t) {
  const s = Math.max(0, Math.ceil(t));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}
