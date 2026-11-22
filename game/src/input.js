const MOVES = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'Space', 'KeyF', 'ShiftLeft', 'ShiftRight', 'KeyR', 'KeyI', 'KeyJ', 'KeyK', 'KeyL']);

export function createInput(canvas) {
  const held = new Set(), pressed = new Set(), clicks = [];
  let actions = 0, pointer = { x: 0, y: 0 }, pointerDown = false, hasPointer = false;
  const point = event => {
    const rect = canvas.getBoundingClientRect();
    pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    hasPointer = true;
  };
  window.addEventListener('keydown', event => {
    if (MOVES.has(event.code) || ['KeyE', 'KeyP', 'Escape', 'Tab', 'Enter', 'Backspace'].includes(event.code)) event.preventDefault();
    if (!event.repeat) {
      pressed.add(event.code);
      if (event.code === 'KeyE') actions |= 1;
      if (['KeyP', 'Escape'].includes(event.code)) actions |= 2;
    }
    held.add(event.code);
  });
  window.addEventListener('keyup', event => held.delete(event.code));
  window.addEventListener('blur', () => { held.clear(); pointerDown = false; });
  window.addEventListener('pointermove', point);
  canvas.addEventListener('pointerdown', event => { point(event); pointerDown = true; canvas.setPointerCapture(event.pointerId); });
  canvas.addEventListener('pointerup', event => { point(event); if (pointerDown) clicks.push({ ...pointer, pointerType: event.pointerType }); pointerDown = false; });
  canvas.addEventListener('pointercancel', () => { pointerDown = false; });
  for (const button of document.querySelectorAll('[data-control]')) {
    const code = button.dataset.control;
    button.addEventListener('pointerdown', event => {
      event.preventDefault(); point(event); button.setPointerCapture(event.pointerId);
      if (code === 'KeyE') actions |= 1;
      else if (['KeyP', 'Escape'].includes(code)) actions |= 2;
      else held.add(code);
    });
    const release = event => { event.preventDefault(); held.delete(code); };
    button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', () => held.delete(code));
  }
  return {
    down(...codes) { return codes.some(code => held.has(code)); },
    take() { const value = actions; actions = 0; return value; },
    takePressed() { const value = [...pressed]; pressed.clear(); return value; },
    takeClicks() { return clicks.splice(0); },
    pointer() { return { ...pointer }; },
    get hasPointer() { return hasPointer; },
    get pointerDown() { return pointerDown; },
  };
}
