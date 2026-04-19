// ── Enemy spawning + AI ──

import { ENEMY_TYPES, WAVE_CONFIG, getSpawnWeights, scaleEnemy, scaleRealmBoss, REALM_CONFIG, REALM_DEFS } from './data/enemies.js?v=7';
import { weightedPick } from './utils.js?v=7';
import { GLOW } from './data/colors.js?v=7';

let _nextEnemyId = 0;

export class EnemySystem {
  constructor() {
    this.enemies = [];
    this.spawnTimer = 0;
    this.spawnInterval = WAVE_CONFIG.baseInterval;
    this.spawnRateMult = 1; // external multiplier (boss pause, etc.)
    this.realmIndex = 0;
    this.bossAlive = false;  // suppresses miniboss + reduces cap
    this.curseSpeedMult = 1;
  }

  get effectiveCap() {
    return this.bossAlive ? REALM_CONFIG.bossEnemyCap : WAVE_CONFIG.maxEnemies;
  }

  update(dt, realmElapsed, effectiveMinutes, player, camera, grid) {
    // Spawn timer (affected by external rate multiplier)
    this.spawnTimer -= dt * this.spawnRateMult;
    if (this.spawnTimer <= 0 && this.enemies.length < this.effectiveCap) {
      this.spawnTimer = this.spawnInterval;
      this.spawnInterval = Math.max(
        WAVE_CONFIG.minInterval,
        this.spawnInterval * WAVE_CONFIG.spawnRateDecay
      );
      this._spawnWave(player, camera, realmElapsed, effectiveMinutes);
    }

    // Update enemy AI with LOD tiers based on camera distance
    // Near (< 1.0 screen): full separation every frame
    // Mid  (1.0–2.0 screens): separation every 3rd frame
    // Far  (> 2.0 screens): chase only, no separation
    const frameIdx = this._frameCount = (this._frameCount || 0) + 1;

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e) continue;

      let spd = e.speed * (this.curseSpeedMult || 1);
      if (e.slowTimer && e.slowTimer > 0) {
        spd *= 0.5;
        e.slowTimer -= dt;
      }

      // Base steering toward player
      let moveX = player.x - e.x;
      let moveY = player.y - e.y;
      let moveLen = Math.hypot(moveX, moveY) || 1;
      moveX /= moveLen;
      moveY /= moveLen;

      // LOD: decide separation tier
      const screenDist = camera.screenDistanceFactor(e.x, e.y);
      const runSep = screenDist < 1.0 ||
        (screenDist < 2.0 && (frameIdx + i) % 3 === 0);

      if (runSep) {
        let sepX = 0;
        let sepY = 0;

        grid.forEachNeighbor(e.x, e.y, other => {
          if (other === e || other.hp <= 0) return;

          const dx = e.x - other.x;
          const dy = e.y - other.y;

          if (Math.abs(dx) > 28 || Math.abs(dy) > 28) return;

          const d2 = dx * dx + dy * dy;
          if (d2 <= 0.0001) return;

          const desired = e.radius + other.radius + 8;
          if (d2 < desired * desired) {
            const d = Math.sqrt(d2);
            const push = (desired - d) / desired;
            sepX += (dx / d) * push;
            sepY += (dy / d) * push;
          }
        });

        // Blend chase and separation
        moveX = moveX * 0.9 + sepX * 1.8;
        moveY = moveY * 0.9 + sepY * 1.8;

        moveLen = Math.hypot(moveX, moveY) || 1;
        moveX /= moveLen;
        moveY /= moveLen;
      }

      e.x += moveX * spd * dt;
      e.y += moveY * spd * dt;

      // Teleporting enemies
      if (e.teleport) {
        if (!e._teleTimer) e._teleTimer = 3 + Math.random() * 2;
        e._teleTimer -= dt;
        if (e._teleTimer <= 0) {
          const teleAngle = Math.random() * Math.PI * 2;
          const teleDist = 90 + Math.random() * 70;
          e.x = player.x + Math.cos(teleAngle) * teleDist;
          e.y = player.y + Math.sin(teleAngle) * teleDist;
          e._teleTimer = 3 + Math.random() * 2;
        }
      }

      // Boss mechanics
      if (e.mechanics) {
        this._updateBossMechanics(e, dt, player);
      }

      // Hit flash timer
      if (e.hitFlash > 0) e.hitFlash -= dt;

      // Marked timer decay
      if (e.marked && e.marked > 0) e.marked -= dt;

      // Dead enemies are removed centrally by Game after awarding XP/drops
    }
  }

  _hasCapacity(count = 1) {
    return this.enemies.length + count <= this.effectiveCap;
  }

  _spawnWave(player, camera, realmElapsed, effectiveMinutes) {
    const weights = getSpawnWeights(realmElapsed);
    const keys = Object.keys(weights);
    const vals = keys.map(k => weights[k]);

    const ri = Math.min(this.realmIndex, REALM_DEFS.length - 1);
    let count = 2 + Math.floor(realmElapsed / 35) + ri * REALM_CONFIG.waveSizePerRealm;

    if (realmElapsed > 120) {
      count += Math.floor((realmElapsed - 120) / 60);
    }

    count = Math.min(count, 10 + ri);

    for (let i = 0; i < count; i++) {
      if (!this._hasCapacity(1)) break;
      const typeKey = weightedPick(keys, vals);
      this._spawnEnemy(typeKey, player, camera, effectiveMinutes, i, count);
    }
  }

  _spawnEnemy(typeKey, player, camera, effectiveMinutes, indexInWave = 0, waveCount = 1) {
    if (!this._hasCapacity(1)) return false;

    const base = ENEMY_TYPES[typeKey];
    if (!base) return false;

    const scaled = scaleEnemy(base, effectiveMinutes);

    // Spawn off-screen with spread so waves do not stack on one point
    const margin = 90;
    const side = Math.floor(Math.random() * 4);
    let x, y;

    const spreadT = waveCount > 1 ? indexInWave / Math.max(1, waveCount - 1) : 0.5;

    switch (side) {
      case 0: // left
        x = camera.x - margin - Math.random() * 30;
        y = camera.y + spreadT * camera.h + (Math.random() - 0.5) * 50;
        break;
      case 1: // right
        x = camera.x + camera.w + margin + Math.random() * 30;
        y = camera.y + spreadT * camera.h + (Math.random() - 0.5) * 50;
        break;
      case 2: // top
        x = camera.x + spreadT * camera.w + (Math.random() - 0.5) * 50;
        y = camera.y - margin - Math.random() * 30;
        break;
      default: // bottom
        x = camera.x + spreadT * camera.w + (Math.random() - 0.5) * 50;
        y = camera.y + camera.h + margin + Math.random() * 30;
        break;
    }

    this.enemies.push({
      id: _nextEnemyId++,
      type: typeKey,
      ...scaled,
      maxHp: scaled.hp,
      x,
      y,
      hitFlash: 0,
      slowTimer: 0,
      teleport: base.teleport || false,
      glow: base.glow || false,
      mechanics: base.mechanics || null,
      _chargeTimer: 0,
      _summonTimer: 0,
    });

    return true;
  }

  _spawnSpecial(typeKey, player, camera, elapsedMinutes) {
    if (!this._hasCapacity(1)) return;
    this._spawnEnemy(typeKey, player, camera, elapsedMinutes);
  }

  _updateBossMechanics(e, dt, player) {
    if (!e.mechanics) return;

    // Summon mechanic
    if (e.mechanics.includes('summon')) {
      e._summonTimer = (e._summonTimer || 0) + dt;
      if (e._summonTimer >= 8) {
        e._summonTimer = 0;

        const summonCount = Math.min(5, WAVE_CONFIG.maxEnemies - this.enemies.length);
        for (let i = 0; i < summonCount; i++) {
          if (!this._hasCapacity(1)) break;

          const a = (Math.PI * 2 / Math.max(1, summonCount)) * i;
          const base = ENEMY_TYPES.crawler;

          this.enemies.push({
            id: _nextEnemyId++,
            type: 'crawler',
            ...base,
            maxHp: base.hp,
            x: e.x + Math.cos(a) * 48,
            y: e.y + Math.sin(a) * 48,
            hitFlash: 0,
            slowTimer: 0,
            glow: false,
            teleport: false,
            mechanics: null,
          });
        }
      }
    }

    // Charge mechanic
    if (e.mechanics.includes('charge')) {
      e._chargeTimer = (e._chargeTimer || 0) + dt;
      if (e._chargeTimer >= 5) {
        e._chargeTimer = 0;
        const dx = player.x - e.x;
        const dy = player.y - e.y;
        const len = Math.hypot(dx, dy) || 1;
        e.x += (dx / len) * 200;
        e.y += (dy / len) * 200;
      }
    }
  }

  draw(ctx, camera) {
    const now = performance.now();
    for (const e of this.enemies) {
      if (!e || e.hp <= 0) continue;
      if (!camera.isVisible(e.x, e.y, e.radius + 20)) continue;

      let sx = camera.screenX(e.x);
      let sy = camera.screenY(e.y);

      // Basic enemies: subtle jitter for unstable feel
      if (e.tier === 'basic') {
        sx += (Math.random() - 0.5) * 1.2;
        sy += (Math.random() - 0.5) * 1.2;
      }

      // Boss: multi-layer outer shell
      if (e.tier === 'boss') {
        const bossPhase = Math.sin(now * 0.003) * 0.2 + 0.3;
        // Outer shell
        ctx.beginPath();
        ctx.arc(sx, sy, e.radius + 8, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(56,0,107,${bossPhase})`;
        ctx.shadowColor = e.color;
        ctx.shadowBlur = GLOW.enemyBoss;
        ctx.fill();
        ctx.shadowBlur = 0;
        // Middle ring
        ctx.beginPath();
        ctx.arc(sx, sy, e.radius + 4, 0, Math.PI * 2);
        ctx.strokeStyle = e.color + '60';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Elite / miniboss: pulsing glow
      if (e.glow) {
        const pulse = e.tier === 'boss' ? 1 :
          (Math.sin(now * 0.004 + (e.id || 0)) * 0.3 + 0.7);
        const glowR = e.radius + (e.tier === 'boss' ? 3 : 5);
        ctx.beginPath();
        ctx.arc(sx, sy, glowR, 0, Math.PI * 2);
        ctx.fillStyle = e.color + Math.floor(pulse * 48).toString(16).padStart(2, '0');
        ctx.shadowColor = e.color;
        ctx.shadowBlur = e.tier === 'boss' ? GLOW.enemyBoss : GLOW.enemyElite;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Main body
      ctx.beginPath();
      ctx.arc(sx, sy, e.radius, 0, Math.PI * 2);
      if (e.hitFlash > 0) {
        // Stronger hit flash: white fill with brief glow halo
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = GLOW.hit;
        ctx.fill();
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = e.color;
        ctx.fill();
      }

      // Elite/boss outline for readability
      if (e.tier === 'elite' || e.tier === 'miniboss') {
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Volatile mark indicator (skull-like dot pattern)
      if (e.volatileMarked) {
        ctx.fillStyle = 'rgba(255,68,68,0.7)';
        ctx.beginPath();
        ctx.arc(sx, sy - e.radius - 4, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Static mark stacks indicator
      if (e.marked && e.marked > 0) {
        for (let m = 0; m < Math.min(e.marked, 3); m++) {
          ctx.fillStyle = 'rgba(0,229,255,0.8)';
          ctx.beginPath();
          ctx.arc(sx - 4 + m * 4, sy + e.radius + 4, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Slow debuff ring
      if (e.slowTimer > 0) {
        ctx.beginPath();
        ctx.arc(sx, sy, e.radius + 2, 0, Math.PI * 2);
        ctx.strokeStyle = '#5dade2';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // HP bar for non-basic enemies
      if (e.tier !== 'basic' && e.hp < e.maxHp) {
        const barW = e.radius * 2.5;
        const barH = 3;
        const barY = sy - e.radius - 8;
        ctx.fillStyle = '#333';
        ctx.fillRect(sx - barW / 2, barY, barW, barH);
        ctx.fillStyle = e.tier === 'boss' ? '#e74c3c' : '#e67e22';
        ctx.fillRect(sx - barW / 2, barY, barW * (e.hp / e.maxHp), barH);
      }
    }
  }

  clear() {
    this.enemies.length = 0;
    this.spawnTimer = 0;
    this.spawnInterval = WAVE_CONFIG.baseInterval;
    this.spawnRateMult = 1;
    this.bossAlive = false;
    this.curseSpeedMult = 1;
  }

  // Reset spawn pacing for a new realm (keeps enemy list intact until despawnAll)
  resetForRealm() {
    this.spawnTimer = 0;
    this.spawnInterval = WAVE_CONFIG.baseInterval;
    this.spawnRateMult = 1;
    this.bossAlive = false;
  }

  // Force-spawn a realm boss, evicting far trash if at cap
  forceSpawnBoss(typeKey, player, camera, effectiveMinutes, realmIndex) {
    // Make room if at cap by removing farthest basic enemy
    if (!this._hasCapacity(1)) {
      let farthestIdx = -1, farthestD = 0;
      for (let i = 0; i < this.enemies.length; i++) {
        const e = this.enemies[i];
        if (e.tier === 'boss' || e.tier === 'miniboss') continue;
        const d = Math.hypot(e.x - player.x, e.y - player.y);
        if (d > farthestD) { farthestD = d; farthestIdx = i; }
      }
      if (farthestIdx >= 0) this.enemies.splice(farthestIdx, 1);
    }

    const base = ENEMY_TYPES[typeKey];
    if (!base) return -1;
    const scaled = scaleRealmBoss(base, effectiveMinutes, realmIndex);
    const margin = 200;
    const angle = Math.random() * Math.PI * 2;
    const id = _nextEnemyId++;

    this.enemies.push({
      id,
      type: typeKey,
      ...scaled,
      maxHp: scaled.hp,
      x: player.x + Math.cos(angle) * margin,
      y: player.y + Math.sin(angle) * margin,
      hitFlash: 0,
      slowTimer: 0,
      teleport: base.teleport || false,
      glow: true,
      mechanics: base.mechanics || null,
      tier: 'boss',
      _chargeTimer: 0,
      _summonTimer: 0,
    });

    return id;
  }

  // Remove all non-boss enemies (for realm transitions)
  despawnAll() {
    this.enemies.length = 0;
  }

  // Force-spawn a surge burst
  triggerSurgeBurst(player, camera, realmElapsed, effectiveMinutes) {
    const count = Math.min(8, 4 + Math.floor(realmElapsed / 90));
    for (let i = 0; i < count; i++) {
      // Suppress elite spawns during boss phase; use per-realm elite timing
      const realmEliteStart = REALM_DEFS[Math.min(this.realmIndex, REALM_DEFS.length - 1)].eliteStartTime;
      const useElite = !this.bossAlive && realmElapsed > realmEliteStart && i === 0;
      const typeKey = useElite ? 'ravager' : 'crawler';
      this._spawnEnemy(typeKey, player, camera, effectiveMinutes, i, count);
    }
  }
}