// ── Companion system ──

import { COMPANION_DEFS, getCompanionStats, MODIFIERS, EVOLUTIONS } from './data/companions.js';
import { dist, angle } from './utils.js';
import { GLOW, TRAIL } from './data/colors.js';

const ORBIT_TRAIL_LEN = TRAIL.orbitLen;

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
    this.modifiers = [];          // array of modifier keys (player-chosen)
    this.evolution = null;        // 'a' or 'b'
    this.evolutionDef = null;     // reference to evolution def object
    this.evolutionGrants = [];    // modifier keys auto-granted by evolution
    this.stats = getCompanionStats(this.def.baseStats, 1);
    this._phase = Math.random() * Math.PI * 2; // visual variety
    this._totalDamage = 0; // run damage tracking

    // Orbit trail ring buffer
    this._orbitTrail = new Float32Array(ORBIT_TRAIL_LEN * 2);
    this._orbitTrailIdx = 0;
    this._orbitTrailFill = 0;
    this._orbitTrailTimer = 0;
  }

  /** Active display color (uses evolution color if evolved) */
  get color() {
    return this.evolutionDef ? this.evolutionDef.color : this.def.color;
  }

  /** Check if this companion has a modifier effect (from modifiers OR evolution grants) */
  hasEffect(key) {
    return this.modifiers.includes(key) || this.evolutionGrants.includes(key);
  }

  /** Centralized stat recompute: level → evolution → synergy → tradeoffs */
  recomputeStats(synergies = {}, tradeoffs = {}) {
    const base = getCompanionStats(this.def.baseStats, this.level);

    // Evolution multipliers / additions
    if (this.evolutionDef) {
      const evo = this.evolutionDef;
      if (evo.statMult) {
        for (const [stat, mult] of Object.entries(evo.statMult)) {
          if (base[stat] !== undefined) {
            base[stat] = stat === 'damage' ? Math.round(base[stat] * mult) : base[stat] * mult;
          }
        }
      }
      if (evo.statAdd) {
        for (const [stat, add] of Object.entries(evo.statAdd)) {
          if (base[stat] !== undefined) base[stat] += add;
        }
      }
    }

    // Category synergy
    const syn = synergies[this.def.category];
    if (syn) {
      if (syn.damageMult) base.damage = Math.round(base.damage * syn.damageMult);
      if (syn.cooldownMult) base.cooldown *= syn.cooldownMult;
      if (syn.rangeMult) base.range = Math.round(base.range * syn.rangeMult);
      if (syn.pierceAdd) base.pierce += syn.pierceAdd;
    }

    // Global tradeoffs
    if (tradeoffs.allDamageMult && tradeoffs.allDamageMult !== 1) {
      base.damage = Math.round(base.damage * tradeoffs.allDamageMult);
    }
    if (tradeoffs.allCooldownMult && tradeoffs.allCooldownMult !== 1) {
      base.cooldown *= tradeoffs.allCooldownMult;
    }
    if (tradeoffs.allRangeMult && tradeoffs.allRangeMult !== 1) {
      base.range = Math.round(base.range * tradeoffs.allRangeMult);
    }
    if (tradeoffs.allPierceAdd) {
      base.pierce += tradeoffs.allPierceAdd;
    }

    this.stats = base;
  }

  levelUp(synergies, tradeoffs) {
    this.level++;
    this.recomputeStats(synergies, tradeoffs);
  }

  evolve(path, synergies, tradeoffs) {
    const evo = EVOLUTIONS[this.key]?.[path];
    if (!evo) return;
    this.evolution = path;
    this.evolutionDef = evo;
    this.evolutionGrants = evo.grants ? [...evo.grants] : [];
    this.recomputeStats(synergies, tradeoffs);
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
          if (this.hasEffect('orbit_surge')) orbSpd *= 1.5;
          if (this.hasEffect('wider_ring')) orbDist = Math.round(orbDist * 1.4);
          this.orbitAngle += orbSpd * dt;
          this.x = player.x + Math.cos(this.orbitAngle) * orbDist;
          this.y = player.y + Math.sin(this.orbitAngle) * orbDist;

          // Record orbit trail position
          this._orbitTrailTimer -= dt;
          if (this._orbitTrailTimer <= 0) {
            this._orbitTrailTimer = 0.03; // ~33 fps trail recording
            const ti = this._orbitTrailIdx * 2;
            this._orbitTrail[ti] = this.x;
            this._orbitTrail[ti + 1] = this.y;
            this._orbitTrailIdx = (this._orbitTrailIdx + 1) % ORBIT_TRAIL_LEN;
            if (this._orbitTrailFill < ORBIT_TRAIL_LEN) this._orbitTrailFill++;
          }
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

    // Momentum damage multiplier (set by game.js each frame)
    const dmgMult = this._momentumDmgMult || 1;

    this.cooldownTimer = this.stats.cooldown;

    switch (this.def.attack) {
      case 'projectile':
        if (target) {
          const a = angle(this, target);
          const hasBloom = this.hasEffect('split_bloom');
          const hasDetonate = this.hasEffect('detonate');
          const hasHoming = this.hasEffect('homing');
          const hasPierce = this.hasEffect('piercing_surge');
          const hasRicochet = this.hasEffect('ricochet');
          const explR = hasDetonate ? 50 : 0;
          const pierce = this.stats.pierce + (hasPierce ? 3 : 0);
          const damage = Math.round(this.stats.damage * dmgMult);

          if (hasBloom) {
            for (let i = -1; i <= 1; i++) {
              projectileSystem.spawn(
                this.x, this.y, a + i * 0.25,
                this.stats.projectileSpeed, damage,
                pierce, this.stats.radius, this.color,
                { homing: hasHoming, explodeRadius: explR, ricochet: hasRicochet, sourceId: this.id }
              );
            }
          } else {
            projectileSystem.spawn(
              this.x, this.y, a,
              this.stats.projectileSpeed, damage,
              pierce, this.stats.radius, this.color,
              { homing: hasHoming, explodeRadius: explR, ricochet: hasRicochet, sourceId: this.id }
            );
          }
        }
        break;

      case 'melee':
        {
          const hasCleave = this.hasEffect('cleave');
          const hasVampiric = this.hasEffect('vampiric');
          const hasFrenzy = this.hasEffect('frenzy_strike');
          const hitRange = this.stats.range * (hasCleave ? 1.8 : 1);
          const damage = Math.round(this.stats.damage * dmgMult);
          const nearby = grid.query(this.x, this.y, hitRange + 20);
          let meleeKills = 0;
          for (const e of nearby) {
            if (e.hp <= 0) continue;
            if (dist(this, e) < hitRange + e.radius) {
              const actualDmg = Math.min(damage, Math.max(0, e.hp));
              const wasAlive = e.hp > 0;
              e.hp -= damage;
              e.hitFlash = 0.1;
              this._totalDamage += actualDmg;
              if (hasVampiric) this.owner.heal(1);
              if (wasAlive && e.hp <= 0) meleeKills++;
              particles.emit(e.x, e.y, 4, this.color, { speedMax: 80, life: 0.3 });
              particles.text(e.x, e.y - e.radius, damage.toString(), this.color);
            }
          }
          if (hasFrenzy && meleeKills > 0) {
            this.cooldownTimer *= 0.5;
          }
        }
        break;

      case 'aura':
        {
          const hasEcho = this.hasEffect('pulse_echo');
          const hasSlowF = this.hasEffect('slow_field');
          const hasGravity = this.hasEffect('gravity_well');
          const dmg = Math.round((hasEcho ? this.stats.damage * 2 : this.stats.damage) * dmgMult);
          const nearby = grid.query(this.x, this.y, this.stats.range);
          for (const e of nearby) {
            if (e.hp <= 0) continue;
            const d = dist(this, e);
            if (d < this.stats.range) {
              const actualDmg = Math.min(dmg, Math.max(0, e.hp));
              e.hp -= dmg;
              e.hitFlash = 0.1;
              this._totalDamage += actualDmg;
              if (hasSlowF) e.slowTimer = Math.max(e.slowTimer || 0, 2.0);
              // Gravity well: pull enemies toward companion
              if (hasGravity && d > 20) {
                const dx = this.x - e.x, dy = this.y - e.y;
                const len = Math.sqrt(dx * dx + dy * dy) || 1;
                e.x += (dx / len) * 30;
                e.y += (dy / len) * 30;
              }
              particles.text(e.x, e.y - e.radius, dmg.toString(), this.color, 10);
            }
          }
          this._auraPulseEnd = performance.now() + 500;
          if (this.hasEffect('heal_pulse')) {
            this.owner.heal(3);
          }
          if (this.hasEffect('linger_field')) {
            this.cooldownTimer *= 0.6;
          }
        }
        break;

      case 'beam':
        if (target) {
          const hasFork = this.hasEffect('fork_beam');
          const hasBP = this.hasEffect('beam_pierce');
          const hasSearing = this.hasEffect('searing_lance');
          const beamDmg = Math.round((hasSearing ? this.stats.damage * 2 : this.stats.damage) * dmgMult);
          const beamLen = hasSearing ? this.stats.range * 1.5 : this.stats.range;
          const beamPierce = this.stats.pierce + (hasBP ? 3 : 0);

          const baseAngle = angle(this, target);
          const angles = [baseAngle];
          if (hasFork) {
            angles.push(baseAngle - 0.4, baseAngle + 0.4);
          }

          // Shared hit set across all fork beams to prevent double-hits
          const hitIds = new Set();
          this._beamTargets = [];

          for (const a of angles) {
            let hits = 0;
            const cosA = Math.cos(a), sinA = Math.sin(a);
            const nearby = grid.query(this.x, this.y, beamLen);

            // Sort by projection distance so nearest enemies consume pierce first
            const candidates = [];
            for (const e of nearby) {
              if (e.hp <= 0 || hitIds.has(e)) continue;
              const dx = e.x - this.x, dy = e.y - this.y;
              const proj = dx * cosA + dy * sinA;
              if (proj < 0 || proj > beamLen) continue;
              const perpDist = Math.abs(-dx * sinA + dy * cosA);
              if (perpDist < e.radius + 8) {
                candidates.push({ e, proj });
              }
            }
            candidates.sort((a, b) => a.proj - b.proj);

            for (const { e } of candidates) {
              if (hits >= beamPierce) break;
              const actualDmg = Math.min(beamDmg, Math.max(0, e.hp));
              e.hp -= beamDmg;
              e.hitFlash = 0.1;
              hits++;
              hitIds.add(e);
              this._totalDamage += actualDmg;
              particles.text(e.x, e.y - e.radius, beamDmg.toString(), this.color, 10);
            }
            this._beamTargets.push({ x: this.x + cosA * beamLen, y: this.y + sinA * beamLen });
          }
          // Legacy compat for draw
          this._beamTarget = this._beamTargets[0] || null;
          this._beamEndTime = performance.now() + 150;
        }
        break;

      case 'orbit':
        this.cooldownTimer = 0;
        break;

      case 'chain':
        if (target) {
          const hasArc = this.hasEffect('chain_arc');
          const hasOverload = this.hasEffect('overload');
          const hasMark = this.hasEffect('static_mark');
          const hasAutoSlow = this.hasEffect('auto_slow');
          const hasVolatile = this.hasEffect('volatile_mark');
          const chainPierce = this.stats.pierce + (hasArc ? 3 : 0);
          const chainDmg = Math.round((hasOverload ? this.stats.damage * 1.3 : this.stats.damage) * dmgMult);
          projectileSystem.spawnChain(
            this.x, this.y, target,
            this.stats.projectileSpeed, chainDmg,
            chainPierce, this.stats.radius, this.color, enemies,
            { mark: hasMark, overload: hasOverload, slow: hasAutoSlow ? 1.5 : 0, volatileMark: hasVolatile, sourceId: this.id }
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

  // Aura effects drawn below enemies (separate z-layer)
  drawAura(ctx, camera) {
    if (!camera.isVisible(this.x, this.y, this.stats.range + 20)) return;
    const sx = camera.screenX(this.x);
    const sy = camera.screenY(this.y);
    const color = this.color;

    // Aura pulse effect
    if (this._auraPulseEnd && performance.now() < this._auraPulseEnd) {
      const remaining = (this._auraPulseEnd - performance.now()) / 500;
      const pulseR = this.stats.range * (1 - remaining * 0.3);
      // Telegraph: expanding ring before damage
      ctx.beginPath();
      ctx.arc(sx, sy, pulseR, 0, Math.PI * 2);
      ctx.strokeStyle = color + Math.floor(remaining * 80).toString(16).padStart(2, '0');
      ctx.lineWidth = 2;
      ctx.stroke();
      // Faint fill for area telegraph
      ctx.beginPath();
      ctx.arc(sx, sy, pulseR, 0, Math.PI * 2);
      ctx.fillStyle = color + '08';
      ctx.fill();
    }

    // Aura-type companion: persistent faint range circle
    if (this.def.attack === 'aura') {
      ctx.beginPath();
      ctx.arc(sx, sy, this.stats.range, 0, Math.PI * 2);
      ctx.strokeStyle = color + '18';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  draw(ctx, camera) {
    if (!camera.isVisible(this.x, this.y, 20)) return;
    const sx = camera.screenX(this.x);
    const sy = camera.screenY(this.y);

    // Use evolution visuals if evolved
    const icon = this.evolutionDef ? this.evolutionDef.icon : this.def.icon;
    const color = this.color;

    // ── Orbit trail arc (behind body) ──
    if (this.def.behavior === 'orbit' && this._orbitTrailFill >= 2) {
      const len = this._orbitTrailFill;
      for (let j = 0; j < len; j++) {
        const idx = ((this._orbitTrailIdx - len + j + ORBIT_TRAIL_LEN) % ORBIT_TRAIL_LEN) * 2;
        const tx = this._orbitTrail[idx];
        const ty = this._orbitTrail[idx + 1];
        const frac = j / len;
        const alpha = frac * 0.35;
        const r = this.stats.radius * (0.2 + frac * 0.4);

        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(camera.screenX(tx), camera.screenY(ty), r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // Body glow
    ctx.beginPath();
    ctx.arc(sx, sy, this.stats.radius + 2, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = GLOW.ally;
    ctx.globalAlpha = 0.4;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    // Body
    ctx.beginPath();
    ctx.arc(sx, sy, this.stats.radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // Icon
    ctx.fillStyle = '#000';
    ctx.font = `${this.stats.radius}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, sx, sy + 1);

    // Level badge
    if (this.level > 1) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 8px monospace';
      ctx.fillText(this.level.toString(), sx + this.stats.radius + 2, sy - this.stats.radius);
    }

    // Beam effect — pulsing width with glow segments
    if (this._beamEndTime && performance.now() < this._beamEndTime) {
      const targets = this._beamTargets || (this._beamTarget ? [this._beamTarget] : []);
      if (targets.length > 0) {
        const bsx = camera.screenX(this.x);
        const bsy = camera.screenY(this.y);
        const beamAge = 1 - (this._beamEndTime - performance.now()) / 150;
        const pulse = 1 + Math.sin(beamAge * Math.PI) * 0.5; // swell then shrink

        // Outer glow pass
        ctx.strokeStyle = color + '40';
        ctx.lineWidth = (5 + pulse * 2);
        ctx.shadowColor = color;
        ctx.shadowBlur = GLOW.ally + 4;
        for (const t of targets) {
          ctx.beginPath();
          ctx.moveTo(bsx, bsy);
          ctx.lineTo(camera.screenX(t.x), camera.screenY(t.y));
          ctx.stroke();
        }
        // Inner bright core
        ctx.strokeStyle = color;
        ctx.lineWidth = 2 + pulse;
        ctx.shadowBlur = GLOW.ally;
        for (const t of targets) {
          ctx.beginPath();
          ctx.moveTo(bsx, bsy);
          ctx.lineTo(camera.screenX(t.x), camera.screenY(t.y));
          ctx.stroke();
        }
        ctx.shadowBlur = 0;
      }
    }
  }
}

// ── Orbit damage companion special case ──
export function processOrbitDamage(companions, enemies, particles, dt, grid) {
  for (const c of companions) {
    if (c.def.attack !== 'orbit') continue;
    const hasBurn = c.hasEffect('contact_burn');
    const hasSurge = c.hasEffect('orbit_surge');
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
          particles.text(e.x, e.y - e.radius, dmg.toString(), c.color, 10);
        }
      }
    }
  }
}
