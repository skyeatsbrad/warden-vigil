// ── XP orbs with object pooling ──
// Swap-and-pop pool, same pattern as particles/projectiles.

import { dist } from './utils.js?v=4';
import { COLORS, GLOW } from './data/colors.js?v=4';

const ORB_POOL_SIZE = 200;

function _createOrb() {
  return {
    x: 0, y: 0, amount: 0,
    radius: 3, magnet: false,
    vx: 0, vy: 0,
  };
}

export class XPSystem {
  constructor() {
    this.pool = new Array(ORB_POOL_SIZE);
    for (let i = 0; i < ORB_POOL_SIZE; i++) {
      this.pool[i] = _createOrb();
    }
    this.count = 0;
  }

  _acquire() {
    if (this.count >= ORB_POOL_SIZE) return null;
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

  spawnOrb(x, y, amount) {
    const orb = this._acquire();
    if (!orb) return;
    orb.x = x + (Math.random() - 0.5) * 10;
    orb.y = y + (Math.random() - 0.5) * 10;
    orb.amount = amount;
    orb.radius = Math.min(3 + amount, 8);
    orb.magnet = false;
    orb.vx = 0;
    orb.vy = 0;
  }

  spawnFromEnemy(enemy) {
    const xp = enemy.xp || 1;
    if (xp > 5) {
      const count = Math.min(xp, 5);
      const base = Math.floor(xp / count);
      const remainder = xp - base * count;
      for (let i = 0; i < count; i++) {
        this.spawnOrb(enemy.x, enemy.y, base + (i < remainder ? 1 : 0));
      }
    } else {
      this.spawnOrb(enemy.x, enemy.y, xp);
    }
  }

  update(dt, player) {
    let levelsGained = 0;
    let i = 0;

    while (i < this.count) {
      const orb = this.pool[i];
      const d = dist(orb, player);

      // Magnet pull
      if (d < player.magnetRadius) {
        orb.magnet = true;
      }

      if (orb.magnet) {
        const dx = player.x - orb.x;
        const dy = player.y - orb.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0) {
          const speed = 300 + (1 - d / player.magnetRadius) * 400;
          orb.x += (dx / len) * speed * dt;
          orb.y += (dy / len) * speed * dt;
        }
      }

      // Pickup
      if (d < player.radius + orb.radius) {
        levelsGained += player.addXp(orb.amount);
        this._kill(i);
      } else {
        i++;
      }
    }

    return levelsGained;
  }

  draw(ctx, camera) {
    ctx.shadowColor = COLORS.xpOrbGlow;
    ctx.shadowBlur = GLOW.xpOrb;
    const now = performance.now() * 0.004;

    for (let i = 0; i < this.count; i++) {
      const orb = this.pool[i];
      if (!camera.isVisible(orb.x, orb.y, 10)) continue;
      const sx = camera.screenX(orb.x);
      const sy = camera.screenY(orb.y);
      // Gentle bob
      const bob = Math.sin(now + orb.x * 0.01) * 2;

      ctx.beginPath();
      ctx.arc(sx, sy + bob, orb.radius, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.xpOrb;
      ctx.fill();

      // Inner highlight
      ctx.beginPath();
      ctx.arc(sx - 1, sy + bob - 1, orb.radius * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fill();

      // Sparkle dot (cheap — just a tiny bright circle that fades in/out)
      const sparkle = Math.sin(now * 3 + orb.y * 0.02);
      if (sparkle > 0.7) {
        ctx.beginPath();
        ctx.arc(sx + orb.radius * 0.6, sy + bob - orb.radius * 0.5, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fill();
      }
    }

    ctx.shadowBlur = 0;
  }

  clear() {
    this.count = 0;
  }
}
