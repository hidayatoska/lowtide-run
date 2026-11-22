import { CHEAT_GROUPS } from './cheats.js';

const FONT = 'system-ui, sans-serif';
const roundRect = (c, x, y, w, h, r = 10) => { c.beginPath(); c.roundRect(x, y, w, h, r); };

export function createPauseMenu(world, weapons, cheats, minimap) {
  let open = false, page = 'main', groupIndex = 0, focus = 0, notice = '', noticeTime = 0;
  const mainItems = ['Resume Game', 'Map', 'Weapons', 'Cheats', 'Settings', 'Restart', 'Main Menu'];
  const group = () => CHEAT_GROUPS[groupIndex];
  function activate(id) {
    if (id === 'Resume Game') { open = false; page = 'main'; }
    else if (id === 'Map') { page = 'map'; focus = 0; minimap.setExpanded(true); }
    else if (id === 'Weapons') { page = 'weapons'; focus = 0; }
    else if (id === 'Cheats') { page = 'cheats'; focus = 0; }
    else if (id === 'Settings') { page = 'settings'; focus = 0; }
    else if (id === 'Restart') { page = 'restart'; focus = 0; }
    else if (id === 'Main Menu') { page = 'title'; focus = 0; }
    else if (id === 'Back') { page = 'main'; focus = 0; minimap.setExpanded(false); }
    else if (id === 'Restart Now' || id === 'New Run') window.location.reload();
    else if (id === 'Toggle Brightness') { world.state.settings.brightness = world.state.settings.brightness < 1 ? 1 : 0.78; }
    else if (id === 'Reset Cheats') notice = cheats.reset();
    else if (id.startsWith('cheat:')) notice = cheats.activate(id.slice(6));
    else if (id.startsWith('weapon:')) {
      const weaponId = id.slice(7); weapons.select(weaponId, world.state.cheats.unlockAllWeapons);
      notice = `Equipped ${weapons.status().name}`;
    }
    if (notice) noticeTime = 2.1;
  }
  function toggle() {
    if (!open) { open = true; page = 'main'; focus = 0; }
    else if (page === 'main') open = false;
    else { page = 'main'; minimap.setExpanded(false); }
  }
  function layout(width, height) {
    const cardW = Math.min(520, width - 28), cardH = Math.min(560, height - 36), x = (width - cardW) / 2, y = (height - cardH) / 2;
    if (page === 'main') {
      const row = Math.min(46, Math.max(31, (cardH - 118) / mainItems.length));
      return mainItems.map((label, i) => ({ id: label, label, x: x + 32, y: y + 67 + i * (row + 5), w: cardW - 64, h: row }));
    }
    if (page === 'map') return [{ id: 'Back', label: 'Back to Pause Menu', x: x + 32, y: y + cardH - 64, w: cardW - 64, h: 46 }];
    if (page === 'weapons') {
      const list = weapons.available(world.state.cheats.unlockAllWeapons).map(weapon => ({ id: `weapon:${weapon.id}`, label: `${weapon.name}${weapons.status(weapon.id).clip === Infinity ? '' : `   ${weapons.status(weapon.id).clip} / ${weapons.status(weapon.id).reserve}`}`, sub: weapon.id === weapons.status().selected ? 'EQUIPPED' : '', type: 'weapon' }));
      const top = y + 78, bottom = y + cardH - 73, row = (bottom - top) / Math.max(1, list.length);
      return list.map((item, i) => ({ ...item, x: x + 32, y: top + i * row, w: cardW - 64, h: Math.min(46, row - 5) })).concat([{ id: 'Back', label: 'Back', x: x + 32, y: y + cardH - 60, w: cardW - 64, h: 42 }]);
    }
    if (page === 'cheats') {
      const cols = 3, gap = 7, tabY = y + 67, tabW = (cardW - 48 - gap * 2) / cols;
      const tabs = CHEAT_GROUPS.map((item, i) => ({ id: `group:${i}`, label: item.label, type: 'tab', x: x + 24 + (i % cols) * (tabW + gap), y: tabY + Math.floor(i / cols) * 37, w: tabW, h: 31, active: i === groupIndex }));
      const top = tabY + 84, rows = group().items.map(item => ({ id: `cheat:${item.id}`, label: item.label, sub: item.kind === 'toggle' ? (world.state.cheats[item.id] ? 'ON' : 'OFF') : 'ACTIVATE', type: item.kind }));
      const row = Math.min(45, Math.max(30, (cardH - 232) / rows.length));
      const options = rows.map((item, i) => ({ ...item, x: x + 24, y: top + i * (row + 4), w: cardW - 48, h: row }));
      return [...tabs, ...options, { id: 'Reset Cheats', label: 'Reset Cheats', x: x + 24, y: y + cardH - 64, w: (cardW - 55) / 2, h: 44 }, { id: 'Back', label: 'Back', x: x + 31 + (cardW - 55) / 2, y: y + cardH - 64, w: (cardW - 55) / 2, h: 44 }];
    }
    if (page === 'settings') return [
      { id: 'Toggle Brightness', label: `HUD / Screen Brightness   ${Math.round(world.state.settings.brightness * 100)}%`, x: x + 32, y: y + 95, w: cardW - 64, h: 46 },
      { id: 'Back', label: 'Back', x: x + 32, y: y + cardH - 64, w: cardW - 64, h: 46 },
    ];
    if (page === 'restart') return [
      { id: 'Restart Now', label: 'Restart Run', x: x + 32, y: y + 150, w: cardW - 64, h: 48 },
      { id: 'Back', label: 'Cancel', x: x + 32, y: y + 210, w: cardW - 64, h: 48 },
    ];
    if (page === 'title') return [
      { id: 'New Run', label: 'Start a New Run', x: x + 32, y: y + 150, w: cardW - 64, h: 48 },
      { id: 'Back', label: 'Return to Pause Menu', x: x + 32, y: y + 210, w: cardW - 64, h: 48 },
    ];
    return [];
  }
  function update(dt, actions, pressed, clicks, pointer, width, height) {
    noticeTime = Math.max(0, noticeTime - dt);
    if (actions & 2) { toggle(); return; }
    if (!open) return;
    const pageBeforeInput = page, groupBeforeInput = groupIndex;
    const buttons = layout(width, height);
    if (pressed.includes('Escape') || pressed.includes('Backspace')) { toggle(); return; }
    if (pressed.some(key => ['ArrowDown', 'ArrowRight'].includes(key))) focus = (focus + 1) % Math.max(1, buttons.length);
    if (pressed.some(key => ['ArrowUp', 'ArrowLeft'].includes(key))) focus = (focus - 1 + buttons.length) % Math.max(1, buttons.length);
    if (pressed.includes('Enter') && buttons[focus]) {
      const id = buttons[focus].id;
      if (id.startsWith('group:')) groupIndex = Number(id.slice(6)); else activate(id);
    }
    if (page !== pageBeforeInput || groupIndex !== groupBeforeInput || !open) return;
    for (const click of clicks) {
      if (page === 'map' && minimap.handleClick(click.x, click.y, width, height)) continue;
      const hit = buttons.find(button => click.x >= button.x && click.x <= button.x + button.w && click.y >= button.y && click.y <= button.y + button.h);
      if (hit?.id.startsWith('group:')) { groupIndex = Number(hit.id.slice(6)); focus = 0; }
      else if (hit) activate(hit.id);
      if (page !== pageBeforeInput || groupIndex !== groupBeforeInput || !open) return;
    }
    if (page === 'cheats' && pressed.includes('Tab')) groupIndex = (groupIndex + 1) % CHEAT_GROUPS.length;
    if (pointer.x >= 0 && pointer.y >= 0) {
      const hovered = buttons.findIndex(button => pointer.x >= button.x && pointer.x <= button.x + button.w && pointer.y >= button.y && pointer.y <= button.y + button.h);
      if (hovered >= 0) focus = hovered;
    }
  }
  function draw(c, width, height, pointer, state) {
    if (!open) return;
    const cardW = Math.min(520, width - 28), cardH = Math.min(560, height - 36), x = (width - cardW) / 2, y = (height - cardH) / 2;
    c.save(); c.fillStyle = '#071011bf'; c.fillRect(0, 0, width, height);
    if (page === 'map') {
      c.fillStyle = '#111b1aee'; roundRect(c, x, y + cardH - 98, cardW, 82, 12); c.fill();
      c.fillStyle = '#f2ebd5'; c.textAlign = 'center'; c.font = `700 20px ${FONT}`; c.fillText('CITY MAP', width / 2, y + cardH - 65); c.font = `13px ${FONT}`; c.fillStyle = '#c8d1c8'; c.fillText('Click + MAP to expand · mission target shown in gold', width / 2, y + cardH - 39);
      const b = layout(width, height)[0], hover = pointer.x >= b.x && pointer.x <= b.x + b.w && pointer.y >= b.y && pointer.y <= b.y + b.h;
      c.fillStyle = hover || focus === 0 ? '#354943' : '#202c29'; roundRect(c, b.x, b.y, b.w, b.h, 8); c.fill(); c.strokeStyle = '#e5c37c88'; c.stroke(); c.fillStyle = '#f1ead4'; c.font = `600 14px ${FONT}`; c.fillText(b.label, width / 2, b.y + 29);
    } else {
      c.fillStyle = '#111b1aee'; roundRect(c, x, y, cardW, cardH, 16); c.fill(); c.strokeStyle = '#d7c89a66'; c.lineWidth = 1; c.stroke();
      c.fillStyle = '#edbd66'; c.font = `700 12px ${FONT}`; c.textAlign = 'left'; c.fillText('LOWTIDE RUN', x + 26, y + 30);
      const title = page === 'main' ? 'Paused' : page === 'cheats' ? 'Cheats · Single Player' : page === 'weapons' ? 'Weapons' : page === 'settings' ? 'Settings' : page === 'restart' ? 'Restart this run?' : 'Lowtide Run';
      c.fillStyle = '#f2ebd5'; c.font = `700 24px ${FONT}`; c.fillText(title, x + 26, y + 58);
      if (page === 'cheats') c.fillStyle = '#aeb9ac', c.font = `12px ${FONT}`, c.fillText('Toggle only implemented systems · money awards are permanent', x + 26, y + 79);
      if (page === 'restart') c.fillStyle = '#d2d9cf', c.font = `14px ${FONT}`, c.fillText('Your current run will be discarded.', x + 26, y + 115);
      if (page === 'title') c.fillStyle = '#d2d9cf', c.font = `14px ${FONT}`, c.fillText('Return to a fresh single-player run.', x + 26, y + 115);
      const buttons = layout(width, height);
      for (let i = 0; i < buttons.length; i++) {
        const b = buttons[i], hover = pointer.x >= b.x && pointer.x <= b.x + b.w && pointer.y >= b.y && pointer.y <= b.y + b.h, active = b.active || hover || i === focus;
        c.fillStyle = b.type === 'tab' ? (active ? '#96713c' : '#263330') : active ? '#354943' : '#202c29'; roundRect(c, b.x, b.y, b.w, b.h, 8); c.fill(); c.strokeStyle = active ? '#e5c37c' : '#ffffff24'; c.lineWidth = 1; c.stroke();
        c.textAlign = 'left'; c.fillStyle = b.type === 'toggle' ? '#f1ead4' : '#f1ead4'; c.font = `${b.type === 'tab' ? '700 11px' : '600 14px'} ${FONT}`; c.fillText(b.label, b.x + 13, b.y + b.h / 2 + 5, b.w - 26);
        if (b.sub) { c.textAlign = 'right'; c.fillStyle = b.sub === 'ON' || b.sub === 'EQUIPPED' ? '#e7c16d' : '#b9c3b9'; c.font = `700 11px ${FONT}`; c.fillText(b.sub, b.x + b.w - 13, b.y + b.h / 2 + 4); }
      }
    }
    if (noticeTime > 0 && notice) { c.fillStyle = '#edc977'; c.textAlign = 'center'; c.font = `700 13px ${FONT}`; c.fillText(notice, width / 2, height - 22); }
    c.restore();
  }
  return { update, draw, toggle, get open() { return open; }, get page() { return page; } };
}
