import { STEP } from './config.js';
import { createWorld } from './world.js';

// Small deterministic gameplay states for local capture tools; the game itself boots in main.js.
export function stageShot(name = 'start', world = createWorld()) {
  const state = world.state;
  if (name === 'play' || name === 'end') {
    const car = state.vehicles[0];
    state.player.x = car.x - 34; state.player.y = car.y; state.player.angle = 0;
    world.step(STEP, { down: (...codes) => codes.includes('KeyD') }, 1);
    state.car.speed = 115; state.car.angle = 0;
    for (let i = 0; i < 120; i++) world.step(STEP, { down: (...codes) => codes.includes('KeyW') });
  }
  if (name === 'end') {
    state.wanted = 3;
    for (let i = 0; i < 10; i++) world.step(STEP, { down: () => false });
  }
  return state;
}
