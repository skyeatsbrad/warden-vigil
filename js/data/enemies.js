// ── Enemy Definitions ──

export const ENEMY_TYPES = {
  // ── SWARM (basic) ──
  crawler: {
    name: 'Crawler',
    color: '#c0392b',
    radius: 8,
    hp: 10,
    damage: 3,
    speed: 52,
    xp: 1,
    tier: 'basic',
  },
  drifter: {
    name: 'Drifter',
    color: '#e67e22',
    radius: 7,
    hp: 8,
    damage: 2,
    speed: 76,
    xp: 1,
    tier: 'basic',
  },
  shambler: {
    name: 'Shambler',
    color: '#8e6f3e',
    radius: 12,
    hp: 24,
    damage: 5,
    speed: 28,
    xp: 3,
    tier: 'basic',
  },

  // ── ELITE ──
  ravager: {
    name: 'Ravager',
    color: '#e74c3c',
    radius: 16,
    hp: 120,
    damage: 15,
    speed: 52,
    xp: 8,
    tier: 'elite',
    glow: true,
  },
  phaseghoul: {
    name: 'Phase Ghoul',
    color: '#9b59b6',
    radius: 13,
    hp: 80,
    damage: 12,
    speed: 74,
    xp: 6,
    tier: 'elite',
    glow: true,
    teleport: true,
  },

  // ── MINI-BOSS ──
  ironhusk: {
    name: 'Iron Husk',
    color: '#7f8c8d',
    radius: 24,
    hp: 500,
    damage: 20,
    speed: 28,
    xp: 30,
    tier: 'miniboss',
    glow: true,
  },

  // ── BOSS ──
  voidlord: {
    name: 'Void Lord',
    color: '#6c3483',
    radius: 36,
    hp: 2000,
    damage: 30,
    speed: 24,
    xp: 100,
    tier: 'boss',
    glow: true,
    mechanics: ['summon', 'charge'],
  },
};

// Wave scaling configuration
export const WAVE_CONFIG = {
  baseInterval: 4.2,       // seconds between spawn waves
  minInterval: 0.85,
  spawnRateDecay: 0.986,
  hpScale: 0.085,          // +8.5% hp per minute
  damageScale: 0.04,       // +4% damage per minute
  maxEnemies: 220,
  eliteStartTime: 100,     // seconds
  minibossInterval: 180,   // seconds
  bossInterval: 300,       // seconds
};

// Spawn weights by time bracket (seconds)
export function getSpawnWeights(elapsed) {
  if (elapsed < 45)  return { crawler: 7, drifter: 2 };
  if (elapsed < 90)  return { crawler: 5, drifter: 3 };
  if (elapsed < 150) return { crawler: 4, drifter: 3, shambler: 1 };
  if (elapsed < 240) return { crawler: 3, drifter: 3, shambler: 2, ravager: 1 };
  return { crawler: 2, drifter: 2, shambler: 3, ravager: 2, phaseghoul: 1 };
}

export function scaleEnemy(base, elapsedMinutes) {
  return {
    ...base,
    hp: Math.round(base.hp * (1 + WAVE_CONFIG.hpScale * elapsedMinutes)),
    damage: Math.max(1, Math.round(base.damage * (1 + WAVE_CONFIG.damageScale * elapsedMinutes))),
  };
}