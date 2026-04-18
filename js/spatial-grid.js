// ── Unified spatial grid for enemy lookups ──
// Built once per frame in game.js, shared across all systems.

const DEFAULT_CELL_SIZE = 64;

// Shared scratch arrays for allocation-free queries
const _scratchA = [];
const _scratchB = [];

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
  // Uses shared scratch array — caller must consume before next query() call.
  query(x, y, radius) {
    const cs = this.cellSize;
    const cx = this._cellCoord(x);
    const cy = this._cellCoord(y);
    const span = Math.ceil(radius / cs);

    _scratchA.length = 0;
    for (let ox = -span; ox <= span; ox++) {
      for (let oy = -span; oy <= span; oy++) {
        const bucket = this.cells.get(this._key((cx + ox) * cs, (cy + oy) * cs));
        if (bucket) {
          for (let i = 0; i < bucket.length; i++) _scratchA.push(bucket[i]);
        }
      }
    }
    return _scratchA;
  }

  // Second query channel for cases that need two results simultaneously
  // (e.g., chain bounce queries while iterating a prior query).
  query2(x, y, radius) {
    const cs = this.cellSize;
    const cx = this._cellCoord(x);
    const cy = this._cellCoord(y);
    const span = Math.ceil(radius / cs);

    _scratchB.length = 0;
    for (let ox = -span; ox <= span; ox++) {
      for (let oy = -span; oy <= span; oy++) {
        const bucket = this.cells.get(this._key((cx + ox) * cs, (cy + oy) * cs));
        if (bucket) {
          for (let i = 0; i < bucket.length; i++) _scratchB.push(bucket[i]);
        }
      }
    }
    return _scratchB;
  }

  // Iterate neighbors (the 3×3 block around a position).
  // Uses _scratchA — caller must consume before next query/neighbors call.
  neighbors(x, y) {
    const cs = this.cellSize;
    const cx = this._cellCoord(x);
    const cy = this._cellCoord(y);

    _scratchA.length = 0;
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        const bucket = this.cells.get(this._key((cx + ox) * cs, (cy + oy) * cs));
        if (bucket) {
          for (let i = 0; i < bucket.length; i++) _scratchA.push(bucket[i]);
        }
      }
    }
    return _scratchA;
  }

  // Callback-based neighbor iteration (zero allocation, no scratch needed).
  forEachNeighbor(x, y, fn) {
    const cs = this.cellSize;
    const cx = this._cellCoord(x);
    const cy = this._cellCoord(y);

    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        const bucket = this.cells.get(this._key((cx + ox) * cs, (cy + oy) * cs));
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i++) fn(bucket[i]);
      }
    }
  }
}
