// ── Collision & damage ──

import { dist } from './utils.js';

export function processCollisions(player, enemies, particles, camera, grid) {
  // Use grid to check only nearby enemies instead of scanning all
  const nearby = grid.query(player.x, player.y, player.radius + 30);
  for (const e of nearby) {
    const d = dist(player, e);
    const minDist = player.radius + e.radius;

    if (d < minDist) {
      // Push enemies slightly away so the player is less likely to get body-locked
      const dx = e.x - player.x;
      const dy = e.y - player.y;
      const len = Math.hypot(dx, dy) || 1;
      const overlap = minDist - d;

      e.x += (dx / len) * overlap * 0.65;
      e.y += (dy / len) * overlap * 0.65;

      const hit = player.takeDamage(e.damage);
      if (hit) {
        particles.emit(player.x, player.y, 6, '#e74c3c', { speedMax: 100, life: 0.3 });
        particles.text(player.x, player.y - player.radius - 10, e.damage.toString(), '#e74c3c');
        camera.applyShake();
      }
    }
  }
}

export function handleProjectileHit(enemy, projectile, particles) {
  // Marked enemies take +25% bonus damage
  let dmg = projectile.damage;
  if (enemy.marked && enemy.marked > 0) {
    dmg = Math.round(dmg * 1.25);
  }

  enemy.hp -= dmg;
  enemy.hitFlash = 0.1;

  // Apply static mark
  if (projectile.mark) {
    enemy.marked = 3;
  }

  if (projectile.slow && projectile.slow > 0) {
    enemy.slowTimer = Math.max(enemy.slowTimer || 0, 1.5);
  }

  particles.emit(enemy.x, enemy.y, 3, projectile.color || '#fff', { speedMax: 60, life: 0.2 });
  particles.text(enemy.x, enemy.y - enemy.radius, dmg.toString(), projectile.color || '#fff');
}