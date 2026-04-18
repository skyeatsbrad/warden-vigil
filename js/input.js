// ── Input system: keyboard + virtual joystick ──

export class Input {
  constructor(joystickCanvas) {
    this.keys = {};
    this.dir = { x: 0, y: 0 };
    this.joystick = { active: false, dx: 0, dy: 0 };
    this.joystickCanvas = joystickCanvas;
    this.joystickCtx = joystickCanvas ? joystickCanvas.getContext('2d') : null;
    this.touchId = null;

    // Default size — updated by resize()
    this._size = 160;
    this.joystickCenter = { x: 80, y: 80 };
    this.joystickRadius = 55;
    this.knobRadius = 22;

    this._bindKeyboard();
    if (joystickCanvas) this._bindTouch();
  }

  resize(screenW, screenH) {
    if (!this.joystickCanvas) return;
    // Scale joystick: 160 on ≥414px wide, down to 120 on ≤320px, up to 180 on ≥600px
    const base = Math.min(screenW, screenH);
    const size = Math.round(Math.max(120, Math.min(180, base * 0.4)));
    this._size = size;
    this.joystickCanvas.width = size;
    this.joystickCanvas.height = size;
    this.joystickCenter.x = size / 2;
    this.joystickCenter.y = size / 2;
    this.joystickRadius = Math.round(size * 0.34);
    this.knobRadius = Math.round(size * 0.14);
  }

  _bindKeyboard() {
    window.addEventListener('keydown', e => {
      this.keys[e.key.toLowerCase()] = true;
    });
    window.addEventListener('keyup', e => {
      this.keys[e.key.toLowerCase()] = false;
    });
    // Clear all keys when window loses focus to prevent stuck movement
    const clearKeys = () => { for (const k in this.keys) this.keys[k] = false; };
    window.addEventListener('blur', clearKeys);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) clearKeys();
    });
  }

  _bindTouch() {
    const c = this.joystickCanvas;
    c.style.touchAction = 'none'; // prevent browser gestures on joystick
    c.addEventListener('pointerdown', e => this._onPointerDown(e));
    c.addEventListener('pointermove', e => this._onPointerMove(e));
    c.addEventListener('pointerup', e => this._onPointerUp(e));
    c.addEventListener('pointercancel', e => this._onPointerUp(e));
  }

  _onPointerDown(e) {
    if (this.touchId !== null) return;
    e.preventDefault();
    this.joystickCanvas.setPointerCapture(e.pointerId);
    this.touchId = e.pointerId;
    this.joystick.active = true;
    const rect = this.joystickCanvas.getBoundingClientRect();
    this._updateJoystick(e.clientX - rect.left, e.clientY - rect.top);
  }

  _onPointerMove(e) {
    if (e.pointerId !== this.touchId) return;
    e.preventDefault();
    const rect = this.joystickCanvas.getBoundingClientRect();
    this._updateJoystick(e.clientX - rect.left, e.clientY - rect.top);
  }

  _onPointerUp(e) {
    if (e.pointerId !== this.touchId) return;
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
    const size = this._size;
    ctx.clearRect(0, 0, size, size);

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
