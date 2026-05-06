// ── Projectile system with object pooling ──
// Pre-allocated pool with swap-and-pop removal. Zero allocations during gameplay
// (hitIds Sets are cleared and reused, not recreated).

import { dist, angle } from './utils.js?v=17';
import { TRAIL, GLOW } from './data/colors.js?v=17';

const PROJ_POOL_SIZE = 300;
const TRAIL_LEN = TRAIL.projectileLen;

function _createProjectile() {
  return {
    x: 0, y: 0, vx: 0, vy: 0, speed: 0,
    damage: 0, pierce: 0, maxPierce: 0,
    radius: 0, color: '',
    homing: false, split: 0, explodeRadius: 0, slow: 0,
    lifetime: 0, age: 0,
    hitIds: new Set(),
    chain: 0, chainRange: 0,
    mark: false, overload: false,
    sourceId: -1,
    // Trail: fixed-size ring buffer of past positions
    trail: new Float32Array(TRAIL_LEN * 2),
    trailIdx: 0,
    trailFill: 0,
    // Chain lightning visual: origin of this chain segment
    chainFromX: 0, chainFromY: 0, isChainBounce: false,
  };
}

export class ProjectileSystem {
  constructor() {
    this.pool = new Array(PROJ_POOL_SIZE);
    for (let i = 0; i < PROJ_POOL_SIZE; i++) {
      this.pool[i] = _createProjectile();
    }
    this.count = 0;
  }

  _acquire() {
    if (this.count >= PROJ_POOL_SIZE) return null;
    const p = this.pool[this.count++];
    p.hitIds.clear();
    p.chain = 0;
    p.chainRange = 0;
    p.mark = false;
    p.overload = false;
    p.ricochet = false;
    p.volatileMark = false;
    p.sourceId = -1;
    p.trailIdx = 0;
    p.trailFill = 0;
    p.isChainBounce = false;
    p.chainFromX = 0;
    p.chainFromY = 0;
    return p;
  }

  _kill(i) {
    this.count--;
    if (i < this.count) {
      const tmp = this.pool[i];
      this.pool[i] = this.pool[this.count];
      this.pool[this.count] = tmp;
    }
  }

  spawn(x, y, targetAngle, speed, damage, pierce, radius, color, opts = {}) {
    const {
      homing = false,
      split = 0,
      explodeRadius = 0,
      slow = 0,
      lifetime = 3,
      ricochet = false,
      sourceId = -1,
    } = opts;

    const p = this._acquire();
    if (!p) return;

    p.x = x; p.y = y;
    p.vx = Math.cos(targetAngle) * speed;
    p.vy = Math.sin(targetAngle) * speed;
    p.speed = speed;
    p.damage = damage;
    p.pierce = pierce;
    p.maxPierce = pierce;
    p.radius = radius;
    p.color = color;
    p.homing = homing;
    p.split = split;
    p.explodeRadius = explodeRadius;
    p.slow = slow;
    p.lifetime = lifetime;
    p.age = 0;
    p.ricochet = ricochet;
    p.sourceId = sourceId;

    // Split shots
    if (split > 0) {
      for (let i = 1; i <= split; i++) {
        const sp = this._acquire();
        if (!sp) break;

        const spreadAngle = targetAngle + (i % 2 === 0 ? 1 : -1) * Math.ceil(i / 2) * 0.25;
        sp.x = x; sp.y = y;
        sp.vx = Math.cos(spreadAngle) * speed;
        sp.vy = Math.sin(spreadAngle) * speed;
        sp.speed = speed;
        sp.damage = Math.round(damage * 0.6);
        sp.pierce = 1;
        sp.maxPierce = 1;
        sp.radius = radius;
        sp.color = color;
        sp.homing = false;
        sp.split = 0;
        sp.explodeRadius = 0;
        sp.slow = slow;
        sp.lifetime = lifetime;
        sp.age = 0;
        sp.sourceId = sourceId;
      }
    }
  }

  spawnChain(x, y, target, speed, damage, bounces, radius, color, enemies, opts = {}) {
    if (!target) return;

    const a = angle({ x, y }, target);
    const p = this._acquire();
    if (!p) return;

    p.x = x; p.y = y;
    p.vx = Math.cos(a) * speed;
    p.vy = Math.sin(a) * speed;
    p.speed = speed;
    p.damage = damage;
    p.pierce = 1;
    p.maxPierce = 1;
    p.radius = radius;
    p.color = color;
    p.homing = false;
    p.split = 0;
    p.explodeRadius = 0;
    p.slow = opts.slow || 0;
    p.lifetime = 2;
    p.age = 0;
    p.chain = bounces;
    p.chainRange = 150;
    p.mark = opts.mark || false;
    p.overload = opts.overload || false;
    p.volatileMark = opts.volatileMark || false;
    p.sourceId = opts.sourceId !== undefined ? opts.sourceId : -1;
  }

  update(dt, enemies, particles, onHit, grid) {
    let i = 0;
    while (i < this.count) {
      const p = this.pool[i];
      p.age += dt;

      // Homing
      if (p.homing && enemies.length > 0) {
        let closest = null;
        let minD = Infinity;

        const nearbyForHoming = grid.query(p.x, p.y, 300);

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

      // Record trail position (ring buffer, every other frame to save cost)
      if ((p.trailFill & 1) === 0 || p.trailFill < TRAIL_LEN) {
        const ti = p.trailIdx * 2;
        p.trail[ti] = p.x;
        p.trail[ti + 1] = p.y;
        p.trailIdx = (p.trailIdx + 1) % TRAIL_LEN;
        if (p.trailFill < TRAIL_LEN) p.trailFill++;
      }

      if (p.age > p.lifetime) {
        this._kill(i);
        continue;
      }

      const nearbyEnemies = grid.neighbors(p.x, p.y);

      // Check hits
      let killed = false;
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

          const chainCandidates = grid.query2(enemy.x, enemy.y, p.chainRange);

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
            // Overload: final bounce deals 2×, intermediate bounces normal
            const isLastBounce = p.chain - 1 <= 0;
            const bounceDmgMult = p.overload ? (isLastBounce ? 2.0 : 1.0) : 0.7;

            const cp = this._acquire();
            if (cp) {
              cp.x = enemy.x; cp.y = enemy.y;
              cp.vx = Math.cos(a2) * p.speed * 1.2;
              cp.vy = Math.sin(a2) * p.speed * 1.2;
              cp.speed = p.speed * 1.2;
              cp.damage = Math.round(p.damage * bounceDmgMult);
              cp.pierce = 1;
              cp.maxPierce = 1;
              cp.radius = p.radius;
              cp.color = p.color;
              cp.homing = false;
              cp.split = 0;
              cp.explodeRadius = 0;
              cp.slow = p.slow;
              cp.lifetime = 1.5;
              cp.age = 0;
              cp.chain = p.chain - 1;
              cp.chainRange = p.chainRange;
              cp.mark = p.mark;
              cp.overload = p.overload;
              cp.volatileMark = p.volatileMark;
              cp.sourceId = p.sourceId;
              cp.isChainBounce = true;
              cp.chainFromX = enemy.x;
              cp.chainFromY = enemy.y;
              // Copy parent hitIds so chain doesn't re-hit
              for (const id of p.hitIds) cp.hitIds.add(id);

              // Spawn chain lightning arc visual
              particles.spawnChain(enemy.x, enemy.y, nextTarget.x, nextTarget.y, p.color);
            }
          }
        }

        // Explode
        if (p.explodeRadius > 0) {
          const explosionCandidates = grid.query2(enemy.x, enemy.y, p.explodeRadius);

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
          // Ricochet: spawn a bounce toward nearest enemy on final hit
          if (p.ricochet) {
            const ricoCandidates = grid.query2(enemy.x, enemy.y, 200);
            let ricoTarget = null, ricoMinD = Infinity;
            for (const e2 of ricoCandidates) {
              if (!e2 || e2.hp <= 0 || p.hitIds.has(e2.id)) continue;
              const d2 = dist(enemy, e2);
              if (d2 < ricoMinD) { ricoMinD = d2; ricoTarget = e2; }
            }
            if (ricoTarget) {
              const ra = angle(enemy, ricoTarget);
              this.spawn(enemy.x, enemy.y, ra, p.speed, p.damage, 1, p.radius, p.color,
                { homing: p.homing, explodeRadius: p.explodeRadius, slow: p.slow, ricochet: false, sourceId: p.sourceId });
              // Carry hitIds to prevent re-hitting
              const rp = this.pool[this.count - 1];
              if (rp) for (const id of p.hitIds) rp.hitIds.add(id);
            }
          }
          this._kill(i);
          killed = true;
        }
        break;
      }

      if (!killed) i++;
    }
  }

  draw(ctx, camera) {
    // ── Trail streaks (line from oldest trail point to head) ──
    ctx.lineCap = 'round';
    for (let i = 0; i < this.count; i++) {
      const p = this.pool[i];
      if (p.trailFill < 2) continue;
      if (!camera.isVisible(p.x, p.y, 40)) continue;

      // Find oldest trail position
      const oldIdx = ((p.trailIdx - p.trailFill + TRAIL_LEN) % TRAIL_LEN) * 2;
      const tailX = camera.screenX(p.trail[oldIdx]);
      const tailY = camera.screenY(p.trail[oldIdx + 1]);
      const headX = camera.screenX(p.x);
      const headY = camera.screenY(p.y);

      // Fading trail line: thick at head, thin at tail
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(headX, headY);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.radius * 0.8;
      ctx.globalAlpha = 0.25;
      ctx.stroke();

      // Brighter inner line for directionality
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(headX, headY);
      ctx.lineWidth = Math.max(1, p.radius * 0.3);
      ctx.globalAlpha = 0.5;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // ── Head pass: short directional streak with glow ──
    ctx.shadowBlur = GLOW.projectile;
    for (let i = 0; i < this.count; i++) {
      const p = this.pool[i];
      if (!camera.isVisible(p.x, p.y)) continue;

      const headX = camera.screenX(p.x);
      const headY = camera.screenY(p.y);

      // Direction-aligned streak: line from head backwards along velocity
      const spd = Math.hypot(p.vx, p.vy) || 1;
      const ndx = p.vx / spd;
      const ndy = p.vy / spd;
      const streakLen = Math.min(p.radius * 2.5, 12);

      ctx.beginPath();
      ctx.moveTo(headX - ndx * streakLen, headY - ndy * streakLen);
      ctx.lineTo(headX + ndx * 2, headY + ndy * 2);
      ctx.strokeStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.lineWidth = Math.max(1.5, p.radius * 0.7);
      ctx.stroke();

      // Bright tip dot
      ctx.beginPath();
      ctx.arc(headX, headY, Math.max(1.5, p.radius * 0.5), 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.lineCap = 'butt';
  }

  clear() {
    this.count = 0;
  }
}