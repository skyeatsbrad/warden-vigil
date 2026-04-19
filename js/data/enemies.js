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
  siegebreaker: {
    name: 'Siegebreaker',
    color: '#c0392b',
    radius: 28,
    hp: 1200,
    damage: 25,
    speed: 22,
    xp: 80,
    tier: 'boss',
    glow: true,
    mechanics: ['slam'],
  },
  voidweaver: {
    name: 'Voidweaver',
    color: '#8e44ad',
    radius: 20,
    hp: 2500,
    damage: 18,
    speed: 40,
    xp: 120,
    tier: 'boss',
    glow: true,
    mechanics: ['voidzone', 'orbit'],
  },
  dreadmaw: {
    name: 'Dreadmaw',
    color: '#d35400',
    radius: 32,
    hp: 4000,
    damage: 30,
    speed: 26,
    xp: 180,
    tier: 'boss',
    glow: true,
    mechanics: ['dash', 'summon_drifters'],
  },
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
  spawnRateDecay: 0.988,   // slightly slower convergence to floor
  hpScale: 0.095,          // +9.5% hp per effective minute
  damageScale: 0.048,      // +4.8% damage per effective minute
  maxEnemies: 220,
  eliteStartTime: 90,      // seconds — elites appear slightly sooner in R1
};

// Realm loop configuration — shared defaults
export const REALM_CONFIG = {
  portalDuration: 4,          // seconds portal lingers before auto-advancing
  scalingOffset: 2.0,         // "virtual minutes" added per realm for stat scaling
  bossHpPerRealm: 1.4,        // boss HP multiplier per realm (compound)
  bossDmgPerRealm: 1.2,       // boss damage multiplier per realm
  waveSizePerRealm: 1.15,     // extra enemies per wave per realm (modest ramp)
  intervalPerRealm: 0.92,     // spawn interval multiplier per realm (compounds)
  bossSpawnMult: 0.55,        // spawn rate multiplier while realm boss alive (~45% reduction)
  bossEnemyCap: 150,          // reduced enemy cap during boss fight
};

// Boss mechanic tuning constants
export const BOSS_TUNING = {
  // Siegebreaker — slam
  slamCooldown: 6,         // seconds between slams
  slamWindup: 0.8,         // seconds of telegraph before slam hits
  slamRadius: 80,          // damage radius
  slamDamage: 25,          // base damage (scaled by scaleRealmBoss)

  // Voidweaver — void zones + orbit
  voidzoneCooldown: 7,     // seconds between zone placements
  voidzoneWindup: 1.0,     // seconds of telegraph before zone activates
  voidzoneDuration: 4,     // seconds zone persists after activation
  voidzoneRadius: 50,      // damage radius
  voidzoneDamage: 12,      // damage per tick
  voidzoneTickRate: 0.6,   // seconds between damage ticks
  voidzoneMaxActive: 3,    // max concurrent zones
  orbitDistance: 150,       // preferred orbit distance from player
  orbitBlinkCooldown: 4,   // seconds between repositioning blinks

  // Dreadmaw — dash + summon
  dashCooldown: 5,         // seconds between dashes
  dashWindup: 0.6,         // seconds of telegraph
  dashDistance: 250,        // total dash travel
  dashSpeed: 600,          // pixels per second during dash
  dashDamage: 30,          // dash contact damage
  dashHitRadius: 40,       // collision radius during dash
  summonCooldown: 10,      // seconds between summon waves
  summonCount: 3,          // drifters per summon
};

// Per-realm definitions — config-driven, not hardcoded if/else
export const REALM_DEFS = [
  {
    name: 'The Outskirts',
    duration: 140,
    bossType: 'siegebreaker',
    tint: '#1a1a2e',
    eliteStartTime: 90,
  },
  {
    name: 'The Hollows',
    duration: 125,
    bossType: 'voidweaver',
    tint: '#1e0a2e',
    eliteStartTime: 65,
  },
  {
    name: 'The Abyss',
    duration: 115,
    bossType: 'dreadmaw',
    tint: '#2e0a0a',
    eliteStartTime: 40,
  },
  {
    name: 'The Crucible',
    duration: 105,
    bossType: 'voidlord',
    tint: '#2e1a00',
    eliteStartTime: 25,
  },
  {
    name: 'The Endless',
    duration: 100,
    bossType: 'voidlord',
    tint: '#0a0a0a',
    eliteStartTime: 15,
  },
];

// Spawn weights by realm-local time (seconds)
export function getSpawnWeights(elapsed) {
  if (elapsed < 45)  return { crawler: 7, drifter: 2 };
  if (elapsed < 90)  return { crawler: 5, drifter: 3 };
  if (elapsed < 150) return { crawler: 4, drifter: 3, shambler: 1 };
  if (elapsed < 240) return { crawler: 3, drifter: 3, shambler: 2, ravager: 1 };
  return { crawler: 2, drifter: 2, shambler: 3, ravager: 2, phaseghoul: 1 };
}

// Scale enemy stats using effective elapsed minutes (includes realm offset)
export function scaleEnemy(base, effectiveMinutes) {
  return {
    ...base,
    hp: Math.round(base.hp * (1 + WAVE_CONFIG.hpScale * effectiveMinutes)),
    damage: Math.max(1, Math.round(base.damage * (1 + WAVE_CONFIG.damageScale * effectiveMinutes))),
  };
}

// Scale a realm boss with compound realm multipliers
export function scaleRealmBoss(base, effectiveMinutes, realmIndex) {
  const scaled = scaleEnemy(base, effectiveMinutes);
  const ri = Math.min(realmIndex, REALM_DEFS.length - 1);
  scaled.hp = Math.round(scaled.hp * Math.pow(REALM_CONFIG.bossHpPerRealm, ri));
  scaled.damage = Math.round(scaled.damage * Math.pow(REALM_CONFIG.bossDmgPerRealm, ri));
  return scaled;
}