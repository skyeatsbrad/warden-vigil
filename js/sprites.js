// ── Sprite loader and draw helper ──
// Loads individual PNGs from assets/raw/, exposes zero-allocation
// drawSprite() for hot render loops. Falls back gracefully when a
// sprite is not loaded — renderers can check has() first or use
// the drawSprite() return value.
//
// Usage:
//   import { SpriteManager } from './sprites.js';
//   const sprites = new SpriteManager();
//   await sprites.load();
//   sprites.drawSprite(ctx, 'enemy_spike_a', sx, sy, 28, 28);
//   sprites.drawSprite(ctx, 'portal_ring_a', sx, sy, 120, 120, angle, 0.7);

const CACHE_V = 17;

// Sprite manifest — key → path relative to repo root.
// Add new sprites here; everything else is automatic.
const SPRITE_MANIFEST = {
  enemy_spike_a:         'assets/raw/enemy_spike_a.png',
  enemy_spider_a:        'assets/raw/enemy_spider_a.png',
  pickup_orb_green_a:    'assets/raw/pickup_orb_green_a.png',
  pickup_crystal_blue_a: 'assets/raw/pickup_crystal_blue_a.png',
  portal_ring_a:         'assets/raw/portal_ring_a.png',
  portal_swirl_a:        'assets/raw/portal_swirl_a.png',
  impact_burst_a:        'assets/raw/impact_burst_a.png',
};

export class SpriteManager {
  constructor() {
    /** @type {Object<string, HTMLImageElement>} */
    this._imgs = {};
    this.ready = false;
  }

  /**
   * Preload all sprites in parallel. Non-blocking — renderers can
   * fall back to canvas if any individual sprite fails.
   * @returns {Promise<boolean>} true if all loaded
   */
  async load() {
    const entries = Object.entries(SPRITE_MANIFEST);
    const results = await Promise.allSettled(
      entries.map(([key, path]) => this._loadOne(key, path))
    );
    let allOk = true;
    for (let i = 0; i < results.length; i++) {
      if (results[i].status === 'rejected') {
        console.warn(`[sprites] "${entries[i][0]}" failed:`, results[i].reason);
        allOk = false;
      }
    }
    this.ready = allOk;
    return allOk;
  }

  _loadOne(key, path) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => { this._imgs[key] = img; resolve(); };
      img.onerror = () => reject(new Error(`Load failed: ${path}`));
      img.src = `${path}?v=${CACHE_V}`;
    });
  }

  /**
   * Check if a sprite is loaded and ready to draw.
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    return !!this._imgs[key];
  }

  /**
   * Draw a sprite centered at (x, y).
   *
   * Three fast-paths to minimise canvas state changes:
   *  1. No rotation, full alpha  → bare drawImage
   *  2. Alpha only               → swap globalAlpha, drawImage
   *  3. Rotation (± alpha)       → save/translate/rotate/drawImage/restore
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} key       - sprite key (e.g. 'enemy_spike_a')
   * @param {number} x         - center x on canvas
   * @param {number} y         - center y on canvas
   * @param {number} w         - draw width
   * @param {number} h         - draw height
   * @param {number} [rotation=0] - radians
   * @param {number} [alpha=1]    - opacity 0-1
   * @returns {boolean} true if drawn, false if missing (use canvas fallback)
   */
  drawSprite(ctx, key, x, y, w, h, rotation, alpha) {
    const img = this._imgs[key];
    if (!img) return false;

    // Fast path: no rotation, full opacity
    if (!rotation && (alpha === undefined || alpha === 1)) {
      ctx.drawImage(img, x - w * 0.5, y - h * 0.5, w, h);
      return true;
    }

    // Alpha-only path (no save/restore overhead)
    if (!rotation) {
      const prev = ctx.globalAlpha;
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, x - w * 0.5, y - h * 0.5, w, h);
      ctx.globalAlpha = prev;
      return true;
    }

    // Full path: rotation (± alpha)
    ctx.save();
    if (alpha !== undefined && alpha !== 1) ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.drawImage(img, -w * 0.5, -h * 0.5, w, h);
    ctx.restore();
    return true;
  }
}
