export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  let pointerDown = false;
  let lastX = 0;
  let lastY = 0;
  let movementX = 0;
  let movementY = 0;
  let wheel = 0;
  let pointerX = innerWidth / 2;
  let pointerY = innerHeight / 2;

  function onKeyDown(event) {
    if (event.code === 'Tab') event.preventDefault();
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
    if (!held.has(event.code)) pressed.add(event.code);
    held.add(event.code);
  }
  function onKeyUp(event) { held.delete(event.code); }
  function onBlur() { held.clear(); pointerDown = false; }
  function onMouseMove(event) {
    pointerX = event.clientX; pointerY = event.clientY;
    if (document.pointerLockElement === canvas) {
      movementX += event.movementX || 0;
      movementY += event.movementY || 0;
      pointerX = Math.max(0, Math.min(innerWidth, pointerX + (event.movementX || 0)));
      pointerY = Math.max(0, Math.min(innerHeight, pointerY + (event.movementY || 0)));
    } else if (pointerDown) {
      movementX += event.clientX - lastX;
      movementY += event.clientY - lastY;
      lastX = event.clientX; lastY = event.clientY;
    }
  }
  function onMouseDown(event) {
    if (event.button !== 0) return;
    pointerDown = true; lastX = event.clientX; lastY = event.clientY;
    if (canvas.requestPointerLock && document.pointerLockElement !== canvas && matchMedia('(pointer:fine)').matches) canvas.requestPointerLock();
  }
  function onMouseUp() { pointerDown = false; }
  function onWheel(event) { wheel += event.deltaY; event.preventDefault(); }
  function onResize() { if (!pointerDown && document.pointerLockElement !== canvas) { pointerX = innerWidth / 2; pointerY = innerHeight / 2; } }
  window.addEventListener('keydown', onKeyDown, { passive: false });
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  document.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('resize', onResize);

  return {
    down: code => held.has(code),
    pointerPosition: () => ({ x: pointerX, y: pointerY }),
    pointerHeld: () => pointerDown,
    consumeWheel() { const value = wheel; wheel = 0; return value; },
    consumePressed(code) { const value = pressed.has(code); pressed.delete(code); return value; },
    consumePointer() { const value = { x: movementX, y: movementY, wheel }; movementX = 0; movementY = 0; wheel = 0; return value; },
    clear() { held.clear(); pressed.clear(); pointerDown = false; movementX = 0; movementY = 0; wheel = 0; },
    dispose() {
      window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); window.removeEventListener('blur', onBlur);
      document.removeEventListener('mousemove', onMouseMove); canvas.removeEventListener('mousedown', onMouseDown); window.removeEventListener('mouseup', onMouseUp); canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', onResize);
    },
  };
}
