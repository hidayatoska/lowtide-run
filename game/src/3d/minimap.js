import { CITY_LIMIT } from './city.js';

const ZOOM_RANGES = [92, 62, 40];

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

export function createMinimap({ miniCanvas, expandedCanvas, overlay, openButton, closeButton, clearButton, zoomLabel, waypointLabel, city, vehicles, missions, helicopterPosition = () => null }) {
  const mini = miniCanvas.getContext('2d');
  const expanded = expandedCanvas.getContext('2d');
  let open = false;
  let zoom = 1;
  let waypoint = null;
  let lastPosition = { x: 0, z: 0 };

  function fitCanvas(canvas, ctx) {
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    const width = Math.max(1, Math.round(rect.width * ratio));
    const height = Math.max(1, Math.round(rect.height * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { width: rect.width, height: rect.height };
  }

  function setOpen(value) {
    open = Boolean(value);
    overlay.hidden = !open;
    document.body.classList.toggle('map-open', open);
    openButton.setAttribute('aria-expanded', String(open));
    if (open) expandedCanvas.focus({ preventScroll: true });
  }

  function drawMap(ctx, canvas, position, heading, expandedMode) {
    const size = fitCanvas(canvas, ctx);
    const width = size.width, height = size.height;
    const cx = width / 2, cy = height / 2;
    const radius = Math.min(width, height) / 2 - (expandedMode ? 18 : 5);
    const range = expandedMode ? CITY_LIMIT + 5 : ZOOM_RANGES[zoom];
    const scale = expandedMode ? radius / range : radius / range;
    const rotate = !expandedMode;
    const c = Math.cos(heading), s = Math.sin(heading);
    const project = (x, z) => {
      const dx = x - position.x, dz = z - position.z;
      const sx = rotate ? dx * c - dz * s : dx;
      const sy = rotate ? dx * s + dz * c : dz;
      return [cx + sx * scale, cy + sy * scale];
    };

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#101a1d';
    ctx.fillRect(0, 0, width, height);
    if (!expandedMode) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.clip();
    }
    ctx.fillStyle = '#182528';
    ctx.fillRect(0, 0, width, height);

    // Coastal edge and water sit behind the street plan.
    const waterA = project(-CITY_LIMIT, 212), waterB = project(CITY_LIMIT, 212);
    const waterC = project(CITY_LIMIT, 390), waterD = project(-CITY_LIMIT, 390);
    ctx.fillStyle = '#183d43';
    ctx.beginPath(); ctx.moveTo(...waterA); ctx.lineTo(...waterB); ctx.lineTo(...waterC); ctx.lineTo(...waterD); ctx.closePath(); ctx.fill();
    const sandA = project(-CITY_LIMIT, 178), sandB = project(CITY_LIMIT, 178);
    const sandC = project(CITY_LIMIT, 216), sandD = project(-CITY_LIMIT, 216);
    ctx.fillStyle = '#6b6652';
    ctx.beginPath(); ctx.moveTo(...sandA); ctx.lineTo(...sandB); ctx.lineTo(...sandC); ctx.lineTo(...sandD); ctx.closePath(); ctx.fill();

    function worldRect(x, z, w, d, color) {
      const corners = [[x - w / 2, z - d / 2], [x + w / 2, z - d / 2], [x + w / 2, z + d / 2], [x - w / 2, z + d / 2]].map(([wx, wz]) => project(wx, wz));
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(...corners[0]);
      for (let i = 1; i < corners.length; i++) ctx.lineTo(...corners[i]);
      ctx.closePath(); ctx.fill();
    }

    for (const line of city.roadLines) {
      worldRect(0, line, CITY_LIMIT * 2 + 14, 14, '#657175');
      worldRect(line, 0, 14, CITY_LIMIT * 2 + 14, '#657175');
    }
    for (const building of city.buildings) {
      worldRect(building.x, building.z, building.w, building.d, building.type === 'warehouse' ? '#596164' : '#465256');
    }

    const mapRadius = Math.min(width, height) / 2 - (expandedMode ? 8 : 10);
    function drawDot(x, z, color, sizePx, label = '') {
      const [sx, sy] = project(x, z);
      const dx = sx - cx, dy = sy - cy;
      if (!expandedMode && Math.hypot(dx, dy) > mapRadius) return;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(sx, sy, sizePx, 0, Math.PI * 2); ctx.fill();
      if (label && expandedMode) {
        ctx.font = '10px system-ui'; ctx.fillStyle = '#f4f0df'; ctx.fillText(label, sx + 7, sy - 6);
      }
    }

    for (const car of vehicles.cars) {
      const p = car.position();
      if (!expandedMode && Math.hypot(p.x - position.x, p.z - position.z) > range * 1.08) continue;
      const [sx, sy] = project(p.x, p.z);
      if (!expandedMode && Math.hypot(sx - cx, sy - cy) > mapRadius) continue;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(rotate ? heading - car.heading : -car.heading);
      ctx.fillStyle = car.role === 'police' ? '#ee6a63' : '#e7c17d';
      const bodyWidth = clamp(car.style.width * scale, 3, expandedMode ? 10 : 7);
      const bodyLength = clamp(car.style.length * scale, 5, expandedMode ? 18 : 12);
      ctx.fillRect(-bodyWidth / 2, -bodyLength / 2, bodyWidth, bodyLength);
      if (car.role === 'police') {
        ctx.fillStyle = '#f3dfb8'; ctx.fillRect(-bodyWidth / 2, -1, bodyWidth, 2);
      }
      ctx.restore();
    }

    const helicopter = helicopterPosition();
    if (helicopter) drawDot(helicopter.x, helicopter.z, '#79d7e5', expandedMode ? 6 : 4.5, 'POLICE AIR');

    for (const agent of missions.mapMarkers()) {
      drawDot(agent.x, agent.z, agent.type === 'objective' ? '#f2bd5f' : '#74d6b4', expandedMode ? 5 : 4, agent.name);
    }

    if (waypoint) {
      const [wx, wy] = project(waypoint.x, waypoint.z);
      const dx = wx - cx, dy = wy - cy;
      const distance = Math.hypot(waypoint.x - position.x, waypoint.z - position.z);
      if (expandedMode || Math.hypot(dx, dy) < mapRadius - 8) {
        ctx.strokeStyle = '#f3cc67'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(wx, wy, expandedMode ? 8 : 6, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#f3cc67'; ctx.beginPath(); ctx.arc(wx, wy, 2.5, 0, Math.PI * 2); ctx.fill();
      } else if (!expandedMode) {
        const angle = Math.atan2(dy, dx);
        const x = cx + Math.cos(angle) * (mapRadius - 7), y = cy + Math.sin(angle) * (mapRadius - 7);
        ctx.save(); ctx.translate(x, y); ctx.rotate(angle + Math.PI / 2);
        ctx.fillStyle = '#f3cc67'; ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5.5, 5); ctx.lineTo(-5.5, 5); ctx.closePath(); ctx.fill(); ctx.restore();
      }
      waypointLabel.textContent = `WAYPOINT  ${distance >= 1000 ? `${(distance / 1000).toFixed(1)} km` : `${Math.round(distance)} m`}`;
      waypointLabel.hidden = false;
    } else waypointLabel.hidden = true;

    const [px, py] = expandedMode ? project(position.x, position.z) : [cx, cy];
    ctx.save(); ctx.translate(px, py);
    if (expandedMode) ctx.rotate(-heading);
    ctx.fillStyle = '#f3f0df'; ctx.strokeStyle = '#162326'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(7, 8); ctx.lineTo(0, 5); ctx.lineTo(-7, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();

    if (!expandedMode) {
      ctx.restore();
      ctx.strokeStyle = '#d5d0bd'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#d5d0bd'; ctx.font = '10px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.fillText(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round((((heading % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8], cx, 14);
      ctx.textAlign = 'start';
    } else {
      ctx.strokeStyle = '#d5d0bd'; ctx.lineWidth = 1; ctx.strokeRect(0.5, 0.5, width - 1, height - 1);
    }
  }

  function render(position, heading) {
    lastPosition = { x: position.x, z: position.z };
    drawMap(mini, miniCanvas, position, heading, false);
    if (open) drawMap(expanded, expandedCanvas, position, heading, true);
    zoomLabel.textContent = ['NEAR', 'NORMAL', 'FAR'][zoom];
  }

  function changeZoom(amount) { zoom = clamp(zoom + amount, 0, ZOOM_RANGES.length - 1); }
  function setWaypoint(point) {
    waypoint = point ? { x: clamp(point.x, -CITY_LIMIT, CITY_LIMIT), z: clamp(point.z, -CITY_LIMIT, CITY_LIMIT) } : null;
  }
  function onExpandedClick(event) {
    const rect = expandedCanvas.getBoundingClientRect();
    const scale = (Math.min(rect.width, rect.height) / 2 - 18) / (CITY_LIMIT + 5);
    waypoint = {
      x: clamp((event.clientX - rect.left - rect.width / 2) / scale, -CITY_LIMIT, CITY_LIMIT),
      z: clamp((event.clientY - rect.top - rect.height / 2) / scale, -CITY_LIMIT, CITY_LIMIT),
    };
  }
  function onWheel(event) { event.preventDefault(); changeZoom(event.deltaY < 0 ? -1 : 1); }
  function onOpenClick() { setOpen(!open); }
  function onCloseClick() { setOpen(false); }
  function onClearClick() { setWaypoint(null); }
  expandedCanvas.addEventListener('click', onExpandedClick);
  miniCanvas.addEventListener('wheel', onWheel, { passive: false });
  expandedCanvas.addEventListener('wheel', onWheel, { passive: false });
  openButton.addEventListener('click', onOpenClick);
  closeButton.addEventListener('click', onCloseClick);
  clearButton.addEventListener('click', onClearClick);

  return {
    render,
    changeZoom,
    setOpen,
    toggle() { setOpen(!open); },
    get isOpen() { return open; },
    get waypoint() { return waypoint ? { ...waypoint } : null; },
    setWaypoint,
    dispose() {
      expandedCanvas.removeEventListener('click', onExpandedClick);
      miniCanvas.removeEventListener('wheel', onWheel);
      expandedCanvas.removeEventListener('wheel', onWheel);
      openButton.removeEventListener('click', onOpenClick);
      closeButton.removeEventListener('click', onCloseClick);
      clearButton.removeEventListener('click', onClearClick);
      document.body.classList.remove('map-open');
    },
  };
}
