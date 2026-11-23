import * as THREE from 'three';

function makeMaterial(color, roughness = 0.82) {
  return new THREE.MeshStandardMaterial({ color, roughness, flatShading: true });
}

export function createPlayer(scene, RAPIER, physicsWorld) {
  const spawn = new THREE.Vector3(-96, 0.9, -32);
  const body = physicsWorld.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.x, spawn.y, spawn.z),
  );
  const collider = physicsWorld.createCollider(
    RAPIER.ColliderDesc.capsule(0.56, 0.34).setFriction(0).setRestitution(0), body,
  );
  const controller = physicsWorld.createCharacterController(0.035);
  controller.setSlideEnabled(true);
  controller.setApplyImpulsesToDynamicBodies(false);
  controller.enableAutostep(0.25, 0.25, false);
  controller.enableSnapToGround(0.22);

  const visual = new THREE.Group();
  visual.name = 'Player character';
  const skin = makeMaterial('#bd8d69');
  const shirt = makeMaterial('#d2b47e');
  const pants = makeMaterial('#3f5151');
  const shoes = makeMaterial('#302f2b');
  const bag = makeMaterial('#a55f46');
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.29, 0.56, 4, 8), shirt);
  torso.position.y = 1.13; torso.castShadow = true; visual.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.205, 12, 9), skin);
  head.position.set(0, 1.76, -0.025); head.castShadow = true; visual.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 7, 0, Math.PI * 2, 0, Math.PI * 0.53), makeMaterial('#493c32'));
  hair.position.set(0, 1.81, -0.02); visual.add(hair);
  const limbs = [];
  let rightArm = null;
  let punchTimer = 0;
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.115, 0.42, 3, 6), pants);
    leg.position.set(side * 0.135, 0.54, 0.015); leg.castShadow = true; visual.add(leg); limbs.push({ mesh: leg, phase: side ? Math.PI : 0, kind: 'leg' });
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.13, 0.38), shoes);
    shoe.position.set(side * 0.135, 0.12, -0.055); shoe.castShadow = true; visual.add(shoe);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.43, 3, 6), skin);
    arm.position.set(side * 0.37, 1.16, -0.01); arm.rotation.z = side * -0.08; arm.castShadow = true; visual.add(arm); limbs.push({ mesh: arm, phase: side ? Math.PI : 0, kind: 'arm' });
    if (side > 0) rightArm = arm;
  }
  const shoulderBag = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.4, 0.19), bag);
  shoulderBag.position.set(0.31, 1.21, 0.17); shoulderBag.castShadow = true; visual.add(shoulderBag);
  scene.add(visual);

  let verticalSpeed = 0;
  let grounded = false;
  let walkPhase = 0;
  let lastMoveLength = 0;
  let health = 100;
  let dead = false;
  let lastDamageSource = '';
  const position = new THREE.Vector3();
  const desired = new THREE.Vector3();
  const directions = { forward: new THREE.Vector3(), right: new THREE.Vector3() };

  function step(dt, input, cameraYaw) {
    punchTimer = Math.max(0, punchTimer - dt);
    const forward = directions.forward.set(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
    const right = directions.right.set(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));
    const x = Number(input.down('KeyD')) - Number(input.down('KeyA'));
    const z = Number(input.down('KeyW')) - Number(input.down('KeyS'));
    desired.set(0, 0, 0);
    if (x || z) {
      desired.addScaledVector(right, x).addScaledVector(forward, z).normalize();
    }
    const sprinting = input.down('ShiftLeft') || input.down('ShiftRight');
    const moveSpeed = sprinting ? 7.5 : 4.5;
    const horizontalX = desired.x * moveSpeed * dt;
    const horizontalZ = desired.z * moveSpeed * dt;

    const jumpPressed = input.consumePressed('Space');
    if (grounded && jumpPressed) verticalSpeed = 6.3;
    verticalSpeed = Math.max(-22, verticalSpeed - 18.5 * dt);
    controller.computeColliderMovement(collider, { x: horizontalX, y: verticalSpeed * dt, z: horizontalZ });
    const movement = controller.computedMovement();
    const current = body.translation();
    position.set(current.x + movement.x, current.y + movement.y, current.z + movement.z);
    body.setNextKinematicTranslation(position);
    grounded = controller.computedGrounded();
    if (grounded && verticalSpeed < 0) verticalSpeed = 0;
    physicsWorld.step();

    const actual = body.translation();
    visual.position.set(actual.x, actual.y - 0.9, actual.z);
    const horizontalSpeed = Math.hypot(movement.x, movement.z) / Math.max(dt, 0.0001);
    lastMoveLength = horizontalSpeed;
    if (horizontalSpeed > 0.15) {
      const targetRotation = Math.atan2(-desired.x, -desired.z);
      let angleDelta = ((targetRotation - visual.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      visual.rotation.y += angleDelta * Math.min(1, dt * 13);
    }
    if (horizontalSpeed > 0.35 && grounded) {
      walkPhase += dt * (sprinting ? 12 : 8);
      for (const limb of limbs) {
        const swing = Math.sin(walkPhase + limb.phase) * (sprinting ? 0.48 : 0.3);
        limb.mesh.rotation.x = limb.kind === 'leg' ? swing : -swing * 0.7;
      }
      torso.position.y = 1.13 + Math.abs(Math.sin(walkPhase * 2)) * 0.025;
    } else if (grounded) {
      for (const limb of limbs) limb.mesh.rotation.x *= Math.max(0, 1 - dt * 8);
      torso.position.y = THREE.MathUtils.damp(torso.position.y, 1.13, 8, dt);
    }
    if (rightArm) {
      const strike = punchTimer > 0 ? Math.sin((1 - punchTimer / 0.28) * Math.PI) : 0;
      const gait = horizontalSpeed > 0.35 && grounded ? -Math.sin(walkPhase + Math.PI) * (sprinting ? 0.48 : 0.3) * 0.7 : 0;
      rightArm.rotation.x = gait - strike * 1.25;
    }
  }

  return {
    body, collider, controller, visual,
    step,
    setInVehicle(value) {
      visual.visible = !value;
      collider.setEnabled(!value);
    },
    setFacing(value) { if (Number.isFinite(value)) visual.rotation.y = value; },
    punch() { punchTimer = 0.28; },
    setPosition(x, y, z, heading = 0) {
      body.setTranslation({ x, y, z }, true);
      physicsWorld.propagateModifiedBodyPositionsToColliders();
      verticalSpeed = 0;
      grounded = false;
      lastMoveLength = 0;
      walkPhase = 0;
      visual.position.set(x, y - 0.9, z);
      visual.rotation.y = heading;
    },
    takeDamage(amount, source = 'unknown') {
      if (dead || !Number.isFinite(amount) || amount <= 0) return 0;
      const previous = health;
      health = THREE.MathUtils.clamp(health - amount, 0, 100);
      lastDamageSource = String(source);
      if (health <= 0) dead = true;
      return previous - health;
    },
    heal(amount) {
      if (dead || !Number.isFinite(amount) || amount <= 0) return health;
      health = THREE.MathUtils.clamp(health + amount, 0, 100);
      return health;
    },
    respawn(x, y, z, heading = 0) {
      body.setTranslation({ x, y, z }, true);
      physicsWorld.propagateModifiedBodyPositionsToColliders();
      collider.setEnabled(true);
      verticalSpeed = 0;
      grounded = false;
      lastMoveLength = 0;
      walkPhase = 0;
      health = 100;
      dead = false;
      lastDamageSource = '';
      visual.visible = true;
      visual.position.set(x, y - 0.9, z);
      visual.rotation.set(0, heading, 0);
      for (const limb of limbs) limb.mesh.rotation.set(0, 0, 0);
      torso.position.y = 1.13;
    },
    position: () => {
      const p = body.translation();
      return { x: p.x, y: p.y, z: p.z };
    },
    get grounded() { return grounded; },
    get speed() { return lastMoveLength; },
    get health() { return health; },
    setHealth(value) {
      health = THREE.MathUtils.clamp(Number.isFinite(value) ? value : health, 0, 100);
      dead = health <= 0;
      return health;
    },
    isDead: () => dead,
    get lastDamageSource() { return lastDamageSource; },
    get facing() { return visual.rotation.y; },
  };
}
