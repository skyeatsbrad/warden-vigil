// ── Main entry point ──

import { Game } from './game.js?v=13';
import { Input } from './input.js?v=13';

const canvas = document.getElementById('game');
const joystickCanvas = document.getElementById('joystick');

// Touch debug mode: ?touchdebug in URL enables it; no gesture toggle in production
if (new URLSearchParams(window.location.search).has('touchdebug')) {
  document.body.classList.add('touch-debug');
}

// Input
const input = new Input(joystickCanvas);

// Game
const game = new Game(canvas, input);

// Resize handling
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  input.resize(canvas.width, canvas.height);
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