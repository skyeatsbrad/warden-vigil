// ── Collision & damage ──

import { dist } from './utils.js?v=11';
import { COLORS } from './data/colors.js?v=11';

export function processCollisions(player, enemies, particles, camera, grid, enemySystem) {
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

      const dmg = player.takeDamage(e.damage);
      if (dmg > 0) {
        particles.emit(player.x, player.y, 6, COLORS.danger, { speedMax: 100, life: 0.3 });
        particles.text(player.x, player.y - player.radius - 10, dmg.toString(), COLORS.danger);
        camera.applyShake();
      }
    }

    // ── Boss slam AOE check ──
    if (e.tier === 'boss' && e._slamHit && e._moveMode === 'slam') {
      const slamD = Math.hypot(player.x - e.x, player.y - e.y);
      if (slamD < 80) { // BOSS_TUNING.slamRadius
        const dmg = player.takeDamage(e.damage);
        if (dmg > 0) {
          particles.emit(player.x, player.y, 8, '#ff4444', { speedMax: 120, life: 0.4 });
          particles.text(player.x, player.y - player.radius - 10, dmg.toString(), '#ff4444');
          camera.applyShake();
        }
      }
      e._slamHit = false; // consume slam event
    }

    // ── Boss dash contact check ──
    if (e.tier === 'boss' && e._moveMode === 'dash' && !e._dashHitPlayer) {
      const dashD = Math.hypot(player.x - e.x, player.y - e.y);
      if (dashD < 40 + player.radius) { // BOSS_TUNING.dashHitRadius + player
        const dmg = player.takeDamage(e.damage);
        if (dmg > 0) {
          particles.emit(player.x, player.y, 8, '#ff8800', { speedMax: 120, life: 0.4 });
          particles.text(player.x, player.y - player.radius - 10, dmg.toString(), '#ff8800');
          camera.applyShake();
        }
        e._dashHitPlayer = true; // only hit once per dash
      }
    }
    if (e.tier === 'boss' && e._moveMode !== 'dash') e._dashHitPlayer = false;
  }

  // ── Hazard zone tick damage ──
  if (enemySystem) {
    for (const z of enemySystem.hazardZones) {
      if (!z.active) continue;
      if (z.tickTimer > 0) continue;
      const zd = Math.hypot(player.x - z.x, player.y - z.y);
      if (zd < z.radius + player.radius) {
        const dmg = player.takeDamage(z.damage);
        if (dmg > 0) {
          particles.emit(player.x, player.y, 4, '#9b59b6', { speedMax: 80, life: 0.3 });
          particles.text(player.x, player.y - player.radius - 10, dmg.toString(), '#9b59b6');
        }
        z.tickTimer = z.tickRate;
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

  const actualDmg = Math.min(dmg, Math.max(0, enemy.hp));
  enemy.hp -= dmg;
  enemy.hitFlash = 0.1;

  // Apply static mark
  if (projectile.mark) {
    enemy.marked = 3;
  }

  // Apply volatile mark (explodes on death)
  if (projectile.volatileMark) {
    enemy.volatileMarked = true;
  }

  if (projectile.slow && projectile.slow > 0) {
    enemy.slowTimer = Math.max(enemy.slowTimer || 0, 1.5);
  }

  // Hit feedback: use projectile color (cyan/blue = yours)
  const hitColor = projectile.color || COLORS.damage;
  particles.emit(enemy.x, enemy.y, 3, hitColor, { speedMax: 60, life: 0.2 });
  particles.text(enemy.x, enemy.y - enemy.radius, dmg.toString(), hitColor);

  return actualDmg;
}