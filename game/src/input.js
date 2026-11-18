// Keyboard and mouse input, with an action map the game reads each frame.
// Presses are snapshotted at the start of each step (beginStep) so a key
// that lands while a frame is running is seen by the next step, never lost:
// clearing the set at the end of a frame drops presses that arrive during
// that frame's step/render.
export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set(); // keys pressed since the last step began
  let justPressed = new Set(); // the snapshot the current step reads
  let mouseX = 0, mouseY = 0, mouseDown = false, mousePressed = false;
  let justMousePressed = false;

  const GAME_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '];

  function onKeyDown(e) {
    if (GAME_KEYS.includes(e.key)) e.preventDefault();
    if (!e.repeat) {
      keys.add(e.key.length === 1 ? e.key.toLowerCase() : e.key);
      pressed.add(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    }
  }
  function onKeyUp(e) {
    keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
  }
  function onMouseMove(e) {
    const r = canvas.getBoundingClientRect();
    mouseX = e.clientX - r.left;
    mouseY = e.clientY - r.top;
  }
  function onMouseDown(e) {
    onMouseMove(e);
    mouseDown = true; mousePressed = true;
  }
  function onMouseUp() { mouseDown = false; }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  return {
    get mouse() { return { x: mouseX, y: mouseY, down: mouseDown, pressed: justMousePressed }; },
    down(name) { return keys.has(name); },
    axis() {
      // {x: -1..1 steering / strafe, y: -1..1 forward/back}
      const x = (keys.has('d') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('a') || keys.has('ArrowLeft') ? 1 : 0);
      const y = (keys.has('w') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('s') || keys.has('ArrowDown') ? 1 : 0);
      return { x, y };
    },
    wasPressed(name) { return justPressed.has(name); },
    /** Snapshot this step's presses; call once per frame, before step(). */
    beginStep() {
      justPressed = new Set(pressed);
      pressed.clear();
      justMousePressed = mousePressed;
      mousePressed = false;
    },
    consume() { justPressed.clear(); justMousePressed = false; },
  };
}
