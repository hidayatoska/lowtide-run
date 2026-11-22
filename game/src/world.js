import { WORLD, COLORS } from './config.js';

const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const TYPES = [
  { type: 'home', name: 'Driftwood House', color: '#b98f6c', w: 174, h: 142 },
  { type: 'shop', name: 'Corner Market', color: '#9d8d68', w: 184, h: 152 },
  { type: 'workshop', name: 'Tideway Garage', color: '#857b6c', w: 196, h: 152 },
];
const CAR_MODELS = [
  { name: 'Harbor Compact', color: '#d2784c', maxSpeed: 275, accel: 230, turn: 2.6, grip: 3.6 },
  { name: 'Bayline Coupe', color: '#57948c', maxSpeed: 340, accel: 255, turn: 2.25, grip: 2.6 },
  { name: 'Oldtown Wagon', color: '#c5b46c', maxSpeed: 225, accel: 190, turn: 2.85, grip: 4.2 },
  { name: 'Patrol Unit', color: '#e8e7da', maxSpeed: 300, accel: 230, turn: 2.45, grip: 3.5 },
];

function rectHit(x, y, r, b) {
  const px = clamp(x, b.x, b.x + b.w), py = clamp(y, b.y, b.y + b.h);
  return (x - px) ** 2 + (y - py) ** 2 < r * r;
}
function makeInterior(type) {
  const layouts = {
    home: { floor: '#b99d78', rooms: [{ x: 30, y: 30, w: 460, h: 300, color: '#c8ad86' }, { x: 30, y: 350, w: 215, h: 190, color: '#ad9877' }, { x: 275, y: 350, w: 215, h: 190, color: '#ad9877' }], furniture: [{ kind: 'sofa', x: 95, y: 105, w: 140, h: 58 }, { kind: 'table', x: 285, y: 125, w: 84, h: 54 }, { kind: 'bed', x: 70, y: 405, w: 120, h: 85 }, { kind: 'bed', x: 325, y: 405, w: 120, h: 85 }] },
    shop: { floor: '#8b8068', rooms: [{ x: 28, y: 30, w: 464, h: 510, color: '#a69a7c' }], furniture: [{ kind: 'counter', x: 350, y: 120, w: 100, h: 265 }, { kind: 'shelf', x: 70, y: 90, w: 72, h: 315 }, { kind: 'shelf', x: 190, y: 90, w: 72, h: 315 }] },
    workshop: { floor: '#777a72', rooms: [{ x: 28, y: 30, w: 464, h: 510, color: '#92958b' }], furniture: [{ kind: 'bench', x: 74, y: 100, w: 175, h: 55 }, { kind: 'tool', x: 345, y: 95, w: 100, h: 70 }, { kind: 'car', x: 174, y: 265, w: 180, h: 100 }] },
  };
  return layouts[type];
}

export function createWorld() {
  const buildings = [], vehicles = [], police = [];
  const types = ['home', 'home', 'shop', 'workshop'];
  let n = 0;
  for (let gx = 0; gx < 9; gx++) for (let gy = 0; gy < 9; gy++) {
    const pick = TYPES[(gx * 7 + gy * 11) % TYPES.length];
    const type = types[(gx + gy * 2) % types.length];
    const x = gx * WORLD.cell + WORLD.road + 25, y = gy * WORLD.cell + WORLD.road + 28;
    const accessible = (gx + gy) % 3 !== 1;
    const b = { id: n++, x, y, w: pick.w, h: pick.h, color: pick.color, type, name: type === 'home' ? `Driftwood ${String.fromCharCode(65 + (gx + gy) % 26)}` : type === 'shop' ? 'Corner Market' : 'Tideway Garage', accessible, entrance: { x: x + pick.w / 2, y: y + pick.h + 13 }, interior: makeInterior(type) };
    buildings.push(b);
  }
  const park = (x, y, angle, model) => vehicles.push({ id: vehicles.length, x, y, angle, speed: 0, parked: true, stolen: false, damage: 0, model: { ...CAR_MODELS[model % 3] } });
  for (let i = 0; i < 9; i++) {
    const p = i * WORLD.cell;
    park(p + 177, 55, 0, i); park(p + 270, p + 184, Math.PI / 2, i + 1); park(p + 58, p + 264, -Math.PI / 2, i + 2);
  }
  const player = { x: 100, y: 55, angle: 0, aimAngle: 0, health: 100, stamina: 100, money: 250, speed: 0 };
  const enemies = [
    [840, 55], [1040, 380], [1420, 695], [1880, 1016], [2300, 1376], [620, 2096], [2670, 2530],
  ].map(([x, y], id) => ({ id, x, y, angle: Math.PI, health: 65, maxHealth: 65, active: true, stagger: 0, hitFlash: 0, attackCooldown: 0 }));
  const state = {
    player, car: { x: player.x, y: player.y, angle: 0, speed: 0, model: CAR_MODELS[0], parked: false }, inCar: false,
    vehicles, police, buildings, enemies, wanted: 0, escapeTime: 0, lostTime: 0, location: 'South Quay', interior: null,
    interaction: '', alert: '', time: 0, cheats: {}, settings: { brightness: 1 }, worldEffects: { dark: false, rain: false },
    mission: { active: true, stage: 'pickup', pickup: { x: 950, y: 55 }, dropoff: { x: 2830, y: 695 }, reward: 1200 }, notification: '',
  };
  let attackCooldown = 0;

  function collidesBuilding(x, y, r) { return buildings.some(b => rectHit(x, y, r, b)); }
  function collidesVehicle(x, y, r, ignore = null) {
    for (const v of vehicles) if (v !== ignore && distance({ x, y }, v) < r + 20) return v;
    for (const p of police) if (p !== ignore && distance({ x, y }, p) < r + 21) return p;
    return null;
  }
  function legalMove(x, y, r, ignore) { return x > r && y > r && x < WORLD.width - r && y < WORLD.height - r && !collidesBuilding(x, y, r) && !collidesVehicle(x, y, r, ignore); }
  function setWanted(amount) { state.wanted = clamp(state.wanted + amount, 0, 5); if (amount > 0) { state.escapeTime = 0; state.lostTime = 0; state.alert = 'Crime reported'; } }
  function policeWantedCount() { return state.wanted === 0 ? 0 : Math.min(10, state.wanted === 1 ? 1 : state.wanted === 2 ? 2 : state.wanted + 2); }
  function spawnPolice() {
    if (state.cheats.disablePolice) return;
    const wanted = policeWantedCount();
    while (police.length < wanted) {
      const angle = (police.length * 2.399 + state.time) % TAU;
      let x = clamp(player.x + Math.cos(angle) * 470, 45, WORLD.width - 45);
      let y = clamp(player.y + Math.sin(angle) * 470, 45, WORLD.height - 45);
      if (collidesBuilding(x, y, 24)) { x = clamp(Math.round(x / WORLD.cell) * WORLD.cell + WORLD.road / 2, 45, WORLD.width - 45); y = clamp(Math.round(y / WORLD.cell) * WORLD.cell + WORLD.road / 2, 45, WORLD.height - 45); }
      police.push({ x, y, angle: Math.atan2(player.y - y, player.x - x), speed: 0, model: { ...CAR_MODELS[3] }, target: player, siren: 0 });
    }
    if (state.wanted === 0) police.length = 0;
  }
  function nearestInteraction() {
    const actor = state.inCar ? state.car : player;
    let best = null, bestD = Infinity;
    if (state.interior) {
      const d = Math.hypot(player.x - 260, player.y - 515);
      if (d < 80) return { kind: 'exit', distance: d, label: 'E  Exit to street' };
      return null;
    }
      if (state.mission?.active) {
      const target = state.mission.stage === 'pickup' ? state.mission.pickup : state.mission.dropoff;
      const d = distance(actor, target);
      if (d < 60) return { kind: 'mission', distance: d, label: state.mission.stage === 'pickup' ? 'E  Collect quay parcel' : 'E  Deliver parcel' };
    }
    if (!state.inCar) {
      for (const v of vehicles) if (v.parked) {
        const d = distance(actor, v);
        if (d < 62 && d < bestD) { bestD = d; best = { kind: 'vehicle', target: v, distance: d, label: `E  Steal ${v.model.name}` }; }
      }
      for (const b of buildings) if (b.accessible) {
        const d = distance(actor, b.entrance);
        if (d < 68 && d < bestD) { bestD = d; best = { kind: 'building', target: b, distance: d, label: `E  Enter ${b.name}` }; }
      }
    }
    return best;
  }
  function enterInterior(b) {
    state.interior = b;
    player.x = 260; player.y = 476; player.angle = -Math.PI / 2;
    state.location = b.name;
  }
  function leaveInterior() {
    const b = state.interior;
    state.interior = null;
    player.x = b.entrance.x; player.y = b.entrance.y; player.angle = Math.PI / 2;
    state.location = 'South Quay';
  }
  function interact() {
    if (state.interior) { if (Math.hypot(player.x - 260, player.y - 515) < 80) leaveInterior(); return; }
    if (state.mission?.active) {
      const actor = state.inCar ? state.car : player;
      const target = state.mission.stage === 'pickup' ? state.mission.pickup : state.mission.dropoff;
      if (distance(actor, target) < 60) {
        if (state.mission.stage === 'pickup') { state.mission.stage = 'dropoff'; state.notification = 'Parcel collected · deliver it to Breakwater'; }
        else { state.mission.active = false; player.money += state.mission.reward; state.notification = `Delivery complete · $${state.mission.reward} earned`; }
        return;
      }
    }
    if (state.inCar) {
      const side = state.car.angle + Math.PI / 2;
      const x = state.car.x + Math.cos(side) * 36, y = state.car.y + Math.sin(side) * 36;
      if (legalMove(x, y, 10, state.car)) { state.inCar = false; player.x = x; player.y = y; player.angle = state.car.angle; state.car.speed = 0; }
      return;
    }
    const choice = nearestInteraction();
    if (!choice) return;
    if (choice.kind === 'vehicle') {
      state.inCar = true; choice.target.parked = false; choice.target.stolen = true;
      state.car = choice.target; setWanted(1); spawnPolice();
    } else if (choice.kind === 'building') enterInterior(choice.target);
  }
  function moveFoot(dt, input) {
    const dx = Number(input.down('KeyD', 'ArrowRight')) - Number(input.down('KeyA', 'ArrowLeft'));
    const dy = Number(input.down('KeyS', 'ArrowDown')) - Number(input.down('KeyW', 'ArrowUp'));
    if (dx || dy) {
      const len = Math.hypot(dx, dy); player.angle = Math.atan2(dy, dx);
      const sprint = input.down('ShiftLeft', 'ShiftRight') && player.stamina > 0;
      const speed = state.cheats.superSpeed ? 300 : sprint ? 265 : 170;
      const canMove = (x, y) => state.interior ? x > 30 && y > 30 && x < 490 && y < 530 : legalMove(x, y, 10);
      const mx = player.x + dx / len * speed * dt, my = player.y + dy / len * speed * dt;
      if (canMove(mx, player.y)) player.x = mx;
      if (canMove(player.x, my)) player.y = my;
      if (sprint && !state.cheats.infiniteStamina) player.stamina = Math.max(0, player.stamina - dt * 16);
      else player.stamina = Math.min(100, player.stamina + dt * 10);
    }
  }
  function moveCar(dt, input) {
    const car = state.car, m = car.model;
    const throttle = Number(input.down('KeyW', 'ArrowUp')) - Number(input.down('KeyS', 'ArrowDown'));
    const steer = Number(input.down('KeyD', 'ArrowRight')) - Number(input.down('KeyA', 'ArrowLeft'));
    const handbrake = input.down('Space');
    car.speed += throttle * m.accel * dt;
    car.speed *= Math.max(0, 1 - (handbrake ? 2.8 : throttle === 0 ? 0.62 : 0.1) * dt);
    const maxSpeed = m.maxSpeed * (state.cheats.superVehicleSpeed ? 1.55 : 1);
    car.speed = clamp(car.speed, -maxSpeed * 0.42, maxSpeed);
    car.angle += steer * m.turn * dt * (0.28 + Math.min(1, Math.abs(car.speed) / 90)) * (car.speed < 0 ? -1 : 1) * (handbrake ? 1.55 : 1);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt, ny = car.y + Math.sin(car.angle) * car.speed * dt;
    let hit = false;
    if (legalMove(nx, car.y, 21, car)) car.x = nx; else hit = true;
    if (legalMove(car.x, ny, 21, car)) car.y = ny; else hit = true;
    if (hit) { car.speed *= -0.18; if (!state.cheats.vehicleGodMode) car.damage = Math.min(100, car.damage + Math.abs(car.speed) * 0.008); if (Math.abs(car.speed) > 110 && !state.cheats.godMode && !state.cheats.infiniteHealth) player.health = Math.max(1, player.health - dt * 8); }
    if (handbrake) car.speed *= Math.max(0, 1 - 3 * dt);
  }
  function updatePolice(dt) {
    if (state.cheats.disablePolice) { police.length = 0; return; }
    spawnPolice();
    const actor = state.inCar ? state.car : player;
    const roadCenter = value => clamp(Math.round((value - WORLD.road / 2) / WORLD.cell), 0, 9) * WORLD.cell + WORLD.road / 2;
    const targetRoadX = roadCenter(actor.x), targetRoadY = roadCenter(actor.y);
    let seen = false;
    for (const p of police) {
      const d = distance(p, actor);
      if (d < 520 && !buildings.some(b => segmentHitsRect(p, actor, b))) seen = true;
      if (state.cheats.freezePolice) { p.speed = 0; continue; }
      const policeRoadY = roadCenter(p.y), policeRoadX = roadCenter(p.x);
      let waypoint;
      if (Math.abs(p.y - targetRoadY) < 20) waypoint = { x: actor.x, y: targetRoadY };
      else if (Math.abs(p.x - targetRoadX) > 22) waypoint = { x: targetRoadX, y: policeRoadY };
      else waypoint = { x: targetRoadX, y: targetRoadY };
      const desired = Math.atan2(waypoint.y - p.y, waypoint.x - p.x);
      let turn = Math.atan2(Math.sin(desired - p.angle), Math.cos(desired - p.angle));
      p.angle += clamp(turn, -2.1 * dt, 2.1 * dt);
      const speed = state.wanted === 1 ? 95 : state.wanted === 2 ? 135 : 175 + state.wanted * 13;
      p.speed = Math.min(speed, p.speed + 100 * dt);
      const nx = p.x + Math.cos(p.angle) * p.speed * dt, ny = p.y + Math.sin(p.angle) * p.speed * dt;
      if (legalMove(nx, p.y, 22, p)) p.x = nx; else p.angle += 0.95;
      if (legalMove(p.x, ny, 22, p)) p.y = ny; else p.angle -= 0.7;
      p.siren += dt;
      if (d < 35) {
        if (state.inCar) { state.car.speed *= 0.94; if (!state.cheats.vehicleGodMode) state.car.damage = Math.min(100, state.car.damage + dt * 3); }
        else if (!state.cheats.godMode && !state.cheats.infiniteHealth) player.health = Math.max(1, player.health - dt * 4);
      }
    }
    if (state.wanted > 0) {
      if (seen) { state.lostTime = 0; state.escapeTime = 0; }
      else { state.lostTime += dt; state.escapeTime += dt; }
      const wait = state.wanted === 1 ? 18 : 25;
      if (state.escapeTime >= wait) { state.wanted--; state.escapeTime = 0; state.alert = state.wanted ? 'Police search continues' : 'You lost the police'; }
    }
  }
  function segmentHitsRect(a, b, r) {
    const steps = 8;
    for (let i = 1; i < steps; i++) { const t = i / steps; if (a.x + (b.x - a.x) * t > r.x && a.x + (b.x - a.x) * t < r.x + r.w && a.y + (b.y - a.y) * t > r.y && a.y + (b.y - a.y) * t < r.y + r.h) return true; }
    return false;
  }
  function step(dt, input, interaction = 0) {
    state.time += dt;
    attackCooldown -= dt;
    if (state.cheats.infiniteHealth) player.health = 100;
    if (state.cheats.infiniteStamina) player.stamina = 100;
    if (state.notification) { state.notificationTime = (state.notificationTime || 2.5) - dt; if (state.notificationTime <= 0) { state.notification = ''; state.notificationTime = 0; } }
    if (interaction) interact();
    if (state.interior) {
      moveFoot(dt, input);
      const bounds = state.interior.interior;
      player.x = clamp(player.x, 44, 476); player.y = clamp(player.y, 44, 510);
      for (const f of bounds.furniture) if (rectHit(player.x, player.y, 10, f)) { player.x -= Math.cos(player.angle) * 3; player.y -= Math.sin(player.angle) * 3; }
    } else if (state.inCar) moveCar(dt, input); else moveFoot(dt, input);
    if (!state.interior && input.down('KeyF') && attackCooldown <= 0 && !state.inCar) {
      const cop = police.find(p => distance(player, p) < 45);
      const car = vehicles.find(v => v.parked && distance(player, v) < 48);
      if (cop || car) { setWanted(1); attackCooldown = 1.1; state.alert = cop ? 'Officer assaulted' : 'Vehicle vandalized'; if (cop) cop.speed = 0; else car.damage = Math.min(100, car.damage + 30); }
    }
    if (!state.interior) for (const enemy of enemies) {
      if (!enemy.active) continue;
      enemy.stagger = Math.max(0, enemy.stagger - dt); enemy.hitFlash = Math.max(0, enemy.hitFlash - dt); enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);
      const actor = state.inCar ? state.car : player, d = distance(enemy, actor);
      if (d < 620 && enemy.stagger === 0 && !state.cheats.freezeEnemies) {
        enemy.angle = Math.atan2(actor.y - enemy.y, actor.x - enemy.x);
        const nx = enemy.x + Math.cos(enemy.angle) * 64 * dt, ny = enemy.y + Math.sin(enemy.angle) * 64 * dt;
        if (legalMove(nx, enemy.y, 10)) enemy.x = nx;
        if (legalMove(enemy.x, ny, 10)) enemy.y = ny;
      }
      if (d < 32 && enemy.attackCooldown === 0) { enemy.attackCooldown = 1.2; if (!state.cheats.godMode && !state.cheats.infiniteHealth && !state.inCar) player.health = Math.max(1, player.health - 8); }
    }
    if (!state.interior) {
      updatePolice(dt);
      const actor = state.inCar ? state.car : player;
      const districts = [['South Quay', 'Market Row', 'North Docks'], ['Oldtown', 'Canal Ward', 'East Market'], ['Tide Flats', 'Harbor Point', 'Breakwater']];
      const col = clamp(Math.floor(actor.x / (WORLD.width / 3)), 0, 2), row = clamp(Math.floor(actor.y / (WORLD.height / 3)), 0, 2);
      state.location = districts[row][col];
    }
    const nearby = nearestInteraction();
    state.interaction = state.interior ? (Math.hypot(player.x - 260, player.y - 515) < 80 ? 'E  Exit to street' : 'Find the exit door') : nearby?.label || (state.inCar ? 'E  Exit vehicle' : input.down('KeyF') ? 'F  Attack nearby' : '');
    return state;
  }
  return { state, step };
}
