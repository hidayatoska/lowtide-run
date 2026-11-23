import * as THREE from 'three';

export const CITY_LIMIT = 211;
const ROAD_SPACING = 64;
export const ROAD_LINES = [-160, -96, -32, 32, 96, 160];
const ROAD_WIDTH = 14;

const box = new THREE.BoxGeometry(1, 1, 1);
const unitWindow = new THREE.BoxGeometry(1, 1, 1);

function instances(scene, geometry, material, items, name) {
  if (!items.length) return null;
  const mesh = new THREE.InstancedMesh(geometry, material, items.length);
  mesh.name = name;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  const object = new THREE.Object3D();
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    object.position.set(item.x, item.y, item.z);
    object.rotation.set(0, item.ry || 0, 0);
    object.scale.set(item.sx, item.sy, item.sz);
    object.updateMatrix();
    mesh.setMatrixAt(i, object.matrix);
    if (item.color) mesh.setColorAt(i, new THREE.Color(item.color));
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  scene.add(mesh);
  return mesh;
}

function addPlane(scene, geometry, material, x, y, z, sx, sy, sz) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function makeRoofGeometry() {
  const p = [
    -0.5, 0, -0.5, 0.5, 0, -0.5, 0, 0.32, 0,
    0.5, 0, -0.5, 0.5, 0, 0.5, 0, 0.32, 0,
    0.5, 0, 0.5, -0.5, 0, 0.5, 0, 0.32, 0,
    -0.5, 0, 0.5, -0.5, 0, -0.5, 0, 0.32, 0,
    -0.5, 0, -0.5, -0.5, 0, 0.5, 0.5, 0, 0.5,
    -0.5, 0, -0.5, 0.5, 0, 0.5, 0.5, 0, -0.5,
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function createBuildingPlan() {
  const plan = [];
  let id = 0;
  for (let ix = 0; ix < 5; ix++) {
    for (let iz = 0; iz < 5; iz++) {
      const blockX = -128 + ix * ROAD_SPACING;
      const blockZ = -128 + iz * ROAD_SPACING;
      const isPark = ix === 2 && iz === 1;
      if (isPark) continue;
      for (let lx = 0; lx < 2; lx++) {
        for (let lz = 0; lz < 2; lz++) {
          const seed = (ix * 19 + iz * 31 + lx * 7 + lz * 13) % 11;
          const type = seed < 4 ? 'house' : seed < 7 ? 'shop' : seed < 9 ? 'walkup' : 'warehouse';
          const w = (type === 'warehouse' ? 21 : 19) + (seed % 3) * 1.2;
          const d = (type === 'house' ? 19 : 20) + ((seed + 1) % 3);
          const height = type === 'house' ? 4.3 + (seed % 2) * 0.6
            : type === 'shop' ? 6.5 + (seed % 3) * 1.4
              : type === 'walkup' ? 12 + (seed % 4) * 2.3
                : 7.2 + (seed % 2) * 1.5;
          plan.push({
            id: id++, type, x: blockX + (lx ? 13 : -13), z: blockZ + (lz ? 13 : -13),
            w, d, height,
            color: type === 'house' ? ['#d1b58d', '#b5aa91', '#d2c3a1', '#b98d72'][seed % 4]
              : type === 'shop' ? ['#aa9476', '#a8a18d', '#a17f69', '#a6a084'][seed % 4]
                : type === 'walkup' ? ['#a79d88', '#878f89', '#9a8f80', '#8b968d'][seed % 4]
                  : ['#969184', '#958a79', '#8c9188'][seed % 3],
          });
        }
      }
    }
  }
  return plan;
}

function getDistrict(x, z) {
  if (z > 105) return x > 60 ? 'Beacon Point' : 'Breakwater';
  if (z > 35) return x < -55 ? 'Salt Gardens' : 'Old Harbor';
  if (x > 85) return 'Trawler Row';
  if (z < -75) return 'South Quay';
  return 'Market Ward';
}

export function buildCity(scene, physics, RAPIER) {
  const mats = {
    grass: new THREE.MeshStandardMaterial({ color: '#829477', roughness: 1 }),
    asphalt: new THREE.MeshStandardMaterial({ color: '#4c5757', roughness: 0.98 }),
    sidewalk: new THREE.MeshStandardMaterial({ color: '#b3ab96', roughness: 1 }),
    curb: new THREE.MeshStandardMaterial({ color: '#ddd1b7', roughness: 1 }),
    roadMark: new THREE.MeshStandardMaterial({ color: '#e2d3ad', roughness: 1 }),
    window: new THREE.MeshStandardMaterial({ color: '#45646a', roughness: 0.38, metalness: 0.08, emissive: '#203239', emissiveIntensity: 0.14 }),
    warmWindow: new THREE.MeshStandardMaterial({ color: '#d2b576', roughness: 0.42, emissive: '#8f682b', emissiveIntensity: 0.35 }),
    trim: new THREE.MeshStandardMaterial({ color: '#e0d0ae', roughness: 0.86 }),
    awning: new THREE.MeshStandardMaterial({ color: '#bd795d', roughness: 0.8 }),
    roof: new THREE.MeshStandardMaterial({ color: '#955f4e', roughness: 0.95 }),
    roofLight: new THREE.MeshStandardMaterial({ color: '#a77f63', roughness: 0.95 }),
    treeTrunk: new THREE.MeshStandardMaterial({ color: '#665644', roughness: 1 }),
    leaves: new THREE.MeshStandardMaterial({ color: '#668466', roughness: 0.94 }),
    leavesLight: new THREE.MeshStandardMaterial({ color: '#83936a', roughness: 0.94 }),
    lamp: new THREE.MeshStandardMaterial({ color: '#394d4d', roughness: 0.68, metalness: 0.3 }),
    lampGlow: new THREE.MeshStandardMaterial({ color: '#f0d19a', emissive: '#dfac5b', emissiveIntensity: 0.48, roughness: 0.4 }),
    sand: new THREE.MeshStandardMaterial({ color: '#d1bd91', roughness: 1 }),
    water: new THREE.MeshStandardMaterial({ color: '#397c80', roughness: 0.3, metalness: 0.12, transparent: true, opacity: 0.94 }),
    pier: new THREE.MeshStandardMaterial({ color: '#806c50', roughness: 1 }),
    parkPath: new THREE.MeshStandardMaterial({ color: '#c3b99d', roughness: 1 }),
  };
  const ground = addPlane(scene, new THREE.PlaneGeometry(620, 480), mats.grass, 0, 0, -70, 1, 1, 1);
  ground.rotation.x = -Math.PI / 2;

  const staticBody = physics.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  physics.createCollider(RAPIER.ColliderDesc.cuboid(310, 0.12, 310).setTranslation(0, -0.12, 0).setFriction(0.24), staticBody);

  const roadMeshes = new THREE.Group();
  roadMeshes.name = 'Streets and curbs';
  scene.add(roadMeshes);
  const sidewalks = [];
  const curbs = [];
  const segmentPairs = (crossings, start = -215, end = 215, halfGap = ROAD_WIDTH / 2 + 0.8) => {
    const segments = [];
    let cursor = start;
    for (const crossing of crossings) {
      const gapStart = crossing - halfGap;
      const gapEnd = crossing + halfGap;
      if (gapStart > cursor) segments.push([cursor, gapStart]);
      cursor = Math.max(cursor, gapEnd);
    }
    if (cursor < end) segments.push([cursor, end]);
    return segments;
  };
  for (const p of ROAD_LINES) {
    const horizontal = new THREE.Mesh(new THREE.PlaneGeometry(430, ROAD_WIDTH), mats.asphalt);
    horizontal.rotation.x = -Math.PI / 2; horizontal.position.set(0, 0.005, p); roadMeshes.add(horizontal);
    const vertical = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_WIDTH, 430), mats.asphalt);
    vertical.rotation.x = -Math.PI / 2; vertical.position.set(p, 0.006, 0); roadMeshes.add(vertical);
    for (const side of [-1, 1]) {
      const z = p + side * 8.7;
      const curbZ = p + side * 7.08;
      for (const [from, to] of segmentPairs(ROAD_LINES)) {
        sidewalks.push({ x: (from + to) / 2, y: 0.02, z, sx: to - from, sy: 0.04, sz: 3.4 });
        curbs.push({ x: (from + to) / 2, y: 0.09, z: curbZ, sx: to - from, sy: 0.17, sz: 0.22 });
      }
      const x = p + side * 8.7;
      const curbX = p + side * 7.08;
      for (const [from, to] of segmentPairs(ROAD_LINES)) {
        sidewalks.push({ x, y: 0.02, z: (from + to) / 2, sx: 3.4, sy: 0.04, sz: to - from });
        curbs.push({ x: curbX, y: 0.09, z: (from + to) / 2, sx: 0.22, sy: 0.17, sz: to - from });
      }
    }
  }
  instances(scene, box, mats.sidewalk, sidewalks, 'Instanced sidewalk segments');
  instances(scene, box, mats.curb, curbs, 'Instanced curb segments');

  const roadPaint = [];
  for (const p of ROAD_LINES) {
    for (let i = -14; i <= 14; i++) {
      const at = i * 14;
      roadPaint.push({ x: at, y: 0.035, z: p, sx: 5.7, sy: 0.025, sz: 0.16 });
      roadPaint.push({ x: p, y: 0.036, z: at, sx: 0.16, sy: 0.025, sz: 5.7 });
    }
  }
  instances(scene, box, mats.roadMark, roadPaint, 'Dashed lane markings');

  const crosswalks = [];
  for (const x of ROAD_LINES) for (const z of ROAD_LINES) {
    for (let i = -4; i <= 4; i++) {
      const off = i * 0.72;
      crosswalks.push({ x: x - 5.05, y: 0.04, z: z + off, sx: 2.8, sy: 0.025, sz: 0.36 });
      crosswalks.push({ x: x + 5.05, y: 0.04, z: z + off, sx: 2.8, sy: 0.025, sz: 0.36 });
      crosswalks.push({ x: x + off, y: 0.04, z: z - 5.05, sx: 0.36, sy: 0.025, sz: 2.8 });
      crosswalks.push({ x: x + off, y: 0.04, z: z + 5.05, sx: 0.36, sy: 0.025, sz: 2.8 });
    }
  }
  instances(scene, box, mats.roadMark, crosswalks, 'Intersection crosswalks');

  const plan = createBuildingPlan();
  const bodyMesh = new THREE.InstancedMesh(box, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.91 }), plan.length);
  bodyMesh.name = 'Procedural coastal buildings';
  bodyMesh.castShadow = false; bodyMesh.receiveShadow = true;
  const roofFlat = [];
  const roofPitched = [];
  const windows = [];
  const awnings = [];
  const signs = [];
  const matrixObject = new THREE.Object3D();
  const glassColors = ['#39585e', '#45666a', '#283f49', '#c4a571'];
  for (let i = 0; i < plan.length; i++) {
    const b = plan[i];
    matrixObject.position.set(b.x, b.height / 2, b.z);
    matrixObject.scale.set(b.w, b.height, b.d);
    matrixObject.updateMatrix();
    bodyMesh.setMatrixAt(i, matrixObject.matrix);
    bodyMesh.setColorAt(i, new THREE.Color(b.color));
    physics.createCollider(
      RAPIER.ColliderDesc.cuboid(b.w / 2, b.height / 2, b.d / 2)
        .setTranslation(b.x, b.height / 2, b.z).setFriction(0.85), staticBody,
    );
    if (b.type === 'house') roofPitched.push({ x: b.x, y: b.height + 0.02, z: b.z, sx: b.w + 1, sy: 1, sz: b.d + 1, color: i % 2 ? '#9c6652' : '#a77b61' });
    else roofFlat.push({ x: b.x, y: b.height + 0.13, z: b.z, sx: b.w + 0.55, sy: 0.27, sz: b.d + 0.55, color: b.type === 'shop' ? '#8e6e58' : '#777e77' });

    const rowStep = b.height > 10 ? 2.25 : 1.85;
    const rowCount = Math.max(1, Math.floor((b.height - 2.0) / rowStep));
    const columnsX = Math.max(2, Math.floor((b.w - 3) / 3.1));
    const columnsZ = Math.max(2, Math.floor((b.d - 3) / 3.1));
    for (let row = 0; row < rowCount; row++) {
      const y = 1.35 + row * rowStep;
      for (let col = 0; col < columnsX; col++) {
        const x = b.x + (col - (columnsX - 1) / 2) * (b.w - 3) / columnsX;
        const color = glassColors[(b.id + row + col * 2) % glassColors.length];
        for (const side of [-1, 1]) windows.push({ x, y, z: b.z + side * (b.d / 2 + 0.065), sx: 1.05, sy: 0.85, sz: 0.13, color });
      }
      for (let col = 0; col < columnsZ; col++) {
        const z = b.z + (col - (columnsZ - 1) / 2) * (b.d - 3) / columnsZ;
        const color = glassColors[(b.id + row + col + 1) % glassColors.length];
        for (const side of [-1, 1]) windows.push({ x: b.x + side * (b.w / 2 + 0.065), y, z, sx: 0.13, sy: 0.85, sz: 1.05, color });
      }
    }
    if (b.type === 'shop') {
      awnings.push({ x: b.x, y: 2.9, z: b.z + b.d / 2 + 0.7, sx: b.w * 0.78, sy: 0.24, sz: 1.1, color: ['#a95e4d', '#597c75', '#bf9b62'][b.id % 3] });
      signs.push({ x: b.x, y: 4.15, z: b.z + b.d / 2 + 0.15, sx: b.w * 0.57, sy: 0.45, sz: 0.2, color: '#ddc58e' });
    }
  }
  bodyMesh.instanceMatrix.needsUpdate = true; bodyMesh.instanceColor.needsUpdate = true; scene.add(bodyMesh);
  instances(scene, box, mats.roofLight, roofFlat, 'Flat rooftops');
  instances(scene, makeRoofGeometry(), mats.roof, roofPitched, 'Pitched house roofs');
  instances(scene, unitWindow, mats.window, windows, 'Facade windows');
  instances(scene, box, mats.awning, awnings, 'Shop awnings');
  instances(scene, box, mats.trim, signs, 'Shop signs');

  // One landscaped civic green gives the dense street grid a walkable public place.
  addPlane(scene, new THREE.PlaneGeometry(48, 48), new THREE.MeshStandardMaterial({ color: '#93a082', roughness: 1 }), 0, 0.025, -64, 1, 1, 1).rotation.x = -Math.PI / 2;
  const parkPaths = [
    { x: 0, y: 0.04, z: -64, sx: 3.5, sy: 0.03, sz: 48 },
    { x: 0, y: 0.045, z: -64, sx: 48, sy: 0.03, sz: 3.5 },
    { x: -10, y: 0.05, z: -74, sx: 2, sy: 0.035, sz: 18, ry: -0.5 },
    { x: 10, y: 0.05, z: -54, sx: 2, sy: 0.035, sz: 18, ry: -0.5 },
  ];
  instances(scene, box, mats.parkPath, parkPaths, 'Park walking paths');
  const treePos = [];
  const lampPosts = [];
  const lampHeads = [];
  const treeLocations = [];
  for (const p of ROAD_LINES) {
    for (let i = -2; i <= 2; i++) {
      const offset = i * 15;
      for (const side of [-1, 1]) {
        if ((p === -96 && Math.abs(offset) < 30) || (p === -32 && Math.abs(offset) < 30)) continue;
        treeLocations.push([p + side * 10.6, offset]);
        treeLocations.push([offset, p + side * 10.6]);
      }
    }
    for (const side of [-1, 1]) {
      for (let i = -2; i <= 2; i++) {
        const offset = i * 24;
        lampPosts.push({ x: p + side * 6.0, y: 3.1, z: offset, sx: 0.17, sy: 6.2, sz: 0.17 });
        lampPosts.push({ x: offset, y: 3.1, z: p + side * 6.0, sx: 0.17, sy: 6.2, sz: 0.17 });
        lampHeads.push({ x: p + side * 6.7, y: 6.0, z: offset, sx: 0.8, sy: 0.16, sz: 0.3 });
        lampHeads.push({ x: offset, y: 6.0, z: p + side * 6.7, sx: 0.3, sy: 0.16, sz: 0.8 });
      }
    }
  }
  for (let x = -21; x <= 21; x += 14) for (let z = -85; z <= -43; z += 14) treeLocations.push([x, z]);
  for (const [x, z] of treeLocations) {
    const height = 2.3 + ((Math.abs(Math.round(x + z)) % 4) * 0.18);
    treePos.push({ x, y: height / 2, z, sx: 0.34, sy: height, sz: 0.34 });
  }
  instances(scene, new THREE.CylinderGeometry(0.5, 0.72, 1, 6), mats.treeTrunk, treePos, 'Instanced tree trunks');
  instances(scene, new THREE.IcosahedronGeometry(1, 1), mats.leaves, treeLocations.map(([x, z], i) => ({ x, y: 3.15 + (i % 3) * 0.17, z, sx: 2.0 + (i % 3) * 0.15, sy: 2.2 + (i % 2) * 0.2, sz: 1.9 + (i % 4) * 0.1, color: i % 3 === 0 ? '#82936b' : '#668466' })), 'Instanced coastal tree canopies');
  instances(scene, new THREE.CylinderGeometry(0.5, 0.5, 1, 8), mats.lamp, lampPosts, 'Instanced street lamps');
  instances(scene, box, mats.lampGlow, lampHeads, 'Street lamp heads');

  // The city thins into a public beach and a small timber pier along the east inlet.
  addPlane(scene, new THREE.PlaneGeometry(430, 42), mats.sand, 0, -0.04, 190, 1, 1, 1).rotation.x = -Math.PI / 2;
  addPlane(scene, new THREE.PlaneGeometry(700, 280), mats.water, 0, -0.16, 333, 1, 1, 1).rotation.x = -Math.PI / 2;
  const pierDeck = new THREE.Mesh(new THREE.BoxGeometry(8, 0.45, 61), mats.pier);
  pierDeck.position.set(16, 0.45, 208); scene.add(pierDeck);
  const pierRails = [];
  const pierPosts = [];
  for (let z = 183; z < 238; z += 3) {
    pierPosts.push({ x: 12.3, y: -0.6, z, sx: 0.5, sy: 2.2, sz: 0.5 }, { x: 19.7, y: -0.6, z, sx: 0.5, sy: 2.2, sz: 0.5 });
    pierRails.push({ x: 12.2, y: 1.0, z, sx: 0.2, sy: 0.15, sz: 2.5 }, { x: 19.8, y: 1.0, z, sx: 0.2, sy: 0.15, sz: 2.5 });
  }
  instances(scene, box, mats.pier, pierPosts, 'Pier supports');
  instances(scene, box, mats.pier, pierRails, 'Pier railings');

  const boundaryBody = staticBody;
  for (const [x, z, hx, hz] of [[-CITY_LIMIT, 0, 0.5, CITY_LIMIT], [CITY_LIMIT, 0, 0.5, CITY_LIMIT], [0, -CITY_LIMIT, CITY_LIMIT, 0.5], [0, CITY_LIMIT, CITY_LIMIT, 0.5]]) {
    physics.createCollider(RAPIER.ColliderDesc.cuboid(hx, 8, hz).setTranslation(x, 7.8, z), boundaryBody);
  }

  const buildingHitMeshes = [bodyMesh];
  return {
    buildings: plan,
    roadLines: ROAD_LINES,
    sidewalks,
    buildingHitMeshes,
    locationAt: getDistrict,
    canStandAt(x, z, radius = 0.45) {
      if (Math.abs(x) > CITY_LIMIT - radius || Math.abs(z) > CITY_LIMIT - radius) return false;
      return !plan.some(b => Math.abs(x - b.x) < b.w / 2 + radius && Math.abs(z - b.z) < b.d / 2 + radius);
    },
    stats: { buildings: plan.length, streetLights: lampPosts.length, trees: treeLocations.length },
    dispose() {
      for (const material of Object.values(mats)) material.dispose();
      box.dispose(); unitWindow.dispose();
    },
  };
}
