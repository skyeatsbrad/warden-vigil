// ── Player (Warden) ──

import { COLORS, GLOW } from './data/colors.js?v=17';

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 14;
    this.speed = 160;
    this.maxHp = 100;
    this.hp = this.maxHp;
    this.invulnTime = 0;
    this.invulnDuration = 0.55;
    this.xp = 0;
    this.level = 1;
    this.xpToNext = 8;
    this.kills = 0;
    this.totalXp = 0;
    this.color = COLORS.player;
    this.facingAngle = 0;
    this.magnetRadius = 85;

    // Panic pulse
    this.panicCooldown = 0;
    this.panicMaxCooldown = 12;
    this.panicRadius = 120;
    this.panicPushForce = 160;

    this._bobPhase = 0;
  }

  update(dt, inputDir) {
    if (inputDir.x !== 0 || inputDir.y !== 0) {
      this.x += inputDir.x * this.speed * dt;
      this.y += inputDir.y * this.speed * dt;
      this.facingAngle = Math.atan2(inputDir.y, inputDir.x);
    }

    if (this.invulnTime > 0) this.invulnTime -= dt;
    if (this.panicCooldown > 0) this.panicCooldown -= dt;

    this._bobPhase += dt * 5;
  }

  takeDamage(amount) {
    if (this.invulnTime > 0) return 0;
    const dmg = Math.round(amount * (this.damageTakenMult || 1));
    this.hp -= dmg;
    this.invulnTime = this.invulnDuration;
    if (this.hp < 0) this.hp = 0;
    return dmg;
  }

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  addXp(amount) {
    const mult = this.xpMult || 1;
    const gained = Math.round(amount * mult);
    this.xp += gained;
    this.totalXp += gained;

    let levels = 0;
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level++;
      levels++;

      if (this.level < 8) {
        this.xpToNext = Math.floor(8 * Math.pow(1.18, this.level - 1));
      } else {
        this.xpToNext = Math.floor(12 * Math.pow(1.28, this.level - 8));
      }
    }

    return levels;
  }

  get alive() {
    return this.hp > 0;
  }

  draw(ctx, camera) {
    const sx = camera.screenX(this.x);
    const sy = camera.screenY(this.y);
    const bob = Math.sin(this._bobPhase) * 2;
    const flicker = this.invulnTime > 0 && Math.sin(this.invulnTime * 30) > 0;

    if (flicker) return;

    const cy = sy + bob;
    const t = this._bobPhase; // reuse as time source (increments ~5/s)

    // Breathing pulse — subtle size oscillation
    const breathe = 1 + Math.sin(t * 0.7) * 0.03;
    const r = this.radius * breathe;

    // ── Magnet ring (faint, always visible) ──
    ctx.beginPath();
    ctx.arc(sx, cy, this.magnetRadius, 0, Math.PI * 2);
    ctx.strokeStyle = COLORS.playerMagnet;
    ctx.lineWidth = 1;
    ctx.stroke();

    // ── Rotating outer ring (dashed arc) ──
    const ringR = r + 6;
    const ringAngle = t * 0.8; // slow rotation
    const arcLen = 1.2; // radians per dash segment
    const gaps = 3;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(126,200,227,0.35)';
    for (let i = 0; i < gaps; i++) {
      const a0 = ringAngle + (Math.PI * 2 / gaps) * i;
      ctx.beginPath();
      ctx.arc(sx, cy, ringR, a0, a0 + arcLen);
      ctx.stroke();
    }

    // ── Orbiting shard (diamond shape, 2 shards opposite) ──
    const shardOrbitR = r + 10;
    const shardAngle = t * 1.5;
    for (let s = 0; s < 2; s++) {
      const sa = shardAngle + Math.PI * s;
      const shX = sx + Math.cos(sa) * shardOrbitR;
      const shY = cy + Math.sin(sa) * shardOrbitR;
      const shR = 3;
      // Diamond shape: 4 points
      ctx.beginPath();
      ctx.moveTo(shX, shY - shR);
      ctx.lineTo(shX + shR * 0.6, shY);
      ctx.lineTo(shX, shY + shR);
      ctx.lineTo(shX - shR * 0.6, shY);
      ctx.closePath();
      ctx.fillStyle = 'rgba(126,200,227,0.6)';
      ctx.fill();
    }

    // ── Additive glow pass (drawn first, behind core) ──
    ctx.beginPath();
    ctx.arc(sx, cy, r + 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(126,200,227,0.12)';
    ctx.shadowColor = COLORS.playerGlow;
    ctx.shadowBlur = GLOW.player + 4;
    ctx.fill();
    ctx.shadowBlur = 0;

    // ── Core body — bright white-cyan ──
    ctx.beginPath();
    ctx.arc(sx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.shadowColor = COLORS.playerGlow;
    ctx.shadowBlur = GLOW.player;
    ctx.fill();
    ctx.shadowBlur = 0;

    // ── Facing dot ──
    const dx = Math.cos(this.facingAngle) * r * 1.1;
    const dy = Math.sin(this.facingAngle) * r * 1.1;
    ctx.beginPath();
    ctx.arc(sx + dx, cy + dy, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();

    // ── Inner highlight (specular) ──
    ctx.beginPath();
    ctx.arc(sx - 2, cy - 3, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fill();
  }
}