const STORAGE_KEY = 'lowtide-run.cheats.v1';
export const CHEAT_GROUPS = [
  { id: 'player', label: 'Player', items: [
    { id: 'godMode', label: 'God Mode', kind: 'toggle' }, { id: 'infiniteHealth', label: 'Infinite Health', kind: 'toggle' },
    { id: 'infiniteStamina', label: 'Infinite Stamina', kind: 'toggle' }, { id: 'superSpeed', label: 'Super Speed', kind: 'toggle' },
  ] },
  { id: 'weapons', label: 'Weapons', items: [
    { id: 'infiniteAmmo', label: 'Infinite Ammo', kind: 'toggle' }, { id: 'unlockAllWeapons', label: 'Unlock All Weapons', kind: 'toggle' },
    { id: 'noReload', label: 'No Reload', kind: 'toggle' },
  ] },
  { id: 'vehicles', label: 'Vehicles', items: [
    { id: 'vehicleGodMode', label: 'Vehicle God Mode', kind: 'toggle' }, { id: 'superVehicleSpeed', label: 'Super Vehicle Speed', kind: 'toggle' },
    { id: 'repairVehicle', label: 'Repair Current Vehicle', kind: 'action' },
  ] },
  { id: 'police', label: 'Police', items: [
    { id: 'clearWanted', label: 'Clear Wanted Level', kind: 'action' }, { id: 'disablePolice', label: 'Disable Police Pursuit', kind: 'toggle' },
    { id: 'freezePolice', label: 'Freeze Police', kind: 'toggle' }, { id: 'restorePolice', label: 'Restore Police AI', kind: 'action' },
  ] },
  { id: 'money', label: 'Money', items: [
    { id: 'money1000', label: 'Add $1,000', kind: 'action' }, { id: 'money10000', label: 'Add $10,000', kind: 'action' },
    { id: 'money100000', label: 'Add $100,000', kind: 'action' },
  ] },
  { id: 'world', label: 'World', items: [
    { id: 'daytime', label: 'Daytime', kind: 'toggle' }, { id: 'nighttime', label: 'Nighttime', kind: 'toggle' },
    { id: 'clearWeather', label: 'Clear Weather', kind: 'toggle' }, { id: 'rainyWeather', label: 'Rainy Weather', kind: 'toggle' },
  ] },
];
const DEFAULTS = { ...Object.fromEntries(CHEAT_GROUPS.flatMap(group => group.items.filter(item => item.kind === 'toggle').map(item => [item.id, false]))), daytime: true, clearWeather: true };

export function createCheats(world) {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { saved = {}; }
  const flags = { ...DEFAULTS, ...saved };
  world.state.cheats = flags;
  world.state.worldEffects = { dark: Boolean(flags.nighttime), rain: Boolean(flags.rainyWeather) };

  function persist() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(flags)); } catch { /* Private browsing can disable storage. */ } }
  function apply(id, value = !flags[id]) {
    flags[id] = Boolean(value);
    if (id === 'daytime' && value) flags.nighttime = false;
    if (id === 'nighttime' && value) flags.daytime = false;
    if (id === 'clearWeather' && value) flags.rainyWeather = false;
    if (id === 'rainyWeather' && value) flags.clearWeather = false;
    world.state.worldEffects.dark = Boolean(flags.nighttime);
    world.state.worldEffects.rain = Boolean(flags.rainyWeather);
    persist();
  }
  function activate(id) {
    const s = world.state;
    if (['daytime', 'nighttime', 'clearWeather', 'rainyWeather'].includes(id)) {
      const pairs = { daytime: 'nighttime', nighttime: 'daytime', clearWeather: 'rainyWeather', rainyWeather: 'clearWeather' };
      flags[id] = true; flags[pairs[id]] = false;
      world.state.worldEffects.dark = Boolean(flags.nighttime); world.state.worldEffects.rain = Boolean(flags.rainyWeather); persist();
      return `${CHEAT_GROUPS.flatMap(g => g.items).find(item => item.id === id).label}: ON`;
    }
    if (id in DEFAULTS) { apply(id); return `${CHEAT_GROUPS.flatMap(g => g.items).find(item => item.id === id).label}: ${flags[id] ? 'ON' : 'OFF'}`; }
    if (id === 'repairVehicle') { if (s.inCar) { s.car.damage = 0; s.car.speed = 0; } return s.inCar ? 'Vehicle repaired' : 'Enter a vehicle to repair it'; }
    if (id === 'clearWanted') { s.wanted = 0; s.escapeTime = 0; s.police.length = 0; return 'Wanted level cleared'; }
    if (id === 'restorePolice') { apply('disablePolice', false); apply('freezePolice', false); return 'Police AI restored'; }
    const money = { money1000: 1000, money10000: 10000, money100000: 100000 }[id];
    if (money) { s.player.money += money; return `$${money.toLocaleString()} added`; }
    return '';
  }
  function reset() {
    for (const id of Object.keys(flags)) flags[id] = Boolean(DEFAULTS[id]);
    world.state.worldEffects.dark = false; world.state.worldEffects.rain = false;
    persist(); return 'Cheat toggles reset';
  }
  return { flags, activate, reset };
}
