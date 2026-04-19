// ── Particle system with object pooling ──
// Pre-allocated pool with swap-and-pop removal. Zero allocations during gameplay.
// Adaptive emission: accepts a pressure value (0–1) to reduce particle counts
// when frame budget is tight.

const POOL_SIZE = 500;
const IMPACT_POOL_SIZE = 30;
const CHAIN_POOL_SIZE = 24;
const CHAIN_MAX_SEGS = 6;  // max jitter midpoints per arc

function _createParticle() {
  return {
    x: 0, y: 0, vx: 0, vy: 0,
    life: 0, maxLife: 0, size: 0,
    color: '', gravity: 0, text: null,
  };
}

function _createImpact() {
  return {
    x: 0, y: 0, color: '',
    t: 0, maxT: 0, maxR: 0,
    active: false,
  };
}

function _createChain() {
  return {
    sx: 0, sy: 0, ex: 0, ey: 0,
    color: '',
    t: 0, maxT: 0,
    segs: 0,
    // Pre-rolled jitter offsets (stable across frames)
    jx: new Float32Array(CHAIN_MAX_SEGS),
    jy: new Float32Array(CHAIN_MAX_SEGS),
    active: false,
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

    // Impact ring pool (expanding ring + small burst)
    this.impacts = new Array(IMPACT_POOL_SIZE);
    for (let i = 0; i < IMPACT_POOL_SIZE; i++) {
      this.impacts[i] = _createImpact();
    }
    this.impactCount = 0;

    // Chain lightning arc pool (jagged line segments between two points)
    this.chains = new Array(CHAIN_POOL_SIZE);
    for (let i = 0; i < CHAIN_POOL_SIZE; i++) {
      this.chains[i] = _createChain();
    }
    this.chainCount = 0;
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

  // ── Impact effect: expanding ring + small radial burst ──
  // Designed for hit confirmation, enemy deaths, ability procs.
  // Ring expands outward and fades. Particles are capped at 10.
  spawnImpact(x, y, color, opts = {}) {
    const {
      maxRadius = 30,
      lifetime = 0.35,
      particles = 8,
      particleSpeed = 90,
      particleSize = 2.5,
    } = opts;

    // Acquire an impact ring slot
    if (this.impactCount < IMPACT_POOL_SIZE) {
      const imp = this.impacts[this.impactCount++];
      imp.x = x;
      imp.y = y;
      imp.color = color;
      imp.t = 0;
      imp.maxT = lifetime;
      imp.maxR = maxRadius;
      imp.active = true;
    }

    // Emit small radial burst (capped at 10, pressure-budgeted)
    const budgeted = this._budgetCount(Math.min(particles, 10));
    for (let i = 0; i < budgeted; i++) {
      const p = this._acquire();
      if (!p) break;

      const a = (Math.PI * 2 / budgeted) * i + (Math.random() - 0.5) * 0.4;
      const speed = particleSpeed * (0.6 + Math.random() * 0.4);

      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * speed;
      p.vy = Math.sin(a) * speed;
      p.life = lifetime * 0.8;
      p.maxLife = lifetime * 0.8;
      p.size = particleSize + Math.random() * 1.5;
      p.color = color;
      p.gravity = 0;
      p.text = null;
    }
  }

  // ── Chain lightning arc: jagged line between two points ──
  // Pre-rolls jitter on spawn so the arc is stable (not flickering).
  // Fades out over lifetime. Optional endpoint sparks via particle pool.
  spawnChain(sx, sy, ex, ey, color, opts = {}) {
    const { lifetime = 0.18, jitter = 14, sparks = 2 } = opts;

    if (this.chainCount < CHAIN_POOL_SIZE) {
      const c = this.chains[this.chainCount++];
      c.sx = sx; c.sy = sy;
      c.ex = ex; c.ey = ey;
      c.color = color;
      c.t = 0;
      c.maxT = lifetime;
      c.active = true;

      // Adaptive segment count based on distance
      const d = Math.hypot(ex - sx, ey - sy);
      c.segs = Math.min(CHAIN_MAX_SEGS, Math.max(3, Math.round(d / 30)));

      // Pre-roll perpendicular jitter offsets
      for (let i = 0; i < c.segs; i++) {
        c.jx[i] = (Math.random() - 0.5) * jitter;
        c.jy[i] = (Math.random() - 0.5) * jitter;
      }
    }

    // Optional tiny sparks at endpoint
    const budgeted = this._budgetCount(Math.min(sparks, 4));
    for (let i = 0; i < budgeted; i++) {
      const p = this._acquire();
      if (!p) break;
      const a = Math.random() * Math.PI * 2;
      const spd = 40 + Math.random() * 40;
      p.x = ex; p.y = ey;
      p.vx = Math.cos(a) * spd;
      p.vy = Math.sin(a) * spd;
      p.life = lifetime * 0.7;
      p.maxLife = lifetime * 0.7;
      p.size = 1.5 + Math.random();
      p.color = color;
      p.gravity = 0;
      p.text = null;
    }
  }

  update(dt) {
    // Update particles
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

    // Update impact rings (swap-and-pop)
    let j = 0;
    while (j < this.impactCount) {
      const imp = this.impacts[j];
      imp.t += dt;
      if (imp.t >= imp.maxT) {
        imp.active = false;
        this.impactCount--;
        if (j < this.impactCount) {
          const tmp = this.impacts[j];
          this.impacts[j] = this.impacts[this.impactCount];
          this.impacts[this.impactCount] = tmp;
        }
      } else {
        j++;
      }
    }

    // Update chain arcs (swap-and-pop)
    let k = 0;
    while (k < this.chainCount) {
      const c = this.chains[k];
      c.t += dt;
      if (c.t >= c.maxT) {
        c.active = false;
        this.chainCount--;
        if (k < this.chainCount) {
          const tmp = this.chains[k];
          this.chains[k] = this.chains[this.chainCount];
          this.chains[this.chainCount] = tmp;
        }
      } else {
        k++;
      }
    }
  }

  draw(ctx, camera) {
    // ── Chain arcs (drawn first, beneath everything) ──
    for (let i = 0; i < this.chainCount; i++) {
      const c = this.chains[i];
      const frac = c.t / c.maxT;
      const alpha = (1 - frac) * 0.85;

      const x0 = camera.screenX(c.sx);
      const y0 = camera.screenY(c.sy);
      const x1 = camera.screenX(c.ex);
      const y1 = camera.screenY(c.ey);

      const dx = x1 - x0, dy = y1 - y0;
      const segs = c.segs;

      // Build jagged path once, stroke twice (glow + core)
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      for (let s = 1; s < segs; s++) {
        const t = s / segs;
        ctx.lineTo(x0 + dx * t + c.jx[s], y0 + dy * t + c.jy[s]);
      }
      ctx.lineTo(x1, y1);

      // Outer glow pass
      ctx.strokeStyle = c.color;
      ctx.lineWidth = 4;
      ctx.globalAlpha = alpha * 0.3;
      ctx.stroke();

      // Inner bright core
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = alpha;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // ── Impact rings (drawn beneath particles) ──
    for (let i = 0; i < this.impactCount; i++) {
      const imp = this.impacts[i];
      if (!camera.isVisible(imp.x, imp.y, imp.maxR + 5)) continue;

      const sx = camera.screenX(imp.x);
      const sy = camera.screenY(imp.y);
      const frac = imp.t / imp.maxT;
      const radius = imp.maxR * frac;
      const alpha = (1 - frac) * 0.6;

      // Expanding ring
      ctx.beginPath();
      ctx.arc(sx, sy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = imp.color;
      ctx.lineWidth = 2.5 * (1 - frac) + 0.5;
      ctx.globalAlpha = alpha;
      ctx.stroke();

      // Inner flash (first 40% of lifetime)
      if (frac < 0.4) {
        const flashAlpha = (1 - frac / 0.4) * 0.15;
        ctx.beginPath();
        ctx.arc(sx, sy, radius * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = imp.color;
        ctx.globalAlpha = flashAlpha;
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // ── Particles ──
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