const STARTS = [
  { id: 'quick-delivery', name: 'Quick Delivery', x: -96, z: -32, state: 'available' },
  { id: 'street-racer', name: 'Street Racer', x: -160, z: -96, state: 'locked' },
];
const CHECKPOINTS = [
  { x: -96, z: -96 }, { x: -32, z: -96 }, { x: 32, z: -96 },
  { x: 96, z: -96 }, { x: 160, z: -96 },
];

function distance(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }

function createMarker(scene, THREE, color) {
  const group = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.78, depthWrite: false });
  const glowMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.18, 1.65, 8), material);
  pole.position.y = 0.92;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.09, 8, 24), material);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 1.85;
  const ground = new THREE.Mesh(new THREE.CircleGeometry(1.1, 24), glowMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0.04;
  group.add(pole, ring, ground);
  group.visible = false;
  scene.add(group);
  return { group, material, glowMaterial };
}

export function createMissionManager(scene, THREE, economy, { notify = () => {} } = {}) {
  const missions = new Map(STARTS.map(spec => [spec.id, { ...spec, timer: 0, checkpoint: 0, stage: '', paid: false }]));
  const markers = new Map(STARTS.map(spec => [spec.id, createMarker(scene, THREE, spec.id === 'quick-delivery' ? '#e4c274' : '#7cc9b2')]));
  const waypoint = createMarker(scene, THREE, '#edba65');
  let phaseClock = 0;

  function resetMission(mission) {
    mission.timer = 0;
    mission.checkpoint = 0;
    mission.stage = '';
  }

  function start(id) {
    const mission = missions.get(id);
    if (!mission || mission.state === 'locked' || mission.state === 'active') return false;
    resetMission(mission);
    mission.state = 'active';
    if (id === 'quick-delivery') mission.stage = 'pickup';
    if (id === 'street-racer') { mission.stage = 'race'; mission.timer = 90; }
    notify(id === 'quick-delivery' ? 'Quick Delivery started. Pick up the package.' : 'Street Racer started. Pass all five checkpoints!');
    return true;
  }

  function nearStart(position, maxDistance = 4.8) {
    let best = null;
    for (const mission of missions.values()) {
      if (!['available', 'completed', 'failed'].includes(mission.state)) continue;
      const d = distance(position, mission);
      if (d <= maxDistance && (!best || d < best.distance)) best = { mission, distance: d };
    }
    return best;
  }

  function interact(position) {
    const nearby = nearStart(position);
    if (!nearby) return false;
    return start(nearby.mission.id);
  }

  function complete(mission, reward) {
    mission.state = 'completed';
    if (reward > 0 && !mission.paid && economy.reward(mission.id, reward)) {
      mission.paid = true;
      notify(`${mission.name} complete. $${reward.toLocaleString('en-US')} earned.`);
    } else notify(`${mission.name} complete.`);
    if (mission.id === 'quick-delivery') missions.get('street-racer').state = 'available';
  }

  function fail(mission, reason) {
    mission.state = 'failed';
    notify(`${mission.name} failed: ${reason}`);
  }

  function step(dt, position, inVehicle) {
    phaseClock += dt;
    const delivery = missions.get('quick-delivery');
    if (delivery.state === 'active') {
      const target = delivery.stage === 'pickup' ? { x: -92, z: -96 } : { x: 96, z: -96 };
      if (distance(position, target) < 4.5 && inVehicle) {
        if (delivery.stage === 'pickup') {
          delivery.stage = 'dropoff';
          notify('Package collected. Drive to the delivery address.');
        } else complete(delivery, 500);
      }
    }

    const race = missions.get('street-racer');
    if (race.state === 'active') {
      race.timer -= dt;
      if (race.timer <= 0) fail(race, 'time ran out');
      else if (inVehicle && distance(position, CHECKPOINTS[race.checkpoint]) < 5.8) {
        race.checkpoint++;
        if (race.checkpoint >= CHECKPOINTS.length) complete(race, 0);
        else notify(`Checkpoint ${race.checkpoint} of 5`);
      }
    }

    for (const mission of missions.values()) {
      const marker = markers.get(mission.id);
      marker.group.visible = mission.state === 'available' || mission.state === 'failed' || mission.state === 'completed';
      marker.group.position.set(mission.x, 0, mission.z);
      marker.group.rotation.y = phaseClock * 0.35;
    }
    const active = [...missions.values()].find(mission => mission.state === 'active');
    if (active) {
      let target;
      if (active.id === 'quick-delivery') target = active.stage === 'pickup' ? { x: -92, z: -96 } : { x: 96, z: -96 };
      if (active.id === 'street-racer') target = CHECKPOINTS[active.checkpoint];
      if (target) {
        waypoint.group.visible = true;
        waypoint.group.position.set(target.x, 0, target.z);
        waypoint.group.rotation.y = phaseClock * 0.5;
      }
    } else waypoint.group.visible = false;
  }

  function prompt(position) {
    const nearby = nearStart(position);
    if (nearby) return `E  ${nearby.mission.state === 'completed' ? 'REPLAY' : 'START'} ${nearby.mission.name}`;
    const active = [...missions.values()].find(mission => mission.state === 'active');
    if (active?.id === 'quick-delivery' && active.stage === 'pickup' && !vehiclesActive && distance(position, { x: -92, z: -96 }) < 10) return 'GET A VEHICLE TO PICK UP THE PACKAGE';
    return '';
  }

  let vehiclesActive = false;
  function setVehicleState(value) { vehiclesActive = value; }

  function objective() {
    const active = [...missions.values()].find(mission => mission.state === 'active');
    if (!active) return '';
    if (active.id === 'quick-delivery') return active.stage === 'pickup' ? 'QUICK DELIVERY  ·  PACKAGE' : 'QUICK DELIVERY  ·  DROP OFF';
    return `STREET RACER  ·  CHECKPOINT ${Math.min(active.checkpoint + 1, 5)}/5  ·  ${Math.ceil(active.timer)}s`;
  }

  function dispose() {
    for (const marker of [...markers.values(), waypoint]) {
      scene.remove(marker.group);
      marker.group.traverse(child => { if (child.geometry) child.geometry.dispose(); });
      marker.material.dispose();
      marker.glowMaterial.dispose();
    }
  }

  function mapMarkers() {
    const output = [];
    for (const mission of missions.values()) {
      if (mission.state === 'available' || mission.state === 'active' || mission.state === 'failed') {
        output.push({ x: mission.x, z: mission.z, type: mission.state === 'active' ? 'active-mission' : 'mission', name: mission.name });
      }
    }
    const active = [...missions.values()].find(mission => mission.state === 'active');
    if (active?.id === 'quick-delivery') output.push(active.stage === 'pickup'
      ? { x: -92, z: -96, type: 'objective', name: 'Package' }
      : { x: 96, z: -96, type: 'objective', name: 'Delivery' });
    if (active?.id === 'street-racer') output.push({ ...CHECKPOINTS[active.checkpoint], type: 'objective', name: `Checkpoint ${active.checkpoint + 1}` });
    return output;
  }

  return { missions, nearStart, interact, step, prompt, objective, mapMarkers, setVehicleState, dispose };
}
