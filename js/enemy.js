// ── Enemy spawning + AI ──

import { ENEMY_TYPES, WAVE_CONFIG, getSpawnWeights, scaleEnemy } from './data/enemies.js';
import { weightedPick } from './utils.js';

let _nextEnemyId = 0;

export class EnemySystem {
  constructor() {
    this.enemies = [];
    this.spawnTimer = 0;
    this.spawnInterval = WAVE_CONFIG.baseInterval;
    this.bossTimer = 0;
    this.minibossTimer = 0;
  }

  update(dt, elapsed, player, camera, grid) {
    const elapsedMinutes = elapsed / 60;

    // Spawn timer
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.enemies.length < WAVE_CONFIG.maxEnemies) {
      this.spawnTimer = this.spawnInterval;
      this.spawnInterval = Math.max(
        WAVE_CONFIG.minInterval,
        this.spawnInterval * WAVE_CONFIG.spawnRateDecay
      );
      this._spawnWave(player, camera, elapsed, elapsedMinutes);
    }

    // Mini-boss timer
    this.minibossTimer += dt;
    if (this.minibossTimer >= WAVE_CONFIG.minibossInterval) {
      this.minibossTimer = 0;
      this._spawnSpecial('ironhusk', player, camera, elapsedMinutes);
    }

    // Boss timer
    this.bossTimer += dt;
    if (this.bossTimer >= WAVE_CONFIG.bossInterval) {
      this.bossTimer = 0;
      this._spawnSpecial('voidlord', player, camera, elapsedMinutes);
    }

    // Update enemy AI with LOD tiers based on camera distance
    // Near (< 1.0 screen): full separation every frame
    // Mid  (1.0–2.0 screens): separation every 3rd frame
    // Far  (> 2.0 screens): chase only, no separation
    const frameIdx = this._frameCount = (this._frameCount || 0) + 1;

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e) continue;

      let spd = e.speed;
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
    return this.enemies.length + count <= WAVE_CONFIG.maxEnemies;
  }

  _spawnWave(player, camera, elapsed, elapsedMinutes) {
    const weights = getSpawnWeights(elapsed);
    const keys = Object.keys(weights);
    const vals = keys.map(k => weights[k]);

    let count = 2 + Math.floor(elapsed / 35);

    if (elapsed > 120) {
      count += Math.floor((elapsed - 120) / 60);
    }

    count = Math.min(count, 10);

    for (let i = 0; i < count; i++) {
      if (!this._hasCapacity(1)) break;
      const typeKey = weightedPick(keys, vals);
      this._spawnEnemy(typeKey, player, camera, elapsedMinutes, i, count);
    }
  }

  _spawnEnemy(typeKey, player, camera, elapsedMinutes, indexInWave = 0, waveCount = 1) {
    if (!this._hasCapacity(1)) return false;

    const base = ENEMY_TYPES[typeKey];
    if (!base) return false;

    const scaled = scaleEnemy(base, elapsedMinutes);

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
    for (const e of this.enemies) {
      if (!e || e.hp <= 0) continue;
      if (!camera.isVisible(e.x, e.y, e.radius + 20)) continue;

      const sx = camera.screenX(e.x);
      const sy = camera.screenY(e.y);

      if (e.glow) {
        ctx.beginPath();
        ctx.arc(sx, sy, e.radius + 5, 0, Math.PI * 2);
        ctx.fillStyle = e.color + '30';
        ctx.shadowColor = e.color;
        ctx.shadowBlur = 15;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      ctx.beginPath();
      ctx.arc(sx, sy, e.radius, 0, Math.PI * 2);
      ctx.fillStyle = e.hitFlash > 0 ? '#fff' : e.color;
      ctx.fill();

      if (e.slowTimer > 0) {
        ctx.beginPath();
        ctx.arc(sx, sy, e.radius + 2, 0, Math.PI * 2);
        ctx.strokeStyle = '#5dade2';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

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
    this.bossTimer = 0;
    this.minibossTimer = 0;
  }
}