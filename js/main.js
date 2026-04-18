// ── Main entry point ──

import { Game } from './game.js?v=4';
import { Input } from './input.js?v=4';

const canvas = document.getElementById('game');
const joystickCanvas = document.getElementById('joystick');

// Touch debug mode: ?touchdebug in URL, or 4-finger tap anywhere to toggle on device
if (new URLSearchParams(window.location.search).has('touchdebug')) {
  document.body.classList.add('touch-debug');
}
document.addEventListener('touchstart', (e) => {
  if (e.touches.length >= 4) {
    const on = document.body.classList.toggle('touch-debug');
    const tag = document.createElement('div');
    tag.textContent = on ? 'TOUCH DEBUG ON' : 'TOUCH DEBUG OFF';
    Object.assign(tag.style, {
      position: 'fixed', top: '50%', left: '50%',
      transform: 'translate(-50%,-50%)',
      background: 'rgba(0,0,0,0.8)', color: on ? 'lime' : 'red',
      padding: '12px 24px', borderRadius: '8px',
      fontSize: '18px', fontWeight: 'bold', zIndex: '9999',
      pointerEvents: 'none'
    });
    document.body.appendChild(tag);
    setTimeout(() => tag.remove(), 1200);
  }
}, { passive: true });

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