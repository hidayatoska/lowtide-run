import * as THREE from 'three';

const DEFINITIONS = [
  { id: 'unarmed', name: 'Unarmed', kind: 'melee', damage: 12, range: 2.1, rate: 0.52 },
  { id: 'pistol', name: 'Pistol', kind: 'single', damage: 28, range: 58, rate: 0.34, clipSize: 12, reserveSize: 48, reserveCapacity: 120, reload: 0.9 },
  { id: 'smg', name: 'SMG', kind: 'single', damage: 11, range: 48, rate: 0.095, clipSize: 30, reserveSize: 120, reserveCapacity: 240, reload: 1.15 },
  { id: 'shotgun', name: 'Shotgun', kind: 'spread', damage: 13, range: 25, rate: 0.78, clipSize: 8, reserveSize: 32, reserveCapacity: 64, reload: 1.25 },
  { id: 'rifle', name: 'Assault Rifle', kind: 'single', damage: 19, range: 78, rate: 0.15, clipSize: 30, reserveSize: 120, reserveCapacity: 240, reload: 1.25 },
  { id: 'sniper', name: 'Sniper Rifle', kind: 'single', damage: 65, range: 115, rate: 1.05, clipSize: 5, reserveSize: 20, reserveCapacity: 40, reload: 1.5 },
];

export function createWeaponManager({ scene, player, pedestrians, wanted, notify, onNpcKilled = () => {}, aimYaw = () => player.facing }) {
  const defs = new Map(DEFINITIONS.map(item => [item.id, item]));
  const owned = new Set(['unarmed', 'pistol']);
  const ammo = Object.fromEntries(DEFINITIONS.filter(item => item.clipSize).map(item => [item.id, { clip: item.clipSize, reserve: item.reserveSize }]));
  const debugUnlock = new URLSearchParams(location.search).get('unlockWeapons') === '1' || window.LOWTIDE_DEBUG_UNLOCK_ALL_WEAPONS === true;
  let current = 'unarmed', cooldown = 0, reloadTimer = 0, switchTimer = 0, attackPose = 0;
  const model = new THREE.Group();
  model.name = 'Procedural held weapon';
  const metal = new THREE.MeshStandardMaterial({ color: '#303638', metalness: 0.62, roughness: 0.38 });
  const grip = new THREE.MeshStandardMaterial({ color: '#705642', roughness: 0.88 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.48), metal);
  body.position.set(0.34, 1.17, -0.33); body.castShadow = true; model.add(body);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.28, 8), metal);
  barrel.rotation.x = Math.PI / 2; barrel.position.set(0.34, 1.17, -0.68); model.add(barrel);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 0.12), grip);
  handle.position.set(0.34, 1.02, -0.22); model.add(handle);
  player.visual.add(model);
  const unlocked = id => defs.has(id) && (owned.has(id) || debugUnlock);
  function status(id = current) {
    const d = defs.get(id), a = ammo[id];
    return { ...d, owned: owned.has(id) || debugUnlock, selected: current === id, clip: a?.clip ?? Infinity, reserve: a?.reserve ?? Infinity, reloading: current === id && reloadTimer > 0, reloadProgress: current === id && reloadTimer > 0 ? 1 - reloadTimer / d.reload : 0 };
  }
  function select(id) {
    if (!unlocked(id) || id === current) return false;
    current = id; reloadTimer = 0; cooldown = 0; switchTimer = 0.22; model.visible = id !== 'unarmed';
    const d = defs.get(id), long = id === 'shotgun' || id === 'rifle' || id === 'sniper';
    body.scale.set(long ? 1.8 : 1, 1, 1); barrel.scale.y = long ? 1.5 : 1;
    if (d) notify(`${d.name} equipped`);
    return true;
  }
  function beginReload() {
    const d = defs.get(current), a = ammo[current];
    if (!a || reloadTimer > 0 || cooldown > 0.08 || a.clip >= d.clipSize || a.reserve <= 0) return false;
    reloadTimer = d.reload; notify('Reloading'); return true;
  }
  function attack() {
    const d = defs.get(current), a = ammo[current];
    if (switchTimer > 0 || reloadTimer > 0 || cooldown > 0) return;
    if (a && a.clip <= 0) { notify('Magazine empty · press R'); return; }
    if (a) a.clip--;
    cooldown = d.rate;
    attackPose = current === 'unarmed' ? 0.28 : 0.12;
    if (current === 'unarmed') player.punch();
    const origin = player.position(), heading = aimYaw();
    player.setFacing(heading);
    const targets = pedestrians.agents.filter(agent => agent.state !== 'RESPAWN').map(agent => {
      const dx = agent.x - origin.x, dz = agent.z - origin.z;
      const distance = Math.hypot(dx, dz), angle = Math.atan2(-dx, -dz);
      const delta = Math.atan2(Math.sin(angle - heading), Math.cos(angle - heading));
      return { agent, distance, delta };
    }).filter(target => target.distance <= d.range && Math.abs(target.delta) < (d.kind === 'melee' ? 0.72 : current === 'sniper' ? 0.035 : 0.095))
      .sort((a, b) => a.distance - b.distance);
    const count = d.kind === 'spread' ? 3 : 1;
    const hit = targets.slice(0, count);
    if (hit.length) {
      for (const { agent } of hit) {
        agent.health = (agent.health ?? 100) - d.damage;
        if (agent.health <= 0) {
          agent.state = 'RESPAWN'; agent.recovery = 3.4; agent.deathCause = 'player';
          wanted.addCrimeType('npcKill', 'Wanted level increased');
          onNpcKilled(agent);
        }
        else {
          const along = agent.lane.axis === 'x' ? agent.x - origin.x : agent.z - origin.z;
          const direction = Math.sign(along) || 1;
          agent.dest = direction > 0 ? agent.lane.max : agent.lane.min;
          agent.state = 'FLEE'; agent.fleeTime = 3;
          agent.heading = agent.lane.axis === 'x' ? (direction > 0 ? Math.PI / 2 : -Math.PI / 2) : (direction > 0 ? 0 : Math.PI);
        }
      }
      if (hit.some(({ agent }) => agent.health > 0)) wanted.addCrimeType('assault', 'Assault reported');
    } else if (current !== 'unarmed') wanted.addCrimeType('weaponDischarge', 'Weapon discharged · police alerted');
  }
  function update(dt, input, { enabled = true, inVehicle = false } = {}) {
    cooldown = Math.max(0, cooldown - dt); switchTimer = Math.max(0, switchTimer - dt); attackPose = Math.max(0, attackPose - dt);
    if (reloadTimer > 0) {
      reloadTimer = Math.max(0, reloadTimer - dt);
      if (reloadTimer === 0) { const d = defs.get(current), a = ammo[current], take = Math.min(d.clipSize - a.clip, a.reserve); a.clip += take; a.reserve -= take; }
    }
    if (!enabled || inVehicle) return;
    if (input.consumePressed('KeyR')) beginReload();
    if (input.consumePressed('Digit1')) select('unarmed');
    if (input.consumePressed('Digit2')) select('pistol');
    if (input.consumePressed('Digit3')) select('smg');
    if (input.consumePressed('Digit4')) select('shotgun');
    if (input.consumePressed('Digit5')) select('rifle');
    if (input.consumePressed('Digit6')) select('sniper');
    if (input.pointerHeld()) attack();
    model.visible = current !== 'unarmed';
    body.rotation.x = -attackPose * 1.3;
    model.position.y = Math.sin((current === 'unarmed' ? 1 : 0.5) * performance.now() / 360) * 0.009;
  }
  function unlock(id) { if (!defs.has(id)) return false; owned.add(id); return true; }
  function addReserve(id, amount) {
    const d = defs.get(id), a = ammo[id];
    if (!d || !a || !unlocked(id) || !Number.isFinite(amount) || amount <= 0) return 0;
    const added = Math.min(Math.floor(amount), Math.max(0, d.reserveCapacity - a.reserve));
    a.reserve += added;
    return added;
  }
  return { update, select, beginReload, status, unlock, addReserve, definitions: DEFINITIONS, unlocked, get ownedWeapons() { return [...owned]; }, get current() { return current; }, get debugUnlock() { return debugUnlock; } };
}
