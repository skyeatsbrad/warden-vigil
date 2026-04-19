// ── Game state manager ──

import { Player } from './player.js?v=16';
import { Companion, processOrbitDamage } from './companion.js?v=16';
import { EnemySystem } from './enemy.js?v=16';
import { ProjectileSystem } from './projectile.js?v=16';
import { XPSystem } from './xp.js?v=16';
import { Particles } from './particles.js?v=16';
import { Camera } from './camera.js?v=16';
import { UI } from './ui.js?v=16';
import { Progression } from './progression.js?v=16';
import { processCollisions, handleProjectileHit } from './collision.js?v=16';
import { SpatialGrid } from './spatial-grid.js?v=16';
import { COMPANION_DEFS, SYNERGY_DEFS, TRADEOFF_CARDS, CURSED_CARDS, EVOLUTIONS, getEvolveLevel, MASTERY_DEFS, getMasteryValue, MODIFIERS } from './data/companions.js?v=16';
import { COLORS } from './data/colors.js?v=16';
import { REALM_CONFIG, REALM_DEFS } from './data/enemies.js?v=16';
import { formatTime, dist, weightedPick } from './utils.js?v=16';

export class Game {
  constructor(canvas, input, sprites) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = input;
    this.sprites = sprites || null;

    this.state = 'title'; // title | playing | upgrading | gameover
    this.elapsed = 0;
    this._isMobile = window.matchMedia('(pointer: coarse)').matches && window.matchMedia('(max-width: 900px)').matches;
    this._safeTop = 0;
    this._safeBottom = 0;
    this._safeRight = 0;

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

    // Build-defining systems
    this.synergies = {};         // active category synergies
    this.tradeoffs = {           // accumulated tradeoff effects
      allDamageMult: 1,
      allCooldownMult: 1,
      allRangeMult: 1,
      allPierceAdd: 0,
      projSpeedAdd: 0,
      allRangeAdd: 0,
      orbitDmgMult: 1,
    };
    this._masteryPicks = {};     // mastery id → pick count
    this._pendingEvolution = null;
    this._bioHealTimer = 0;

    // Momentum system
    this._momentum = 0;
    this._momentumTier = 0;
    this._maxMomentumTier = 0;

    // Void burst pickup
    this._voidBurstKills = 0;

    // Surge / pressure spike system
    this._surgeTimer = 0;
    this._surgeActive = false;
    this._surgeRemaining = 0;
    this._surgeCount = 0;
    this._surgesCompleted = 0;
    this._surgeWarningShown = false;
    this._surgeWarningTime = 0;

    // Chest system
    this._pendingChests = 0;

    // Cursed upgrade effects
    this._curseSpawnMult = 1;
    this._curseDrainPerSec = 0;
    this._curseEnemySpeedMult = 1;
    this._curseDrainAccum = 0;

    // Run stats
    this._totalDamageDealt = 0;

    // Panic pulse ring effect
    this._panicRingT = 0;   // 0 = inactive, >0 = expanding
    this._panicRingMax = 0.35;

    // Death ring effects (expanding circles on kill)
    this._deathRings = [];

    // Ultimate bloom effect (multi-phase)
    this._ultBloomT = 0;
    this._ultBloomMax = 0.8;
    this._ultColor = '#ffffff';
    this._ultCoreX = 0;
    this._ultCoreY = 0;

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
        e.preventDefault();
        this._useUltimate();
      }
      if ((e.key === 'q' || e.key === 'Q') && this.state === 'playing') {
        e.preventDefault();
        this._usePanic();
      }
    });

    // Panic touch button — use pointerdown for reliable mobile response
    const panicBtn = document.getElementById('panic-btn');
    if (panicBtn) {
      panicBtn.addEventListener('pointerdown', e => {
        e.preventDefault();
        e.stopPropagation();
        if (this.state === 'playing') this._usePanic();
      });
    }

    // Ultimate touch button — use pointerdown for reliable mobile response
    const ultBtn = document.getElementById('ult-btn');
    if (ultBtn) {
      ultBtn.addEventListener('pointerdown', e => {
        e.preventDefault();
        e.stopPropagation();
        if (this.state === 'playing' && this.ultimateCooldown <= 0) this._useUltimate();
      });
    }
  }

  startRun() {
    this.state = 'playing';
    this.elapsed = 0;
    this.ultimateCooldown = 0;

    // Restore HUD/controls hidden during gameover
    const hud = document.getElementById('hud');
    const mobileCtrl = document.getElementById('mobile-controls');
    if (hud) hud.style.opacity = '';
    if (mobileCtrl) mobileCtrl.style.opacity = '';
    this.player = new Player(0, 0);
    this.companions = [];
    this.enemySystem.clear();
    this.enemySystem.realmIndex = 0;
    this.projectiles.clear();
    this.xpSystem.clear();
    this.pickups = [];
    this.attackSpeedBuff = 0;
    this.guaranteedRare = false;
    this.pendingUpgrades = 0;
    this.overclockTimer = 0;
    this._overclockOriginals = [];
    this.synergies = {};
    this.tradeoffs = { allDamageMult: 1, allCooldownMult: 1, allRangeMult: 1, allPierceAdd: 0, projSpeedAdd: 0, allRangeAdd: 0, orbitDmgMult: 1 };
    this._masteryPicks = {};  // id → count
    this._pendingEvolution = null;
    this._bioHealTimer = 0;
    this._momentum = 0;
    this._momentumTier = 0;
    this._maxMomentumTier = 0;
    this._voidBurstKills = 0;
    this._surgeTimer = 0;
    this._surgeActive = false;
    this._surgeRemaining = 0;
    this._surgeCount = 0;
    this._surgesCompleted = 0;
    this._surgeWarningShown = false;
    this._surgeWarningTime = 0;
    this._pendingChests = 0;
    this._curseSpawnMult = 1;
    this._curseDrainPerSec = 0;
    this._curseEnemySpeedMult = 1;
    this._curseDrainAccum = 0;
    this._totalDamageDealt = 0;
    this._panicRingT = 0;
    this._deathRings = [];
    this._ultBloomT = 0;
    this._ultColor = '#ffffff';
    this.ui._pickedTradeoffs = new Set();
    this.camera.reset(0, 0);

    // Realm loop state
    this._realmIndex = 0;
    this._realmElapsed = 0;
    this._realmState = 'active'; // active | boss | portal
    this._realmBossId = -1;
    this._realmBossRef = null;
    this._currentRealmDef = REALM_DEFS[0];
    this._currentRi = 0;
    this._portalTimer = 0;
    this._portalRingT = 0;

    // Spawn starting companion
    const starter = new Companion(this.selectedStarter, this.player);
    this.companions.push(starter);

    // Bind projectile hit callback once (avoids per-frame closure allocation)
    this._onProjectileHit = (enemy, proj) => {
      const actualDmg = handleProjectileHit(enemy, proj, this.particles);
      this._totalDamageDealt += actualDmg;
      if (proj.sourceId >= 0) {
        const c = this.companions.find(c => c.id === proj.sourceId);
        if (c) c._totalDamage += actualDmg;
      }
    };
  }

  update(dt) {
    if (this.state !== 'playing') return;

    // Frame pressure: smoothed ratio of actual dt to target dt
    this._smoothedDt += (dt - this._smoothedDt) * 0.1;
    const pressure = Math.min(1, Math.max(0, (this._smoothedDt / this._targetDt - 1) * 2));
    this.particles.pressure = pressure;

    this.elapsed += dt;
    this._realmElapsed += dt;
    this.input.update();

    // Compute realm-aware scaling (cached per realm transition)
    const realmDef = this._currentRealmDef;
    const ri = this._currentRi;
    const effectiveMinutes = this._realmElapsed / 60 + ri * REALM_CONFIG.scalingOffset;

    // Player
    this.player.update(dt, this.input.dir);

    // Camera
    this.camera.follow(this.player, dt);

    // Build spatial grid once per frame
    const grid = new SpatialGrid(this.enemySystem.enemies);

    // Momentum decay and tier calculation
    this._momentum = Math.max(0, this._momentum - 2 * dt);
    const newTier = this._momentum >= 50 ? 3 : this._momentum >= 25 ? 2 : this._momentum >= 10 ? 1 : 0;
    this._momentumTier = newTier;
    if (newTier > this._maxMomentumTier) this._maxMomentumTier = newTier;
    const momentumDmgMult = newTier >= 2 ? 1.15 : 1;

    // Set momentum damage multiplier on each companion
    for (const c of this.companions) {
      c._momentumDmgMult = momentumDmgMult;
      c.update(dt, this.player, this.enemySystem.enemies, grid);
      c.attack(this.enemySystem.enemies, this.projectiles, this.particles, grid);
    }

    // Momentum tier 1: -10% cooldown (extra cooldown reduction)
    if (newTier >= 1) {
      for (const c of this.companions) {
        c.cooldownTimer -= dt * 0.1;
      }
    }

    // Attack speed buff: extra cooldown reduction for all companions
    if (this.attackSpeedBuff > 0) {
      this.attackSpeedBuff -= dt;
      for (const c of this.companions) {
        c.cooldownTimer -= dt;
      }
    }

    // Orbit damage
    processOrbitDamage(this.companions, this.enemySystem.enemies, this.particles, dt, grid, this.tradeoffs.orbitDmgMult);

    // ── Realm state machine ──
    if (this._realmState === 'active') {
      if (this._realmElapsed >= realmDef.duration) {
        // Spawn realm boss
        const bossType = realmDef.bossType || 'voidlord';
        this._realmBossId = this.enemySystem.forceSpawnBoss(
          bossType, this.player, this.camera, effectiveMinutes, this._realmIndex
        );
        this._realmBossRef = this.enemySystem.enemies.find(e => e.id === this._realmBossId) || null;
        this._realmState = 'boss';
        this.enemySystem.bossAlive = true;
        this.enemySystem.spawnRateMult = REALM_CONFIG.bossSpawnMult;
        // Announce with boss name
        const bossName = this._realmBossRef ? this._realmBossRef.name : bossType;
        this.particles.text(this.player.x, this.player.y - 50,
          `⚠ ${bossName}!`, '#ff2222', 22);
        this.camera.applyShake();
      }
    } else if (this._realmState === 'portal') {
      this._portalTimer -= dt;
      this._portalRingT += dt;
      if (this._portalTimer <= 0) {
        this._advanceRealm();
      }
    }
    // Boss death is detected below in the enemy removal loop

    // ── Surge / pressure spike system (paused during boss/portal) ──
    if (this._realmState === 'active') {
      this._surgeTimer += dt;
      if (!this._surgeActive && this._surgeTimer >= 90) {
        this._surgeActive = true;
        this._surgeRemaining = 15;
        this._surgeCount++;
        this._surgeTimer = 0;
        this._surgeWarningShown = true;
        this._surgeWarningTime = 2.0;
        this.enemySystem.triggerSurgeBurst(this.player, this.camera, this._realmElapsed, effectiveMinutes);
        this.particles.text(this.player.x, this.player.y - 40, '⚠ SURGE!', '#ff4444', 20);
        this.camera.applyShake();
      }
    }
    if (this._surgeActive) {
      this._surgeRemaining -= dt;
      this.enemySystem.spawnTimer -= dt;
      if (this._surgeRemaining <= 0) {
        this._surgeActive = false;
        this._surgesCompleted++;
        this.particles.text(this.player.x, this.player.y - 40, 'SURGE CLEAR!', '#2ecc71', 16);
      }
    }
    if (this._surgeWarningTime > 0) this._surgeWarningTime -= dt;
    if (this._panicRingT > 0) this._panicRingT -= dt;
    if (this._ultBloomT > 0) this._ultBloomT -= dt;

    // Apply curse spawn rate multiplier
    if (this._curseSpawnMult !== 1) {
      this.enemySystem.spawnTimer -= dt * (1 / this._curseSpawnMult - 1);
    }

    // Apply curse enemy speed
    this.enemySystem.curseSpeedMult = this._curseEnemySpeedMult;

    // Curse HP drain
    if (this._curseDrainPerSec > 0) {
      this._curseDrainAccum += this._curseDrainPerSec * dt;
      while (this._curseDrainAccum >= 1) {
        this._curseDrainAccum -= 1;
        this.player.hp = Math.max(1, this.player.hp - 1);
      }
    }

    // Enemies
    this.enemySystem.update(dt, this._realmElapsed, effectiveMinutes, this.player, this.camera, grid);

    // Projectiles — track damage for source companions
    this.projectiles.update(dt, this.enemySystem.enemies, this.particles, this._onProjectileHit, grid);

    // Collisions (player vs nearby enemies via grid)
    processCollisions(this.player, this.enemySystem.enemies, this.particles, this.camera, grid, this.enemySystem);

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
    // Momentum tier 3 bonus: +25 effective magnet radius
    const magnetBonus = this._momentumTier >= 3 ? 25 : 0;

    for (let i = this.enemySystem.enemies.length - 1; i >= 0; i--) {
      const e = this.enemySystem.enemies[i];
      if (e.hp <= 0) {
        this.player.kills++;
        this._momentum += 1;
        this.xpSystem.spawnFromEnemy(e);

        // Enhanced kill feedback: impact ring + radial burst
        const isElite = e.tier === 'elite' || e.tier === 'miniboss' || e.tier === 'boss';
        this.particles.spawnImpact(e.x, e.y, e.color, {
          maxRadius: e.radius * (isElite ? 4 : 2.5),
          lifetime: isElite ? 0.4 : 0.25,
          particles: isElite ? 10 : 6,
          particleSpeed: isElite ? 160 : 100,
        });

        if (isElite) {
          this.camera.applyShake();
          this._spawnPickup(e.x, e.y);
          // 35% chance to also drop a chest
          if (Math.random() < 0.35) {
            this.pickups.push({ type: 'chest', x: e.x + 15, y: e.y, radius: 12, life: 20, age: 0 });
          }
        }

        // Void burst: next N kills explode for AoE
        if (this._voidBurstKills > 0) {
          this._voidBurstKills--;
          const burstTargets = grid.query2(e.x, e.y, 80);
          for (const e2 of burstTargets) {
            if (e2 === e || e2.hp <= 0) continue;
            if (dist(e, e2) < 80) {
              e2.hp -= 15;
              e2.hitFlash = 0.1;
            }
          }
          this.particles.emit(e.x, e.y, 10, '#8e44ad', { speedMax: 120, life: 0.4 });
        }

        // Volatile mark: marked enemies explode on death (single-hop, no cascade)
        if (e.volatileMarked && !e._volatileExploded) {
          const vmTargets = grid.query2(e.x, e.y, 60);
          for (const e2 of vmTargets) {
            if (e2 === e || e2.hp <= 0) continue;
            if (dist(e, e2) < 60) {
              e2.hp -= Math.round(e.maxHp * 0.2);
              e2.hitFlash = 0.12;
              e2._volatileExploded = true; // prevent cascade
            }
          }
          this.particles.emit(e.x, e.y, 12, '#ff4444', { speedMax: 130, life: 0.4 });
        }

        // Realm boss death → trigger portal
        if (e.id === this._realmBossId && this._realmState === 'boss') {
          this._realmState = 'portal';
          this._portalTimer = REALM_CONFIG.portalDuration;
          this._portalRingT = 0;
          this._realmBossRef = null;
          this.enemySystem.bossAlive = false;
          this.enemySystem.spawnRateMult = 0;
          // Victory feedback
          this.particles.text(e.x, e.y - 30,
            `${e.name || e.type} DEFEATED!`, '#ffd700', 22);
          this.particles.emit(e.x, e.y, 20, '#ffd700', { speedMax: 180, life: 0.6 });
          this.particles.emit(e.x, e.y, 12, e.color, { speedMax: 140, life: 0.5 });
          this.camera.applyShake();
        }

        this.enemySystem.enemies.splice(i, 1);
      }
    }

    // XP collection — apply momentum magnet bonus temporarily
    this.player.magnetRadius += magnetBonus;
    const levelsGained = this.xpSystem.update(dt, this.player);
    this.player.magnetRadius -= magnetBonus;
    if (levelsGained > 0) {
      this.pendingUpgrades += levelsGained;
      this._showNextUpgrade();
    }

    // Ultimate cooldown
    if (this.ultimateCooldown > 0) this.ultimateCooldown -= dt;

    // Bio synergy heal
    if (this.synergies.Bio) {
      this._bioHealTimer -= dt;
      if (this._bioHealTimer <= 0) {
        this.player.heal(1);
        this._bioHealTimer = SYNERGY_DEFS.Bio.healInterval;
      }
    }

    // Particles
    this.particles.update(dt);

    // Update HUD
    this.ui.updateHUD(this.player, this.elapsed, this._realmIndex, this._realmState, realmDef);

    // Check death
    if (!this.player.alive) {
      this._gameOver();
    }
  }

  _showNextUpgrade() {
    // Prevent re-entry when already upgrading
    if (this.state === 'upgrading') return;

    // Handle pending evolution first (guaranteed 2-card event)
    if (this._pendingEvolution) {
      const c = this._pendingEvolution;
      this._pendingEvolution = null;
      this.state = 'upgrading';
      this.ui.showEvolutionChoice(c, path => {
        c.evolve(path, this.synergies, this.tradeoffs);
        this.particles.emit(c.x, c.y, 20, c.evolutionDef.color, { speedMax: 150, life: 0.6 });
        this.particles.text(c.x, c.y - 20, `${c.evolutionDef.name}!`, c.evolutionDef.color);
        this.state = 'playing';
        this._showNextUpgrade();
      });
      return;
    }

    // Handle pending chests (guaranteed epic power spike)
    if (this._pendingChests > 0) {
      this._pendingChests--;
      this.state = 'upgrading';
      this.ui.showChestSelection(this.player, this.companions, choice => {
        this._applyUpgrade(choice);
        this.state = 'playing';
        this._showNextUpgrade();
      }, this._masteryPicks);
      return;
    }

    if (this.pendingUpgrades <= 0) {
      this.state = 'playing';
      return;
    }
    this.pendingUpgrades--;
    this.state = 'upgrading';
    this.ui.showUpgradeSelection(this.player, this.companions, choice => {
      this._applyUpgrade(choice);
      this.guaranteedRare = false;
      this.state = 'playing';
      this._showNextUpgrade();
    }, this.guaranteedRare, this._masteryPicks);
  }

  draw() {
    const ctx = this.ctx;
    const cam = this.camera;

    // Clear
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.state === 'title') return;
    if (!this.player) return;

    // During gameover, suppress the gameplay canvas to near-black
    if (this.state === 'gameover') {
      ctx.fillStyle = '#000';
      ctx.globalAlpha = 0.85;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.globalAlpha = 1;
      return;
    }

    // Grid background — skip on mobile under frame pressure
    if (!(this._isMobile && this.particles.pressure > 0.5)) {
      this._drawGrid(ctx, cam);
    }

    // XP orbs (lowest world layer)
    this.xpSystem.draw(ctx, cam);

    // Aura effects (below enemies)
    for (const c of this.companions) {
      c.drawAura(ctx, cam);
    }

    // Enemies
    this.enemySystem.draw(ctx, cam, this.sprites);

    // Projectiles (above enemies)
    this.projectiles.draw(ctx, cam);

    // Pickups (above enemies, below player)
    this._drawPickups(ctx, cam);

    // Companions
    for (const c of this.companions) {
      c.draw(ctx, cam);
    }

    // Player (always on top of world)
    this.player.draw(ctx, cam);

    // Hit effects + particles (topmost world layer — includes impact rings)
    this.particles.draw(ctx, cam);

    // Panic pulse ring (screen-space effect)
    this._drawPanicRing(ctx, cam);

    // Ultimate bloom overlay
    this._drawUltBloom(ctx);

    // Portal ring during realm transition
    if (this._realmState === 'portal') {
      this._drawPortalRing(ctx, cam);
    }

    // Boss HP bar during boss phase
    if (this._realmState === 'boss') {
      this._drawBossHPBar(ctx);
    }

    // Ultimate cooldown indicator
    if (this.state === 'playing') {
      if (this._isMobile) {
        // On mobile: update DOM button labels with cooldown state (no canvas indicators)
        this._updateMobileButtons();
        // Skip momentum meter + surge text on mobile — they clutter touch areas.
        // Keep surge border (red pulse) as it's useful danger feedback.
        this._drawSurgeBorder(ctx);
      } else {
        this._drawUltimateIndicator(ctx);
        this._drawPanicIndicator(ctx);
        this._drawMomentumMeter(ctx);
        this._drawSurgeIndicator(ctx);
      }
    }

    // Joystick
    this.input.drawJoystick();
  }

  _drawGrid(ctx, cam) {
    const gridSize = 60;
    const startX = Math.floor(cam.x / gridSize) * gridSize;
    const startY = Math.floor(cam.y / gridSize) * gridSize;

    ctx.strokeStyle = COLORS.gridLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = startX; x < cam.x + cam.w + gridSize; x += gridSize) {
      const sx = x - cam.x + cam.shakeX;
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, cam.h);
    }
    for (let y = startY; y < cam.y + cam.h + gridSize; y += gridSize) {
      const sy = y - cam.y + cam.shakeY;
      ctx.moveTo(0, sy);
      ctx.lineTo(cam.w, sy);
    }
    ctx.stroke();
  }

  _drawUltimateIndicator(ctx) {
    const def = COMPANION_DEFS[this.selectedStarter];
    if (!def || !def.ultimate) return;

    const safeB = this._safeBottom || 0;
    const safeR = this._safeRight || 0;
    const x = this.canvas.width - 70 - safeR;
    const y = this.canvas.height - 70 - safeB;
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
    if (!this._isMobile) ctx.fillText('[SPACE]', x, y + r + 10);
    ctx.restore();
  }

  _useUltimate() {
    const def = COMPANION_DEFS[this.selectedStarter];
    if (!def || !def.ultimate) return;
    this.ultimateCooldown = def.ultimate.cooldown;
    this._triggerUltimateVFX(def.color || '#ffffff');

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
        {
          const c = new Companion(choice.key, this.player);
          this.companions.push(c);
          this._computeSynergies();
          c.recomputeStats(this.synergies, this.tradeoffs);
        }
        break;

      case 'level_up':
        {
          const c = this.companions.find(c => c.id === choice.companionId);
          if (c) {
            c.levelUp(this.synergies, this.tradeoffs);
            // Check for evolution trigger
            const evoLevel = getEvolveLevel(c.key);
            if (c.level === evoLevel && EVOLUTIONS[c.key] && !c.evolution) {
              this._pendingEvolution = c;
            }
          }
        }
        break;

      case 'modifier':
        {
          const c = this.companions.find(c => c.id === choice.companionId);
          if (c) c.addModifier(choice.modKey);
        }
        break;

      case 'tradeoff':
        {
          const tc = TRADEOFF_CARDS.find(t => t.id === choice.tradeoffId);
          if (tc) {
            const eff = tc.effects;
            if (eff.allDamageMult) this.tradeoffs.allDamageMult *= eff.allDamageMult;
            if (eff.allCooldownMult) this.tradeoffs.allCooldownMult *= eff.allCooldownMult;
            if (eff.allRangeMult) this.tradeoffs.allRangeMult *= eff.allRangeMult;
            if (eff.allPierceAdd) this.tradeoffs.allPierceAdd += eff.allPierceAdd;
            if (eff.maxHpAdd) {
              this.player.maxHp += eff.maxHpAdd;
              if (eff.maxHpAdd > 0) this.player.heal(eff.maxHpAdd);
              if (this.player.hp > this.player.maxHp) this.player.hp = this.player.maxHp;
              if (this.player.maxHp < 1) this.player.maxHp = 1;
            }
            if (eff.damageTakenMult) {
              this.player.damageTakenMult = (this.player.damageTakenMult || 1) * eff.damageTakenMult;
            }
            this.ui._pickedTradeoffs.add(tc.id);
            this._recomputeAllStats();
          }
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

      case 'cursed':
        {
          const cc = CURSED_CARDS.find(c => c.id === choice.cursedId);
          if (cc) {
            const eff = cc.effects;
            if (eff.allDamageMult) this.tradeoffs.allDamageMult *= eff.allDamageMult;
            if (eff.allCooldownMult) this.tradeoffs.allCooldownMult *= eff.allCooldownMult;
            if (eff.maxHpAdd) {
              this.player.maxHp += eff.maxHpAdd;
              this.player.heal(eff.maxHpAdd);
            }
            if (eff.curseSpawnMult) this._curseSpawnMult *= eff.curseSpawnMult;
            if (eff.curseDrainPerSec) this._curseDrainPerSec += eff.curseDrainPerSec;
            if (eff.curseEnemySpeedMult) this._curseEnemySpeedMult *= eff.curseEnemySpeedMult;
            this.ui._pickedTradeoffs.add(cc.id);
            this._recomputeAllStats();
          }
        }
        break;

      case 'mastery':
        {
          const mDef = MASTERY_DEFS.find(m => m.id === choice.masteryId);
          if (mDef) {
            const rank = this._masteryPicks[mDef.id] || 0;
            const val = getMasteryValue(mDef, rank);
            this._masteryPicks[mDef.id] = rank + 1;

            switch (mDef.stat) {
              case 'allDamageMult':
                this.tradeoffs.allDamageMult *= (1 + val);
                this._recomputeAllStats();
                break;
              case 'allCooldownMult':
                this.tradeoffs.allCooldownMult *= (1 - val);
                this._recomputeAllStats();
                break;
              case 'projSpeedAdd':
                this.tradeoffs.projSpeedAdd += val;
                this._recomputeAllStats();
                break;
              case 'allRangeAdd':
                this.tradeoffs.allRangeAdd += val;
                this._recomputeAllStats();
                break;
              case 'orbitDmgMult':
                this.tradeoffs.orbitDmgMult *= (1 + val);
                this._recomputeAllStats();
                break;
              case 'magnet':
                this.player.magnetRadius += val;
                break;
              case 'speed':
                this.player.speed += val;
                break;
              case 'maxHp':
                this.player.maxHp += val;
                this.player.heal(val);
                break;
              case 'healOnPickup':
                this.player.healOnPickup = (this.player.healOnPickup || 0) + val;
                break;
              case 'xpMult':
                this.player.xpMult = (this.player.xpMult || 1) * (1 + val);
                break;
            }
          }
        }
        break;
    }
  }

  _computeSynergies() {
    const counts = {};
    for (const c of this.companions) {
      const cat = c.def.category;
      counts[cat] = (counts[cat] || 0) + 1;
    }
    const oldSynergies = this.synergies;
    this.synergies = {};
    for (const [cat, def] of Object.entries(SYNERGY_DEFS)) {
      if ((counts[cat] || 0) >= 2) {
        this.synergies[cat] = def;
        // Notify on newly activated synergy
        if (!oldSynergies[cat] && this.player) {
          this.particles.text(this.player.x, this.player.y - 50, `⚡ ${def.label}`, '#ffd700', 16);
        }
      }
    }
  }

  _recomputeAllStats() {
    for (const c of this.companions) {
      c.recomputeStats(this.synergies, this.tradeoffs);
    }
  }

  // ── Pickup system (elite drops) ──

  _spawnPickup(x, y) {
    const types = ['heal', 'frenzy_core', 'essence_surge', 'rare_token', 'void_burst'];
    const weights = [25, 25, 25, 15, 10];
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
      case 'frenzy_core':
        this.attackSpeedBuff = 8;
        this.particles.text(this.player.x, this.player.y - 20, 'FRENZY!', '#f39c12');
        this.particles.emit(this.player.x, this.player.y, 10, '#f39c12', { speedMax: 80, life: 0.5 });
        break;
      case 'essence_surge':
        this.xpSystem.spawnOrb(this.player.x, this.player.y, 10);
        this.player.heal(10);
        this.particles.text(this.player.x, this.player.y - 20, 'ESSENCE SURGE!', '#9b59b6');
        this.particles.emit(this.player.x, this.player.y, 10, '#9b59b6', { speedMax: 80, life: 0.5 });
        break;
      case 'rare_token':
        this.guaranteedRare = true;
        this.particles.text(this.player.x, this.player.y - 20, 'RARE SIGIL!', '#e74c3c');
        this.particles.emit(this.player.x, this.player.y, 12, '#e74c3c', { speedMax: 80, life: 0.5 });
        break;
      case 'void_burst':
        this._voidBurstKills = 5;
        this.particles.text(this.player.x, this.player.y - 20, 'VOID BURST!', '#8e44ad');
        this.particles.emit(this.player.x, this.player.y, 15, '#8e44ad', { speedMax: 100, life: 0.6 });
        break;
      case 'chest':
        this._pendingChests++;
        this.particles.text(this.player.x, this.player.y - 20, '🎁 CHEST!', '#ffd700', 18);
        this.particles.emit(this.player.x, this.player.y, 15, '#ffd700', { speedMax: 100, life: 0.5 });
        // Trigger chest selection if not already upgrading
        if (this.state === 'playing') {
          this._showNextUpgrade();
        }
        break;
    }
  }

  _drawPickups(ctx, cam) {
    const PICKUP_COLORS = {
      heal: '#2ecc71', frenzy_core: '#f39c12',
      essence_surge: '#9b59b6', rare_token: '#e74c3c', void_burst: '#8e44ad',
      chest: '#ffd700',
    };
    const PICKUP_ICONS = {
      heal: '✚', frenzy_core: '⚡', essence_surge: '✦', rare_token: '★', void_burst: '◈',
      chest: '🎁',
    };
    const now = performance.now() * 0.004;
    // Sprite key mapping: game pickup type → sprite key
    const SPRITE_MAP = {
      heal: 'pickup_orb_green_a',
      essence_surge: 'pickup_crystal_blue_a',
    };

    for (const p of this.pickups) {
      if (!cam.isVisible(p.x, p.y, 15)) continue;
      const sx = cam.screenX(p.x);
      const sy = cam.screenY(p.y);
      const bob = Math.sin(p.age * 4) * 3;
      const color = PICKUP_COLORS[p.type];

      // Fade when about to expire
      const fadeAlpha = p.life < 3 ? 0.3 + 0.7 * (p.life / 3) : 1;
      ctx.globalAlpha = fadeAlpha;

      // Sparkle ring (cheap rotating dots) — kept for both sprite and canvas
      const sparkPhase = now * 2 + p.x * 0.01;
      for (let s = 0; s < 3; s++) {
        const a = sparkPhase + s * (Math.PI * 2 / 3);
        const sparkR = p.radius + 5 + Math.sin(now * 3 + s) * 2;
        const sparkAlpha = Math.sin(now * 4 + s * 2) * 0.3 + 0.4;
        ctx.globalAlpha = fadeAlpha * sparkAlpha;
        ctx.beginPath();
        ctx.arc(sx + Math.cos(a) * sparkR, sy + bob + Math.sin(a) * sparkR, 1.2, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
      }
      ctx.globalAlpha = fadeAlpha;

      // Sprite path
      const spriteKey = SPRITE_MAP[p.type];
      if (spriteKey && this.sprites?.drawSprite(ctx, spriteKey, sx, sy + bob, p.radius * 2.4, p.radius * 2.4, 0, fadeAlpha)) {
        // drawn by sprite
      } else {
        // Canvas fallback
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
      }

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

    this.particles.emit(this.player.x, this.player.y, 20, '#ff6d00', {
      speedMin: 100, speedMax: 200, life: 0.35, sizeMin: 2, sizeMax: 4,
    });
    this.camera.applyShake();
    this._panicRingT = this._panicRingMax; // trigger expanding ring
  }

  _drawPanicRing(ctx, cam) {
    if (this._panicRingT <= 0) return;
    const frac = 1 - this._panicRingT / this._panicRingMax;
    const radius = this.player.panicRadius * frac;
    const alpha = (1 - frac) * 0.6;
    const sx = cam.screenX(this.player.x);
    const sy = cam.screenY(this.player.y);

    // Brief background desaturate during panic
    if (frac < 0.4) {
      ctx.fillStyle = `rgba(0,0,0,${0.15 * (1 - frac / 0.4)})`;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    ctx.beginPath();
    ctx.arc(sx, sy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,109,0,${alpha})`;
    ctx.lineWidth = 3 * (1 - frac) + 1;
    ctx.stroke();
  }

  _drawPortalRing(ctx, cam) {
    const t = this._portalRingT;
    const pulse = 0.5 + 0.5 * Math.sin(t * 6);
    const baseR = 60 + 20 * pulse;
    const sx = cam.screenX(this.player.x);
    const sy = cam.screenY(this.player.y);

    // ── Sprite portal layers (behind canvas effects) ──
    // Layer 1: outer ring — rotating, pulsing size
    const outerSize = baseR * 2.6;
    this.sprites?.drawSprite(ctx, 'portal_ring_a', sx, sy, outerSize, outerSize, t * 0.5, 0.6 + 0.2 * pulse);
    // Layer 2: inner swirl — counter-rotating, smaller
    const innerSize = baseR * 1.4;
    this.sprites?.drawSprite(ctx, 'portal_swirl_a', sx, sy, innerSize, innerSize, -t * 0.8, 0.5 + 0.3 * pulse);

    // ── 1. Inner swirling gradient (3 offset radial fills) ──
    const innerR = baseR * 0.7;
    for (let i = 0; i < 3; i++) {
      const a = t * (1.8 + i * 0.3) + (Math.PI * 2 / 3) * i;
      const ox = Math.cos(a) * innerR * 0.25;
      const oy = Math.sin(a) * innerR * 0.25;
      ctx.beginPath();
      ctx.arc(sx + ox, sy + oy, innerR * 0.7, 0, Math.PI * 2);
      ctx.fillStyle = i === 0 ? '#00ffc8' : i === 1 ? '#0088ff' : '#aa44ff';
      ctx.globalAlpha = 0.04 + 0.02 * pulse;
      ctx.fill();
    }

    // ── 2. Rotating outer ring (3 arc segments, dashed look) ──
    const ringAngle = t * 1.5;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.5 + 0.2 * pulse;
    ctx.strokeStyle = '#00ffc8';
    for (let i = 0; i < 3; i++) {
      const segStart = ringAngle + (Math.PI * 2 / 3) * i;
      ctx.beginPath();
      ctx.arc(sx, sy, baseR, segStart, segStart + 1.4);
      ctx.stroke();
    }

    // Counter-rotating inner ring (2 segments, thinner)
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#0088ff';
    ctx.globalAlpha = 0.3 + 0.15 * pulse;
    for (let i = 0; i < 2; i++) {
      const segStart = -t * 2.2 + Math.PI * i;
      ctx.beginPath();
      ctx.arc(sx, sy, baseR * 0.75, segStart, segStart + 1.8);
      ctx.stroke();
    }

    // ── 3. Pulsing center core ──
    const coreR = 8 + 6 * pulse;
    // Outer glow
    ctx.beginPath();
    ctx.arc(sx, sy, coreR * 2.2, 0, Math.PI * 2);
    ctx.fillStyle = '#00ffc8';
    ctx.globalAlpha = 0.06 + 0.04 * pulse;
    ctx.fill();
    // Bright center
    ctx.beginPath();
    ctx.arc(sx, sy, coreR, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.4 + 0.3 * pulse;
    ctx.fill();
    // Color halo
    ctx.beginPath();
    ctx.arc(sx, sy, coreR * 1.4, 0, Math.PI * 2);
    ctx.strokeStyle = '#00ffc8';
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.3 + 0.2 * pulse;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // ── 4. Floating orbiting motes (4, no particles) ──
    for (let i = 0; i < 4; i++) {
      const moteA = t * (2 + i * 0.4) + (Math.PI / 2) * i;
      const moteR = baseR * (0.4 + 0.15 * Math.sin(t * 3 + i));
      const mx = sx + Math.cos(moteA) * moteR;
      const my = sy + Math.sin(moteA) * moteR;
      ctx.beginPath();
      ctx.arc(mx, my, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#00ffc8';
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 5 + i * 1.5);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // ── 5. Realm label ──
    ctx.save();
    const nextDef = REALM_DEFS[Math.min(this._realmIndex + 1, REALM_DEFS.length - 1)];
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.6 + 0.3 * pulse;
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(nextDef.name, sx, sy - baseR - 12);
    ctx.restore();
  }

  _drawBossHPBar(ctx) {
    const boss = this._realmBossRef;
    if (!boss || boss.hp <= 0) return;

    const barW = 300, barH = 16;
    const x = (ctx.canvas.width - barW) / 2;
    const y = 50;
    const hpFrac = Math.max(0, boss.hp / boss.maxHp);
    const bossName = boss.name || boss.type || 'BOSS';

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x - 2, y - 2, barW + 4, barH + 4);

    // HP fill with color shift
    ctx.fillStyle = hpFrac > 0.5 ? '#cc2222' : hpFrac > 0.25 ? '#cc6600' : '#ff0000';
    ctx.fillRect(x, y, barW * hpFrac, barH);

    // HP percentage text inside bar
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.ceil(hpFrac * 100)}%`, ctx.canvas.width / 2, y + 12);

    // Border
    ctx.strokeStyle = boss.color || '#ff4444';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x - 2, y - 2, barW + 4, barH + 4);

    // Boss name label
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`⚠ ${bossName}`, ctx.canvas.width / 2, y - 6);
    ctx.restore();
  }

  // ── Ultimate VFX trigger ──
  // Starts the multi-phase visual: dim → core burst → expanding ring → fade.
  // Particles spawned once (max 30), no per-frame allocation.
  _triggerUltimateVFX(color) {
    this._ultBloomT = this._ultBloomMax;
    this._ultColor = color;
    this._ultCoreX = this.canvas.width / 2;
    this._ultCoreY = this.canvas.height / 2;
    this.camera.applyShake();

    // Core burst particles (radial, capped at 24)
    const px = this.player.x, py = this.player.y;
    const burstCount = Math.min(24, this.particles._budgetCount(24));
    for (let i = 0; i < burstCount; i++) {
      const a = (Math.PI * 2 / burstCount) * i;
      const spd = 120 + Math.random() * 100;
      const p = this.particles._acquire();
      if (!p) break;
      p.x = px; p.y = py;
      p.vx = Math.cos(a) * spd;
      p.vy = Math.sin(a) * spd;
      p.life = 0.5 + Math.random() * 0.3;
      p.maxLife = p.life;
      p.size = 3 + Math.random() * 2;
      p.color = color;
      p.gravity = 0;
      p.text = null;
    }

    // Secondary white sparkle ring (6 particles)
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * 2 / 6) * i + Math.random() * 0.3;
      const spd = 200 + Math.random() * 60;
      const p = this.particles._acquire();
      if (!p) break;
      p.x = px; p.y = py;
      p.vx = Math.cos(a) * spd;
      p.vy = Math.sin(a) * spd;
      p.life = 0.35;
      p.maxLife = 0.35;
      p.size = 2;
      p.color = '#ffffff';
      p.gravity = 0;
      p.text = null;
    }
  }

  _drawUltBloom(ctx) {
    if (this._ultBloomT <= 0) return;
    const t = 1 - this._ultBloomT / this._ultBloomMax; // 0→1 over duration
    const w = this.canvas.width, h = this.canvas.height;
    const cx = this._ultCoreX, cy = this._ultCoreY;
    const color = this._ultColor;
    const maxR = Math.max(w, h) * 0.7;

    // ── Phase 1: Screen dim (strongest at start, fades by t=0.4) ──
    if (t < 0.4) {
      const dimAlpha = 0.35 * (1 - t / 0.4);
      ctx.fillStyle = '#000';
      ctx.globalAlpha = dimAlpha;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }

    // ── Phase 2: Bright core burst (t=0→0.3, shrinks) ──
    if (t < 0.3) {
      const coreFrac = t / 0.3;
      const coreR = 60 * (1 - coreFrac * 0.7);
      const coreAlpha = (1 - coreFrac) * 0.7;

      // Outer glow
      ctx.beginPath();
      ctx.arc(cx, cy, coreR * 1.8, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = coreAlpha * 0.25;
      ctx.fill();

      // Inner white-hot core
      ctx.beginPath();
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = coreAlpha;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // ── Phase 3: Expanding ring (t=0.05→0.9) ──
    if (t > 0.05 && t < 0.9) {
      const ringT = (t - 0.05) / 0.85;
      const ringR = maxR * ringT;
      const ringAlpha = (1 - ringT) * 0.6;
      const ringWidth = 4 * (1 - ringT) + 1;

      // Color ring
      ctx.beginPath();
      ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = ringWidth;
      ctx.globalAlpha = ringAlpha;
      ctx.stroke();

      // Inner white ring (slightly smaller, brighter)
      if (ringT < 0.5) {
        ctx.beginPath();
        ctx.arc(cx, cy, ringR * 0.92, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.globalAlpha = ringAlpha * 0.6;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  _drawPanicIndicator(ctx) {
    const safeB = this._safeBottom || 0;
    const safeR = this._safeRight || 0;
    const x = this.canvas.width - 70 - safeR;
    const y = this.canvas.height - 120 - safeB;
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
    if (!this._isMobile) ctx.fillText('[Q]', x, y + r + 8);
    ctx.restore();
  }

  _updateMobileButtons() {
    const ultBtn = this._ultBtnEl;
    if (ultBtn) {
      const ready = this.ultimateCooldown <= 0;
      const cd = ready ? 0 : Math.ceil(this.ultimateCooldown);
      if (this._ultLastCd !== cd) {
        this._ultLastCd = cd;
        ultBtn.textContent = ready ? 'ULT' : cd.toString();
        ultBtn.classList.toggle('on-cooldown', !ready);
      }
    }

    const panicBtn = this._panicBtnEl;
    if (panicBtn) {
      const ready = this.player.panicCooldown <= 0;
      const cd = ready ? 0 : Math.ceil(this.player.panicCooldown);
      if (this._panicLastCd !== cd) {
        this._panicLastCd = cd;
        panicBtn.textContent = ready ? 'PANIC' : cd.toString();
        panicBtn.classList.toggle('on-cooldown', !ready);
      }
    }
  }

  _drawMomentumMeter(ctx) {
    if (this._momentum < 1) return; // Don't draw when inactive
    // On mobile, draw at top-left under HUD instead of lower-left (joystick area)
    const isMob = this._isMobile;
    const x = isMob ? 10 : 20;
    const y = isMob ? (70 + (this._safeTop || 0)) : (this.canvas.height - 60 - (this._safeBottom || 0));
    const w = 80;
    const h = 8;
    const tier = this._momentumTier;

    // Bar background
    ctx.fillStyle = 'rgba(30,25,50,0.6)';
    ctx.fillRect(x, y, w, h);

    // Fill based on momentum (cap display at 60)
    const fillPct = Math.min(1, this._momentum / 60);
    const tierColors = ['#888', '#f39c12', '#e67e22', '#e74c3c'];
    ctx.fillStyle = tierColors[tier];
    ctx.fillRect(x, y, w * fillPct, h);

    // Tier threshold marks
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    for (const t of [10, 25, 50]) {
      const tx = x + (t / 60) * w;
      ctx.beginPath();
      ctx.moveTo(tx, y);
      ctx.lineTo(tx, y + h);
      ctx.stroke();
    }

    // Border
    ctx.strokeStyle = tierColors[tier];
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);

    // Label
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    const labels = ['', '⚡SPD', '⚡SPD 🗡DMG', '⚡SPD 🗡DMG ✧MAG'];
    ctx.fillText(tier > 0 ? labels[tier] : 'MOMENTUM', x, y - 2);
  }

  _drawSurgeIndicator(ctx) {
    if (!this._surgeActive && this._surgeWarningTime <= 0) return;

    if (this._surgeActive) {
      // Red pulsing border during surge
      const pulse = Math.sin(performance.now() * 0.006) * 0.3 + 0.4;
      ctx.strokeStyle = `rgba(255,50,50,${pulse})`;
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, this.canvas.width - 4, this.canvas.height - 4);

      // Surge timer
      ctx.fillStyle = '#ff4444';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(`⚠ SURGE ${Math.ceil(this._surgeRemaining)}s`, this.canvas.width / 2, 50 + (this._safeTop || 0));
    }
  }

  _drawSurgeBorder(ctx) {
    if (!this._surgeActive) return;
    const pulse = Math.sin(performance.now() * 0.006) * 0.3 + 0.4;
    ctx.strokeStyle = `rgba(255,50,50,${pulse})`;
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, this.canvas.width - 4, this.canvas.height - 4);
  }

  _gameOver() {
    this.state = 'gameover';
    this.pendingUpgrades = 0;

    // Suppress gameplay layer behind death modal
    const hud = document.getElementById('hud');
    const mobileCtrl = document.getElementById('mobile-controls');
    if (hud) hud.style.opacity = '0';
    if (mobileCtrl) mobileCtrl.style.opacity = '0';

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

    // ── Build label + stats ──
    const buildLabel = this._computeBuildLabel();
    const topCompanion = this.companions.reduce((best, c) =>
      c._totalDamage > (best ? best._totalDamage : 0) ? c : best, null);
    const topName = topCompanion
      ? (topCompanion.evolutionDef ? topCompanion.evolutionDef.name : topCompanion.def.name)
      : '—';
    const activeSynergies = Object.values(this.synergies).map(s => s.label);
    const curseNames = [];
    for (const cc of CURSED_CARDS) {
      if (this.ui._pickedTradeoffs && this.ui._pickedTradeoffs.has(cc.id)) curseNames.push(cc.title);
    }

    const momentumLabels = ['None', 'Bronze', 'Silver', 'Gold'];

    const statsEl = document.getElementById('run-stats');
    const synergyLine = activeSynergies.length > 0
      ? `<div class="death-synergies">Synergies: <strong style="color:#ffd700">${activeSynergies.join(', ')}</strong></div>` : '';
    const curseLine = curseNames.length > 0
      ? `<div class="death-synergies">Curses: <strong style="color:#b07ee8">${curseNames.join(', ')}</strong></div>` : '';

    // Format modifier keys into readable display names
    const _modLabel = (key) => {
      const mod = MODIFIERS[key];
      return mod ? mod.name : key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    };

    const breakdownRows = this.companions.map(c => {
      const n = c.evolutionDef ? c.evolutionDef.name : c.def.name;
      const dmg = Math.round(c._totalDamage).toLocaleString();
      const modLine = c.modifiers.length > 0
        ? `<div class="death-breakdown-mods">${c.modifiers.map(_modLabel).join(' · ')}</div>` : '';
      return `<div class="death-breakdown-entry"><div class="death-breakdown-row"><span class="death-breakdown-name">${n} <span class="death-breakdown-lvl">Lv${c.level}</span></span><span class="death-breakdown-dmg">${dmg}</span></div>${modLine}</div>`;
    }).join('');

    statsEl.innerHTML = `
      <div class="death-build-label">${buildLabel}</div>
      <div class="death-stat-grid">
        <span>Time</span><strong>${formatTime(this.elapsed)}</strong>
        <span>Level</span><strong>${this.player.level}</strong>
        <span>Kills</span><strong>${this.player.kills}</strong>
        <span>Realms</span><strong>${this._realmIndex + 1}</strong>
        <span>Damage</span><strong>${Math.round(this._totalDamageDealt).toLocaleString()}</strong>
        <span>Top source</span><strong>${topName}</strong>
        <span>Surges</span><strong>${this._surgesCompleted}/${this._surgeCount}</strong>
        <span>Momentum</span><strong>${momentumLabels[this._maxMomentumTier]}</strong>
      </div>
      ${synergyLine}${curseLine}
      <div class="death-breakdown">${breakdownRows}</div>
    `;
    document.getElementById('gameover-screen').classList.remove('hidden');
  }

  _advanceRealm() {
    this._realmIndex++;
    this._realmElapsed = 0;
    this._realmState = 'active';
    this._realmBossId = -1;
    this._realmBossRef = null;

    // Cache realm def for this realm
    this._currentRi = Math.min(this._realmIndex, REALM_DEFS.length - 1);
    this._currentRealmDef = REALM_DEFS[this._currentRi];

    // Reset surge for new realm
    this._surgeTimer = 0;
    this._surgeActive = false;
    this._surgeRemaining = 0;

    // Clear enemies and reset spawn pacing
    this.enemySystem.despawnAll();
    this.enemySystem.resetForRealm();
    this.enemySystem.realmIndex = this._realmIndex;

    // Apply realm-based spawn interval compression
    this.enemySystem.spawnInterval *= Math.pow(REALM_CONFIG.intervalPerRealm, this._currentRi);

    this.particles.text(this.player.x, this.player.y - 50,
      this._currentRealmDef.name, '#00ffcc', 24);
    this.camera.applyShake();
  }

  _computeBuildLabel() {
    const typeCounts = {};
    for (const c of this.companions) {
      const t = c.def.attack;
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    }
    const dominant = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0];
    const dtype = dominant ? dominant[0] : 'unknown';

    // Check for notable modifiers to refine label
    const allMods = new Set();
    for (const c of this.companions) {
      for (const m of c.modifiers) allMods.add(m);
      for (const m of c.evolutionGrants) allMods.add(m);
    }

    const labels = {
      projectile: allMods.has('split_bloom') ? 'Shotgun Barrage' :
                   allMods.has('homing') ? 'Tracking Arsenal' :
                   allMods.has('ricochet') ? 'Ricochet Storm' : 'Gunner',
      melee: allMods.has('vampiric') ? 'Bloodthirst Brawler' :
             allMods.has('cleave') ? 'Cleave Master' : 'Melee Brawler',
      beam: allMods.has('fork_beam') ? 'Prismatic Laser' :
            allMods.has('searing_lance') ? 'Death Ray' : 'Beam Focus',
      chain: allMods.has('volatile_mark') ? 'Chain Reaction' :
             allMods.has('overload') ? 'Overload Cascade' : 'Lightning Weaver',
      aura: allMods.has('gravity_well') ? 'Gravity Vortex' :
            allMods.has('pulse_echo') ? 'Pulse Destroyer' : 'Aura Controller',
      orbit: allMods.has('contact_burn') ? 'Burning Shield' : 'Orbit Guard',
    };

    const base = labels[dtype] || 'Warden';
    const hasCurse = this._curseDrainPerSec > 0 || this._curseSpawnMult < 1 || this._curseEnemySpeedMult > 1;
    return hasCurse ? `Cursed ${base}` : base;
  }

  resize(w, h) {
    this.camera.resize(w, h);
    this._isMobile = window.matchMedia('(pointer: coarse)').matches && window.matchMedia('(max-width: 900px)').matches;
    this._safeTop = this._isMobile ? Math.max(20, Math.round(h * 0.04)) : 0;
    this._safeBottom = this._isMobile ? Math.max(20, Math.round(h * 0.03)) : 0;
    this._safeRight = this._isMobile ? 16 : 0;

    // Cache DOM button refs for mobile cooldown updates
    if (!this._panicBtnEl) this._panicBtnEl = document.getElementById('panic-btn');
    if (!this._ultBtnEl) this._ultBtnEl = document.getElementById('ult-btn');
    this._ultLastCd = -1;
    this._panicLastCd = -1;
  }
}
