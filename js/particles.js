// ── Particle system for visual effects ──

const MAX_PARTICLES = 500;
const MAX_TEXT_PARTICLES = 120;

export class Particles {
  constructor() {
    this.particles = [];
  }

  _trimIfNeeded() {
    if (this.particles.length <= MAX_PARTICLES) return;

    let textCount = 0;
    for (const p of this.particles) {
      if (p.text) textCount++;
    }

    // Drop oldest non-text particles first
    for (let i = 0; i < this.particles.length && this.particles.length > MAX_PARTICLES; i++) {
      if (!this.particles[i].text) {
        this.particles.splice(i, 1);
        i--;
      }
    }

    // If still too many, trim from the front
    while (this.particles.length > MAX_PARTICLES) {
      this.particles.shift();
    }

    // Clamp text particles separately
    if (textCount > MAX_TEXT_PARTICLES) {
      let liveTextCount = 0;
      for (const p of this.particles) {
        if (p.text) liveTextCount++;
      }

      for (let i = 0; i < this.particles.length && liveTextCount > MAX_TEXT_PARTICLES; i++) {
        if (this.particles[i].text) {
          this.particles.splice(i, 1);
          liveTextCount--;
          i--;
        }
      }
    }
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

    const allowed = Math.max(0, MAX_PARTICLES - this.particles.length);
    const finalCount = Math.min(count, allowed);

    for (let i = 0; i < finalCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = speedMin + Math.random() * (speedMax - speedMin);

      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life,
        maxLife: life,
        size: sizeMin + Math.random() * (sizeMax - sizeMin),
        color,
        gravity,
      });
    }

    this._trimIfNeeded();
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

    const allowed = Math.max(0, MAX_PARTICLES - this.particles.length);
    const finalCount = Math.min(count, allowed);

    for (let i = 0; i < finalCount; i++) {
      const a = angle + (Math.random() - 0.5) * spread;
      const speed = speedMin + Math.random() * (speedMax - speedMin);

      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life,
        maxLife: life,
        size: sizeMin + Math.random() * (sizeMax - sizeMin),
        color,
        gravity: 0,
      });
    }

    this._trimIfNeeded();
  }

  // Floating text (damage numbers)
  text(x, y, str, color = '#fff', size = 14) {
    let textCount = 0;
    for (const p of this.particles) {
      if (p.text) textCount++;
    }

    if (textCount >= MAX_TEXT_PARTICLES) {
      for (let i = 0; i < this.particles.length; i++) {
        if (this.particles[i].text) {
          this.particles.splice(i, 1);
          break;
        }
      }
    }

    this.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 20,
      vy: -60,
      life: 0.8,
      maxLife: 0.8,
      size,
      color,
      gravity: 0,
      text: str,
    });

    this._trimIfNeeded();
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.gravity || 0) * dt;
      p.life -= dt;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  draw(ctx, camera) {
    for (const p of this.particles) {
      const pos = camera.worldToScreen(p.x, p.y);
      const alpha = Math.max(0, p.life / p.maxLife);

      if (p.text) {
        ctx.globalAlpha = alpha;
        ctx.font = `bold ${p.size}px monospace`;
        ctx.fillStyle = p.color;
        ctx.textAlign = 'center';
        ctx.fillText(p.text, pos.x, pos.y);
        ctx.globalAlpha = 1;
      } else {
        ctx.globalAlpha = alpha * 0.8;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }
}