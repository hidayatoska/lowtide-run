const WEAPONS = [
  { id: 'unarmed', name: 'Unarmed', kind: 'melee', damage: 8, range: 38, rate: 0.48 },
  { id: 'pistol', name: 'Pistol', kind: 'ranged', damage: 24, clipSize: 12, reserveSize: 72, rate: 0.28, speed: 680, range: 760 },
  { id: 'shotgun', name: 'Shotgun', kind: 'spread', damage: 12, pellets: 5, clipSize: 6, reserveSize: 30, rate: 0.78, speed: 520, range: 420, spread: 0.24 },
  { id: 'smg', name: 'SMG', kind: 'ranged', damage: 9, clipSize: 30, reserveSize: 120, rate: 0.085, speed: 620, range: 600 },
  { id: 'rifle', name: 'Rifle', kind: 'ranged', damage: 22, clipSize: 24, reserveSize: 96, rate: 0.19, speed: 940, range: 980 },
  { id: 'melee', name: 'Melee', kind: 'melee', damage: 31, range: 66, rate: 0.62 },
];
const INITIAL_UNLOCKS = new Set(['unarmed', 'pistol', 'melee']);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const pointSegmentDistance = (p, a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy;
  const t = length ? clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / length, 0, 1) : 0;
  return Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t);
};

export function createWeapons() {
  const unlocked = new Set(INITIAL_UNLOCKS), ammo = Object.fromEntries(WEAPONS.filter(w => w.clipSize).map(w => [w.id, { clip: w.clipSize, reserve: w.reserveSize }]));
  const projectiles = [];
  let selected = 'pistol', cooldown = 0, reloadTimer = 0;
  const definition = id => WEAPONS.find(weapon => weapon.id === id);
  function available(unlockAll = false) { return WEAPONS.filter(weapon => unlockAll || unlocked.has(weapon.id)); }
  function select(id, unlockAll = false) { if (available(unlockAll).some(weapon => weapon.id === id)) selected = id; return selected; }
  function unlockAll() { for (const weapon of WEAPONS) unlocked.add(weapon.id); }
  function status(id = selected) {
    const weapon = definition(id), count = ammo[id];
    return { ...weapon, selected: id, unlocked: unlocked.has(id), clip: count?.clip ?? Infinity, reserve: count?.reserve ?? Infinity, reloading: id === selected && reloadTimer > 0, unlockedIds: [...unlocked] };
  }
  function reload(cheats) {
    const weapon = definition(selected), count = ammo[selected];
    if (cheats.noReload || !count || count.clip >= weapon.clipSize || count.reserve <= 0 || reloadTimer > 0) return;
    reloadTimer = weapon.id === 'shotgun' ? 0.95 : 0.8;
  }
  function harm(enemy, amount, state) {
    if (!enemy.active) return;
    enemy.health = Math.max(0, enemy.health - amount); enemy.stagger = 0.3; enemy.hitFlash = 0.12;
    if (enemy.health === 0) { enemy.active = false; state.player.money += 20; }
  }
  function fire(state, aim, cheats) {
    const weapon = definition(selected), actor = state.player;
    if (!weapon || state.inCar || state.interior || cooldown > 0) return;
    if (weapon.kind === 'melee') {
      const angle = Math.atan2(aim.y - actor.y, aim.x - actor.x); actor.aimAngle = angle;
      const target = state.enemies.filter(enemy => enemy.active && dist(enemy, actor) <= weapon.range && Math.abs(Math.atan2(Math.sin(Math.atan2(enemy.y - actor.y, enemy.x - actor.x) - angle), Math.cos(Math.atan2(enemy.y - actor.y, enemy.x - actor.x) - angle))) < 1.15).sort((a, b) => dist(a, actor) - dist(b, actor))[0];
      if (target) harm(target, weapon.damage, state);
      cooldown = weapon.rate; return;
    }
    const count = ammo[selected];
    if (count.clip <= 0 && cheats.noReload) count.clip = weapon.clipSize;
    if (count.clip <= 0 && !cheats.infiniteAmmo) { reload(cheats); state.notification = 'Reloading'; state.notificationTime = 1; return; }
    if (!cheats.infiniteAmmo) count.clip--;
    const baseAngle = Math.atan2(aim.y - actor.y, aim.x - actor.x); actor.aimAngle = baseAngle;
    const shots = weapon.kind === 'spread' ? weapon.pellets : 1;
    for (let index = 0; index < shots; index++) {
      const angle = baseAngle + (shots === 1 ? 0 : ((index / (shots - 1)) - 0.5) * weapon.spread);
      const muzzle = { x: actor.x + Math.cos(angle) * 18, y: actor.y + Math.sin(angle) * 18 };
      projectiles.push({ x: muzzle.x, y: muzzle.y, px: muzzle.x, py: muzzle.y, angle, speed: weapon.speed, range: weapon.range, damage: weapon.damage, life: weapon.range / weapon.speed, color: weapon.id === 'shotgun' ? '#ffd88a' : '#f9eeae' });
    }
    cooldown = weapon.rate;
  }
  function update(dt, input, state, aim, blocked = false, pressed = [], shots = []) {
    if (!available(state.cheats.unlockAllWeapons).some(weapon => weapon.id === selected)) selected = 'pistol';
    cooldown = Math.max(0, cooldown - dt); reloadTimer = Math.max(0, reloadTimer - dt);
    const aimX = Number(input.down('KeyL', 'ArrowRight')) - Number(input.down('KeyJ', 'ArrowLeft'));
    const aimY = Number(input.down('KeyK', 'ArrowDown')) - Number(input.down('KeyI', 'ArrowUp'));
    if (aimX || aimY) { const angle = Math.atan2(aimY, aimX); state.player.aimAngle = angle; aim = { x: state.player.x + Math.cos(angle) * 1000, y: state.player.y + Math.sin(angle) * 1000 }; }
    else if (!aim) { const angle = Number.isFinite(state.player.aimAngle) ? state.player.aimAngle : state.player.angle; aim = { x: state.player.x + Math.cos(angle) * 1000, y: state.player.y + Math.sin(angle) * 1000 }; }
    if (aim) state.player.aimAngle = Math.atan2(aim.y - state.player.y, aim.x - state.player.x);
    if (reloadTimer === 0 && selected in ammo && !state.cheats.infiniteAmmo && !state.cheats.noReload) {
      const weapon = definition(selected), count = ammo[selected];
      if (count.clip < weapon.clipSize && count.reserve > 0 && !state.cheats.noReload) {
        const take = Math.min(weapon.clipSize - count.clip, count.reserve); count.clip += take; count.reserve -= take;
      }
    }
    if (pressed.includes('KeyR')) reload(state.cheats);
    if (!blocked && input.pointerDown && aim) fire(state, aim, state.cheats);
    if (!blocked) for (const target of shots) fire(state, target, state.cheats);
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const bullet = projectiles[i]; bullet.px = bullet.x; bullet.py = bullet.y;
      bullet.x += Math.cos(bullet.angle) * bullet.speed * dt; bullet.y += Math.sin(bullet.angle) * bullet.speed * dt; bullet.life -= dt;
      let hit = false;
      for (const building of state.buildings) {
        let wall = false;
        for (let t = 0.1; t <= 1; t += 0.2) { const x = bullet.px + (bullet.x - bullet.px) * t, y = bullet.py + (bullet.y - bullet.py) * t; if (x > building.x && x < building.x + building.w && y > building.y && y < building.y + building.h) { wall = true; break; } }
        if (wall) { hit = true; break; }
      }
      if (!hit) for (const enemy of state.enemies) if (enemy.active && pointSegmentDistance(enemy, bullet, { x: bullet.px, y: bullet.py }) < 15) { harm(enemy, bullet.damage, state); hit = true; break; }
      if (hit || bullet.life <= 0) projectiles.splice(i, 1);
    }
  }
  function draw(c, state) {
    for (const bullet of projectiles) { c.strokeStyle = bullet.color; c.lineWidth = 3; c.beginPath(); c.moveTo(bullet.px, bullet.py); c.lineTo(bullet.x, bullet.y); c.stroke(); }
  }
  function setUnlocked(ids) { for (const id of ids) if (definition(id)) unlocked.add(id); }
  return { update, draw, status, available, select, unlockAll, setUnlocked, definition };
}
