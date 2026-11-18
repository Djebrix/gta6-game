// Synthesised sound: every effect is generated with WebAudio oscillators and
// filtered noise, so the game ships no audio files. All calls are safe before
// the first user gesture (the context is created lazily and guarded).
let ctx = null;
let master = null;
let muted = false;
let engineOsc = null;
let engineGain = null;
let sirenOsc = null;
let sirenGain = null;
let sirenTimer = 0;

function ensure() {
  if (ctx) return true;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    return true;
  } catch {
    return false;
  }
}

export function unlockAudio() {
  if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
}

export function setMuted(m) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.5;
  if (m) stopEngine();
}
export function isMuted() { return muted; }

function noiseBuffer(seconds) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
  return buf;
}

function blip(freq, dur, type, vol, slideTo) {
  if (!ensure() || muted) return;
  try {
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  } catch { /* audio is best-effort */ }
}

function noiseHit(dur, vol, filterFreq, type = 'lowpass') {
  if (!ensure() || muted) return;
  try {
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(dur + 0.05);
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t); src.stop(t + dur + 0.05);
  } catch { /* audio is best-effort */ }
}

export const sfx = {
  click() { blip(660, 0.06, 'square', 0.12); },
  punch() { noiseHit(0.12, 0.5, 300); blip(120, 0.1, 'sine', 0.4, 60); },
  shot() { noiseHit(0.14, 0.6, 1800, 'highpass'); blip(220, 0.08, 'square', 0.25, 60); },
  crash() { noiseHit(0.25, 0.7, 400); blip(90, 0.22, 'sine', 0.5, 40); },
  pickup() { blip(880, 0.09, 'sine', 0.25); setTimeout(() => blip(1320, 0.12, 'sine', 0.25), 90); },
  cash() { blip(988, 0.08, 'triangle', 0.3); setTimeout(() => blip(1319, 0.14, 'triangle', 0.3), 80); },
  missionPass() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'triangle', 0.3), i * 110)); },
  missionFail() { [392, 330, 262].forEach((f, i) => setTimeout(() => blip(f, 0.25, 'sawtooth', 0.18), i * 140)); },
  wasted() { [330, 262, 196, 131].forEach((f, i) => setTimeout(() => blip(f, 0.35, 'sawtooth', 0.2), i * 180)); },
  sirenBlip() { blip(950, 0.3, 'sine', 0.12, 700); },
  door() { blip(180, 0.07, 'square', 0.15, 120); },
};

/** Continuous engine hum, driven by speed 0..1. Call every frame; cheap. */
export function engine(speed01, on) {
  if (!ensure() || muted || !on) { stopEngine(); return; }
  try {
    if (!engineOsc) {
      engineOsc = ctx.createOscillator();
      engineGain = ctx.createGain();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      engineGain.gain.value = 0;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 500;
      engineOsc.connect(f); f.connect(engineGain); engineGain.connect(master);
      engineOsc.start();
    }
    engineOsc.frequency.value = 55 + speed01 * 160;
    engineGain.gain.value = 0.02 + speed01 * 0.05;
  } catch { /* best-effort */ }
}

export function stopEngine() {
  if (engineOsc) {
    try { engineOsc.stop(); } catch { /* already stopped */ }
    engineOsc = null; engineGain = null;
  }
}

/** Two-tone police siren while any police car is near. Call every frame. */
export function siren(active, dt) {
  if (!ensure() || muted || !active) {
    if (sirenOsc) { try { sirenOsc.stop(); } catch { /* already stopped */ } sirenOsc = null; sirenGain = null; }
    return;
  }
  try {
    if (!sirenOsc) {
      sirenOsc = ctx.createOscillator();
      sirenGain = ctx.createGain();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 750;
      sirenGain.gain.value = 0.045;
      sirenOsc.connect(sirenGain); sirenGain.connect(master);
      sirenOsc.start();
      sirenTimer = 0;
    }
    sirenTimer += dt;
    const phase = Math.floor(sirenTimer / 0.45) % 2;
    sirenOsc.frequency.value = phase === 0 ? 750 : 980;
  } catch { /* best-effort */ }
}
