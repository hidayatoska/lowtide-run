const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function createMinimap() {
  let expanded = false;
  function geometry(width, height) {
    const small = width < 600;
    const mapW = expanded ? Math.min(width * 0.52, 360) : small ? Math.min(width * 0.37, 158) : 196;
    const mapH = expanded ? Math.min(height * 0.48, 290) : small ? 126 : 144;
    return { x: width - mapW - 16, y: small ? 194 : 16, w: mapW, h: mapH };
  }
  function contains(x, y, width, height) { const r = geometry(width, height); return x >= r.x && y >= r.y && x <= r.x + r.w && y <= r.y + r.h; }
  function handleClick(x, y, width, height) {
    const r = geometry(width, height);
    if (x >= r.x + r.w - 43 && y >= r.y + 4 && x <= r.x + r.w - 5 && y <= r.y + 29) { expanded = !expanded; return true; }
    return false;
  }
  function draw(c, state, width, height) {
    const r = geometry(width, height), actor = state.inCar ? state.car : state.player;
    const span = expanded ? 2050 : 1050, pad = 9, mapW = r.w - pad * 2, mapH = r.h - 31;
    const sx = mapW / span, sy = mapH / span, scale = Math.min(sx, sy), cx = clamp(actor.x, span / 2, 3200 - span / 2), cy = clamp(actor.y, span / 2, 3200 - span / 2);
    const px = (x) => r.x + pad + mapW / 2 + (x - cx) * scale;
    const py = (y) => r.y + 27 + mapH / 2 + (y - cy) * scale;
    c.save(); c.fillStyle = '#101719ed'; c.fillRect(r.x, r.y, r.w, r.h); c.strokeStyle = '#c3c9b866'; c.lineWidth = 1; c.strokeRect(r.x + .5, r.y + .5, r.w - 1, r.h - 1);
    c.fillStyle = '#d2d8ce'; c.font = '700 10px system-ui'; c.fillText(expanded ? 'CITY MAP' : 'LOCAL MAP', r.x + 9, r.y + 17);
    c.fillStyle = '#2b3434'; c.fillRect(r.x + pad, r.y + 26, mapW, mapH);
    c.save(); c.beginPath(); c.rect(r.x + pad, r.y + 26, mapW, mapH); c.clip();
    c.fillStyle = '#35453d'; c.fillRect(r.x + pad, r.y + 26, mapW, mapH);
    const minX = cx - span / 2, maxX = cx + span / 2, minY = cy - span / 2, maxY = cy + span / 2;
    c.fillStyle = '#59605b';
    for (let x = Math.floor(minX / 320) * 320; x <= maxX; x += 320) c.fillRect(px(x), r.y + 26, 112 * scale, mapH);
    for (let y = Math.floor(minY / 320) * 320; y <= maxY; y += 320) c.fillRect(r.x + pad, py(y), mapW, 112 * scale);
    for (const b of state.buildings) if (b.x + b.w >= minX && b.x <= maxX && b.y + b.h >= minY && b.y <= maxY) {
      c.fillStyle = b.accessible ? '#b9a47d' : '#837663'; c.fillRect(px(b.x), py(b.y), Math.max(2, b.w * scale), Math.max(2, b.h * scale));
      if (b.accessible) { c.fillStyle = '#e8d38b'; c.fillRect(px(b.entrance.x) - 2, py(b.entrance.y) - 2, 4, 4); }
    }
    for (const v of state.vehicles) if (v.parked && Math.abs(v.x - cx) < span / 2 && Math.abs(v.y - cy) < span / 2) { c.fillStyle = '#61c7b4'; c.fillRect(px(v.x) - 2, py(v.y) - 2, 4, 4); }
    for (const p of state.police) if (Math.abs(p.x - cx) < span / 2 && Math.abs(p.y - cy) < span / 2) { c.fillStyle = '#ff6660'; c.beginPath(); c.arc(px(p.x), py(p.y), 3.5, 0, Math.PI * 2); c.fill(); }
    const mission = state.mission;
    if (mission?.active) {
      const target = mission.stage === 'pickup' ? mission.pickup : mission.dropoff;
      const edge = point => ({ x: clamp(px(point.x), r.x + pad + 5, r.x + pad + mapW - 5), y: clamp(py(point.y), r.y + 31, r.y + 25 + mapH - 5) });
      const marker = edge(target); c.fillStyle = '#f4c55f'; c.beginPath(); c.arc(marker.x, marker.y, 4, 0, Math.PI * 2); c.fill();
      if (mission.stage === 'pickup') { const delivery = edge(mission.dropoff); c.strokeStyle = '#f4c55f'; c.beginPath(); c.arc(delivery.x, delivery.y, 3, 0, Math.PI * 2); c.stroke(); }
    }
    c.save(); c.translate(px(actor.x), py(actor.y)); c.rotate(state.inCar ? state.car.angle : state.player.aimAngle || state.player.angle); c.fillStyle = '#fff5c6'; c.beginPath(); c.moveTo(0, -7); c.lineTo(5, 6); c.lineTo(0, 3); c.lineTo(-5, 6); c.closePath(); c.fill(); c.restore();
    c.restore();
    c.fillStyle = '#172023'; c.fillRect(r.x + r.w - 43, r.y + 4, 38, 22); c.strokeStyle = '#ffffff55'; c.strokeRect(r.x + r.w - 43, r.y + 4, 38, 22); c.fillStyle = '#f0f0dc'; c.font = '700 10px system-ui'; c.fillText(expanded ? '− MAP' : '+ MAP', r.x + r.w - 39, r.y + 19);
    c.restore();
  }
  return { draw, handleClick, contains, get expanded() { return expanded; }, setExpanded(value) { expanded = Boolean(value); } };
}
