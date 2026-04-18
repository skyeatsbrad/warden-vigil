// ── Camera: follows player with smoothing ──

export class Camera {
  constructor(canvasWidth, canvasHeight) {
    this.x = 0;
    this.y = 0;
    this.w = canvasWidth;
    this.h = canvasHeight;
    this.smoothing = 0.08;
    this.shake = 0;
    this.shakeX = 0;
    this.shakeY = 0;
  }

  follow(target, dt) {
    const tx = target.x - this.w / 2;
    const ty = target.y - this.h / 2;
    const factor = 1 - Math.pow(1 - this.smoothing, dt * 60);
    this.x += (tx - this.x) * factor;
    this.y += (ty - this.y) * factor;

    // Screen shake
    if (this.shake > 0) {
      this.shake -= dt;
      const intensity = this.shake * 8;
      this.shakeX = (Math.random() - 0.5) * intensity;
      this.shakeY = (Math.random() - 0.5) * intensity;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
    }
  }

  applyShake() {
    this.shake = Math.min(this.shake + 0.15, 0.5);
  }

  // Convert world coords to screen coords
  worldToScreen(wx, wy) {
    return {
      x: wx - this.x + this.shakeX,
      y: wy - this.y + this.shakeY,
    };
  }

  // Check if world position is visible on screen (with margin)
  isVisible(wx, wy, margin = 50) {
    return wx > this.x - margin &&
           wx < this.x + this.w + margin &&
           wy > this.y - margin &&
           wy < this.y + this.h + margin;
  }

  resize(w, h) {
    this.w = w;
    this.h = h;
  }

  reset(targetX, targetY) {
    this.x = targetX - this.w / 2;
    this.y = targetY - this.h / 2;
    this.shake = 0;
    this.shakeX = 0;
    this.shakeY = 0;
  }
}
