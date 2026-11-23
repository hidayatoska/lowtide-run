import * as THREE from 'three';
import { CITY_LIMIT } from './city.js';

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

export function createPoliceHelicopter(scene, { notify = () => {} } = {}) {
  let root = null, rotor = null, tailRotor = null, redLight = null, blueLight = null;
  let rotorPhase = 0, orbitPhase = 0, despawnTimer = 0, level = 0;

  function box(parent, geometry, material, position, size = [1, 1, 1], rotation = null) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position); mesh.scale.set(...size);
    if (rotation) mesh.rotation.set(...rotation);
    mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }

  function createModel(position) {
    root = new THREE.Group(); root.name = 'Police helicopter';
    const navy = new THREE.MeshStandardMaterial({ color: '#263b46', roughness: 0.45, metalness: 0.24, flatShading: true });
    const white = new THREE.MeshStandardMaterial({ color: '#dce0d7', roughness: 0.54, metalness: 0.12, flatShading: true });
    const glass = new THREE.MeshStandardMaterial({ color: '#6c9ba3', roughness: 0.2, metalness: 0.2, transparent: true, opacity: 0.78 });
    const red = new THREE.MeshStandardMaterial({ color: '#ff584f', emissive: '#fa3025', emissiveIntensity: 1.1 });
    const blue = new THREE.MeshStandardMaterial({ color: '#54aaff', emissive: '#176dff', emissiveIntensity: 0.3 });
    box(root, new THREE.BoxGeometry(1, 1, 1), navy, [0, 0, 0], [1.55, 1.05, 2.7]);
    box(root, new THREE.SphereGeometry(0.74, 12, 9), white, [0, 0.12, 0.12], [1.04, 0.84, 1.32]);
    box(root, new THREE.BoxGeometry(1, 1, 1), glass, [0, 0.26, -0.91], [1.18, 0.58, 0.65], [-0.12, 0, 0]);
    box(root, new THREE.BoxGeometry(1, 1, 1), navy, [0, 0.05, 2.12], [0.25, 0.25, 2.35]);
    box(root, new THREE.BoxGeometry(0.13, 0.82, 0.4), white, [0, 0.14, 3.22]);
    box(root, new THREE.BoxGeometry(0.18, 0.72, 0.12), navy, [0, 0.1, 3.32]);
    for (const side of [-1, 1]) {
      box(root, new THREE.BoxGeometry(0.08, 0.86, 0.08), navy, [side * 0.66, -0.72, 0.15], [1, 1, 1], [0, 0, side * -0.11]);
      box(root, new THREE.BoxGeometry(0.12, 0.12, 3.2), navy, [side * 0.88, -1.1, 0.18]);
      box(root, new THREE.BoxGeometry(0.1, 0.44, 0.1), navy, [side * 0.83, -0.78, -0.83]);
      box(root, new THREE.BoxGeometry(0.1, 0.44, 0.1), navy, [side * 0.83, -0.78, 1.08]);
    }
    const mast = box(root, new THREE.CylinderGeometry(0.08, 0.08, 0.48, 8), navy, [0, 0.69, 0]);
    mast.castShadow = false;
    rotor = new THREE.Group(); rotor.position.set(0, 0.92, 0); root.add(rotor);
    box(rotor, new THREE.BoxGeometry(1, 1, 1), navy, [0, 0, 0], [8.5, 0.045, 0.2]);
    box(rotor, new THREE.BoxGeometry(1, 1, 1), navy, [0, 0.008, 0], [0.2, 0.045, 8.5]);
    tailRotor = new THREE.Group(); tailRotor.position.set(0.18, 0.25, 3.34); root.add(tailRotor);
    box(tailRotor, new THREE.BoxGeometry(1, 1, 1), navy, [0, 0, 0], [0.86, 0.13, 0.08]);
    box(tailRotor, new THREE.BoxGeometry(1, 1, 1), navy, [0, 0, 0], [0.08, 0.13, 0.86]);
    redLight = box(root, new THREE.SphereGeometry(0.14, 8, 6), red, [-0.48, 0.5, 0.1]);
    blueLight = box(root, new THREE.SphereGeometry(0.14, 8, 6), blue, [0.48, 0.5, 0.1]);
    root.position.copy(position); scene.add(root);
  }

  function removeModel() {
    if (!root) return;
    scene.remove(root);
    root.traverse(object => {
      object.geometry?.dispose();
      if (Array.isArray(object.material)) object.material.forEach(material => material.dispose());
      else object.material?.dispose();
    });
    root = rotor = tailRotor = redLight = blueLight = null;
  }

  function step(dt, wantedLevel, target, visible, lastKnown, heading = 0) {
    level = wantedLevel;
    if (level >= 4 && !root) {
      const spawn = new THREE.Vector3(clamp(target.x - Math.sin(heading) * 58, -CITY_LIMIT + 12, CITY_LIMIT - 12), 22, clamp(target.z - Math.cos(heading) * 58, -CITY_LIMIT + 12, CITY_LIMIT - 12));
      createModel(spawn);
      orbitPhase = 0;
      notify('Police helicopter deployed');
    }
    if (!root) return;
    if (level === 0) {
      despawnTimer += dt;
      if (despawnTimer >= 4) { removeModel(); despawnTimer = 0; return; }
    } else despawnTimer = 0;

    const tracked = visible || level === 0 ? target : lastKnown;
    orbitPhase += dt * (level >= 5 ? 0.28 : 0.09);
    const radius = level >= 5 ? 50 : 58;
    const forwardX = -Math.sin(heading), forwardZ = -Math.cos(heading);
    const rightX = Math.cos(heading), rightZ = -Math.sin(heading);
    const desiredX = clamp(tracked.x + (forwardX * Math.cos(orbitPhase) + rightX * Math.sin(orbitPhase)) * radius, -CITY_LIMIT + 12, CITY_LIMIT - 12);
    const desiredZ = clamp(tracked.z + (forwardZ * Math.cos(orbitPhase) + rightZ * Math.sin(orbitPhase)) * radius, -CITY_LIMIT + 12, CITY_LIMIT - 12);
    const desiredY = level >= 5 ? 24 : 22;
    const delta = new THREE.Vector3(desiredX - root.position.x, desiredY - root.position.y, desiredZ - root.position.z);
    const distance = delta.length();
    const maxSpeed = level >= 5 ? 24 : 17;
    if (distance > 0.001) root.position.addScaledVector(delta, Math.min(1, maxSpeed * dt / distance));
    const dx = tracked.x - root.position.x, dz = tracked.z - root.position.z;
    root.rotation.y = Math.atan2(-dx, -dz);
    rotorPhase += dt * (level >= 5 ? 26 : 21);
    rotor.rotation.y = rotorPhase;
    tailRotor.rotation.z = rotorPhase * 1.9;
    const flash = Math.sin(performance.now() * 0.012) > 0;
    redLight.material.emissiveIntensity = flash ? 1.5 : 0.22;
    blueLight.material.emissiveIntensity = flash ? 0.22 : 1.5;
  }

  return {
    step,
    position() { return root ? { x: root.position.x, z: root.position.z, y: root.position.y } : null; },
    get active() { return Boolean(root); },
    get level() { return level; },
    get rotorAngle() { return rotor?.rotation.y ?? 0; },
    dispose: removeModel,
  };
}
