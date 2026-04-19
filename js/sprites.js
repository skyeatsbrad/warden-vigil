// ── Sprite atlas loader and draw helper ──
// JSON-driven sprite pipeline: loads atlas metadata from JSON files,
// preloads atlas images, exposes zero-allocation drawSprite() for hot paths.
//
// Atlas metadata shape (JSON file per atlas):
//   {
//     "image": "enemies.png",
//     "frames": {
//       "enemy_blob_a":    { "x": 0, "y": 0, "w": 32, "h": 32 },
//       "enemy_spike_a":   { "x": 34, "y": 0, "w": 32, "h": 32 },
//       ...
//     }
//   }
//
// Usage:
//   import { SpriteManager } from './sprites.js';
//   const sprites = new SpriteManager();
//   await sprites.load();
//   sprites.drawSprite(ctx, 'enemies', 'enemy_blob_a', sx, sy, 28, 28, 0, 1);

// Cache version appended to all fetch/image URLs to bust browser cache
const CACHE_V = 15;

// Atlas manifest — maps atlas key to JSON metadata path.
// Image path is resolved from the JSON's "image" field.
const ATLAS_MANIFEST = {
  enemies: `assets/atlases/enemies.json?v=${CACHE_V}`,
  pickups: `assets/atlases/pickups.json?v=${CACHE_V}`,
  portal:  `assets/atlases/portal.json?v=${CACHE_V}`,
  bosses:  `assets/atlases/bosses.json?v=${CACHE_V}`,
};

// Pre-cached frame rects per atlas. Populated once on load.
// Shape: { [atlasKey]: { [frameName]: { x, y, w, h } } }
const _frames = {};

export class SpriteManager {
  constructor() {
    /** @type {Object<string, HTMLImageElement>} */
    this._images = {};
    this.ready = false;
  }

  /**
   * Preload all atlases (JSON metadata + PNG image).
   * Non-blocking: renderers can fall back to canvas if load fails.
   */
  async load() {
    const keys = Object.keys(ATLAS_MANIFEST);
    const results = await Promise.allSettled(
      keys.map(key => this._loadAtlas(key, ATLAS_MANIFEST[key]))
    );

    let allOk = true;
    for (let i = 0; i < results.length; i++) {
      if (results[i].status === 'rejected') {
        console.warn(`[sprites] Atlas "${keys[i]}" failed:`, results[i].reason);
        allOk = false;
      }
    }
    this.ready = allOk;
    return allOk;
  }

  async _loadAtlas(key, jsonUrl) {
    const resp = await fetch(jsonUrl);
    if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${jsonUrl}`);
    const meta = await resp.json();

    // Resolve image URL relative to the JSON file's directory
    const base = jsonUrl.substring(0, jsonUrl.lastIndexOf('/') + 1);
    const imgUrl = base + meta.image + `?v=${CACHE_V}`;

    // Cache frame rects (plain object — zero per-draw overhead)
    _frames[key] = meta.frames;

    // Load the image
    await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => { this._images[key] = img; resolve(); };
      img.onerror = () => reject(new Error(`Image load failed: ${imgUrl}`));
      img.src = imgUrl;
    });
  }

  /**
   * Check if a specific atlas has a given frame loaded.
   */
  has(atlasKey, frameName) {
    return !!(this._images[atlasKey] && _frames[atlasKey]?.[frameName]);
  }

  /**
   * Draw a sprite frame centered at (x, y).
   * Optimized fast-path when rotation === 0 and alpha === 1.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} atlas  - atlas key (e.g. 'enemies')
   * @param {string} frame  - frame name (e.g. 'enemy_blob_a')
   * @param {number} x      - center x on canvas
   * @param {number} y      - center y on canvas
   * @param {number} w      - draw width
   * @param {number} h      - draw height
   * @param {number} [rotation=0] - radians
   * @param {number} [alpha=1]    - opacity (0–1)
   * @returns {boolean} true if drawn, false if frame/atlas missing (use canvas fallback)
   */
  drawSprite(ctx, atlas, frame, x, y, w, h, rotation, alpha) {
    const img = this._images[atlas];
    const f = _frames[atlas]?.[frame];
    if (!img || !f) return false;

    // Fast path: no rotation, full opacity
    if (!rotation && (alpha === undefined || alpha === 1)) {
      ctx.drawImage(img, f.x, f.y, f.w, f.h, x - w * 0.5, y - h * 0.5, w, h);
      return true;
    }

    // Alpha-only path (no save/restore)
    if (!rotation) {
      const prev = ctx.globalAlpha;
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, f.x, f.y, f.w, f.h, x - w * 0.5, y - h * 0.5, w, h);
      ctx.globalAlpha = prev;
      return true;
    }

    // Full path: rotation (and optional alpha)
    ctx.save();
    if (alpha !== undefined && alpha !== 1) ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.drawImage(img, f.x, f.y, f.w, f.h, -w * 0.5, -h * 0.5, w, h);
    ctx.restore();
    return true;
  }

  /**
   * Get all loaded atlas keys.
   */
  get atlasKeys() { return Object.keys(this._images); }
}
