import { WORLD, COLORS, FONT } from './config.js';

function vehicle(c, v, police = false) {
  c.save(); c.translate(v.x, v.y); c.rotate(v.angle);
  c.fillStyle = '#162023'; c.fillRect(-28, -15, 56, 30);
  c.fillStyle = police ? '#eeeadd' : v.model.color; c.fillRect(-24, -12, 48, 24);
  c.fillStyle = police ? '#26333a' : '#263d40'; c.fillRect(-6, -10, 18, 20);
  c.fillStyle = police ? '#283943' : '#20272a'; c.fillRect(-21, -14, 12, 3); c.fillRect(10, -14, 12, 3); c.fillRect(-21, 11, 12, 3); c.fillRect(10, 11, 12, 3);
  c.fillStyle = '#f7dda0'; c.fillRect(21, -9, 4, 6); c.fillRect(21, 3, 4, 6);
  if (police) { c.fillStyle = Math.floor(v.siren * 7) % 2 ? '#e44d4d' : '#4d9ee4'; c.fillRect(-7, -15, 14, 4); }
  c.restore();
}
function label(c, text, x, y, size = 14, color = '#f4f0e5', weight = 500) { c.font = `${weight} ${size}px ${FONT}`; c.fillStyle = color; c.fillText(text, x, y); }

export function createRenderer(canvas) {
  const c = canvas.getContext('2d'); let w = 0, h = 0, dpr = 1;
  function resize() { dpr = devicePixelRatio || 1; w = innerWidth; h = innerHeight; canvas.width = w * dpr; canvas.height = h * dpr; }
  function drawInterior(s, scale, vw, vh, cx, cy) {
    const i = s.interior, layout = i.interior;
    c.fillStyle = '#37413a'; c.fillRect(0, 0, WORLD.width, WORLD.height);
    c.fillStyle = layout.floor; c.fillRect(0, 0, 520, 560);
    for (const room of layout.rooms) { c.fillStyle = room.color; c.fillRect(room.x, room.y, room.w, room.h); c.strokeStyle = '#e2d3b0'; c.lineWidth = 5; c.strokeRect(room.x, room.y, room.w, room.h); }
    c.fillStyle = '#5a4c3b';
    for (const f of layout.furniture) {
      c.fillStyle = f.kind === 'bed' ? '#718b86' : f.kind === 'sofa' ? '#537a72' : f.kind === 'car' ? '#d2784c' : '#554b3b';
      if (f.kind === 'car') { c.fillRect(f.x, f.y, f.w, f.h); c.fillStyle = '#29434a'; c.fillRect(f.x + 25, f.y + 12, f.w - 50, f.h - 24); }
      else c.fillRect(f.x, f.y, f.w, f.h);
    }
    c.fillStyle = '#e9d29a'; c.fillRect(238, 520, 44, 16);
    c.fillStyle = '#2b302c'; c.fillRect(224, 542, 72, 18);
    c.fillStyle = '#f4d789'; c.globalAlpha = 0.16; c.beginPath(); c.arc(260, 268, 250, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
    c.save(); c.translate(s.player.x, s.player.y); c.fillStyle = '#202326'; c.beginPath(); c.arc(0, 0, 10, 0, Math.PI * 2); c.fill(); c.fillStyle = '#e7bd83'; c.beginPath(); c.arc(2, -3, 6, 0, Math.PI * 2); c.fill(); c.restore();
  }
  function draw(s, paused, options = {}) {
    if (w !== innerWidth || h !== innerHeight) resize();
    const scale = Math.min(w / 1100, h / 760), vw = w / scale, vh = h / scale;
    const follow = s.interior ? s.player : s.inCar ? s.car : s.player;
    const cx = s.interior ? 260 : Math.max(vw / 2, Math.min(WORLD.width - vw / 2, follow.x));
    const cy = s.interior ? 280 : Math.max(vh / 2, Math.min(WORLD.height - vh / 2, follow.y));
    c.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0); c.fillStyle = COLORS.water; c.fillRect(0, 0, vw, vh); c.save(); c.translate(vw / 2 - cx, vh / 2 - cy);
    if (s.interior) drawInterior(s, scale, vw, vh, cx, cy);
    else {
      c.fillStyle = COLORS.grass; c.fillRect(0, 0, WORLD.width, WORLD.height);
      c.fillStyle = COLORS.road; for (let i = 0; i < 10; i++) { const p = i * WORLD.cell; c.fillRect(p, 0, WORLD.road, WORLD.height); c.fillRect(0, p, WORLD.width, WORLD.road); }
      c.strokeStyle = COLORS.line; c.lineWidth = 2; c.setLineDash([20, 20]); for (let i = 0; i < 10; i++) { const m = i * WORLD.cell + WORLD.road / 2; c.beginPath(); c.moveTo(m, 0); c.lineTo(m, WORLD.height); c.moveTo(0, m); c.lineTo(WORLD.width, m); c.stroke(); } c.setLineDash([]);
      for (const b of s.buildings) { c.fillStyle = '#00000028'; c.fillRect(b.x + 9, b.y + 12, b.w, b.h); c.fillStyle = b.color; c.fillRect(b.x, b.y, b.w, b.h); c.fillStyle = COLORS.roof; c.fillRect(b.x + 12, b.y + 12, b.w - 24, b.h - 24); c.fillStyle = '#d8c59c'; for (let x = b.x + 20; x < b.x + b.w - 10; x += 34) { c.fillRect(x, b.y + 7, 12, 5); c.fillRect(x, b.y + b.h - 12, 12, 5); } c.fillStyle = b.accessible ? '#f3d28c' : '#725c47'; c.fillRect(b.entrance.x - 8, b.y + b.h - 3, 16, 7); }
      for (const v of s.vehicles) if (v.parked) vehicle(c, v);
      for (const p of s.police) vehicle(c, p, true);
      for (const enemy of s.enemies) if (enemy.active) {
        c.save(); c.translate(enemy.x, enemy.y); c.rotate(enemy.angle); c.fillStyle = enemy.hitFlash > 0 ? '#fff2dd' : '#442c2a'; c.beginPath(); c.arc(0, 0, 12, 0, Math.PI * 2); c.fill(); c.fillStyle = '#bc6658'; c.fillRect(-9, -5, 18, 13); c.fillStyle = '#e1b18d'; c.beginPath(); c.arc(3, -4, 6, 0, Math.PI * 2); c.fill(); c.restore();
        if (enemy.health < enemy.maxHealth) { c.fillStyle = '#241d1b'; c.fillRect(enemy.x - 15, enemy.y - 20, 30, 4); c.fillStyle = '#e27662'; c.fillRect(enemy.x - 15, enemy.y - 20, 30 * enemy.health / enemy.maxHealth, 4); }
      }
      if (s.mission?.active) { const target = s.mission.stage === 'pickup' ? s.mission.pickup : s.mission.dropoff; c.strokeStyle = '#f4c55f'; c.lineWidth = 3; c.beginPath(); c.arc(target.x, target.y, 18 + Math.sin(s.time * 3) * 3, 0, Math.PI * 2); c.stroke(); c.fillStyle = '#f4c55f'; c.fillRect(target.x - 3, target.y - 3, 6, 6); }
      if (s.inCar) vehicle(c, s.car); else { c.save(); c.translate(s.player.x, s.player.y); c.rotate(s.player.angle); c.fillStyle = '#202326'; c.beginPath(); c.ellipse(0, 0, 11, 14, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = '#e7bd83'; c.beginPath(); c.arc(3, -2, 7, 0, Math.PI * 2); c.fill(); c.fillStyle = '#52a3a0'; c.fillRect(-9, -6, 12, 12); c.restore(); }
      options.drawWeapons?.(c, s);
      if (s.worldEffects.dark) { c.fillStyle = '#09131f88'; c.fillRect(0, 0, WORLD.width, WORLD.height); }
      if (s.worldEffects.rain) { c.strokeStyle = '#b8d2e866'; c.lineWidth = 1; for (let i = 0; i < 75; i++) { const x = (i * 137 + s.time * 210) % WORLD.width, y = (i * 223 + s.time * 400) % WORLD.height; c.beginPath(); c.moveTo(x, y); c.lineTo(x - 4, y + 13); c.stroke(); } }
    }
    c.restore(); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = '#172023e8'; c.fillRect(16, 16, Math.min(w - 32, 430), 172);
    label(c, 'LOWTIDE RUN', 30, 42, 18, COLORS.accent, 700);
    label(c, `$${s.player.money}`, 30, 68, 16, '#f4f0e5', 700); label(c, `HEALTH  ${Math.ceil(s.player.health)}%`, 130, 68, 14); label(c, `STAMINA  ${Math.ceil(s.player.stamina)}%`, 270, 68, 12, '#d4dbd2');
    label(c, s.location, 30, 94, 13, '#c0c8bd');
    label(c, 'WANTED', 30, 119, 12, '#c0c8bd', 700); for (let i = 0; i < 5; i++) label(c, i < s.wanted ? '★' : '☆', 94 + i * 24, 121, 20, i < s.wanted ? '#f0bd54' : '#65716c', 700);
    label(c, s.inCar ? `IN VEHICLE  ${s.car.model.name}  ·  ${Math.round(Math.abs(s.car.speed) * 0.32)} km/h` : s.interior ? 'ON FOOT' : 'ON FOOT', 30, 143, 12, '#d4dbd2');
    const gun = options.weapon; if (gun) label(c, `${gun.name.toUpperCase()}  ${s.cheats.infiniteAmmo ? '∞ AMMO' : gun.clip === Infinity ? '∞' : `${gun.clip} / ${gun.reserve}`}${gun.reloading ? '  RELOADING' : ''}`, 30, 164, 12, '#f0d08b', 700);
    if (s.mission?.active) label(c, s.mission.stage === 'pickup' ? 'JOB  Collect the quay parcel' : 'JOB  Deliver parcel to Breakwater', 212, 119, 11, '#f2cf7e');
    if (s.notification && s.notificationTime > 0) label(c, s.notification, w / 2, h - 96, 14, '#f4d38d', 700);
    if (s.interaction) { const width = Math.min(w - 32, 410); c.fillStyle = '#172023e8'; c.fillRect((w - width) / 2, h - 78, width, 46); label(c, s.interaction, (w - width) / 2 + 15, h - 49, 15, '#f5dda4', 700); }
    if (!s.inCar && !s.interior) { label(c, 'WASD move  ·  IJKL aim  ·  Click shoot  ·  R reload', 20, h - 34, 12, '#e3e7de'); label(c, 'F attack  ·  Hold TAB weapon wheel  ·  P / Esc pause', 20, h - 16, 12, '#e3e7de'); }
    else if (s.inCar) label(c, 'W accelerate  ·  S brake/reverse  ·  A/D steer  ·  Space handbrake  ·  E exit', 20, h - 18, 12, '#e3e7de');
    if (s.wanted) { const remain = Math.max(0, (s.wanted === 1 ? 18 : 25) - s.escapeTime); label(c, s.alert || 'Police searching', 18, 198, 13, '#f5c66f', 700); label(c, `Stay out of sight  ${Math.ceil(remain)}s`, 18, 218, 12); }
    if (s.settings?.brightness < 1) { c.fillStyle = `rgba(0,0,0,${1 - s.settings.brightness})`; c.fillRect(0, 0, w, h); }
    if (options.aimPointer && !paused) { const p = options.aimPointer; c.strokeStyle = '#fff2cb'; c.lineWidth = 1.5; c.beginPath(); c.arc(p.x, p.y, 7, 0, Math.PI * 2); c.moveTo(p.x - 11, p.y); c.lineTo(p.x - 4, p.y); c.moveTo(p.x + 4, p.y); c.lineTo(p.x + 11, p.y); c.moveTo(p.x, p.y - 11); c.lineTo(p.x, p.y - 4); c.moveTo(p.x, p.y + 4); c.lineTo(p.x, p.y + 11); c.stroke(); }
    if (paused && !options.pauseMenu) { c.fillStyle = '#101819b8'; c.fillRect(0, 0, w, h); label(c, 'PAUSED', w / 2 - 54, h / 2, 32); label(c, 'Press P or Escape to continue', w / 2 - 118, h / 2 + 30, 15); }
  }
  function screenToWorld(point, state) {
    const scale = Math.min(w / 1100, h / 760), vw = w / scale, vh = h / scale, follow = state.inCar ? state.car : state.player;
    const cx = Math.max(vw / 2, Math.min(WORLD.width - vw / 2, follow.x)), cy = Math.max(vh / 2, Math.min(WORLD.height - vh / 2, follow.y));
    return { x: cx + (point.x - w / 2) / scale, y: cy + (point.y - h / 2) / scale };
  }
  resize(); window.addEventListener('resize', resize); return { draw, screenToWorld, surface() { return { context: c, width: w, height: h, dpr }; } };
}
