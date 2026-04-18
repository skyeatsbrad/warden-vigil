// ── Player (Warden) ──

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
    this.color = '#c9a0ff';
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
    if (this.invulnTime > 0) return false;
    this.hp -= amount;
    this.invulnTime = this.invulnDuration;
    if (this.hp < 0) this.hp = 0;
    return true;
  }

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  addXp(amount) {
    this.xp += amount;
    this.totalXp += amount;

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

    ctx.beginPath();
    ctx.arc(sx, cy, this.magnetRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(201,160,255,0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(sx, cy, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;

    const dx = Math.cos(this.facingAngle) * this.radius * 1.1;
    const dy = Math.sin(this.facingAngle) * this.radius * 1.1;
    ctx.beginPath();
    ctx.arc(sx + dx, cy + dy, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(sx, cy - 2, 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fill();
  }
}