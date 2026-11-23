import * as THREE from 'three';

export function createFollowCamera(camera, obstacles) {
  const focus = new THREE.Vector3();
  const target = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const raycaster = new THREE.Raycaster();
  raycaster.near = 0.18;
  raycaster.far = 38;
  let yaw = 0.18;
  let pitch = 0.24;
  let distance = 8.2;
  let currentDistance = distance;

  function rotate(dx, dy) {
    yaw -= dx * 0.0027;
    pitch = THREE.MathUtils.clamp(pitch + dy * 0.0023, -0.05, 0.82);
  }

  function zoom(amount) {
    distance = THREE.MathUtils.clamp(distance + amount * 0.006, 3.4, 15.5);
  }

  function setYaw(value) { yaw = value; }

  function update(playerPosition, dt) {
    const p = playerPosition;
    target.set(p.x, p.y + 0.8, p.z);
    const cosPitch = Math.cos(pitch);
    direction.set(Math.sin(yaw) * cosPitch, Math.sin(pitch), Math.cos(yaw) * cosPitch).normalize();
    raycaster.set(target, direction);
    raycaster.far = distance;
    const hits = raycaster.intersectObjects(obstacles, false);
    const desiredDistance = hits.length ? Math.max(0.48, hits[0].distance - 0.42) : distance;
    currentDistance = THREE.MathUtils.damp(currentDistance, desiredDistance, desiredDistance < currentDistance ? 14 : 4.5, dt);
    focus.copy(target);
    target.addScaledVector(direction, currentDistance);
    camera.position.lerp(target, 1 - Math.exp(-dt * 9));
    const floorLimit = p.y + 0.32;
    if (camera.position.y < floorLimit) camera.position.y = THREE.MathUtils.damp(camera.position.y, floorLimit, 13, dt);
    camera.lookAt(focus);
  }

  return { rotate, zoom, setYaw, update, get yaw() { return yaw; }, get pitch() { return pitch; }, get distance() { return distance; } };
}
