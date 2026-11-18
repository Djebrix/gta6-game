// Save / load in localStorage: cash, unlocked missions, completed missions,
// total earned and the mute setting. Safe when storage is unavailable.
const KEY = 'solmar-save-v1';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || typeof s !== 'object') return null;
    return {
      cash: typeof s.cash === 'number' ? s.cash : 0,
      unlocked: typeof s.unlocked === 'number' ? s.unlocked : 0,
      completed: Array.isArray(s.completed) ? s.completed : [],
      earned: typeof s.earned === 'number' ? s.earned : 0,
      muted: s.muted === true,
    };
  } catch {
    return null;
  }
}

export function storeSave(save) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(save));
  } catch { /* storage unavailable: play without saving */ }
}

export function clearSave() {
  try { window.localStorage.removeItem(KEY); } catch { /* ignore */ }
}
