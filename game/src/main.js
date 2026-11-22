import { STEP } from './config.js';
import { createWorld } from './world.js';
import { createInput } from './input.js';
import { createRenderer } from './render.js';
import { createMinimap } from './minimap.js';
import { createWeaponWheel } from './weaponWheel.js';
import { createWeapons } from './weapons.js';
import { createCheats } from './cheats.js';
import { createPauseMenu } from './pauseMenu.js';

const canvas = document.getElementById('game');
const world = createWorld();
const input = createInput(canvas);
const renderer = createRenderer(canvas);
const minimap = createMinimap();
const weapons = createWeapons();
const cheats = createCheats(world);
const weaponWheel = createWeaponWheel();
const pauseMenu = createPauseMenu(world, weapons, cheats, minimap);
let last = performance.now(), accumulator = 0, pendingInteraction = 0, pendingShots = [];

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.1); last = now;
  const actions = input.take(), pressed = input.takePressed(), clicks = input.takeClicks(), pointer = input.pointer();
  const pausedBefore = pauseMenu.open;
  const surface = renderer.surface();
  pauseMenu.update(dt, actions, pressed, clicks, pointer, surface.width, surface.height);
  const paused = pauseMenu.open;
  document.body.classList.toggle('pause-open', paused);
  const wheelWasOpen = weaponWheel.open;
  const wheelOpen = weaponWheel.update(dt, input, weapons, world.state, surface.width, surface.height, pressed, !paused && !pausedBefore);
  if (!paused && !pausedBefore) {
    for (const click of clicks) {
      if (minimap.contains(click.x, click.y, surface.width, surface.height)) {
        minimap.handleClick(click.x, click.y, surface.width, surface.height);
      } else if (!wheelOpen && !wheelWasOpen) pendingShots.push(renderer.screenToWorld(click, world.state));
    }
    if (actions & 1 && !wheelOpen) pendingInteraction = 1;
  }
  if (!paused && !pausedBefore) {
    accumulator += dt * (wheelOpen ? 0.12 : 1);
    while (accumulator >= STEP) {
      world.step(STEP, input, pendingInteraction);
      const pointerInMap = minimap.contains(pointer.x, pointer.y, surface.width, surface.height);
      const aim = input.hasPointer ? renderer.screenToWorld(input.pointer(), world.state) : null;
      weapons.update(STEP, input, world.state, aim, wheelOpen || pointerInMap, pressed, pendingShots);
      pendingInteraction = 0; pendingShots = []; accumulator -= STEP;
    }
  } else { accumulator = 0; pendingInteraction = 0; pendingShots = []; }

  renderer.draw(world.state, paused, {
    weapon: weapons.status(),
    drawWeapons: (context, state) => weapons.draw(context, state),
    aimPointer: input.hasPointer ? pointer : null,
    pauseMenu: true,
  });
  const finalSurface = renderer.surface();
  minimap.draw(finalSurface.context, world.state, finalSurface.width, finalSurface.height);
  weaponWheel.draw(finalSurface.context, finalSurface.width, finalSurface.height, weapons, world.state);
  pauseMenu.draw(finalSurface.context, finalSurface.width, finalSurface.height, pointer, world.state);
}

requestAnimationFrame(frame);
