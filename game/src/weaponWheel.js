const ORDER = ['unarmed', 'pistol', 'shotgun', 'smg', 'rifle', 'melee'];
const LABELS = { unarmed: 'Unarmed', pistol: 'Pistol', shotgun: 'Shotgun', smg: 'SMG', rifle: 'Rifle', melee: 'Melee' };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
function drawIcon(c, id, x, y) {
  c.save(); c.translate(x, y); c.strokeStyle = '#f4eedc'; c.fillStyle = '#f4eedc'; c.lineWidth = 3; c.lineCap = 'round'; c.lineJoin = 'round';
  if (id === 'unarmed') { c.beginPath(); c.roundRect(-9, -6, 18, 14, 5); c.fill(); c.beginPath(); c.moveTo(-5, -6); c.lineTo(-5, -10); c.moveTo(0, -6); c.lineTo(0, -11); c.moveTo(5, -5); c.lineTo(5, -9); c.stroke(); }
  else if (id === 'melee') { c.beginPath(); c.moveTo(-10, 10); c.lineTo(9, -9); c.lineTo(5, 3); c.lineTo(-4, 12); c.closePath(); c.fill(); c.beginPath(); c.moveTo(-9, 10); c.lineTo(-13, 14); c.stroke(); }
  else { const length = id === 'rifle' ? 25 : id === 'shotgun' ? 23 : id === 'smg' ? 20 : 17; c.fillRect(-length / 2, -3, length, 6); c.fillRect(-length / 2 - 3, -2, 4, 4); c.fillRect(0, 2, id === 'rifle' ? 4 : 5, 8); if (id === 'rifle' || id === 'shotgun') c.fillRect(-length / 2 - 7, -2, 6, 4); if (id === 'smg') c.fillRect(length / 2 - 4, -7, 6, 3); }
  c.restore();
}

export function createWeaponWheel() {
  let open = false, previousOpen = false, progress = 0, candidate = 'pistol';
  function update(dt, input, weapons, state, width, height, pressed = [], enabled = true) {
    const held = enabled && input.down('Tab') && !state.inCar && !state.interior;
    if (held && !open) candidate = weapons.status().selected;
    open = held;
    const available = weapons.available(state.cheats.unlockAllWeapons);
    if (open) {
      const pointer = input.pointer(), dx = pointer.x - width / 2, dy = pointer.y - height / 2;
      const pointerDistance = Math.hypot(dx, dy);
      if (input.hasPointer && pointerDistance > 48 && pointerDistance < 245) {
        const angle = Math.atan2(dy, dx) + Math.PI / 2;
        const index = ((Math.round(angle / (Math.PI / 3)) % 6) + 6) % 6;
        const id = ORDER[index];
        if (available.some(weapon => weapon.id === id)) candidate = id;
      }
      if (pressed.some(key => ['ArrowLeft', 'ArrowUp'].includes(key))) {
        const unlocked = available.map(weapon => weapon.id), at = unlocked.indexOf(candidate);
        candidate = unlocked[(at - 1 + unlocked.length) % unlocked.length];
      }
      if (pressed.some(key => ['ArrowRight', 'ArrowDown'].includes(key))) {
        const unlocked = available.map(weapon => weapon.id), at = unlocked.indexOf(candidate);
        candidate = unlocked[(at + 1) % unlocked.length];
      }
    }
    if (previousOpen && !open) weapons.select(candidate, state.cheats.unlockAllWeapons);
    previousOpen = open;
    progress = clamp(progress + (open ? 1 : -1) * dt * 8, 0, 1);
    return open;
  }
  function draw(c, width, height, weapons, state) {
    if (progress <= 0) return;
    const available = weapons.available(state.cheats.unlockAllWeapons), status = weapons.status();
    const ease = 1 - (1 - progress) ** 3, cx = width / 2, cy = height / 2, radius = 160 * ease;
    c.save(); c.fillStyle = `rgba(8,13,15,${0.45 * progress})`; c.fillRect(0, 0, width, height);
    c.fillStyle = '#12201feF'; c.beginPath(); c.arc(cx, cy, radius + 59, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#d9c99888'; c.lineWidth = 2; c.stroke();
    for (let i = 0; i < ORDER.length; i++) {
      const id = ORDER[i], angle = i * Math.PI / 3 - Math.PI / 2, x = cx + Math.cos(angle) * radius, y = cy + Math.sin(angle) * radius;
      const unlocked = available.some(weapon => weapon.id === id), chosen = open ? candidate === id : status.selected === id;
      c.fillStyle = chosen ? '#d3aa5b' : unlocked ? '#30413e' : '#1c2827'; c.beginPath(); c.arc(x, y, 31 * ease, 0, Math.PI * 2); c.fill(); c.strokeStyle = chosen ? '#fff0bd' : '#b7c1af88'; c.lineWidth = chosen ? 3 : 1; c.stroke();
      c.globalAlpha = unlocked ? 1 : 0.35; drawIcon(c, id, x, y); c.globalAlpha = 1; c.font = '700 13px system-ui'; c.textAlign = 'center';
      c.font = '11px system-ui'; c.fillText(unlocked ? LABELS[id] : 'LOCKED', x, y + 46);
    }
    const current = ORDER.includes(candidate) ? candidate : status.selected, selected = weapons.definition(current), ammoState = weapons.status(current), ammo = selected.kind === 'melee' ? '∞' : `${ammoState.clip} / ${ammoState.reserve}`;
    c.textAlign = 'center'; c.fillStyle = '#f6f0db'; c.font = '700 18px system-ui'; c.fillText(LABELS[current], cx, cy + 6); c.font = '13px system-ui'; c.fillStyle = '#d2dacd'; c.fillText(available.some(w => w.id === current) ? `Ammo  ${ammo}` : 'Weapon locked', cx, cy + 30); c.font = '11px system-ui'; c.fillText('Hold TAB · aim to select · release to equip', cx, cy + radius + 83);
    c.restore();
  }
  return { update, draw, get open() { return open; } };
}
