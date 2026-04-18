// ── Unified spatial grid for enemy lookups ──
// Built once per frame in game.js, shared across all systems.

const DEFAULT_CELL_SIZE = 64;

export class SpatialGrid {
  constructor(enemies, cellSize = DEFAULT_CELL_SIZE) {
    this.cellSize = cellSize;
    this.cells = new Map();

    for (const e of enemies) {
      if (!e || e.hp <= 0) continue;
      const key = this._key(e.x, e.y);
      let bucket = this.cells.get(key);
      if (!bucket) {
        bucket = [];
        this.cells.set(key, bucket);
      }
      bucket.push(e);
    }
  }

  _cellCoord(v) {
    return Math.floor(v / this.cellSize);
  }

  _key(x, y) {
    return ((this._cellCoord(x) & 0xFFFF) << 16) | (this._cellCoord(y) & 0xFFFF);
  }

  // Return all live enemies whose cell is within radius of (x, y).
  // Caller still needs to do precise distance checks.
  query(x, y, radius) {
    const cs = this.cellSize;
    const cx = this._cellCoord(x);
    const cy = this._cellCoord(y);
    const span = Math.ceil(radius / cs);

    const results = [];
    for (let ox = -span; ox <= span; ox++) {
      for (let oy = -span; oy <= span; oy++) {
        const bucket = this.cells.get(this._key((cx + ox) * cs, (cy + oy) * cs));
        if (bucket) {
          for (const e of bucket) results.push(e);
        }
      }
    }
    return results;
  }

  // Iterate neighbors (the 3×3 block around a position).
  // Fastest path for tight loops like separation and projectile hits.
  neighbors(x, y) {
    const cs = this.cellSize;
    const cx = this._cellCoord(x);
    const cy = this._cellCoord(y);

    const results = [];
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        const bucket = this.cells.get(this._key((cx + ox) * cs, (cy + oy) * cs));
        if (bucket) {
          for (const e of bucket) results.push(e);
        }
      }
    }
    return results;
  }
}
