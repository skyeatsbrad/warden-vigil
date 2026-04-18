// ── Main entry point ──

import { Game } from './game.js';
import { Input } from './input.js';

const canvas = document.getElementById('game');
const joystickCanvas = document.getElementById('joystick');

// Input
const input = new Input(joystickCanvas);

// Game
const game = new Game(canvas, input);

// Resize handling
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  game.resize(canvas.width, canvas.height);
}

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 150));
resize();

// ── Game loop ──
let lastTime = 0;

function gameLoop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;

  game.update(dt);
  game.draw();

  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(ts => {
  lastTime = ts;
  requestAnimationFrame(gameLoop);
});