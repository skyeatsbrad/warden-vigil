// ── Particle system with object pooling ──
// Pre-allocated pool with swap-and-pop removal. Zero allocations during gameplay.
// Adaptive emission: accepts a pressure value (0–1) to reduce particle counts
// when frame budget is tight.

const POOL_SIZE = 500;

function _createParticle() {
  return {
    x: 0, y: 0, vx: 0, vy: 0,
    life: 0, maxLife: 0, size: 0,
    color: '', gravity: 0, text: null,
  };
}

export class Particles {
  constructor() {
    this.pool = new Array(POOL_SIZE);
    for (let i = 0; i < POOL_SIZE; i++) {
      this.pool[i] = _createParticle();
    }
    this.count = 0;
    this.pressure = 0; // 0 = relaxed, 1 = max pressure
  }

  _acquire() {
    if (this.count >= POOL_SIZE) return null;
    return this.pool[this.count++];
  }

  _kill(i) {
    this.count--;
    if (i < this.count) {
      const tmp = this.pool[i];
      this.pool[i] = this.pool[this.count];
      this.pool[this.count] = tmp;
    }
  }

  // Scale down emit counts based on frame pressure
  _budgetCount(requested) {
    if (this.pressure <= 0.2) return requested;
    const scale = Math.max(0.2, 1 - this.pressure * 0.8);
    return Math.max(1, Math.round(requested * scale));
  }

  emit(x, y, count, color, opts = {}) {
    const {
      speedMin = 30,
      speedMax = 100,
      sizeMin = 2,
      sizeMax = 5,
      life = 0.5,
      gravity = 0,
    } = opts;

    const budgeted = this._budgetCount(count);

    for (let i = 0; i < budgeted; i++) {
      const p = this._acquire();
      if (!p) break;

      const a = Math.random() * Math.PI * 2;
      const speed = speedMin + Math.random() * (speedMax - speedMin);

      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * speed;
      p.vy = Math.sin(a) * speed;
      p.life = life;
      p.maxLife = life;
      p.size = sizeMin + Math.random() * (sizeMax - sizeMin);
      p.color = color;
      p.gravity = gravity;
      p.text = null;
    }
  }

  // Directional burst
  burst(x, y, angle, spread, count, color, opts = {}) {
    const {
      speedMin = 60,
      speedMax = 150,
      sizeMin = 2,
      sizeMax = 4,
      life = 0.4,
    } = opts;

    const budgeted = this._budgetCount(count);

    for (let i = 0; i < budgeted; i++) {
      const p = this._acquire();
      if (!p) break;

      const a = angle + (Math.random() - 0.5) * spread;
      const speed = speedMin + Math.random() * (speedMax - speedMin);

      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * speed;
      p.vy = Math.sin(a) * speed;
      p.life = life;
      p.maxLife = life;
      p.size = sizeMin + Math.random() * (sizeMax - sizeMin);
      p.color = color;
      p.gravity = 0;
      p.text = null;
    }
  }

  // Floating text (damage numbers) — throttled under heavy pressure
  text(x, y, str, color = '#fff', size = 14) {
    // Under heavy pressure, skip ~half of damage text
    if (this.pressure > 0.6 && Math.random() < this.pressure * 0.5) return;

    const p = this._acquire();
    if (!p) return;

    p.x = x;
    p.y = y;
    p.vx = (Math.random() - 0.5) * 20;
    p.vy = -60;
    p.life = 0.8;
    p.maxLife = 0.8;
    p.size = size;
    p.color = color;
    p.gravity = 0;
    p.text = str;
  }

  update(dt) {
    let i = 0;
    while (i < this.count) {
      const p = this.pool[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      p.life -= dt;

      if (p.life <= 0) {
        this._kill(i);
      } else {
        i++;
      }
    }
  }

  draw(ctx, camera) {
    for (let i = 0; i < this.count; i++) {
      const p = this.pool[i];
      // Skip off-screen particles
      if (!camera.isVisible(p.x, p.y, p.text ? 40 : p.size + 5)) continue;

      const sx = camera.screenX(p.x);
      const sy = camera.screenY(p.y);
      const alpha = Math.max(0, p.life / p.maxLife);

      if (p.text) {
        ctx.globalAlpha = alpha;
        ctx.font = `bold ${p.size}px monospace`;
        ctx.fillStyle = p.color;
        ctx.textAlign = 'center';
        ctx.fillText(p.text, sx, sy);
        ctx.globalAlpha = 1;
      } else {
        ctx.globalAlpha = alpha * 0.8;
        ctx.beginPath();
        ctx.arc(sx, sy, p.size * alpha, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }
}