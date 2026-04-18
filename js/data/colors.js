// ── Centralized Color Role System ──
// Every visual element references these roles for consistency.
// Rule: Player = highest contrast. Blue/cyan = yours. Red = enemy.

export const COLORS = {
  // Player
  player:       '#e0f0ff',   // bright white-cyan
  playerGlow:   '#7ec8e3',   // soft cyan glow
  playerMagnet: 'rgba(126,200,227,0.08)',

  // Allies / companions — slightly dimmer than player
  ally:         '#64b5f6',   // blue tint
  allyGlow:     '#42a5f5',

  // Player damage output
  damage:       '#00e5ff',   // electric cyan
  damageGlow:   '#00b8d4',

  // Enemies
  enemyBasic:   '#e53935',   // red
  enemyElite:   '#ab47bc',   // purple-red
  enemyBoss:    '#6a1b9a',   // deep purple
  enemyBossOuter: '#38006b', // boss outer shell

  // Pickups / rewards
  pickup:       '#fdd835',   // bright yellow
  pickupGlow:   '#fbc02d',
  xpOrb:        '#ce93d8',   // soft purple
  xpOrbGlow:    '#ab47bc',

  // Rarity
  rareColor:    '#ffa726',   // orange-gold
  epicColor:    '#e040fb',   // purple
  legendaryColor: '#ff6d00', // deep orange

  // Ultimates / panic
  ultimate:     '#ffffff',   // white-hot
  panic:        '#ff6d00',   // orange shockwave
  panicGlow:    '#e65100',

  // Background
  bg:           '#0a0a12',
  gridLine:     'rgba(60,50,80,0.12)',

  // Danger indicators
  danger:       '#ff1744',
  surge:        '#ff3d00',
};

// ── Glow presets (shadowBlur values) ──
export const GLOW = {
  player:       14,
  ally:          8,
  projectile:    8,
  enemyElite:   12,
  enemyBoss:    18,
  pickup:       10,
  xpOrb:         6,
  hit:          16,   // brief flash on hit
};

// ── Trail config ──
export const TRAIL = {
  projectileLen:  4,   // positions stored
  orbitLen:        6,
  projectileFade: 0.6, // starting alpha
};
