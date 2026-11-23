const ROAD_LINES = [-160, -96, -32, 32, 96, 160];

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function nearestRoad(value) { return ROAD_LINES.reduce((a, b) => Math.abs(b - value) < Math.abs(a - value) ? b : a); }

function blockedSight(a, b, buildings) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const length2 = dx * dx + dz * dz;
  if (!length2) return false;
  return buildings.some(building => {
    const t = clamp(((building.x - a.x) * dx + (building.z - a.z) * dz) / length2, 0.04, 0.96);
    const x = a.x + dx * t, z = a.z + dz * t;
    return Math.abs(x - building.x) < building.w / 2 && Math.abs(z - building.z) < building.d / 2;
  });
}

export function createWantedSystem(vehicles, city, { notify = () => {}, onCaught = () => {}, crimeIncrements = {} } = {}) {
  let level = 0;
  let unseen = 0;
  let decayClock = 0;
  let catchCooldown = 0;
  let lastKnown = { x: -96, z: -32 };
  let lostSightFor = 0;
  let spawnCooldown = 0;
  const units = [];
  const responseCount = [0, 1, 2, 3, 4, 5];
  const crimeValues = { weaponDischarge: 1, assault: 0, vehicleTheft: 1, ...crimeIncrements, npcKill: 1 };

  function addCrime(amount = 1, message = '') {
    const increase = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
    const next = Math.min(5, level + increase);
    if (next !== level) {
      level = next;
      unseen = 0;
      decayClock = 0;
      notify(message || `Wanted level increased · ${level} star${level === 1 ? '' : 's'}`);
    }
    return level;
  }

  function addCrimeType(type, message = '') { return addCrime(crimeValues[type] ?? 0, message); }

  function spawn(position, index) {
    const roadX = nearestRoad(position.x);
    const roadZ = nearestRoad(position.z);
    const candidates = [
      { x: roadX, z: roadZ - 38 }, { x: roadX + 38, z: roadZ },
      { x: roadX, z: roadZ + 38 }, { x: roadX - 38, z: roadZ },
      { x: roadX + 38, z: roadZ - 38 },
    ];
    let point = candidates[index % candidates.length];
    if (Math.hypot(point.x - position.x, point.z - position.z) < 25) point = candidates[(index + 2) % candidates.length];
    point = { x: clamp(point.x, -190, 190), z: clamp(point.z, -190, 190) };
    const heading = Math.atan2(-(position.x - point.x), -(position.z - point.z));
    return vehicles.spawnPolice(point.x, point.z, heading);
  }

  function ensureUnits(position, dt) {
    const wantedCount = responseCount[level];
    while (units.length > wantedCount) vehicles.despawn(units.pop());
    spawnCooldown = Math.max(0, spawnCooldown - dt);
    if (units.length < wantedCount && spawnCooldown === 0) {
      units.push(spawn(position, units.length));
      spawnCooldown = 0.8;
    }
  }

  function step(dt, playerPosition, playerHeading = 0) {
    catchCooldown = Math.max(0, catchCooldown - dt);
    if (level === 0) {
      unseen = 0;
      lostSightFor = 0;
      while (units.length) vehicles.despawn(units.pop());
      spawnCooldown = 0;
      return;
    }

    if (!units.length) lastKnown = { x: playerPosition.x, z: playerPosition.z };
    let visible = false;
    for (const unit of units) {
      const p = unit.position();
      const distance = Math.hypot(p.x - playerPosition.x, p.z - playerPosition.z);
      if (distance < 54 && !blockedSight(p, playerPosition, city.buildings)) visible = true;
    }
    if (visible) {
      lastKnown = { x: playerPosition.x, z: playerPosition.z };
      unseen = 0;
      lostSightFor = 0;
    } else {
      unseen += dt;
      lostSightFor += dt;
    }
    ensureUnits(playerPosition, dt);

    const lead = level >= 3 && visible ? Math.min(12, level * 2.1) : 0;
    const pursuitTarget = { x: playerPosition.x - Math.sin(playerHeading) * lead, z: playerPosition.z - Math.cos(playerHeading) * lead };
    const searchTarget = visible ? pursuitTarget : lastKnown;
    for (let i = 0; i < units.length; i++) {
      const unit = units[i];
      const p = unit.position();
      const roadX = nearestRoad(p.x);
      const targetX = nearestRoad(searchTarget.x);
      const targetZ = nearestRoad(searchTarget.z);
      let waypoint;
      if (Math.abs(p.z - targetZ) > 8) waypoint = { x: roadX, z: targetZ };
      else if (Math.abs(p.x - targetX) > 8) waypoint = { x: targetX, z: targetZ };
      else waypoint = searchTarget;

      // If the final approach is through a building, hold at the nearest road until the
      // player moves back into the street. The city grid keeps the patrol from tunnelling.
      if (waypoint === searchTarget && blockedSight(p, searchTarget, city.buildings)) {
        waypoint = { x: targetX, z: targetZ };
      }
      const speed = 10.5 + Math.max(0, level - 1) * 2.8;
      vehicles.driveToward(unit, waypoint, dt, speed, 1.45 + level * 0.11);
      const distance = Math.hypot(p.x - playerPosition.x, p.z - playerPosition.z);
      if (distance < 3.2 && catchCooldown === 0) {
        catchCooldown = 4.5;
        onCaught(level);
        notify('Police caught up. You lost $100.');
      }
    }

    if (unseen >= 12) {
      decayClock += dt;
      if (decayClock >= 9) {
        decayClock = 0;
        level = Math.max(0, level - 1);
        notify(level ? `Police search easing — ${level} star${level === 1 ? '' : 's'} remain.` : 'You escaped the police.');
        if (level === 0) unseen = 0;
      }
    } else decayClock = 0;
  }

  return {
    addCrime,
    addCrimeType,
    crimeValues,
    step,
    get level() { return level; },
    get units() { return units; },
    get visible() { return level > 0 && unseen === 0; },
    get unseenFor() { return unseen; },
    get lastKnown() { return { ...lastKnown }; },
  };
}
