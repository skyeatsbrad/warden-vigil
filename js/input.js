// ── Input system: keyboard + virtual joystick ──

export class Input {
  constructor(joystickCanvas) {
    this.keys = {};
    this.dir = { x: 0, y: 0 };
    this.joystick = { active: false, dx: 0, dy: 0 };
    this.joystickCanvas = joystickCanvas;
    this.joystickCtx = joystickCanvas ? joystickCanvas.getContext('2d') : null;
    this.joystickCenter = { x: 80, y: 80 };
    this.joystickRadius = 55;
    this.knobRadius = 22;
    this.touchId = null;

    this._bindKeyboard();
    if (joystickCanvas) this._bindTouch();
  }

  _bindKeyboard() {
    window.addEventListener('keydown', e => {
      this.keys[e.key.toLowerCase()] = true;
    });
    window.addEventListener('keyup', e => {
      this.keys[e.key.toLowerCase()] = false;
    });
  }

  _bindTouch() {
    const c = this.joystickCanvas;
    c.addEventListener('touchstart', e => this._onTouchStart(e), { passive: false });
    c.addEventListener('touchmove', e => this._onTouchMove(e), { passive: false });
    c.addEventListener('touchend', e => this._onTouchEnd(e), { passive: false });
    c.addEventListener('touchcancel', e => this._onTouchEnd(e), { passive: false });
  }

  _getTouchPos(e) {
    const rect = this.joystickCanvas.getBoundingClientRect();
    for (const t of e.changedTouches) {
      if (this.touchId === null || t.identifier === this.touchId) {
        return {
          id: t.identifier,
          x: t.clientX - rect.left,
          y: t.clientY - rect.top,
        };
      }
    }
    return null;
  }

  _onTouchStart(e) {
    e.preventDefault();
    if (this.touchId !== null) return;
    const t = this._getTouchPos(e);
    if (!t) return;
    this.touchId = t.id;
    this.joystick.active = true;
    this._updateJoystick(t.x, t.y);
  }

  _onTouchMove(e) {
    e.preventDefault();
    const t = this._getTouchPos(e);
    if (!t) return;
    this._updateJoystick(t.x, t.y);
  }

  _onTouchEnd(e) {
    e.preventDefault();
    const t = this._getTouchPos(e);
    if (!t) return;
    this.touchId = null;
    this.joystick.active = false;
    this.joystick.dx = 0;
    this.joystick.dy = 0;
  }

  _updateJoystick(x, y) {
    let dx = x - this.joystickCenter.x;
    let dy = y - this.joystickCenter.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > this.joystickRadius) {
      dx = (dx / d) * this.joystickRadius;
      dy = (dy / d) * this.joystickRadius;
    }
    this.joystick.dx = dx / this.joystickRadius;
    this.joystick.dy = dy / this.joystickRadius;
  }

  update() {
    // Keyboard direction
    let kx = 0, ky = 0;
    if (this.keys['w'] || this.keys['arrowup'])    ky = -1;
    if (this.keys['s'] || this.keys['arrowdown'])  ky = 1;
    if (this.keys['a'] || this.keys['arrowleft'])  kx = -1;
    if (this.keys['d'] || this.keys['arrowright']) kx = 1;

    // Normalize diagonal
    if (kx !== 0 && ky !== 0) {
      const inv = 1 / Math.SQRT2;
      kx *= inv;
      ky *= inv;
    }

    // Merge keyboard + joystick (joystick takes priority if active)
    if (this.joystick.active) {
      this.dir.x = this.joystick.dx;
      this.dir.y = this.joystick.dy;
    } else {
      this.dir.x = kx;
      this.dir.y = ky;
    }
  }

  drawJoystick() {
    if (!this.joystickCtx) return;
    const ctx = this.joystickCtx;
    const cx = this.joystickCenter.x;
    const cy = this.joystickCenter.y;
    ctx.clearRect(0, 0, 160, 160);

    // Base ring
    ctx.beginPath();
    ctx.arc(cx, cy, this.joystickRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(200,200,200,0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Knob
    const knobX = cx + this.joystick.dx * this.joystickRadius;
    const knobY = cy + this.joystick.dy * this.joystickRadius;
    ctx.beginPath();
    ctx.arc(knobX, knobY, this.knobRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(200,200,200,0.35)';
    ctx.fill();
  }
}
