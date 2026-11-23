import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { buildCity } from './city.js';
import { createPlayer } from './player.js';
import { createFollowCamera } from './camera.js';
import { createInput } from './input.js';
import { createVehicles } from './vehicles.js';
import { createEconomy } from './economy.js';
import { createWantedSystem } from './wanted.js';
import { createMissionManager } from './missions.js';
import { createPedestrians } from './pedestrians.js';
import { createMinimap } from './minimap.js';
import { createWeaponManager } from './weapons.js';
import { createWeaponWheel } from './weaponWheel.js';
import { createPoliceHelicopter } from './helicopter.js';
import { createLootSystem } from './loot.js';
import './style.css';

const canvas = document.querySelector('#game');
const loading = document.querySelector('#loading');
const errorPanel = document.querySelector('#error-panel');
const healthFill = document.querySelector('#health-fill');
const healthValue = document.querySelector('#health-value');
const healthTrack = document.querySelector('#health-track');
const locationLabel = document.querySelector('#location');
const interaction = document.querySelector('#interaction');
const vehicleStatus = document.querySelector('#vehicle-status');
const controlsHint = document.querySelector('#controls-hint');
const moneyLabel = document.querySelector('#money-value');
const wantedStars = [...document.querySelectorAll('.wanted-star')];
const airUnitAlert = document.querySelector('#air-unit-alert');
const notification = document.querySelector('#notification');
const missionStatus = document.querySelector('#mission-status');
const deathOverlay = document.querySelector('#death-overlay');
const minimapCanvas = document.querySelector('#minimap');
const expandedMapCanvas = document.querySelector('#expanded-map');
const mapOverlay = document.querySelector('#map-overlay');
const mapOpenButton = document.querySelector('#map-open-button');
const mapCloseButton = document.querySelector('#map-close-button');
const mapClearButton = document.querySelector('#map-clear-button');
const minimapZoom = document.querySelector('#minimap-zoom');
const waypointLabel = document.querySelector('#waypoint-label');
const weaponHud = document.querySelector('#weapon-hud');
const weaponName = document.querySelector('#weapon-name');
const weaponAmmo = document.querySelector('#weapon-ammo');
const weaponReload = document.querySelector('#weapon-reload');

function showError(error) {
  console.error(error);
  errorPanel.hidden = false;
  errorPanel.textContent = `Lowtide Run could not start.\n${error?.stack || error}`;
  loading?.classList.add('done');
}

async function start() {
  if (!canvas || !window.WebGLRenderingContext) throw new Error('This browser does not provide WebGL support.');
  await RAPIER.init();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#9bbec0');
  scene.fog = new THREE.Fog('#b9c5b6', 180, 440);
  const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 600);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.7));
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene.add(new THREE.HemisphereLight('#e3ecdf', '#776d5a', 2.05));
  const sun = new THREE.DirectionalLight('#ffe4b2', 2.65);
  sun.position.set(-95, 125, -70);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -42; sun.shadow.camera.right = 42;
  sun.shadow.camera.top = 42; sun.shadow.camera.bottom = -42;
  sun.shadow.camera.near = 8; sun.shadow.camera.far = 260;
  sun.shadow.bias = -0.0005;
  scene.add(sun);

  const physics = new RAPIER.World({ x: 0, y: -18.5, z: 0 });
  physics.timestep = 1 / 60;
  const city = buildCity(scene, physics, RAPIER);
  const player = createPlayer(scene, RAPIER, physics);
  const vehicles = createVehicles(scene, RAPIER, physics, city);
  const economy = createEconomy();
  let notificationUntil = 0;
  function notify(message) {
    notification.textContent = message;
    notification.classList.add('visible');
    notificationUntil = performance.now() + 2600;
  }
  const wanted = createWantedSystem(vehicles, city, {
    notify,
    crimeIncrements: window.LOWTIDE_CRIME_VALUES ?? {},
    onCaught() {
      player.takeDamage(18, 'police');
      economy.spend(100);
    },
  });
  const helicopter = createPoliceHelicopter(scene, { notify });
  const missions = createMissionManager(scene, THREE, economy, { notify });
  const pedestrians = createPedestrians(scene, city, vehicles, player.position(), 20);
  let loot = null;
  const weapons = createWeaponManager({ scene, player, pedestrians, wanted, notify, onNpcKilled: agent => loot?.spawnForNpc(agent), aimYaw: () => followCamera.yaw });
  loot = createLootSystem({ scene, economy, weapons, city, notify, config: window.LOWTIDE_LOOT_CONFIG ?? {} });
  const weaponWheel = createWeaponWheel(document.querySelector('#game-root'), weapons);
  const minimap = createMinimap({
    miniCanvas: minimapCanvas,
    expandedCanvas: expandedMapCanvas,
    overlay: mapOverlay,
    openButton: mapOpenButton,
    closeButton: mapCloseButton,
    clearButton: mapClearButton,
    zoomLabel: minimapZoom,
    waypointLabel,
    city, vehicles, missions, helicopterPosition: () => helicopter.position(),
  });
  const input = createInput(canvas);
  const followCamera = createFollowCamera(camera, city.buildingHitMeshes);
  const resizeObserver = new ResizeObserver(() => {
    const width = Math.max(1, innerWidth);
    const height = Math.max(1, innerHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.7));
    renderer.setSize(width, height, false);
  });
  resizeObserver.observe(document.documentElement);

  const fixedStep = 1 / 60;
  let previous = performance.now();
  let accumulator = 0;
  let animationFrame = 0;
  let running = true;
  let elapsed = 0;
  let frames = 0;
  let fpsTimer = 0;
  let averageFps = 0;
  let vehicleCameraOffset = 0;
  let theftCooldown = 0;
  let impactCooldown = 0;
  let deathStarted = false;
  let respawnAt = 0;
  const startTime = performance.now();

  function safeRespawnPoint() {
    const candidates = [{ x: -96, z: -32 }, ...city.roadLines.flatMap(x => city.roadLines.map(z => ({ x, z })))];
    for (const candidate of candidates) {
      if (!city.canStandAt(candidate.x, candidate.z, 0.75)) continue;
      if (vehicles.cars.some(car => { const p = car.position(); return Math.hypot(p.x - candidate.x, p.z - candidate.z) < 5.2; })) continue;
      if (pedestrians.agents.some(agent => Math.hypot(agent.x - candidate.x, agent.z - candidate.z) < 2.7)) continue;
      return { ...candidate, y: 0.95, heading: 0 };
    }
    return { x: -96, y: 0.95, z: -32, heading: 0 };
  }

  function beginDeath() {
    if (deathStarted) return;
    deathStarted = true;
    respawnAt = performance.now() + 3000;
    minimap.setOpen(false);
    input.clear();
    if (vehicles.active) vehicles.stopActive();
    player.setInVehicle(true);
    deathOverlay.hidden = false;
  }

  function respawnPlayer() {
    const spawn = safeRespawnPoint();
    player.respawn(spawn.x, spawn.y, spawn.z, spawn.heading);
    vehicleCameraOffset = 0;
    followCamera.setYaw(spawn.heading);
    followCamera.update(spawn, 1);
    deathStarted = false;
    deathOverlay.hidden = true;
    notify('You recovered.');
  }

  function checkFootVehicleImpact() {
    if (vehicles.active || impactCooldown > 0) return;
    const p = player.position();
    for (const car of vehicles.cars) {
      const speed = Math.abs(car.speed || 0);
      if (speed < 7) continue;
      const vehiclePosition = car.position();
      const dx = p.x - vehiclePosition.x, dz = p.z - vehiclePosition.z;
      const c = Math.cos(car.heading), s = Math.sin(car.heading);
      const localX = dx * c + dz * s;
      const localZ = -dx * s + dz * c;
      if (Math.abs(localX) > car.style.width * 0.54 + 0.48 || Math.abs(localZ) > car.style.length * 0.51 + 0.55) continue;
      const amount = THREE.MathUtils.clamp((speed - 4) * 1.8, 8, 42);
      player.takeDamage(amount, car.role === 'police' ? 'police vehicle impact' : 'vehicle impact');
      impactCooldown = 1.05;
      break;
    }
  }

  function frame(now) {
    if (!running) return;
    animationFrame = requestAnimationFrame(frame);
    const dt = Math.min((now - previous) / 1000, 0.05);
    previous = now;
    elapsed += dt;
    const mapWasOpen = minimap.isOpen;
    if (input.consumePressed('KeyM') && !player.isDead()) minimap.toggle();
    if (minimap.isOpen && input.consumePressed('Escape')) minimap.setOpen(false);
    if (minimap.isOpen) {
      if (input.consumePressed('Equal') || input.consumePressed('NumpadAdd')) minimap.changeZoom(-1);
      if (input.consumePressed('Minus') || input.consumePressed('NumpadSubtract')) minimap.changeZoom(1);
    }
    if (player.isDead()) {
      minimap.setOpen(false);
      if (!deathStarted) beginDeath();
      if (performance.now() >= respawnAt) respawnPlayer();
    }
    if (mapWasOpen || minimap.isOpen || player.isDead()) input.clear();
    const wheelOpen = weaponWheel.update(dt, input, { enabled: !minimap.isOpen && !player.isDead() && !vehicles.active });
    const pointer = input.consumePointer();
    const yawBeforePointer = followCamera.yaw;
    if (!minimap.isOpen && !player.isDead() && !wheelOpen && (pointer.x || pointer.y)) followCamera.rotate(pointer.x, pointer.y);
    if (!minimap.isOpen && !player.isDead() && !wheelOpen && pointer.wheel && vehicles.active) followCamera.zoom(pointer.wheel);
    if (!minimap.isOpen && !player.isDead() && !vehicles.active && pointer.wheel && !input.down('Tab')) {
      const ids = ['unarmed', 'pistol', 'smg', 'shotgun', 'rifle', 'sniper'];
      let index = ids.indexOf(weapons.current), direction = Math.sign(pointer.wheel);
      for (let i = 0; i < ids.length; i++) { index = (index + direction + ids.length) % ids.length; if (weapons.unlocked(ids[index])) { weapons.select(ids[index]); break; } }
    }
    if (vehicles.active && (pointer.x || pointer.y)) vehicleCameraOffset += followCamera.yaw - yawBeforePointer;
    if (minimap.isOpen || player.isDead()) accumulator = 0;
    else accumulator = Math.min(accumulator + dt, 0.12);
    let fixedSteps = 0;
    while (accumulator >= fixedStep && fixedSteps < 5) {
      if (player.isDead() || minimap.isOpen) { accumulator = 0; break; }
      if (wheelOpen) { accumulator -= fixedStep; fixedSteps++; continue; }
      const interactPressed = input.consumePressed('KeyE');
      theftCooldown = Math.max(0, theftCooldown - fixedStep);
      impactCooldown = Math.max(0, impactCooldown - fixedStep);
      let justExitedVehicle = false;
      const worldPosition = vehicles.active ? vehicles.active.position() : player.position();
      missions.setVehicleState(Boolean(vehicles.active));
      const pursuitHeading = vehicles.active ? vehicles.active.heading : player.facing;
      wanted.step(fixedStep, worldPosition, pursuitHeading);
      helicopter.step(fixedStep, wanted.level, worldPosition, wanted.visible, wanted.lastKnown, pursuitHeading);
      loot.update(fixedStep);
      if (player.isDead()) {
        beginDeath();
        accumulator -= fixedStep;
        fixedSteps++;
        continue;
      }
      const lootTarget = loot.nearby(worldPosition, Boolean(vehicles.active));
      const lootInteracted = Boolean(interactPressed && lootTarget && loot.collect(lootTarget.id, worldPosition, Boolean(vehicles.active)));
      const missionInteracted = !lootInteracted && interactPressed && missions.interact(worldPosition);
      missions.step(fixedStep, worldPosition, Boolean(vehicles.active));
      if (vehicles.active) {
        input.consumePressed('Space');
        if (interactPressed && !missionInteracted && !lootInteracted) {
          const exitPosition = vehicles.exit();
          if (exitPosition) {
            player.setInVehicle(false);
            player.setPosition(exitPosition.x, exitPosition.y, exitPosition.z, exitPosition.heading);
            justExitedVehicle = true;
          }
        }
      } else {
        const nearby = vehicles.nearest(player.position());
        if (interactPressed && !missionInteracted && !lootInteracted && nearby && vehicles.enter(nearby.vehicle)) {
          if (!nearby.vehicle.authorized && !nearby.vehicle.stolen && theftCooldown === 0) {
            nearby.vehicle.stolen = true;
            theftCooldown = 0.8;
            wanted.addCrimeType('vehicleTheft', 'Vehicle stolen! Police alerted.');
          }
          player.setInVehicle(true);
          vehicleCameraOffset = Math.atan2(
            Math.sin(followCamera.yaw - vehicles.active.heading),
            Math.cos(followCamera.yaw - vehicles.active.heading),
          );
        }
      }
      if (vehicles.active) {
        const speedBefore = Math.abs(vehicles.active.speed);
        vehicles.fixedStep(fixedStep, input);
        const speedAfter = Math.abs(vehicles.active.speed);
        const impact = speedBefore - speedAfter;
        if (speedBefore > 11 && impact > 8 && impactCooldown <= 0) {
          player.takeDamage(THREE.MathUtils.clamp((impact - 4) * 2.15, 8, 55), 'vehicle collision');
          impactCooldown = 1.0;
        }
      } else if (justExitedVehicle) physics.step();
      else {
        checkFootVehicleImpact();
        if (!player.isDead()) player.step(fixedStep, input, followCamera.yaw);
      }
      vehicles.syncVisuals();
      weapons.update(fixedStep, input, { enabled: !minimap.isOpen && !wheelOpen, inVehicle: Boolean(vehicles.active) });
      if (player.isDead()) beginDeath();
      else pedestrians.step(fixedStep);
      accumulator -= fixedStep;
      fixedSteps++;
    }

    if (vehicles.active) followCamera.setYaw(vehicles.active.heading + vehicleCameraOffset);
    const p = vehicles.active ? vehicles.active.position() : player.position();
    followCamera.update(p, dt);
    renderer.render(scene, camera);
    minimap.render(p, vehicles.active ? vehicles.active.heading : player.facing);
    locationLabel.textContent = city.locationAt(p.x, p.z);
    const health = Math.round(player.health);
    healthValue.textContent = String(health);
    healthFill.style.width = `${health}%`;
    healthTrack.classList.toggle('healthy', health >= 50);
    healthTrack.classList.toggle('warning', health < 50 && health >= 25);
    healthTrack.classList.toggle('critical', health < 25);
    healthValue.style.color = health < 25 ? '#ed7770' : health < 50 ? '#e8c35f' : '#f1d38f';
    moneyLabel.textContent = `$${economy.money.toLocaleString('en-US')}`;
    wantedStars.forEach((star, index) => star.classList.toggle('active', index < wanted.level));
    airUnitAlert.hidden = wanted.level < 4;
    airUnitAlert.classList.toggle('active', wanted.level >= 4);
    const weapon = weapons.status();
    weaponHud.hidden = weapon.id === 'unarmed';
    weaponName.textContent = weapon.name;
    weaponAmmo.textContent = weapon.clip === Infinity ? '' : `${weapon.clip} / ${weapon.reserve}`;
    weaponReload.hidden = !weapon.reloading;
    weaponReload.style.setProperty('--reload-progress', `${weapon.reloadProgress * 100}%`);
    missionStatus.textContent = missions.objective();
    if (performance.now() >= notificationUntil) notification.classList.remove('visible');
    const nearby = vehicles.active ? null : vehicles.nearest(player.position());
    vehicleStatus.textContent = vehicles.active
      ? `${vehicles.active.style.name}  ·  ${Math.round(Math.abs(vehicles.active.speed) * 3.6)} KM/H`
      : 'ON FOOT';
    const nearbyLoot = loot.nearby(p, Boolean(vehicles.active));
    const missionPrompt = missions.prompt(p);
    if (nearbyLoot) {
      interaction.textContent = loot.prompt(nearbyLoot);
    } else if (missionPrompt) {
      interaction.textContent = missionPrompt;
    } else if (vehicles.active) {
      interaction.textContent = 'E  EXIT VEHICLE';
      controlsHint.innerHTML = '<span><kbd>W</kbd> ACCELERATE</span><span><kbd>S</kbd> BRAKE / REVERSE</span><span><kbd>A D</kbd> STEER</span><span><kbd>SPACE</kbd> HANDBRAKE</span><span><kbd>E</kbd> EXIT</span>';
    } else if (nearby) {
      interaction.textContent = `E  ENTER ${nearby.vehicle.style.name}`;
      controlsHint.innerHTML = '<span><kbd>W A S D</kbd> MOVE</span><span><kbd>SHIFT</kbd> RUN</span><span><kbd>SPACE</kbd> JUMP</span><span><kbd>E</kbd> ENTER VEHICLE</span><span><kbd>MOUSE</kbd> LOOK</span>';
    } else {
      interaction.textContent = document.pointerLockElement === canvas
        ? 'Breakwater Bay is open - follow the coast road'
        : 'Click the city to capture the mouse - buildings block your path';
      controlsHint.innerHTML = '<span><kbd>W A S D</kbd> MOVE</span><span><kbd>SHIFT</kbd> RUN</span><span><kbd>SPACE</kbd> JUMP</span><span><kbd>MOUSE</kbd> LOOK / ATTACK</span><span><kbd>WHEEL</kbd> SWITCH</span><span><kbd>R</kbd> RELOAD</span>';
    }

    frames++;
    fpsTimer += dt;
    if (fpsTimer >= 1) { averageFps = frames / fpsTimer; frames = 0; fpsTimer = 0; }
    if (import.meta.env.DEV) {
      window.__LOWTIDE_TEST__ = {
        get position() { return player.position(); },
        get grounded() { return player.grounded; },
        get speed() { return player.speed; },
        get facing() { return player.facing; },
        get cameraPosition() { return camera.position.toArray(); },
        get cameraYaw() { return followCamera.yaw; },
        get cameraDistance() { return followCamera.distance; },
        get buildingCount() { return city.stats.buildings; },
        get vehicleCount() { return vehicles.count; },
        get pedestrianCount() { return pedestrians.count; },
        get pedestrianStates() { return pedestrians.stateCounts; },
        get pedestrians() { return pedestrians.agents.map(({ x, z, state }) => ({ x, z, state })); },
        get pedestrianSafety() {
          return pedestrians.agents.map(agent => ({
            walkable: city.canStandAt(agent.x, agent.z, 0.36),
            sidewalkOffset: Math.min(...[-160, -96, -32, 32, 96, 160].map(line => Math.abs((agent.lane.axis === 'x' ? agent.z : agent.x) - line))),
            nearestVehicle: Math.min(...vehicles.cars.map(car => { const p = car.position(); return Math.hypot(agent.x - p.x, agent.z - p.z); })),
          }));
        },
        get policeCount() { return wanted.units.length; },
        get policePositions() { return wanted.units.map(unit => unit.position()); },
        get helicopterActive() { return helicopter.active; },
        get helicopterPosition() { return helicopter.position(); },
        get helicopterRotorAngle() { return helicopter.rotorAngle; },
        lookCamera(dx, dy) { followCamera.rotate(dx, dy); },
        get lootDrops() { return loot.items.map(({ id, type, x, z, amount, ammoId }) => ({ id, type, x, z, amount, ammoId })); },
        get wantedLevel() { return wanted.level; },
        get wantedUnseenFor() { return wanted.unseenFor; },
        get money() { return economy.money; },
        get missions() { return [...missions.missions.values()].map(({ id, state, stage, checkpoint, timer }) => ({ id, state, stage, checkpoint, timer })); },
        get currentVehicle() { return vehicles.active?.style.name ?? null; },
        get vehicleSpeed() { return vehicles.active?.speed ?? 0; },
        get vehicleHeading() { return vehicles.active?.heading ?? null; },
        get vehiclePosition() { return vehicles.active?.position() ?? null; },
        get nearestVehicle() { const n = vehicles.nearest(player.position()); return n?.vehicle.style.name ?? null; },
        get playerVisible() { return player.visual.visible; },
        get fps() { return averageFps; },
        get elapsed() { return (performance.now() - startTime) / 1000; },
        get pointerLocked() { return document.pointerLockElement === canvas; },
        get rendererInfo() { return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }; },
        get health() { return player.health; },
        get weapon() { return weapons.status(); },
        weaponStatus(id) { return weapons.status(id); },
        get ownedWeapons() { return weapons.ownedWeapons; },
        get weaponWheelOpen() { return weaponWheel.open; },
        get pointerHeld() { return input.pointerHeld(); },
        unlockWeapon(id) { return weapons.unlock(id); },
        equipWeapon(id) { return weapons.select(id); },
        reloadWeapon() { return weapons.beginReload(); },
        get dead() { return player.isDead(); },
        get deathOverlayVisible() { return !deathOverlay.hidden; },
        takeDamage(amount, source = 'test') { const result = player.takeDamage(amount, source); if (player.isDead()) beginDeath(); return result; },
        heal(amount) { return player.heal(amount); },
        setHealth(amount) { return player.setHealth(amount); },
        stagePedestrianTarget(index = 0, distance = 6) {
          const agent = pedestrians.agents[index];
          if (!agent) return null;
          const p = player.position(), yaw = followCamera.yaw;
          agent.x = p.x - Math.sin(yaw) * distance; agent.z = p.z - Math.cos(yaw) * distance;
          agent.health = 1; agent.state = 'IDLE'; agent.timer = 60; agent.lootDropped = false; agent.deathCause = '';
          return { x: agent.x, z: agent.z };
        },
        setPlayerPosition(x, z) { const p = player.position(); player.setPosition(x, p.y, z, player.facing); },
        get mapOpen() { return minimap.isOpen; },
        get waypoint() { return minimap.waypoint; },
        setWaypoint(x, z) { minimap.setWaypoint({ x, z }); },
        clearWaypoint() { minimap.setWaypoint(null); },
        changeMapZoom(direction) { minimap.changeZoom(direction); },
        addWanted(amount = 1) { return wanted.addCrime(amount); },
      };
    }
    if (elapsed > 0.45) loading.classList.add('done');
  }

  animationFrame = requestAnimationFrame(frame);
  window.addEventListener('beforeunload', () => {
    running = false;
    cancelAnimationFrame(animationFrame);
    input.dispose(); resizeObserver.disconnect(); minimap.dispose(); loot.dispose(); helicopter.dispose(); pedestrians.dispose(); missions.dispose(); vehicles.dispose(); city.dispose(); physics.free(); renderer.dispose();
  }, { once: true });
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault(); showError(new Error('The WebGL context was lost. Reload to retry.'));
  }, { once: true });
}

start().catch(showError);
