// ── Companion system ──

import { COMPANION_DEFS, getCompanionStats, MODIFIERS } from './data/companions.js';
import { dist, angle } from './utils.js';

let _nextId = 0;

export class Companion {
  constructor(defKey, owner) {
    this.id = _nextId++;
    this.key = defKey;
    this.def = COMPANION_DEFS[defKey];
    this.level = 1;
    this.owner = owner;
    this.x = owner.x;
    this.y = owner.y;
    this.orbitAngle = Math.random() * Math.PI * 2;
    this.cooldownTimer = 0;
    this.modifiers = [];          // array of modifier keys
    this.stats = getCompanionStats(this.def.baseStats, 1);
    this._phase = Math.random() * Math.PI * 2; // visual variety
  }

  levelUp() {
    this.level++;
    this.stats = getCompanionStats(this.def.baseStats, this.level);
  }

  addModifier(modKey) {
    if (!this.modifiers.includes(modKey)) {
      this.modifiers.push(modKey);
    }
  }

  update(dt, player, enemies, grid) {
    const behavior = this.def.behavior;
    const orbitDist = 55 + this.id * 12;

    switch (behavior) {
      case 'orbit':
        {
          let orbSpd = this.stats.speed || 2;
          let orbDist = orbitDist;
          if (this.modifiers.includes('orbit_surge')) orbSpd *= 1.5;
          if (this.modifiers.includes('wider_ring')) orbDist = Math.round(orbDist * 1.4);
          this.orbitAngle += orbSpd * dt;
          this.x = player.x + Math.cos(this.orbitAngle) * orbDist;
          this.y = player.y + Math.sin(this.orbitAngle) * orbDist;
        }
        break;

      case 'follow':
        {
          const targetX = player.x + Math.cos(this._phase + performance.now() * 0.001) * 40;
          const targetY = player.y + Math.sin(this._phase + performance.now() * 0.001) * 40;
          const dx = targetX - this.x;
          const dy = targetY - this.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d > 2) {
            const moveSpeed = (this.stats.speed || 2) * 50;
            this.x += (dx / d) * moveSpeed * dt;
            this.y += (dy / d) * moveSpeed * dt;
          }
        }
        break;

      case 'chase':
        {
          // Chase nearest enemy, return to player if no enemy
          let target = this._findNearest(enemies, this.stats.range + 80, grid);
          if (target) {
            const a = angle(this, target);
            const moveSpeed = (this.stats.speed || 2) * 60;
            this.x += Math.cos(a) * moveSpeed * dt;
            this.y += Math.sin(a) * moveSpeed * dt;
          } else {
            const dx = player.x - this.x;
            const dy = player.y - this.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d > 50) {
              const moveSpeed = (this.stats.speed || 2) * 60;
              this.x += (dx / d) * moveSpeed * dt;
              this.y += (dy / d) * moveSpeed * dt;
            }
          }
        }
        break;

      case 'stationary':
        // Stays near player but doesn't chase
        {
          const dx = player.x - this.x;
          const dy = player.y - this.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d > 120) {
            this.x += (dx / d) * 100 * dt;
            this.y += (dy / d) * 100 * dt;
          }
        }
        break;
    }

    // Cooldown
    if (this.cooldownTimer > 0) this.cooldownTimer -= dt;
  }

  canAttack() {
    return this.cooldownTimer <= 0;
  }

  attack(enemies, projectileSystem, particles, grid) {
    if (!this.canAttack()) return;
    if (enemies.length === 0) return;

    const target = this._findNearest(enemies, this.stats.range, grid);
    if (!target && this.def.attack !== 'orbit' && this.def.attack !== 'aura') return;

    this.cooldownTimer = this.stats.cooldown;

    switch (this.def.attack) {
      case 'projectile':
        if (target) {
          const a = angle(this, target);
          const hasBloom = this.modifiers.includes('split_bloom');
          const hasDetonate = this.modifiers.includes('detonate');
          const hasHoming = this.modifiers.includes('homing');
          const explR = hasDetonate ? 50 : 0;

          if (hasBloom) {
            for (let i = -1; i <= 1; i++) {
              projectileSystem.spawn(
                this.x, this.y, a + i * 0.25,
                this.stats.projectileSpeed, this.stats.damage,
                this.stats.pierce, this.stats.radius, this.def.color,
                { homing: hasHoming, explodeRadius: explR }
              );
            }
          } else {
            projectileSystem.spawn(
              this.x, this.y, a,
              this.stats.projectileSpeed, this.stats.damage,
              this.stats.pierce, this.stats.radius, this.def.color,
              { homing: hasHoming, explodeRadius: explR }
            );
          }
        }
        break;

      case 'melee':
        {
          const nearby = grid.query(this.x, this.y, this.stats.range + 20);
          for (const e of nearby) {
            if (dist(this, e) < this.stats.range + e.radius) {
              e.hp -= this.stats.damage;
              e.hitFlash = 0.1;
              particles.emit(e.x, e.y, 4, this.def.color, { speedMax: 80, life: 0.3 });
              particles.text(e.x, e.y - e.radius, this.stats.damage.toString(), this.def.color);
            }
          }
        }
        break;

      case 'aura':
        {
          const hasEcho = this.modifiers.includes('pulse_echo');
          const hasSlowF = this.modifiers.includes('slow_field');
          const dmg = hasEcho ? this.stats.damage * 2 : this.stats.damage;
          const nearby = grid.query(this.x, this.y, this.stats.range);
          for (const e of nearby) {
            if (dist(this, e) < this.stats.range) {
              e.hp -= dmg;
              e.hitFlash = 0.1;
              if (hasSlowF) e.slowTimer = Math.max(e.slowTimer || 0, 2.0);
              particles.text(e.x, e.y - e.radius, dmg.toString(), this.def.color, 10);
            }
          }
          this._auraPulseEnd = performance.now() + 500;
          if (this.modifiers.includes('linger_field')) {
            this.cooldownTimer *= 0.6;
          }
        }
        break;

      case 'beam':
        if (target) {
          const a = angle(this, target);
          const beamLen = this.stats.range;
          let hits = 0;
          const nearby = grid.query(this.x, this.y, beamLen);
          for (const e of nearby) {
            if (hits >= this.stats.pierce) break;
            const dx = e.x - this.x;
            const dy = e.y - this.y;
            const proj = dx * Math.cos(a) + dy * Math.sin(a);
            if (proj < 0 || proj > beamLen) continue;
            const perpDist = Math.abs(-dx * Math.sin(a) + dy * Math.cos(a));
            if (perpDist < e.radius + 8) {
              e.hp -= this.stats.damage;
              e.hitFlash = 0.1;
              hits++;
              particles.text(e.x, e.y - e.radius, this.stats.damage.toString(), this.def.color, 10);
            }
          }
          this._beamTarget = { x: this.x + Math.cos(a) * beamLen, y: this.y + Math.sin(a) * beamLen };
          this._beamEndTime = performance.now() + 150;
        }
        break;

      case 'orbit':
        // Continuous contact damage (handled in collision), no cooldown needed
        this.cooldownTimer = 0;
        break;

      case 'chain':
        if (target) {
          const hasArc = this.modifiers.includes('chain_arc');
          const hasOverload = this.modifiers.includes('overload');
          const hasMark = this.modifiers.includes('static_mark');
          const chainPierce = this.stats.pierce + (hasArc ? 3 : 0);
          const chainDmg = hasOverload ? Math.round(this.stats.damage * 1.3) : this.stats.damage;
          projectileSystem.spawnChain(
            this.x, this.y, target,
            this.stats.projectileSpeed, chainDmg,
            chainPierce, this.stats.radius, this.def.color, enemies,
            { mark: hasMark, overload: hasOverload }
          );
        }
        break;
    }
  }

  _findNearest(enemies, range, grid) {
    const candidates = grid ? grid.query(this.x, this.y, range) : enemies;
    let nearest = null, minD = range;
    for (const e of candidates) {
      const d = dist(this, e);
      if (d < minD) { minD = d; nearest = e; }
    }
    return nearest;
  }

  draw(ctx, camera) {
    if (!camera.isVisible(this.x, this.y, 20)) return;
    const sx = camera.screenX(this.x);
    const sy = camera.screenY(this.y);

    // Aura pulse effect
    if (this._auraPulseEnd && performance.now() < this._auraPulseEnd) {
      const remaining = (this._auraPulseEnd - performance.now()) / 500;
      ctx.beginPath();
      ctx.arc(sx, sy, this.stats.range * (1 - remaining * 0.3), 0, Math.PI * 2);
      ctx.strokeStyle = this.def.color + Math.floor(remaining * 80).toString(16).padStart(2, '0');
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Body glow
    ctx.beginPath();
    ctx.arc(sx, sy, this.stats.radius + 2, 0, Math.PI * 2);
    ctx.fillStyle = this.def.color;
    ctx.shadowColor = this.def.color;
    ctx.shadowBlur = 10;
    ctx.globalAlpha = 0.4;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    // Body
    ctx.beginPath();
    ctx.arc(sx, sy, this.stats.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.def.color;
    ctx.fill();

    // Icon
    ctx.fillStyle = '#000';
    ctx.font = `${this.stats.radius}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.def.icon, sx, sy + 1);

    // Level badge
    if (this.level > 1) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 8px monospace';
      ctx.fillText(this.level.toString(), sx + this.stats.radius + 2, sy - this.stats.radius);
    }

    // Beam effect (uses separate screenX/screenY calls — no aliasing)
    if (this._beamEndTime && performance.now() < this._beamEndTime && this._beamTarget) {
      const bsx = camera.screenX(this.x);
      const bsy = camera.screenY(this.y);
      const bex = camera.screenX(this._beamTarget.x);
      const bey = camera.screenY(this._beamTarget.y);
      ctx.beginPath();
      ctx.moveTo(bsx, bsy);
      ctx.lineTo(bex, bey);
      ctx.strokeStyle = this.def.color;
      ctx.lineWidth = 3;
      ctx.shadowColor = this.def.color;
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }
}

// ── Orbit damage companion special case ──
export function processOrbitDamage(companions, enemies, particles, dt, grid) {
  for (const c of companions) {
    if (c.def.attack !== 'orbit') continue;
    const hasBurn = c.modifiers.includes('contact_burn');
    const hasSurge = c.modifiers.includes('orbit_surge');
    const tickRate = hasBurn ? 0.15 : 0.3;
    const dmgMult = hasSurge ? 1.2 : 1;
    const timerId = '_oht_' + c.id;
    const hitRange = c.stats.radius + c.stats.range * 0.3 + 20;
    const nearby = grid.query(c.x, c.y, hitRange);
    for (const e of nearby) {
      if (dist(c, e) < c.stats.radius + e.radius + c.stats.range * 0.3) {
        if (!e[timerId]) e[timerId] = 0;
        e[timerId] -= dt;
        if (e[timerId] <= 0) {
          const dmg = Math.round(c.stats.damage * dmgMult);
          e.hp -= dmg;
          e.hitFlash = 0.08;
          e[timerId] = tickRate;
          particles.text(e.x, e.y - e.radius, dmg.toString(), c.def.color, 10);
        }
      }
    }
  }
}
