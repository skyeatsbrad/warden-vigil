// ── Game state manager ──

import { Player } from './player.js';
import { Companion, processOrbitDamage } from './companion.js';
import { EnemySystem } from './enemy.js';
import { ProjectileSystem } from './projectile.js';
import { XPSystem } from './xp.js';
import { Particles } from './particles.js';
import { Camera } from './camera.js';
import { UI } from './ui.js';
import { Progression } from './progression.js';
import { processCollisions, handleProjectileHit } from './collision.js';
import { SpatialGrid } from './spatial-grid.js';
import { COMPANION_DEFS } from './data/companions.js';
import { formatTime, dist, weightedPick } from './utils.js';

export class Game {
  constructor(canvas, input) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = input;

    this.state = 'title'; // title | playing | upgrading | gameover
    this.elapsed = 0;

    this.camera = new Camera(canvas.width, canvas.height);
    this.player = null;
    this.companions = [];
    this.enemySystem = new EnemySystem();
    this.projectiles = new ProjectileSystem();
    this.xpSystem = new XPSystem();
    this.particles = new Particles();
    this.ui = new UI();
    this.progression = new Progression();

    this.selectedStarter = 'glintbug';
    this.ultimateCooldown = 0;
    this.pickups = [];
    this.attackSpeedBuff = 0;
    this.guaranteedRare = false;
    this.pendingUpgrades = 0;
    this.overclockTimer = 0;
    this._overclockOriginals = [];

    // Frame pressure tracking for adaptive quality
    this._smoothedDt = 0.016;
    this._targetDt = 1 / 60;

    this._setupScreens();
  }

  _setupScreens() {
    // Title screen
    const titleScreen = document.getElementById('title-screen');
    const startBtn = document.getElementById('start-btn');
    const companionOptions = document.getElementById('companion-options');
    const unlockInfo = document.getElementById('unlock-info');

    this.progression.populateCompanionSelect(companionOptions, key => {
      this.selectedStarter = key;
    });

    const prog = this.progression.data;
    unlockInfo.textContent = `Total kills: ${prog.totalKills} | Best time: ${formatTime(prog.bestTime)} | Runs: ${prog.runsCompleted}`;

    startBtn.addEventListener('click', () => {
      titleScreen.classList.add('hidden');
      this.startRun();
    });

    // Game over screen
    const restartBtn = document.getElementById('restart-btn');
    restartBtn.addEventListener('click', () => {
      document.getElementById('gameover-screen').classList.add('hidden');
      titleScreen.classList.remove('hidden');
      // Re-populate in case we unlocked something
      this.progression.populateCompanionSelect(companionOptions, key => {
        this.selectedStarter = key;
      });
      const prog2 = this.progression.data;
      unlockInfo.textContent = `Total kills: ${prog2.totalKills} | Best time: ${formatTime(prog2.bestTime)} | Runs: ${prog2.runsCompleted}`;
    });

    // Ultimate ability (spacebar / touch button)
    window.addEventListener('keydown', e => {
      if (e.key === ' ' && this.state === 'playing' && this.ultimateCooldown <= 0) {
        this._useUltimate();
      }
      if ((e.key === 'q' || e.key === 'Q') && this.state === 'playing') {
        this._usePanic();
      }
    });

    // Panic touch button
    const panicBtn = document.getElementById('panic-btn');
    if (panicBtn) {
      panicBtn.addEventListener('touchstart', e => {
        e.preventDefault();
        if (this.state === 'playing') this._usePanic();
      });
      panicBtn.addEventListener('click', () => {
        if (this.state === 'playing') this._usePanic();
      });
    }

    // Ultimate touch button
    const ultBtn = document.getElementById('ult-btn');
    if (ultBtn) {
      ultBtn.addEventListener('touchstart', e => {
        e.preventDefault();
        if (this.state === 'playing' && this.ultimateCooldown <= 0) this._useUltimate();
      });
      ultBtn.addEventListener('click', () => {
        if (this.state === 'playing' && this.ultimateCooldown <= 0) this._useUltimate();
      });
    }
  }

  startRun() {
    this.state = 'playing';
    this.elapsed = 0;
    this.ultimateCooldown = 0;
    this.player = new Player(0, 0);
    this.companions = [];
    this.enemySystem.clear();
    this.projectiles.clear();
    this.xpSystem.clear();
    this.pickups = [];
    this.attackSpeedBuff = 0;
    this.guaranteedRare = false;
    this.pendingUpgrades = 0;
    this.overclockTimer = 0;
    this._overclockOriginals = [];

    // Reset camera to player start
    this.camera.reset(0, 0);

    // Spawn starting companion
    const starter = new Companion(this.selectedStarter, this.player);
    this.companions.push(starter);
  }

  update(dt) {
    if (this.state !== 'playing') return;

    // Frame pressure: smoothed ratio of actual dt to target dt
    this._smoothedDt += (dt - this._smoothedDt) * 0.1;
    const pressure = Math.min(1, Math.max(0, (this._smoothedDt / this._targetDt - 1) * 2));
    this.particles.pressure = pressure;

    this.elapsed += dt;
    this.input.update();

    // Player
    this.player.update(dt, this.input.dir);

    // Camera
    this.camera.follow(this.player, dt);

    // Build spatial grid once per frame
    const grid = new SpatialGrid(this.enemySystem.enemies);

    // Companions
    for (const c of this.companions) {
      c.update(dt, this.player, this.enemySystem.enemies, grid);
      c.attack(this.enemySystem.enemies, this.projectiles, this.particles, grid);
    }

    // Attack speed buff: extra cooldown reduction for all companions
    if (this.attackSpeedBuff > 0) {
      this.attackSpeedBuff -= dt;
      for (const c of this.companions) {
        c.cooldownTimer -= dt;
      }
    }

    // Orbit damage
    processOrbitDamage(this.companions, this.enemySystem.enemies, this.particles, dt, grid);

    // Enemies
    this.enemySystem.update(dt, this.elapsed, this.player, this.camera, grid);

    // Projectiles
    this.projectiles.update(dt, this.enemySystem.enemies, this.particles, (enemy, proj) => {
      handleProjectileHit(enemy, proj, this.particles);
    }, grid);

    // Collisions (player vs nearby enemies via grid)
    processCollisions(this.player, this.enemySystem.enemies, this.particles, this.camera, grid);

    // Pickups
    this._updatePickups(dt);

    // Overclock timer (Rustmaw ultimate, replaces setTimeout)
    if (this.overclockTimer > 0) {
      this.overclockTimer -= dt;
      if (this.overclockTimer <= 0) {
        for (const entry of this._overclockOriginals) {
          if (entry.companion && entry.companion.stats) {
            entry.companion.stats.cooldown = entry.original;
          }
        }
        this._overclockOriginals = [];
      }
    }

    // Track kills & spawn XP — centralized death handling
    for (let i = this.enemySystem.enemies.length - 1; i >= 0; i--) {
      const e = this.enemySystem.enemies[i];
      if (e.hp <= 0) {
        this.player.kills++;
        this.xpSystem.spawnFromEnemy(e);
        this.particles.emit(e.x, e.y, 8, e.color, { speedMax: 100, life: 0.4 });
        if (e.tier === 'elite' || e.tier === 'miniboss' || e.tier === 'boss') {
          this._spawnPickup(e.x, e.y);
        }
        this.enemySystem.enemies.splice(i, 1);
      }
    }

    // XP collection — returns number of levels gained
    const levelsGained = this.xpSystem.update(dt, this.player);
    if (levelsGained > 0) {
      this.pendingUpgrades += levelsGained;
      this._showNextUpgrade();
    }

    // Ultimate cooldown
    if (this.ultimateCooldown > 0) this.ultimateCooldown -= dt;

    // Particles
    this.particles.update(dt);

    // Update HUD
    this.ui.updateHUD(this.player, this.elapsed);

    // Check death
    if (!this.player.alive) {
      this._gameOver();
    }
  }

  _showNextUpgrade() {
    if (this.pendingUpgrades <= 0) {
      this.state = 'playing';
      return;
    }
    this.pendingUpgrades--;
    this.state = 'upgrading';
    this.ui.showUpgradeSelection(this.player, this.companions, choice => {
      this._applyUpgrade(choice);
      this.guaranteedRare = false;
      this._showNextUpgrade();
    }, this.guaranteedRare);
  }

  draw() {
    const ctx = this.ctx;
    const cam = this.camera;

    // Clear
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.state === 'title') return;
    if (!this.player) return;

    // Grid background
    this._drawGrid(ctx, cam);

    // XP orbs
    this.xpSystem.draw(ctx, cam);

    // Enemies
    this.enemySystem.draw(ctx, cam);

    // Projectiles
    this.projectiles.draw(ctx, cam);

    // Companions
    for (const c of this.companions) {
      c.draw(ctx, cam);
    }

    // Player
    this.player.draw(ctx, cam);

    // Pickups
    this._drawPickups(ctx, cam);

    // Particles (on top)
    this.particles.draw(ctx, cam);

    // Ultimate cooldown indicator
    if (this.state === 'playing') {
      this._drawUltimateIndicator(ctx);
      this._drawPanicIndicator(ctx);
    }

    // Joystick
    this.input.drawJoystick();
  }

  _drawGrid(ctx, cam) {
    const gridSize = 60;
    const startX = Math.floor(cam.x / gridSize) * gridSize;
    const startY = Math.floor(cam.y / gridSize) * gridSize;

    ctx.strokeStyle = 'rgba(60,50,80,0.15)';
    ctx.lineWidth = 1;

    for (let x = startX; x < cam.x + cam.w + gridSize; x += gridSize) {
      const sx = x - cam.x + cam.shakeX;
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, cam.h);
      ctx.stroke();
    }
    for (let y = startY; y < cam.y + cam.h + gridSize; y += gridSize) {
      const sy = y - cam.y + cam.shakeY;
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(cam.w, sy);
      ctx.stroke();
    }
  }

  _drawUltimateIndicator(ctx) {
    const def = COMPANION_DEFS[this.selectedStarter];
    if (!def || !def.ultimate) return;

    const x = this.canvas.width - 70;
    const y = this.canvas.height - 70;
    const r = 24;
    const ready = this.ultimateCooldown <= 0;

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = ready ? 'rgba(150,100,255,0.6)' : 'rgba(50,50,50,0.6)';
    ctx.fill();
    ctx.strokeStyle = ready ? '#c9a0ff' : '#555';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Cooldown arc
    if (!ready) {
      const pct = this.ultimateCooldown / def.ultimate.cooldown;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - pct));
      ctx.closePath();
      ctx.fillStyle = 'rgba(150,100,255,0.25)';
      ctx.fill();
    }

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ready ? 'ULT' : Math.ceil(this.ultimateCooldown).toString(), x, y);

    ctx.font = '8px monospace';
    ctx.fillText('[SPACE]', x, y + r + 10);
    ctx.restore();
  }

  _useUltimate() {
    const def = COMPANION_DEFS[this.selectedStarter];
    if (!def || !def.ultimate) return;
    this.ultimateCooldown = def.ultimate.cooldown;

    const enemies = this.enemySystem.enemies;

    switch (this.selectedStarter) {
      case 'glintbug':
        // Nova Burst: damage all visible enemies
        for (const e of enemies) {
          if (this.camera.isVisible(e.x, e.y)) {
            e.hp -= 80;
            e.hitFlash = 0.2;
            this.particles.emit(e.x, e.y, 5, '#f1c40f', { speedMax: 80, life: 0.3 });
          }
        }
        this.particles.emit(this.player.x, this.player.y, 30, '#f1c40f', { speedMax: 200, life: 0.6 });
        this.camera.applyShake();
        break;

      case 'rustmaw':
        // Overclock: speed boost (game-time based)
        this._overclockOriginals = [];
        for (const c of this.companions) {
          this._overclockOriginals.push({ companion: c, original: c.stats.cooldown });
          c.stats.cooldown *= 0.33;
        }
        this.overclockTimer = 8;
        this.particles.emit(this.player.x, this.player.y, 20, '#95a5a6', { speedMax: 150, life: 0.5 });
        break;

      case 'nullwisp':
        // Rift Collapse: pull and damage
        for (const e of enemies) {
          const dx = this.player.x - e.x;
          const dy = this.player.y - e.y;
          e.x += dx * 0.6;
          e.y += dy * 0.6;
          e.hp -= 50;
          e.hitFlash = 0.3;
        }
        this.particles.emit(this.player.x, this.player.y, 40, '#8e44ad', { speedMax: 180, life: 0.7 });
        this.camera.applyShake();
        break;

      case 'thornvine':
        // Overgrowth: AoE slow + damage
        for (const e of enemies) {
          if (this.camera.isVisible(e.x, e.y)) {
            e.hp -= 40;
            e.slowTimer = 5;
            e.hitFlash = 0.15;
            this.particles.emit(e.x, e.y, 3, '#27ae60', { speedMax: 50, life: 0.4 });
          }
        }
        this.particles.emit(this.player.x, this.player.y, 25, '#27ae60', { speedMax: 160, life: 0.6 });
        break;

      case 'prismoth':
        // Shatter Field: rain shards
        for (let i = 0; i < 30; i++) {
          const x = this.camera.x + Math.random() * this.camera.w;
          const y = this.camera.y + Math.random() * this.camera.h;
          this.projectiles.spawn(x, y - 200, Math.PI / 2, 300, 25, 3, 4, '#3498db', { lifetime: 2 });
        }
        break;
    }
  }

  _applyUpgrade(choice) {
    switch (choice.type) {
      case 'new_companion':
        this.companions.push(new Companion(choice.key, this.player));
        break;

      case 'level_up':
        {
          const c = this.companions.find(c => c.id === choice.companionId);
          if (c) c.levelUp();
        }
        break;

      case 'modifier':
        {
          const c = this.companions.find(c => c.id === choice.companionId);
          if (c) c.addModifier(choice.modKey);
        }
        break;

      case 'stat':
        if (choice.stat === 'speed') this.player.speed += choice.value;
        if (choice.stat === 'maxHp') {
          this.player.maxHp += choice.value;
          this.player.heal(choice.value);
        }
        if (choice.stat === 'magnet') this.player.magnetRadius += choice.value;
        break;

      case 'heal':
        this.player.heal(choice.value);
        break;
    }
  }

  // ── Pickup system (elite drops) ──

  _spawnPickup(x, y) {
    const types = ['heal', 'attack_speed', 'xp_burst', 'rare_token'];
    const weights = [30, 25, 30, 15];
    const type = weightedPick(types, weights);
    this.pickups.push({ type, x, y, radius: 10, life: 15, age: 0 });
  }

  _updatePickups(dt) {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.life -= dt;
      p.age += dt;
      if (p.life <= 0) {
        this.pickups.splice(i, 1);
        continue;
      }
      if (dist(this.player, p) < this.player.radius + p.radius) {
        this._collectPickup(p);
        this.pickups.splice(i, 1);
      }
    }
  }

  _collectPickup(p) {
    switch (p.type) {
      case 'heal':
        this.player.heal(25);
        this.particles.text(this.player.x, this.player.y - 20, '+25 HP', '#2ecc71');
        this.particles.emit(this.player.x, this.player.y, 8, '#2ecc71', { speedMax: 60, life: 0.4 });
        break;
      case 'attack_speed':
        this.attackSpeedBuff = 6;
        this.particles.text(this.player.x, this.player.y - 20, 'ATK SPEED!', '#f39c12');
        this.particles.emit(this.player.x, this.player.y, 8, '#f39c12', { speedMax: 60, life: 0.4 });
        break;
      case 'xp_burst':
        this.xpSystem.spawnOrb(this.player.x, this.player.y, 10);
        this.particles.text(this.player.x, this.player.y - 20, '+10 XP', '#9b59b6');
        this.particles.emit(this.player.x, this.player.y, 8, '#9b59b6', { speedMax: 60, life: 0.4 });
        break;
      case 'rare_token':
        this.guaranteedRare = true;
        this.particles.text(this.player.x, this.player.y - 20, 'RARE TOKEN!', '#e74c3c');
        this.particles.emit(this.player.x, this.player.y, 12, '#e74c3c', { speedMax: 80, life: 0.5 });
        break;
    }
  }

  _drawPickups(ctx, cam) {
    const PICKUP_COLORS = {
      heal: '#2ecc71', attack_speed: '#f39c12',
      xp_burst: '#9b59b6', rare_token: '#e74c3c',
    };
    const PICKUP_ICONS = {
      heal: '✚', attack_speed: '⚡', xp_burst: '✦', rare_token: '★',
    };
    for (const p of this.pickups) {
      if (!cam.isVisible(p.x, p.y, 15)) continue;
      const sx = cam.screenX(p.x);
      const sy = cam.screenY(p.y);
      const bob = Math.sin(p.age * 4) * 3;
      const color = PICKUP_COLORS[p.type];

      // Fade when about to expire
      ctx.globalAlpha = p.life < 3 ? 0.3 + 0.7 * (p.life / 3) : 1;

      ctx.beginPath();
      ctx.arc(sx, sy + bob, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(PICKUP_ICONS[p.type], sx, sy + bob);

      ctx.globalAlpha = 1;
    }
  }

  // ── Panic pulse ──

  _usePanic() {
    if (this.player.panicCooldown > 0) return;
    this.player.panicCooldown = this.player.panicMaxCooldown;

    const enemies = this.enemySystem.enemies;
    for (const e of enemies) {
      const d = dist(this.player, e);
      if (d < this.player.panicRadius) {
        const dx = e.x - this.player.x;
        const dy = e.y - this.player.y;
        const len = Math.hypot(dx, dy) || 1;
        e.x += (dx / len) * this.player.panicPushForce;
        e.y += (dy / len) * this.player.panicPushForce;
        e.slowTimer = Math.max(e.slowTimer || 0, 1.5);
      }
    }

    this.particles.emit(this.player.x, this.player.y, 20, '#c9a0ff', {
      speedMin: 100, speedMax: 200, life: 0.35, sizeMin: 2, sizeMax: 4,
    });
    this.camera.applyShake();
  }

  _drawPanicIndicator(ctx) {
    const x = this.canvas.width - 70;
    const y = this.canvas.height - 120;
    const r = 18;
    const ready = this.player.panicCooldown <= 0;

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = ready ? 'rgba(100,200,255,0.5)' : 'rgba(50,50,50,0.5)';
    ctx.fill();
    ctx.strokeStyle = ready ? '#7ec8e3' : '#555';
    ctx.lineWidth = 2;
    ctx.stroke();

    if (!ready) {
      const pct = this.player.panicCooldown / this.player.panicMaxCooldown;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - pct));
      ctx.closePath();
      ctx.fillStyle = 'rgba(100,200,255,0.2)';
      ctx.fill();
    }

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ready ? 'PANIC' : Math.ceil(this.player.panicCooldown).toString(), x, y);
    ctx.font = '7px monospace';
    ctx.fillText('[Q]', x, y + r + 8);
    ctx.restore();
  }

  _gameOver() {
    this.state = 'gameover';
    this.pendingUpgrades = 0;

    // End overclock if active
    if (this.overclockTimer > 0) {
      for (const entry of this._overclockOriginals) {
        if (entry.companion && entry.companion.stats) {
          entry.companion.stats.cooldown = entry.original;
        }
      }
      this._overclockOriginals = [];
      this.overclockTimer = 0;
    }

    // Check level-based unlocks before recording
    if (this.player.level >= 10 && !this.progression.isUnlocked('thornvine')) {
      this.progression.data.unlocked.push('thornvine');
    }

    this.progression.recordRun(this.player.kills, this.elapsed);

    const statsEl = document.getElementById('run-stats');
    statsEl.innerHTML = `
      Time survived: <strong>${formatTime(this.elapsed)}</strong><br>
      Level reached: <strong>${this.player.level}</strong><br>
      Enemies slain: <strong>${this.player.kills}</strong><br>
      Companions: <strong>${this.companions.map(c => c.def.name).join(', ')}</strong>
    `;
    document.getElementById('gameover-screen').classList.remove('hidden');
  }

  resize(w, h) {
    this.camera.resize(w, h);
  }
}
