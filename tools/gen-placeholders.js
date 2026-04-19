// ── Placeholder sprite atlas generator ──
// Run once in a browser console or as a module to generate placeholder PNG atlases.
// Creates colored rectangles with labels so sprite integration can be tested
// before real art is added. Output: downloads PNG files.
//
// Usage: import and call generatePlaceholders() or paste in browser console.

export function generatePlaceholders() {
  _gen('pickups', 16, 16, 4, 2, {
    0: { color: '#2ecc71', label: '✚' },
    1: { color: '#f39c12', label: '⚡' },
    2: { color: '#9b59b6', label: '✦' },
    3: { color: '#e74c3c', label: '★' },
    4: { color: '#8e44ad', label: '◈' },
    5: { color: '#ffd700', label: '🎁' },
    6: { color: '#444', label: '' },
    7: { color: '#444', label: '' },
  });

  _gen('enemies', 32, 32, 4, 4, {
    0: { color: '#cc4444', label: 'R' },
    1: { color: '#8844cc', label: 'B' },
    2: { color: '#44cc44', label: 'S' },
    3: { color: '#cccc44', label: 'W' },
    4: { color: '#ff6666', label: 'R+' },
    5: { color: '#aa66ff', label: 'B+' },
    6: { color: '#66ff66', label: 'S+' },
    7: { color: '#ffff66', label: 'W+' },
  });

  _gen('portal', 64, 64, 4, 1, {
    0: { color: '#00ffc8', label: '0' },
    1: { color: '#0088ff', label: '1' },
    2: { color: '#aa44ff', label: '2' },
    3: { color: '#00ffc8', label: '3' },
  });

  _gen('bosses', 48, 48, 3, 2, {
    0: { color: '#cc2222', label: 'SB' },
    1: { color: '#6a0dad', label: 'VW' },
    2: { color: '#228b22', label: 'DM' },
    3: { color: '#ff4444', label: 'SB!' },
    4: { color: '#9b59b6', label: 'VW!' },
    5: { color: '#44cc44', label: 'DM!' },
  });
}

function _gen(name, fw, fh, cols, rows, frames) {
  const c = document.createElement('canvas');
  c.width = cols * fw;
  c.height = rows * fh;
  const ctx = c.getContext('2d');

  for (let i = 0; i < cols * rows; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * fw;
    const y = row * fh;
    const f = frames[i] || { color: '#333', label: '' };

    ctx.fillStyle = '#111';
    ctx.fillRect(x, y, fw, fh);

    ctx.beginPath();
    ctx.arc(x + fw / 2, y + fh / 2, Math.min(fw, fh) * 0.38, 0, Math.PI * 2);
    ctx.fillStyle = f.color;
    ctx.fill();

    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, fw - 1, fh - 1);

    if (f.label) {
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.floor(Math.min(fw, fh) * 0.35)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(f.label, x + fw / 2, y + fh / 2);
    }
  }

  c.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.png`;
    a.click();
    URL.revokeObjectURL(url);
  });
}
