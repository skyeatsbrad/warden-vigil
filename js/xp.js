// ── XP orbs + leveling ──

import { dist } from './utils.js';

export class XPSystem {
  constructor() {
    this.orbs = [];
  }

  spawnOrb(x, y, amount) {
    // Slight random offset
    this.orbs.push({
      x: x + (Math.random() - 0.5) * 10,
      y: y + (Math.random() - 0.5) * 10,
      amount,
      radius: Math.min(3 + amount, 8),
      magnet: false,
      vx: 0,
      vy: 0,
    });
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

    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const orb = this.orbs[i];
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
        this.orbs.splice(i, 1);
      }
    }

    return levelsGained;
  }

  draw(ctx, camera) {
    for (const orb of this.orbs) {
      if (!camera.isVisible(orb.x, orb.y, 10)) continue;
      const pos = camera.worldToScreen(orb.x, orb.y);

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, orb.radius, 0, Math.PI * 2);
      ctx.fillStyle = '#9b59b6';
      ctx.shadowColor = '#c9a0ff';
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Inner highlight
      ctx.beginPath();
      ctx.arc(pos.x - 1, pos.y - 1, orb.radius * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fill();
    }
  }

  clear() {
    this.orbs.length = 0;
  }
}
