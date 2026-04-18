// ── Projectile / Attack entities ──

import { dist, angle } from './utils.js';

const PROJECTILE_CELL_SIZE = 96;
const PROJECTILE_NEIGHBOR_OFFSETS = [
  [-1, -1], [0, -1], [1, -1],
  [-1,  0], [0,  0], [1,  0],
  [-1,  1], [0,  1], [1,  1],
];

function cellKey(cx, cy) {
  return `${cx},${cy}`;
}

function getCellCoords(x, y) {
  return {
    cx: Math.floor(x / PROJECTILE_CELL_SIZE),
    cy: Math.floor(y / PROJECTILE_CELL_SIZE),
  };
}

function buildEnemyGrid(enemies) {
  const grid = new Map();

  for (const enemy of enemies) {
    if (!enemy || enemy.hp <= 0) continue;
    const { cx, cy } = getCellCoords(enemy.x, enemy.y);
    const key = cellKey(cx, cy);
    let bucket = grid.get(key);
    if (!bucket) {
      bucket = [];
      grid.set(key, bucket);
    }
    bucket.push(enemy);
  }

  return grid;
}

function getNearbyEnemies(grid, x, y) {
  const { cx, cy } = getCellCoords(x, y);
  const results = [];

  for (const [ox, oy] of PROJECTILE_NEIGHBOR_OFFSETS) {
    const bucket = grid.get(cellKey(cx + ox, cy + oy));
    if (!bucket) continue;
    results.push(...bucket);
  }

  return results;
}

export class ProjectileSystem {
  constructor() {
    this.projectiles = [];
  }

  spawn(x, y, targetAngle, speed, damage, pierce, radius, color, opts = {}) {
    const {
      homing = false,
      split = 0,
      explodeRadius = 0,
      slow = 0,
      lifetime = 3,
    } = opts;

    this.projectiles.push({
      x, y,
      vx: Math.cos(targetAngle) * speed,
      vy: Math.sin(targetAngle) * speed,
      speed,
      damage,
      pierce,
      maxPierce: pierce,
      radius,
      color,
      homing,
      split,
      explodeRadius,
      slow,
      lifetime,
      age: 0,
      hitIds: new Set(),
    });

    // Split shots
    if (split > 0) {
      for (let i = 1; i <= split; i++) {
        const spreadAngle = targetAngle + (i % 2 === 0 ? 1 : -1) * Math.ceil(i / 2) * 0.25;
        this.projectiles.push({
          x, y,
          vx: Math.cos(spreadAngle) * speed,
          vy: Math.sin(spreadAngle) * speed,
          speed,
          damage: Math.round(damage * 0.6),
          pierce: 1,
          maxPierce: 1,
          radius,
          color,
          homing: false,
          split: 0,
          explodeRadius: 0,
          slow,
          lifetime,
          age: 0,
          hitIds: new Set(),
        });
      }
    }
  }

  spawnChain(x, y, target, speed, damage, bounces, radius, color, enemies, opts = {}) {
    if (!target) return;

    const a = angle({ x, y }, target);

    this.projectiles.push({
      x, y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      speed,
      damage,
      pierce: 1,
      maxPierce: 1,
      radius,
      color,
      homing: false,
      split: 0,
      explodeRadius: 0,
      slow: 0,
      lifetime: 2,
      age: 0,
      hitIds: new Set(),
      chain: bounces,
      chainRange: 150,
      mark: opts.mark || false,
      overload: opts.overload || false,
    });
  }

  update(dt, enemies, particles, onHit) {
    const enemyGrid = buildEnemyGrid(enemies);

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.age += dt;

      // Homing
      if (p.homing && enemies.length > 0) {
        let closest = null;
        let minD = Infinity;

        const nearbyForHoming = getNearbyEnemies(enemyGrid, p.x, p.y);

        for (const e of nearbyForHoming) {
          if (!e || e.hp <= 0) continue;
          if (p.hitIds.has(e.id)) continue;

          const d = dist(p, e);
          if (d < minD) {
            minD = d;
            closest = e;
          }
        }

        if (closest && minD < 300) {
          const a = angle(p, closest);
          const turnRate = 3 * dt;
          const currentAngle = Math.atan2(p.vy, p.vx);

          let diff = a - currentAngle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;

          const newAngle = currentAngle + Math.sign(diff) * Math.min(Math.abs(diff), turnRate);
          p.vx = Math.cos(newAngle) * p.speed;
          p.vy = Math.sin(newAngle) * p.speed;
        }
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (p.age > p.lifetime) {
        this.projectiles.splice(i, 1);
        continue;
      }

      const nearbyEnemies = getNearbyEnemies(enemyGrid, p.x, p.y);

      // Check hits
      for (const enemy of nearbyEnemies) {
        if (!enemy || enemy.hp <= 0) continue;
        if (p.hitIds.has(enemy.id)) continue;
        if (dist(p, enemy) >= p.radius + enemy.radius) continue;

        p.hitIds.add(enemy.id);
        onHit(enemy, p);

        // Chain lightning
        if (p.chain && p.chain > 0) {
          let nextTarget = null;
          let minD2 = Infinity;

          const chainCandidates = getNearbyEnemies(enemyGrid, enemy.x, enemy.y);

          for (const e2 of chainCandidates) {
            if (!e2 || e2.hp <= 0) continue;
            if (p.hitIds.has(e2.id)) continue;

            const d2 = dist(enemy, e2);
            if (d2 < p.chainRange && d2 < minD2) {
              minD2 = d2;
              nextTarget = e2;
            }
          }

          if (nextTarget) {
            const a2 = angle(enemy, nextTarget);
            const bounceDmgMult = p.overload ? 1.0 : 0.7;

            this.projectiles.push({
              x: enemy.x,
              y: enemy.y,
              vx: Math.cos(a2) * p.speed * 1.2,
              vy: Math.sin(a2) * p.speed * 1.2,
              speed: p.speed * 1.2,
              damage: Math.round(p.damage * bounceDmgMult),
              pierce: 1,
              maxPierce: 1,
              radius: p.radius,
              color: p.color,
              homing: false,
              split: 0,
              explodeRadius: 0,
              slow: p.slow,
              lifetime: 1.5,
              age: 0,
              hitIds: new Set(p.hitIds),
              chain: p.chain - 1,
              chainRange: p.chainRange,
              mark: p.mark || false,
              overload: p.overload || false,
            });
          }
        }

        // Explode
        if (p.explodeRadius > 0) {
          const explosionCandidates = getNearbyEnemies(enemyGrid, enemy.x, enemy.y);

          for (const e2 of explosionCandidates) {
            if (!e2 || e2.hp <= 0) continue;
            if (p.hitIds.has(e2.id)) continue;
            if (dist(enemy, e2) >= p.explodeRadius) continue;

            onHit(e2, { damage: Math.round(p.damage * 0.5), slow: p.slow });
            p.hitIds.add(e2.id);
          }

          particles.emit(enemy.x, enemy.y, 12, p.color, { speedMax: 120, life: 0.4 });
        }

        p.pierce--;
        if (p.pierce <= 0) {
          this.projectiles.splice(i, 1);
        }
        break;
      }
    }
  }

  draw(ctx, camera) {
    for (const p of this.projectiles) {
      if (!camera.isVisible(p.x, p.y)) continue;
      const pos = camera.worldToScreen(p.x, p.y);

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  clear() {
    this.projectiles.length = 0;
  }
}