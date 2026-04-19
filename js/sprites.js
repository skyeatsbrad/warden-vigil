// ── Sprite atlas loader and draw helper ──
// Lightweight sprite pipeline: preloads PNG atlases, stores frame metadata,
// exposes zero-allocation drawSprite() for hot render loops.
//
// Atlas layout: uniform grid of equal-sized frames, left-to-right top-to-bottom.
// Frame metadata is defined in ATLASES config, not embedded in image files.
//
// Usage:
//   import { SpriteManager } from './sprites.js';
//   const sprites = new SpriteManager();
//   await sprites.load();
//   sprites.draw(ctx, 'pickup_heal', sx, sy, 24, 24);  // centered at sx,sy
//   sprites.drawFrame(ctx, 'enemies', 2, sx, sy, 32, 32);  // frame index

// ── Atlas definitions ──
// Each atlas: { src, frameW, frameH, cols, rows, names? }
// If 'names' is provided, frames are individually addressable by name.
// Otherwise use drawFrame() with numeric index.
const ATLASES = {
  pickups: {
    src: 'assets/sprites/pickups.png',
    frameW: 16, frameH: 16,
    cols: 4, rows: 2,
    // Named frames map to grid index (left-to-right, top-to-bottom)
    names: {
      heal: 0,
      frenzy_core: 1,
      essence_surge: 2,
      rare_token: 3,
      void_burst: 4,
      chest: 5,
    },
  },
  enemies: {
    src: 'assets/sprites/enemies.png',
    frameW: 32, frameH: 32,
    cols: 4, rows: 4,
    // Named frames for enemy types — extend as sprites are added
    names: {
      runner: 0,
      brute: 1,
      spitter: 2,
      swarm: 3,
      // Row 2: elite overlays / variants
      elite_runner: 4,
      elite_brute: 5,
      elite_spitter: 6,
      elite_swarm: 7,
    },
  },
  portal: {
    src: 'assets/sprites/portal.png',
    frameW: 64, frameH: 64,
    cols: 4, rows: 1,
    // Animation frames
    names: {
      frame0: 0,
      frame1: 1,
      frame2: 2,
      frame3: 3,
    },
  },
  bosses: {
    src: 'assets/sprites/bosses.png',
    frameW: 48, frameH: 48,
    cols: 3, rows: 2,
    names: {
      siegebreaker: 0,
      voidweaver: 1,
      dreadmaw: 2,
      // Row 2: attack/telegraph frames
      siegebreaker_slam: 3,
      voidweaver_cast: 4,
      dreadmaw_charge: 5,
    },
  },
};

// Pre-computed frame rectangles (filled once on load, never allocated at runtime)
// Map<atlasKey, Map<nameOrIndex, {sx, sy, sw, sh}>>
const _frameCache = {};

export class SpriteManager {
  constructor() {
    /** @type {Map<string, HTMLImageElement>} */
    this.images = {};
    this.ready = false;
    this._fallback = true; // true until all atlases load successfully
  }

  /**
   * Preload all atlas images. Returns a promise that resolves when done.
   * On failure, sets _fallback = true so renderers can skip sprite calls.
   */
  async load() {
    const entries = Object.entries(ATLASES);
    const results = await Promise.allSettled(
      entries.map(([key, def]) => this._loadImage(key, def))
    );

    let allOk = true;
    for (let i = 0; i < results.length; i++) {
      if (results[i].status === 'rejected') {
        console.warn(`[sprites] Failed to load atlas "${entries[i][0]}":`, results[i].reason);
        allOk = false;
      }
    }

    this._fallback = !allOk;
    this.ready = allOk;
    return allOk;
  }

  _loadImage(key, def) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.images[key] = img;
        // Pre-compute frame rects
        _frameCache[key] = {};
        const total = def.cols * def.rows;
        for (let i = 0; i < total; i++) {
          const col = i % def.cols;
          const row = Math.floor(i / def.cols);
          _frameCache[key][i] = {
            sx: col * def.frameW,
            sy: row * def.frameH,
            sw: def.frameW,
            sh: def.frameH,
          };
        }
        // Also map named frames to same rects
        if (def.names) {
          for (const [name, idx] of Object.entries(def.names)) {
            _frameCache[key][name] = _frameCache[key][idx];
          }
        }
        resolve();
      };
      img.onerror = () => reject(new Error(`Failed to load ${def.src}`));
      img.src = def.src;
    });
  }

  /**
   * Check if a specific atlas is loaded and has the given frame.
   */
  has(atlasKey, frameName) {
    return !!(this.images[atlasKey] && _frameCache[atlasKey] && _frameCache[atlasKey][frameName]);
  }

  /**
   * Draw a named sprite frame, centered at (dx, dy).
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} atlasKey - e.g. 'pickups', 'enemies'
   * @param {string|number} frame - frame name or index
   * @param {number} dx - center x on canvas
   * @param {number} dy - center y on canvas
   * @param {number} dw - draw width
   * @param {number} dh - draw height
   */
  draw(ctx, atlasKey, frame, dx, dy, dw, dh) {
    const img = this.images[atlasKey];
    const f = _frameCache[atlasKey]?.[frame];
    if (!img || !f) return false;

    ctx.drawImage(img, f.sx, f.sy, f.sw, f.sh, dx - dw * 0.5, dy - dh * 0.5, dw, dh);
    return true;
  }

  /**
   * Draw a sprite frame with rotation (radians), centered at (dx, dy).
   * Uses save/restore — use sparingly in hot loops.
   */
  drawRotated(ctx, atlasKey, frame, dx, dy, dw, dh, angle) {
    const img = this.images[atlasKey];
    const f = _frameCache[atlasKey]?.[frame];
    if (!img || !f) return false;

    ctx.save();
    ctx.translate(dx, dy);
    ctx.rotate(angle);
    ctx.drawImage(img, f.sx, f.sy, f.sw, f.sh, -dw * 0.5, -dh * 0.5, dw, dh);
    ctx.restore();
    return true;
  }

  /**
   * Draw a sprite with current globalAlpha (no save/restore overhead).
   */
  drawAlpha(ctx, atlasKey, frame, dx, dy, dw, dh, alpha) {
    const img = this.images[atlasKey];
    const f = _frameCache[atlasKey]?.[frame];
    if (!img || !f) return false;

    const prev = ctx.globalAlpha;
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, f.sx, f.sy, f.sw, f.sh, dx - dw * 0.5, dy - dh * 0.5, dw, dh);
    ctx.globalAlpha = prev;
    return true;
  }

  /**
   * Get atlas config for extending frame definitions at runtime.
   */
  static getAtlasDef(key) {
    return ATLASES[key] || null;
  }

  /**
   * Register additional named frames for an atlas (e.g. after adding new enemy types).
   */
  static registerFrames(atlasKey, nameMap) {
    const def = ATLASES[atlasKey];
    if (!def) return;
    if (!def.names) def.names = {};
    for (const [name, idx] of Object.entries(nameMap)) {
      def.names[name] = idx;
      if (_frameCache[atlasKey]?.[idx]) {
        _frameCache[atlasKey][name] = _frameCache[atlasKey][idx];
      }
    }
  }
}
