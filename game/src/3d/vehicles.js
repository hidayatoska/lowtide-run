import * as THREE from 'three';

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const wheelGeometry = new THREE.CylinderGeometry(0.36, 0.36, 0.24, 14);
wheelGeometry.rotateZ(Math.PI / 2);
const hubGeometry = new THREE.CylinderGeometry(0.205, 0.205, 0.255, 12);
hubGeometry.rotateZ(Math.PI / 2);
const spokeGeometry = new THREE.BoxGeometry(0.045, 0.19, 0.055);
const TAU = Math.PI * 2;
const axisX = new THREE.Vector3(1, 0, 0);
const axisY = new THREE.Vector3(0, 1, 0);
const steeringQuaternion = new THREE.Quaternion();
const spokeQuaternion = new THREE.Quaternion();

const STYLES = [
  { name: 'Breakwater Compact', color: '#c36f50', width: 1.92, length: 3.9, scaleX: 0.94, scaleZ: 0.94, maxSpeed: 22, acceleration: 9.2, reverse: 5.2, braking: 17, turn: 1.12 },
  { name: 'Bayline Sedan', color: '#497d7b', width: 2.02, length: 4.35, scaleX: 1, scaleZ: 1.04, maxSpeed: 27, acceleration: 8.3, reverse: 5.8, braking: 18, turn: 0.96 },
  { name: 'Wharf Utility', color: '#b9a366', width: 2.06, length: 4.45, scaleX: 1.04, scaleZ: 1.07, maxSpeed: 21, acceleration: 7.6, reverse: 5, braking: 17, turn: 1.04 },
  { name: 'Saltline Sport', color: '#55636a', width: 1.98, length: 4.1, scaleX: 0.98, scaleZ: 1, maxSpeed: 31, acceleration: 11.5, reverse: 6.3, braking: 20, turn: 1.24 },
  { name: 'Harbor Patrol', color: '#e2e1d4', width: 2.02, length: 4.35, scaleX: 1, scaleZ: 1.04, maxSpeed: 26, acceleration: 10.8, reverse: 6, braking: 19, turn: 1.08 },
];

const PARKED = [
  { x: -91.5, z: -43.5, heading: 0, style: 0 },
  { x: -100.5, z: -84, heading: 0, style: 1 },
  { x: -91.5, z: 47, heading: 0, style: 2 },
  { x: 36.5, z: -108, heading: 0, style: 3 },
  { x: 36.5, z: 95, heading: 0, style: 1 },
  { x: -140, z: -90.5, heading: -Math.PI / 2, style: 2 },
  { x: -20, z: 37.5, heading: -Math.PI / 2, style: 0 },
  { x: 130, z: -90.5, heading: -Math.PI / 2, style: 3 },
];

function boxPart(parent, material, position, size, rotation = null) {
  const mesh = new THREE.Mesh(unitBox, material);
  mesh.position.set(...position);
  mesh.scale.set(...size);
  if (rotation) mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function createCarVisual(scene, style) {
  const root = new THREE.Group();
  root.scale.set(style.scaleX, 1, style.scaleZ);
  root.name = style.name;
  const bodyPaint = new THREE.MeshStandardMaterial({ color: style.color, roughness: 0.36, metalness: 0.24, flatShading: true });
  const trim = new THREE.MeshStandardMaterial({ color: '#282f31', roughness: 0.72, metalness: 0.12 });
  const glass = new THREE.MeshStandardMaterial({ color: '#58777b', roughness: 0.24, metalness: 0.22, transparent: true, opacity: 0.87 });
  const tire = new THREE.MeshStandardMaterial({ color: '#202526', roughness: 0.94 });
  const alloy = new THREE.MeshStandardMaterial({ color: '#b8b9ad', roughness: 0.34, metalness: 0.68 });
  const headlamp = new THREE.MeshStandardMaterial({ color: '#f4dfaa', emissive: '#b8893b', emissiveIntensity: 0.58, roughness: 0.3 });
  const tailLamp = new THREE.MeshStandardMaterial({ color: '#aa4336', emissive: '#751b18', emissiveIntensity: 0.55, roughness: 0.34 });
  const grille = new THREE.MeshStandardMaterial({ color: '#20292a', roughness: 0.68, metalness: 0.16 });
  const materials = [bodyPaint, trim, glass, tire, alloy, headlamp, tailLamp, grille];

  boxPart(root, bodyPaint, [0, -0.005, 0], [2.02, 0.52, 4.12]);
  boxPart(root, bodyPaint, [0, 0.19, -1.35], [1.94, 0.27, 1.36]);
  boxPart(root, bodyPaint, [0, 0.18, 1.52], [1.88, 0.28, 0.84]);
  boxPart(root, trim, [0, -0.24, 0], [1.72, 0.13, 2.75]);
  boxPart(root, bodyPaint, [0, 0.50, 0.04], [1.58, 0.66, 1.92]);
  boxPart(root, bodyPaint, [0, 0.86, 0.12], [1.34, 0.08, 1.55]);

  // Windscreens, four framed side windows, door sills, and small mirrors.
  boxPart(root, glass, [0, 0.51, -0.91], [1.37, 0.44, 0.075], [-0.24, 0, 0]);
  boxPart(root, glass, [0, 0.51, 1.00], [1.30, 0.42, 0.075], [0.24, 0, 0]);
  for (const side of [-1, 1]) {
    for (const z of [-0.38, 0.43]) boxPart(root, glass, [side * 0.795, 0.53, z], [0.06, 0.39, 0.67]);
    boxPart(root, trim, [side * 0.83, -0.15, 0.12], [0.16, 0.12, 2.02]);
    boxPart(root, bodyPaint, [side * 1.03, 0.49, -0.65], [0.25, 0.12, 0.35], [0, side * 0.14, 0]);
    boxPart(root, trim, [side * 0.83, 0.13, 0.28], [0.075, 0.055, 0.24]);
  }
  boxPart(root, trim, [0, -0.20, -2.08], [1.48, 0.18, 0.16]);
  boxPart(root, trim, [0, -0.19, 2.08], [1.42, 0.17, 0.16]);
  boxPart(root, grille, [0, -0.04, -2.075], [0.70, 0.27, 0.045]);
  boxPart(root, trim, [0, 0.01, -2.105], [0.08, 0.19, 0.035]);
  for (const side of [-1, 1]) {
    boxPart(root, headlamp, [side * 0.69, 0.08, -2.09], [0.39, 0.22, 0.075]);
    boxPart(root, tailLamp, [side * 0.70, 0.08, 2.075], [0.30, 0.24, 0.075]);
    boxPart(root, trim, [side * 0.55, -0.16, -2.10], [0.18, 0.07, 0.055]);
  }

  const wheelPivots = [];
  const wheels = [];
  for (const side of [-1, 1]) for (const axle of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 1.10, -0.20, axle * 1.35);
    root.add(pivot);
    const wheel = new THREE.Mesh(wheelGeometry, tire);
    wheel.castShadow = true;
    wheel.receiveShadow = true;
    pivot.add(wheel);
    const hub = new THREE.Mesh(hubGeometry, alloy);
    pivot.add(hub);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.265, 10), trim);
    cap.rotation.z = Math.PI / 2;
    pivot.add(cap);
    wheelPivots.push({ pivot, front: axle === -1, side, axle });
    wheels.push(wheel);
  }
  const spokes = new THREE.InstancedMesh(spokeGeometry, alloy, 40);
  spokes.name = `${style.name} rotating wheel spokes`;
  root.add(spokes);
  const matrixObject = new THREE.Object3D();
  function syncWheels(spin, steering) {
    let index = 0;
    for (const wheel of wheelPivots) {
      const yaw = wheel.front ? -steering : 0;
      steeringQuaternion.setFromAxisAngle(axisY, yaw);
      wheel.pivot.rotation.y = yaw;
      for (const face of [-1, 1]) for (let spoke = 0; spoke < 5; spoke++) {
        const angle = spoke * TAU / 5 + spin;
        const localZ = Math.sin(angle) * 0.145;
        const localX = Math.sin(yaw) * localZ;
        const z = wheel.axle * 1.35 + Math.cos(yaw) * localZ;
        matrixObject.position.set(wheel.side * 1.10 + localX + face * 0.145, -0.20 + Math.cos(angle) * 0.145, z);
        spokeQuaternion.setFromAxisAngle(axisX, angle);
        matrixObject.quaternion.copy(steeringQuaternion).multiply(spokeQuaternion);
        matrixObject.updateMatrix();
        spokes.setMatrixAt(index++, matrixObject.matrix);
      }
    }
    spokes.instanceMatrix.needsUpdate = true;
  }
  syncWheels(0, 0);

  // A visible cabin, seat backs, and turning steering wheel give the silhouette depth.
  for (const x of [-0.38, 0.38]) {
    boxPart(root, trim, [x, 0.02, -0.25], [0.36, 0.47, 0.34]);
    boxPart(root, trim, [x, 0.04, 0.48], [0.38, 0.48, 0.35]);
  }
  const steeringWheel = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.035, 8, 16), alloy);
  steeringWheel.position.set(-0.39, 0.39, -0.45);
  steeringWheel.rotation.y = Math.PI / 2;
  steeringWheel.rotation.x = 0.22;
  root.add(steeringWheel);

  scene.add(root);
  return { root, wheelPivots, wheels, spokes, steeringWheel, materials, syncWheels };
}

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function angleDifference(a, b) { return Math.atan2(Math.sin(a - b), Math.cos(a - b)); }

export function createVehicles(scene, RAPIER, physics, city) {
  const cars = [];
  function createVehicle(parking, role = 'parked') {
    const style = STYLES[parking.style];
    const rotation = { x: 0, y: Math.sin(parking.heading / 2), z: 0, w: Math.cos(parking.heading / 2) };
    const body = physics.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(parking.x, 0.5, parking.z)
        .setRotation(rotation)
        .setLinearDamping(0.28)
        .setAngularDamping(4)
        .setCanSleep(false)
        .setCcdEnabled(true),
    );
    body.setEnabledRotations(false, true, false, true);
    const collider = physics.createCollider(
      RAPIER.ColliderDesc.cuboid(style.width * 0.53, 0.5, style.length * 0.51)
        .setDensity(1.15).setFriction(0.22).setRestitution(0.04), body,
    );
    const visual = createCarVisual(scene, style);
    const car = {
      body, collider, visual, style, heading: parking.heading, steering: 0, wheelSpin: 0,
      speed: 0, active: false, role, authorized: Boolean(parking.authorized), stolen: false,
      position() { const p = body.translation(); return { x: p.x, y: p.y, z: p.z }; },
    };
    cars.push(car);
    return car;
  }
  for (const parking of PARKED) createVehicle(parking);

  let active = null;
  function nearest(position, maxDistance = 3.7) {
    if (active) return null;
    let best = null;
    let bestDistance = maxDistance;
    for (const car of cars) {
      if (car.role !== 'parked') continue;
      const p = car.position();
      const d = Math.hypot(position.x - p.x, position.z - p.z);
      if (d < bestDistance) { best = car; bestDistance = d; }
    }
    return best ? { vehicle: best, distance: bestDistance } : null;
  }

  function enter(car) {
    if (active || !cars.includes(car)) return false;
    active = car;
    car.active = true;
    car.speed = 0;
    car.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    car.heading = car.visual.root.rotation.y;
    return true;
  }

  function exit() {
    if (!active) return null;
    const car = active;
    const p = car.position();
    const candidates = [1, -1].map(side => ({
      x: p.x + Math.cos(car.heading) * side * 1.65,
      z: p.z - Math.sin(car.heading) * side * 1.65,
      side,
    }));
    const clear = candidates.find(candidate =>
      city.canStandAt(candidate.x, candidate.z, 0.48)
      && cars.every(other => other === car || Math.hypot(candidate.x - other.position().x, candidate.z - other.position().z) > 2.45),
    );
    if (!clear) return null;
    car.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    car.speed = 0;
    car.active = false;
    active = null;
    return { x: clear.x, y: 0.95, z: clear.z, heading: car.heading };
  }

  function stopActive() {
    if (!active) return null;
    const car = active;
    const position = car.position();
    car.body.setLinvel({ x: 0, y: car.body.linvel().y, z: 0 }, true);
    car.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    car.speed = 0;
    car.active = false;
    active = null;
    return position;
  }

  function spawnPolice(x, z, heading = 0) {
    return createVehicle({ x, z, heading, style: 4, authorized: true }, 'police');
  }

  function despawn(car) {
    if (!cars.includes(car) || car === active) return false;
    physics.removeCollider(car.collider, true);
    physics.removeRigidBody(car.body);
    scene.remove(car.visual.root);
    for (const material of car.visual.materials) material.dispose();
    cars.splice(cars.indexOf(car), 1);
    return true;
  }

  function driveToward(car, target, dt, maxSpeed = 13, turnRate = 1.5) {
    if (!cars.includes(car) || car.role !== 'police' || car === active) return;
    const p = car.position();
    const dx = target.x - p.x, dz = target.z - p.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 2.7) {
      car.speed = Math.max(0, car.speed - 14 * dt);
    } else {
      const desired = Math.atan2(-dx, -dz);
      const difference = angleDifference(desired, car.heading);
      car.heading += clamp(difference, -turnRate * dt, turnRate * dt);
      const forwardError = Math.abs(difference);
      const desiredSpeed = maxSpeed * (forwardError > 1.1 ? 0.48 : forwardError > 0.65 ? 0.72 : 1);
      car.speed += clamp(desiredSpeed - car.speed, -12 * dt, 7 * dt);
    }
    const fx = -Math.sin(car.heading), fz = -Math.cos(car.heading);
    car.body.setRotation({ x: 0, y: Math.sin(car.heading / 2), z: 0, w: Math.cos(car.heading / 2) }, true);
    car.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    car.body.setLinvel({ x: fx * car.speed, y: car.body.linvel().y, z: fz * car.speed }, true);
    car.wheelSpin += car.speed * dt / 0.34;
    car.visual.syncWheels(car.wheelSpin, 0);
  }

  function fixedStep(dt, input) {
    if (active) {
      const car = active;
      const body = car.body;
      const style = car.style;
      const yaw = car.heading;
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      const rx = Math.cos(yaw), rz = -Math.sin(yaw);
      const oldVelocity = body.linvel();
      let forwardSpeed = oldVelocity.x * fx + oldVelocity.z * fz;
      let sideSpeed = oldVelocity.x * rx + oldVelocity.z * rz;
      const accelerate = input.down('KeyW') || input.down('ArrowUp');
      const brakeReverse = input.down('KeyS') || input.down('ArrowDown');
      const steer = Number(input.down('KeyD') || input.down('ArrowRight')) - Number(input.down('KeyA') || input.down('ArrowLeft'));
      const handbrake = input.down('Space');

      if (handbrake) {
        forwardSpeed *= Math.exp(-8.5 * dt);
        sideSpeed *= Math.exp(-0.75 * dt);
      } else if (accelerate) {
        forwardSpeed += (forwardSpeed < -0.55 ? 17 : style.acceleration) * dt;
      } else if (brakeReverse) {
        forwardSpeed -= (forwardSpeed > 0.65 ? style.braking : style.reverse) * dt;
      } else {
        forwardSpeed *= Math.exp(-0.42 * dt);
      }
      forwardSpeed = clamp(forwardSpeed, -8, style.maxSpeed);
      sideSpeed *= Math.exp(-(handbrake ? 0.75 : 7.2) * dt);

      const turnStrength = clamp(Math.abs(forwardSpeed) / 4.5, 0, 1);
      car.steering = THREE.MathUtils.damp(car.steering, steer * 0.44, 9, dt);
      if (steer && turnStrength > 0.015) {
        car.heading -= steer * Math.sign(forwardSpeed) * style.turn * turnStrength * (handbrake ? 1.42 : 1) * dt;
      }
      const nextFx = -Math.sin(car.heading), nextFz = -Math.cos(car.heading);
      const nextRx = Math.cos(car.heading), nextRz = -Math.sin(car.heading);
      body.setRotation({ x: 0, y: Math.sin(car.heading / 2), z: 0, w: Math.cos(car.heading / 2) }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      body.setLinvel({
        x: nextFx * forwardSpeed + nextRx * sideSpeed,
        y: oldVelocity.y,
        z: nextFz * forwardSpeed + nextRz * sideSpeed,
      }, true);
      car.speed = forwardSpeed;
      car.wheelSpin += forwardSpeed * dt / 0.34;
      for (const wheel of car.visual.wheels) wheel.rotation.x = car.wheelSpin;
      car.visual.syncWheels(car.wheelSpin, car.steering);
      car.visual.steeringWheel.rotation.z = -car.steering * 1.8;
    } else {
      for (const car of cars) car.speed = Math.hypot(car.body.linvel().x, car.body.linvel().z);
    }

    physics.step();
    syncVisuals();
  }

  function syncVisuals() {
    for (const car of cars) {
      const p = car.body.translation();
      const q = car.body.rotation();
      car.visual.root.position.set(p.x, p.y, p.z);
      car.visual.root.quaternion.set(q.x, q.y, q.z, q.w);
    }
  }

  return {
    cars,
    nearest,
    enter,
    exit,
    stopActive,
    spawnPolice,
    despawn,
    driveToward,
    fixedStep,
    syncVisuals,
    get active() { return active; },
    get count() { return cars.length; },
    dispose() {
      for (const car of cars) {
        physics.removeCollider(car.collider, true);
        physics.removeRigidBody(car.body);
        scene.remove(car.visual.root);
        for (const material of car.visual.materials) material.dispose();
      }
      unitBox.dispose(); wheelGeometry.dispose(); hubGeometry.dispose(); spokeGeometry.dispose();
    },
  };
}
