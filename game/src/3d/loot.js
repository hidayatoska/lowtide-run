import * as THREE from 'three';

const MAX_DROPS = 24;
const LIFETIME = 38;
const AMMO_PICKUPS = {
  pistol: { name: 'Pistol Ammo', amount: 12, color: '#d1b45e' },
  smg: { name: 'SMG Ammo', amount: 30, color: '#79b596' },
  shotgun: { name: 'Shotgun Ammo', amount: 4, color: '#d28b5f' },
  rifle: { name: 'Rifle Ammo', amount: 30, color: '#79a7c1' },
  sniper: { name: 'Sniper Ammo', amount: 3, color: '#aa8ec7' },
};

export function createLootSystem({ scene, economy, weapons, city, notify, config = {} }) {
  const params = new URLSearchParams(location.search);
  const devLoot = import.meta.env.DEV ? params.get('debugLoot') : '';
  const options = {
    cashChance: devLoot === 'cash' ? 1 : devLoot === 'ammo' ? 0 : devLoot === '1' ? 1 : 0.72,
    ammoChance: devLoot === 'ammo' ? 1 : devLoot === 'cash' || devLoot === '1' ? 0 : 0.34,
    lifetime: devLoot ? 90 : LIFETIME,
    maxDrops: MAX_DROPS,
    ...config,
  };
  const items = [];
  let nextDropId = 1;
  const cashGeometry = new THREE.DodecahedronGeometry(0.24, 0);
  const ammoGeometry = new THREE.BoxGeometry(0.42, 0.28, 0.34);
  const stripeGeometry = new THREE.BoxGeometry(0.44, 0.07, 0.36);
  const ringGeometry = new THREE.TorusGeometry(0.37, 0.035, 5, 18);
  const cashMaterial = new THREE.MeshStandardMaterial({ color: '#63c77f', emissive: '#1d8c42', emissiveIntensity: 0.72, roughness: 0.45, flatShading: true });
  const ammoMaterials = new Map();
  const ringMaterial = new THREE.MeshBasicMaterial({ color: '#8fe2a0', transparent: true, opacity: 0.65 });

  function materialFor(id) {
    if (!ammoMaterials.has(id)) ammoMaterials.set(id, new THREE.MeshStandardMaterial({ color: AMMO_PICKUPS[id].color, emissive: AMMO_PICKUPS[id].color, emissiveIntensity: 0.23, roughness: 0.56, flatShading: true }));
    return ammoMaterials.get(id);
  }

  function makeItem(type, x, z, amount, ammoId = '') {
    const group = new THREE.Group();
    group.position.set(x, 0.08, z);
    group.name = type === 'cash' ? 'Cash loot pickup' : `${ammoId} ammo pickup`;
    const body = new THREE.Mesh(type === 'cash' ? cashGeometry : ammoGeometry, type === 'cash' ? cashMaterial : materialFor(ammoId));
    body.castShadow = true; group.add(body);
    if (type === 'ammo') {
      const stripe = new THREE.Mesh(stripeGeometry, materialFor(ammoId)); stripe.position.y = 0.015; group.add(stripe);
    }
    const ring = new THREE.Mesh(ringGeometry, ringMaterial); ring.rotation.x = -Math.PI / 2; ring.position.y = -0.035; group.add(ring);
    scene.add(group);
    items.push({ id: nextDropId++, type, x, z, amount, ammoId, age: 0, group, collected: false, baseY: 0.08 });
  }

  function clearItem(index) {
    const [item] = items.splice(index, 1);
    if (item) scene.remove(item.group);
    return item;
  }

  function spawnForNpc(agent) {
    const itemCount = items.length;
    if (!agent || agent.lootDropped) return 0;
    agent.lootDropped = true;
    if (itemCount >= options.maxDrops) clearItem(0);
    const radians = Math.random() * Math.PI * 2;
    let x = agent.x + Math.cos(radians) * 0.65, z = agent.z + Math.sin(radians) * 0.65;
    if (!city.canStandAt(x, z, 0.3)) { x = agent.x; z = agent.z; }
    let spawned = 0;
    if (Math.random() < options.cashChance) {
      makeItem('cash', x, z, Math.floor(10 + Math.random() * 241)); spawned++;
    }
    if (items.length < options.maxDrops && Math.random() < options.ammoChance) {
      const available = Object.keys(AMMO_PICKUPS).filter(id => weapons.unlocked(id));
      if (available.length) {
        const ammoId = available[Math.floor(Math.random() * available.length)];
        makeItem('ammo', x + 0.35, z + 0.15, AMMO_PICKUPS[ammoId].amount, ammoId); spawned++;
      }
    }
    return spawned;
  }

  function update(dt) {
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i];
      item.age += dt;
      if (item.age >= options.lifetime) { clearItem(i); continue; }
      item.group.position.y = item.baseY + Math.sin(item.age * 2.6) * 0.11;
      item.group.rotation.y += dt * (item.type === 'cash' ? 0.55 : 0.38);
    }
  }

  function nearby(position, inVehicle = false) {
    if (inVehicle) return null;
    let best = null, bestDistance = 2.15;
    for (const item of items) {
      const distance = Math.hypot(item.x - position.x, item.z - position.z);
      if (distance < bestDistance) { best = item; bestDistance = distance; }
    }
    return best;
  }

  function prompt(item) {
    if (!item) return '';
    return item.type === 'cash' ? `E  COLLECT $${item.amount}` : `E  COLLECT ${AMMO_PICKUPS[item.ammoId].name} +${item.amount}`;
  }

  function collect(id, position, inVehicle = false) {
    const index = items.findIndex(item => item.id === id && !item.collected);
    if (index < 0 || inVehicle) return false;
    const item = items[index];
    if (Math.hypot(item.x - position.x, item.z - position.z) > 2.15) return false;
    item.collected = true;
    if (item.type === 'cash') {
      economy.add(item.amount);
      clearItem(index);
      notify(`$${item.amount} collected`);
      return true;
    }
    const amount = weapons.addReserve(item.ammoId, item.amount);
    if (!amount) {
      item.collected = false;
      notify(weapons.unlocked(item.ammoId) ? 'Ammo full' : `${AMMO_PICKUPS[item.ammoId].name} unavailable`);
      return false;
    }
    clearItem(index);
    notify(`${AMMO_PICKUPS[item.ammoId].name} +${amount}`);
    return true;
  }

  return {
    items,
    spawnForNpc,
    update,
    nearby,
    prompt,
    collect,
    dispose() {
      while (items.length) clearItem(items.length - 1);
      cashGeometry.dispose(); ammoGeometry.dispose(); stripeGeometry.dispose(); ringGeometry.dispose();
      cashMaterial.dispose(); ringMaterial.dispose();
      for (const material of ammoMaterials.values()) material.dispose();
    },
  };
}
