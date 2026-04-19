// ── Placeholder sprite atlas generator (v2) ──
// Generates placeholder PNGs matching assets/atlases/*.json metadata.
// Run in browser console: import and call generatePlaceholders().
// Downloads PNG files that match the atlas JSON frame layouts.
//
// NOTE: For production use, replace the downloaded PNGs with real art.
// The JSON metadata files are the source of truth for frame positions.

export async function generatePlaceholders() {
  const atlases = ['enemies', 'pickups', 'portal', 'bosses'];
  for (const key of atlases) {
    const resp = await fetch(`assets/atlases/${key}.json`);
    const meta = await resp.json();
    _genFromMeta(key, meta);
  }
}

const FRAME_COLORS = {
  enemy_blob_a: '#c0392b',
  enemy_spike_a: '#e67e22',
  enemy_crawler_a: '#8e6f3e',
  elite_ring_a: '#ffd700',
  pickup_xp_small: '#2ecc71',
  pickup_heal_small: '#27ae60',
  portal_outer_ring_a: '#00ffc8',
  portal_inner_core_a: '#0088ff',
  boss_ashen_core_a: '#c0392b',
  boss_ashen_node_a: '#8e44ad',
  boss_ashen_weakpoint_a: '#f1c40f',
};

function _genFromMeta(name, meta) {
  // Compute canvas size from frame positions
  let maxX = 0, maxY = 0;
  for (const f of Object.values(meta.frames)) {
    maxX = Math.max(maxX, f.x + f.w);
    maxY = Math.max(maxY, f.y + f.h);
  }
  maxX += 2; maxY += 2;

  const c = document.createElement('canvas');
  c.width = maxX; c.height = maxY;
  const ctx = c.getContext('2d');

  for (const [frameName, f] of Object.entries(meta.frames)) {
    const color = FRAME_COLORS[frameName] || '#888';
    const cx = f.x + f.w / 2;
    const cy = f.y + f.h / 2;
    const r = Math.min(f.w, f.h) / 2 - 2;

    ctx.fillStyle = color;
    if (frameName.includes('ring')) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    } else if (frameName.includes('spike')) {
      ctx.beginPath();
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy);
      ctx.lineTo(cx, cy + r);
      ctx.lineTo(cx - r, cy);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Download
  c.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${name}.png`;
    a.click();
    URL.revokeObjectURL(url);
  });
}
