const ORDER = ['unarmed', 'pistol', 'smg', 'shotgun', 'rifle', 'sniper'];
const LABELS = { unarmed: 'Unarmed', pistol: 'Pistol', smg: 'SMG', shotgun: 'Shotgun', rifle: 'Assault Rifle', sniper: 'Sniper Rifle' };

export function createWeaponWheel(root, weapons) {
  const canvas = document.createElement('canvas');
  canvas.className = 'weapon-wheel-canvas'; canvas.setAttribute('aria-hidden', 'true'); root.append(canvas);
  const ctx = canvas.getContext('2d');
  let open = false, wasHeld = false, progress = 0, candidate = weapons.current, changed = false, cancelled = false;
  function update(dt, input, { enabled = true } = {}) {
    const held = enabled && input.down('Tab');
    if (held && !wasHeld) { candidate = weapons.current; changed = false; cancelled = false; }
    if (held) {
      const pointer = input.pointerPosition(), dx = pointer.x - innerWidth / 2, dy = pointer.y - innerHeight / 2;
      const distance = Math.hypot(dx, dy);
      if (distance > 48) {
        const angle = Math.atan2(dy, dx) + Math.PI / 2;
        const index = ((Math.round(angle / (Math.PI / 3)) % 6) + 6) % 6;
        const id = ORDER[index];
        if (weapons.unlocked(id)) { candidate = id; changed = true; }
        else { candidate = id; }
      }
      const scroll = input.consumeWheel();
      if (scroll) {
        const direction = Math.sign(scroll);
        let index = ORDER.indexOf(candidate);
        for (let i = 0; i < ORDER.length; i++) { index = (index + direction + ORDER.length) % ORDER.length; if (weapons.unlocked(ORDER[index])) { candidate = ORDER[index]; changed = true; break; } }
      }
      for (let i = 0; i < ORDER.length; i++) if (input.consumePressed(`Digit${i + 1}`)) {
        const id = ORDER[i]; candidate = id;
        if (weapons.unlocked(id)) changed = true;
      }
      if (input.consumePressed('Escape')) cancelled = true;
    }
    open = held && !cancelled;
    if (wasHeld && !held && changed && !cancelled) weapons.select(candidate);
    wasHeld = held;
    progress += (open ? 1 : -1) * dt * 8;
    progress = Math.max(0, Math.min(1, progress));
    draw();
    return open;
  }
  function icon(id, x, y, scale, color) {
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    if (id === 'unarmed') { ctx.beginPath(); ctx.roundRect(-8, -5, 16, 13, 4); ctx.fill(); ctx.beginPath(); ctx.moveTo(-4, -5); ctx.lineTo(-4, -9); ctx.moveTo(0, -5); ctx.lineTo(0, -10); ctx.moveTo(4, -4); ctx.lineTo(4, -8); ctx.stroke(); }
    else { const length = id === 'sniper' ? 27 : id === 'rifle' || id === 'shotgun' ? 24 : id === 'smg' ? 20 : 17; ctx.fillRect(-length / 2, -2.5, length, 5); ctx.fillRect(0, 2, 4, 8); if (['rifle', 'shotgun', 'sniper'].includes(id)) ctx.fillRect(-length / 2 - 6, -2, 5, 3); if (id === 'sniper') { ctx.fillRect(-4, -6, 8, 2); ctx.fillRect(-1, -8, 2, 6); } }
    ctx.restore();
  }
  function draw() {
    const dpr = Math.min(devicePixelRatio || 1, 2), w = innerWidth, h = innerHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    if (progress <= 0) return;
    const ease = 1 - (1 - progress) ** 3, cx = w / 2, cy = h / 2, radius = Math.min(158, Math.min(w, h) * 0.25) * ease;
    ctx.fillStyle = `rgba(5, 11, 12, ${0.32 * progress})`; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = `rgba(13, 24, 25, ${0.94 * progress})`; ctx.beginPath(); ctx.arc(cx, cy, radius + 60, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#d8c89a99'; ctx.lineWidth = 1.5; ctx.stroke();
    for (let i = 0; i < ORDER.length; i++) {
      const id = ORDER[i], angle = i * Math.PI / 3 - Math.PI / 2, x = cx + Math.cos(angle) * radius, y = cy + Math.sin(angle) * radius;
      const unlocked = weapons.unlocked(id), selected = candidate === id;
      ctx.fillStyle = selected ? '#cba759' : unlocked ? '#30413e' : '#1c2827'; ctx.beginPath(); ctx.arc(x, y, 31 * ease, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = selected ? '#fff0bd' : '#b7c1af88'; ctx.lineWidth = selected ? 2.7 : 1; ctx.stroke();
      icon(id, x, y, ease, unlocked ? '#f4eedc' : '#85908a');
      ctx.textAlign = 'center'; ctx.font = '600 11px system-ui'; ctx.fillStyle = unlocked ? '#f0ead8' : '#a3aaa0'; ctx.fillText(unlocked ? LABELS[id] : '🔒 Locked', x, y + 47);
    }
    const weapon = weapons.status(candidate), centerName = LABELS[candidate];
    ctx.textAlign = 'center'; ctx.fillStyle = '#f6f0db'; ctx.font = '700 17px system-ui'; ctx.fillText(centerName, cx, cy + 4);
    ctx.fillStyle = weapon.owned ? '#d2dacd' : '#efb5a6'; ctx.font = '12px system-ui';
    ctx.fillText(weapon.owned ? (weapon.clip === Infinity ? 'Ready' : `Ammo  ${weapon.clip} / ${weapon.reserve}`) : 'Locked', cx, cy + 27);
    ctx.fillStyle = '#d0d8cc'; ctx.font = '10px ui-monospace, monospace'; ctx.fillText('HOLD TAB · AIM TO SELECT · RELEASE TO EQUIP', cx, cy + radius + 82);
  }
  return { update, dispose() { canvas.remove(); }, get open() { return open; }, get candidate() { return candidate; } };
}
