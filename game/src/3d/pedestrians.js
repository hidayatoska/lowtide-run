import * as THREE from 'three';

const ROAD_LINES = [-160, -96, -32, 32, 96, 160];
const SHIRTS = ['#b65e49', '#4d7775', '#d2ad6d', '#776c88', '#49708c', '#b78668', '#778a61', '#d0c4aa'];
const PANTS = ['#384a51', '#53473e', '#626958', '#333a46', '#66534b'];
const SKIN = ['#e0b38a', '#b77f5b', '#8c5e45', '#d19a71', '#efc49a'];
const HAIR = ['#493a32', '#292c2b', '#786047', '#9a7a50', '#343946'];
const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);
const workObject = new THREE.Object3D();
const yawQuaternion = new THREE.Quaternion();
const tiltQuaternion = new THREE.Quaternion();
const localQuaternion = new THREE.Quaternion();
const fullQuaternion = new THREE.Quaternion();
const localPosition = new THREE.Vector3();
const worldPosition = new THREE.Vector3();

function random(min, max) { return min + Math.random() * (max - min); }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function wrapAngle(value) { return Math.atan2(Math.sin(value), Math.cos(value)); }
function nearestRoad(value) { return ROAD_LINES.reduce((a, b) => Math.abs(b - value) < Math.abs(a - value) ? b : a); }

function makeInstanced(scene, geometry, count, name) {
  const material = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.86, metalness: 0, flatShading: true });
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.name = name;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  scene.add(mesh);
  return { mesh, material };
}

export function createPedestrians(scene, city, vehicles, startPosition, count = 20) {
  // The authored city sidewalk strips form short, safe walking lanes between crossings.
  const lanes = [];
  for (const strip of city.sidewalks) {
    const alongX = strip.sx > strip.sz;
    const fixed = alongX ? strip.z : strip.x;
    const road = nearestRoad(fixed);
    const side = Math.sign(fixed - road);
    const lane = road + side * 7.65;
    const length = alongX ? strip.sx : strip.sz;
    const center = alongX ? strip.x : strip.z;
    const min = center - length / 2 + 4;
    const max = center + length / 2 - 4;
    if (max - min < 8) continue;
    const probe = alongX ? { x: min, z: lane } : { x: lane, z: min };
    if (!city.canStandAt(probe.x, probe.z, 0.36)) continue;
    lanes.push({ axis: alongX ? 'x' : 'z', lane, min, max, center, length });
  }

  const agents = [];
  const carRadius = 5.3;
  for (let index = 0; index < count; index++) {
    let candidate = null;
    for (let attempt = 0; attempt < 700; attempt++) {
      const lane = lanes[Math.floor(Math.random() * lanes.length)];
      const along = random(lane.min, lane.max);
      const p = lane.axis === 'x' ? { x: along, z: lane.lane } : { x: lane.lane, z: along };
      const localToStart = Math.hypot(p.x - startPosition.x, p.z - startPosition.z);
      if (index < 8 && localToStart > 25) continue;
      if (index >= 8 && localToStart < 25) continue;
      if (!city.canStandAt(p.x, p.z, 0.36)) continue;
      if (agents.some(other => Math.hypot(p.x - other.x, p.z - other.z) < 5.2)) continue;
      if (vehicles.cars.some(car => {
        const c = car.position();
        return Math.hypot(p.x - c.x, p.z - c.z) < carRadius;
      })) continue;
      candidate = { lane, x: p.x, z: p.z };
      break;
    }
    if (!candidate) {
      const lane = lanes[(index * 7) % lanes.length];
      const along = lane.min + (lane.max - lane.min) * ((index + 1) / (count + 1));
      candidate = lane.axis === 'x' ? { lane, x: along, z: lane.lane } : { lane, x: lane.lane, z: along };
    }
    const height = random(0.88, 1.13);
    const agent = {
      ...candidate,
      spawnX: candidate.x,
      spawnZ: candidate.z,
      heading: candidate.lane.axis === 'x' ? (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (Math.random() < 0.5 ? 0 : Math.PI),
      state: Math.random() < 0.78 ? 'WALK' : 'IDLE',
      timer: random(0.35, 2.5),
      phase: random(0, Math.PI * 2),
      dest: 0,
      height,
      width: random(0.88, 1.14),
      skin: SKIN[index % SKIN.length],
      shirt: SHIRTS[(index * 3 + Math.floor(index / SHIRTS.length)) % SHIRTS.length],
      pants: PANTS[(index * 2 + Math.floor(index / PANTS.length)) % PANTS.length],
      hair: HAIR[(index * 3) % HAIR.length],
      recovery: 0,
      fleeTime: 0,
      collisionCount: 0,
      health: 100,
      deathCause: '',
      lootDropped: false,
    };
    agents.push(agent);
  }

  const torso = makeInstanced(scene, new THREE.CylinderGeometry(0.22, 0.28, 0.76, 7), count, 'Pedestrian clothing');
  const heads = makeInstanced(scene, new THREE.SphereGeometry(0.185, 9, 7), count, 'Pedestrian heads');
  const hair = makeInstanced(scene, new THREE.SphereGeometry(0.188, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.57), count, 'Pedestrian hair');
  const arms = makeInstanced(scene, new THREE.CylinderGeometry(0.075, 0.09, 0.52, 6), count * 2, 'Pedestrian arms');
  const legs = makeInstanced(scene, new THREE.CylinderGeometry(0.095, 0.11, 0.65, 6), count * 2, 'Pedestrian legs');
  const shoes = makeInstanced(scene, new THREE.BoxGeometry(0.18, 0.12, 0.30), count * 2, 'Pedestrian shoes');

  for (let i = 0; i < count; i++) {
    const agent = agents[i];
    torso.mesh.setColorAt(i, new THREE.Color(agent.shirt));
    heads.mesh.setColorAt(i, new THREE.Color(agent.skin));
    hair.mesh.setColorAt(i, new THREE.Color(agent.hair));
    for (let side = 0; side < 2; side++) {
      arms.mesh.setColorAt(i * 2 + side, new THREE.Color(agent.skin));
      legs.mesh.setColorAt(i * 2 + side, new THREE.Color(agent.pants));
      shoes.mesh.setColorAt(i * 2 + side, new THREE.Color('#343432'));
    }
    chooseDestination(agent, Math.random() < 0.78);
  }
  for (const part of [torso, heads, hair, arms, legs, shoes]) {
    if (part.mesh.instanceColor) part.mesh.instanceColor.needsUpdate = true;
  }

  function chooseDestination(agent, walk = true) {
    const lane = agent.lane;
    const along = lane.axis === 'x' ? agent.x : agent.z;
    let destination = random(lane.min, lane.max);
    if (Math.abs(destination - along) < 5) destination = destination < (lane.min + lane.max) / 2 ? lane.max : lane.min;
    agent.dest = destination;
    if (walk) agent.state = 'WALK';
    agent.timer = walk ? 0 : random(0.65, 2.8);
  }

  function vehicleHit(agent, car) {
    const p = car.position();
    const dx = agent.x - p.x, dz = agent.z - p.z;
    const c = Math.cos(car.heading), s = Math.sin(car.heading);
    const localX = dx * c + dz * s;
    const localZ = -dx * s + dz * c;
    return Math.abs(localX) < car.style.width * 0.54 + 0.34
      && Math.abs(localZ) < car.style.length * 0.51 + 0.34;
  }

  function flee(agent, car) {
    const carPosition = car.position();
    const value = agent.lane.axis === 'x' ? agent.x : agent.z;
    const carValue = agent.lane.axis === 'x' ? carPosition.x : carPosition.z;
    const direction = value >= carValue ? 1 : -1;
    agent.dest = direction > 0 ? agent.lane.max : agent.lane.min;
    agent.state = 'FLEE';
    agent.fleeTime = 2.5;
    if (agent.lane.axis === 'x') agent.heading = direction > 0 ? Math.PI / 2 : -Math.PI / 2;
    else agent.heading = direction > 0 ? 0 : Math.PI;
  }

  function step(dt) {
    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];
      let closestThreat = null;
      let threatDistance = 10.5;
      for (const car of vehicles.cars) {
        const speed = Math.abs(car.speed || 0);
        if (speed < 4.7) continue;
        const p = car.position();
        const d = Math.hypot(agent.x - p.x, agent.z - p.z);
        if (d < threatDistance) { closestThreat = car; threatDistance = d; }
      }

      if (agent.state !== 'RESPAWN' && closestThreat && threatDistance < 9.2) {
        if (vehicleHit(agent, closestThreat)) {
          agent.state = 'RESPAWN';
          agent.recovery = 1.55;
          agent.collisionCount++;
        } else if (agent.state !== 'FLEE') flee(agent, closestThreat);
        else agent.fleeTime = Math.max(agent.fleeTime, 0.4);
      }

      if (agent.state === 'RESPAWN') {
        agent.recovery -= dt;
        if (agent.recovery <= 0) {
          // Move the recovered pedestrian to a safe point on its existing sidewalk strip.
          agent.x = agent.spawnX;
          agent.z = agent.spawnZ;
          agent.state = 'IDLE';
          agent.timer = random(0.7, 1.6);
          agent.heading = random(-Math.PI, Math.PI);
          agent.health = 100;
          agent.deathCause = '';
          agent.lootDropped = false;
        }
        continue;
      }

      if (agent.state === 'IDLE') {
        agent.timer -= dt;
        if (agent.timer <= 0) chooseDestination(agent, true);
      } else {
        const value = agent.lane.axis === 'x' ? agent.x : agent.z;
        const difference = agent.dest - value;
        if (Math.abs(difference) < 0.55) {
          if (agent.state === 'FLEE' && agent.fleeTime > 0) agent.fleeTime -= dt;
          else { agent.state = 'IDLE'; agent.timer = random(0.45, 2.5); }
        } else {
          const direction = Math.sign(difference);
          let speed = agent.state === 'FLEE' ? 3.6 : 1.18;
          let blockedByCrowd = false;
          for (let otherIndex = 0; otherIndex < agents.length; otherIndex++) {
            if (otherIndex === i) continue;
            const other = agents[otherIndex];
            const dx = other.x - agent.x, dz = other.z - agent.z;
            const d2 = dx * dx + dz * dz;
            if (d2 > 1.05 * 1.05 || d2 < 0.0001) continue;
            const along = agent.lane.axis === 'x' ? dx : dz;
            if (along * direction > 0) blockedByCrowd = true;
            else speed = Math.min(speed, 0.72);
          }
          const amount = blockedByCrowd ? 0 : Math.min(Math.abs(difference), speed * dt);
          const nextX = agent.lane.axis === 'x' ? agent.x + direction * amount : agent.x;
          const nextZ = agent.lane.axis === 'z' ? agent.z + direction * amount : agent.z;
          if (city.canStandAt(nextX, nextZ, 0.36)) {
            agent.x = nextX;
            agent.z = nextZ;
          } else {
            agent.state = 'IDLE';
            agent.timer = random(0.5, 1.2);
            chooseDestination(agent, false);
          }
          const targetYaw = agent.lane.axis === 'x' ? (direction > 0 ? Math.PI / 2 : -Math.PI / 2) : (direction > 0 ? 0 : Math.PI);
          agent.heading += wrapAngle(targetYaw - agent.heading) * Math.min(1, dt * 4.5);
          if (agent.state === 'FLEE') {
            agent.fleeTime -= dt;
            if (agent.fleeTime <= 0) { agent.state = 'WALK'; chooseDestination(agent, true); }
          }
        }
      }
      agent.phase += dt * (agent.state === 'FLEE' ? 13 : 7.5);
    }
    syncInstances();
  }

  function write(meshRecord, instanceIndex, agent, localOffset, rotationX, scale, prone = false) {
    if (agent.state === 'RESPAWN' && agent.recovery < 0.35) {
      workObject.position.set(0, -1000, 0);
      workObject.scale.setScalar(0);
      workObject.updateMatrix();
      meshRecord.mesh.setMatrixAt(instanceIndex, workObject.matrix);
      return;
    }
    yawQuaternion.setFromAxisAngle(AXIS_Y, agent.heading);
    if (prone) tiltQuaternion.setFromAxisAngle(AXIS_Z, agent.collisionCount % 2 ? 1.22 : -1.22);
    else tiltQuaternion.identity();
    fullQuaternion.copy(yawQuaternion).multiply(tiltQuaternion);
    localPosition.set(localOffset[0], localOffset[1], localOffset[2]).applyQuaternion(fullQuaternion);
    worldPosition.set(agent.x, 0, agent.z).add(localPosition);
    localQuaternion.setFromAxisAngle(AXIS_X, rotationX);
    workObject.position.copy(worldPosition);
    workObject.quaternion.copy(fullQuaternion).multiply(localQuaternion);
    workObject.scale.set(scale[0] * agent.width, scale[1] * agent.height, scale[2] * agent.width);
    workObject.updateMatrix();
    meshRecord.mesh.setMatrixAt(instanceIndex, workObject.matrix);
  }

  function syncInstances() {
    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];
      const walking = agent.state === 'WALK' || agent.state === 'FLEE';
      const prone = agent.state === 'RESPAWN' && agent.recovery > 0.4;
      const swing = walking ? Math.sin(agent.phase) * (agent.state === 'FLEE' ? 0.58 : 0.38) : Math.sin(agent.phase * 0.35) * 0.035;
      write(torso, i, agent, [0, 1.00 + (walking ? Math.abs(Math.sin(agent.phase * 2)) * 0.025 : Math.sin(agent.phase * 0.45) * 0.018), 0], 0, [1, 1, 1], prone);
      write(heads, i, agent, [0, 1.57 + Math.sin(agent.phase * 0.35) * 0.018, 0], 0, [1, 1.08, 0.95], prone);
      write(hair, i, agent, [0, 1.68, 0], 0, [1, 0.66, 1], prone);
      for (let side = 0; side < 2; side++) {
        const sign = side === 0 ? -1 : 1;
        write(arms, i * 2 + side, agent, [sign * 0.31, 1.06, 0], sign * swing, [0.9, 1, 0.9], prone);
        write(legs, i * 2 + side, agent, [sign * 0.14, 0.50, 0], -sign * swing, [0.9, 1, 0.92], prone);
        write(shoes, i * 2 + side, agent, [sign * 0.14, 0.12, -0.06], -sign * swing, [1, 1, 1], prone);
      }
    }
    for (const part of [torso, heads, hair, arms, legs, shoes]) part.mesh.instanceMatrix.needsUpdate = true;
  }

  syncInstances();

  return {
    agents,
    step,
    get count() { return agents.length; },
    get stateCounts() {
      const counts = { WALK: 0, IDLE: 0, FLEE: 0, RESPAWN: 0 };
      for (const agent of agents) counts[agent.state]++;
      return counts;
    },
    dispose() {
      for (const part of [torso, heads, hair, arms, legs, shoes]) {
        scene.remove(part.mesh);
        part.mesh.geometry.dispose();
        part.material.dispose();
      }
    },
  };
}
