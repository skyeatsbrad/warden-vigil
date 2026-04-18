// ── Main entry point ──

import { Game } from './game.js';
import { Input } from './input.js';

const canvas = document.getElementById('game');
const joystickCanvas = document.getElementById('joystick');

// Touch debug mode: ?touchdebug in URL, or triple-tap title to toggle on device
if (new URLSearchParams(window.location.search).has('touchdebug')) {
  document.body.classList.add('touch-debug');
}
let _debugTaps = 0, _debugTimer = 0;
document.getElementById('title-screen').addEventListener('pointerdown', () => {
  const now = Date.now();
  if (now - _debugTimer > 800) _debugTaps = 0;
  _debugTimer = now;
  _debugTaps++;
  if (_debugTaps >= 3) {
    document.body.classList.toggle('touch-debug');
    _debugTaps = 0;
  }
});

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