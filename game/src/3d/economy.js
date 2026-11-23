const SAVE_KEY = 'lowtide-run-player-v1';

function readSave() {
  try {
    const value = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
    return {
      money: Number.isFinite(value.money) ? Math.max(0, Math.floor(value.money)) : 1000,
      paidMissions: Array.isArray(value.paidMissions) ? value.paidMissions.filter(id => typeof id === 'string') : [],
    };
  } catch {
    return { money: 1000, paidMissions: [] };
  }
}

export function createEconomy() {
  const save = readSave();
  let money = save.money;
  const paidMissions = new Set(save.paidMissions);

  function persist() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ money, paidMissions: [...paidMissions] })); }
    catch { /* The session remains playable if browser storage is disabled. */ }
  }

  return {
    get money() { return money; },
    add(amount) {
      money += Math.max(0, Math.floor(amount));
      persist();
      return money;
    },
    spend(amount) {
      money = Math.max(0, money - Math.max(0, Math.floor(amount)));
      persist();
      return money;
    },
    reward(missionId, amount) {
      if (paidMissions.has(missionId)) return false;
      paidMissions.add(missionId);
      money += Math.max(0, Math.floor(amount));
      persist();
      return true;
    },
    wasPaid(missionId) { return paidMissions.has(missionId); },
  };
}
