// ── Companion Definitions ──
// Categories: Void, Solar, Bio, Mechanical, Arcane

export const COMPANION_DEFS = {
  // ── STARTER COMPANIONS (unlockable) ──
  glintbug: {
    name: 'Glintbug',
    icon: '✦',
    category: 'Solar',
    color: '#f1c40f',
    desc: 'A tiny spark of condensed light that orbits the Warden.',
    attack: 'projectile',
    behavior: 'orbit',
    // BALANCE: starter companion — cooldown controls early DPS feel. Lower = punchier opening.
    baseStats: { damage: 12, cooldown: 0.75, range: 220, speed: 3, projectileSpeed: 320, radius: 6, pierce: 1 },
    ultimate: { name: 'Nova Burst', desc: 'All enemies on screen take massive Solar damage', cooldown: 30 },
    unlocked: true,
  },
  rustmaw: {
    name: 'Rustmaw',
    icon: '⚙',
    category: 'Mechanical',
    color: '#95a5a6',
    desc: 'A gnashing gear-beast that slams nearby foes.',
    attack: 'melee',
    behavior: 'chase',
    // BALANCE: melee starter — fast attack cadence makes it feel aggressive immediately.
    baseStats: { damage: 20, cooldown: 0.55, range: 60, speed: 2.8, projectileSpeed: 0, radius: 14, pierce: 0 },
    ultimate: { name: 'Overclock', desc: 'All companions attack 3x faster for 8 seconds', cooldown: 35 },
    unlocked: true,
  },
  nullwisp: {
    name: 'Nullwisp',
    icon: '◈',
    category: 'Void',
    color: '#8e44ad',
    desc: 'A fragment of nothing that pulses damaging waves.',
    attack: 'aura',
    behavior: 'orbit',
    baseStats: { damage: 8, cooldown: 1.2, range: 110, speed: 2, projectileSpeed: 0, radius: 10, pierce: 99 },
    ultimate: { name: 'Rift Collapse', desc: 'Creates a vortex pulling enemies to center and crushing them', cooldown: 40 },
    unlocked: false,
    unlockCondition: 'Survive 3 minutes',
  },
  thornvine: {
    name: 'Thornvine',
    icon: '❋',
    category: 'Bio',
    color: '#27ae60',
    desc: 'A living tendril that lashes out at passing threats.',
    attack: 'beam',
    behavior: 'stationary',
    baseStats: { damage: 12, cooldown: 0.5, range: 150, speed: 0, projectileSpeed: 0, radius: 8, pierce: 2 },
    ultimate: { name: 'Overgrowth', desc: 'Roots erupt from the ground slowing and damaging all enemies', cooldown: 35 },
    unlocked: false,
    unlockCondition: 'Reach level 10',
  },
  prismoth: {
    name: 'Prismoth',
    icon: '◇',
    category: 'Arcane',
    color: '#3498db',
    desc: 'A crystalline moth whose wings scatter piercing shards.',
    attack: 'projectile',
    behavior: 'orbit',
    baseStats: { damage: 6, cooldown: 0.4, range: 250, speed: 3, projectileSpeed: 350, radius: 5, pierce: 3 },
    ultimate: { name: 'Shatter Field', desc: 'Rains crystal shards across the entire screen', cooldown: 30 },
    unlocked: false,
    unlockCondition: 'Kill 500 enemies total',
  },

  // ── MID-GAME COMPANIONS (drops / level-up choices) ──
  embercell: {
    name: 'Embercell',
    icon: '▣',
    category: 'Mechanical',
    color: '#e67e22',
    desc: 'An incandescent core that orbits and burns.',
    attack: 'orbit',
    behavior: 'orbit',
    baseStats: { damage: 10, cooldown: 0, range: 80, speed: 4, projectileSpeed: 0, radius: 10, pierce: 99 },
  },
  sporeloom: {
    name: 'Sporeloom',
    icon: '❂',
    category: 'Bio',
    color: '#1abc9c',
    desc: 'Releases toxic clouds at regular intervals.',
    attack: 'aura',
    behavior: 'follow',
    baseStats: { damage: 4, cooldown: 2.0, range: 120, speed: 2, projectileSpeed: 0, radius: 12, pierce: 99 },
  },
  voidlance: {
    name: 'Voidlance',
    icon: '⟐',
    category: 'Void',
    color: '#9b59b6',
    desc: 'Fires slow but devastating void bolts.',
    attack: 'projectile',
    behavior: 'follow',
    baseStats: { damage: 30, cooldown: 2.5, range: 300, speed: 1.5, projectileSpeed: 200, radius: 8, pierce: 5 },
  },
  solsentry: {
    name: 'Solsentry',
    icon: '☀',
    category: 'Solar',
    color: '#f39c12',
    desc: 'Stays put and fires rapid light pulses.',
    attack: 'projectile',
    behavior: 'stationary',
    baseStats: { damage: 7, cooldown: 0.3, range: 220, speed: 0, projectileSpeed: 400, radius: 4, pierce: 1 },
  },
  hexweaver: {
    name: 'Hexweaver',
    icon: '⬡',
    category: 'Arcane',
    color: '#2980b9',
    desc: 'Chains lightning between nearby foes.',
    attack: 'chain',
    behavior: 'follow',
    baseStats: { damage: 9, cooldown: 1.8, range: 180, speed: 2, projectileSpeed: 600, radius: 6, pierce: 4 },
  },
};

// Which companions can appear as level-up choices
export const DROPPABLE_COMPANIONS = [
  'embercell',
  'sporeloom',
  'voidlance',
  'solsentry',
  'hexweaver',
];

// Which companions are selectable at game start
export const STARTER_COMPANIONS = [
  'glintbug',
  'rustmaw',
  'nullwisp',
  'thornvine',
  'prismoth',
];

// Stat multipliers per companion level
export function getCompanionStats(baseDef, level) {
  const mult = 1 + (level - 1) * 0.2;
  const cdMult = Math.max(0.3, 1 - (level - 1) * 0.08);
  return {
    damage: Math.round(baseDef.damage * mult),
    cooldown: baseDef.cooldown * cdMult,
    range: baseDef.range + (level - 1) * 10,
    speed: baseDef.speed,
    projectileSpeed: baseDef.projectileSpeed + (level - 1) * 15,
    radius: baseDef.radius,
    pierce: baseDef.pierce + Math.floor((level - 1) / 3),
  };
}

// Type-specific modifier pool
export const MODIFIERS = {
  // ── Projectile ──
  split_bloom:    { name: 'Split Bloom',      desc: 'Fires 3 projectiles in a fan',            icon: '✿', attackTypes: ['projectile'], rarity: 'rare' },
  detonate:       { name: 'Detonation Core',  desc: 'Projectiles explode on hit for AoE',      icon: '💥', attackTypes: ['projectile'], rarity: 'rare' },
  piercing_surge: { name: 'Piercing Surge',   desc: 'Projectiles pierce +3 extra enemies',     icon: '➤', attackTypes: ['projectile'], rarity: 'rare' },
  homing:         { name: 'Homing Sigil',     desc: 'Projectiles track the nearest enemy',     icon: '◎', attackTypes: ['projectile'], rarity: 'epic' },
  ricochet:       { name: 'Ricochet',         desc: 'Projectiles bounce to a nearby enemy',    icon: '↯', attackTypes: ['projectile'], rarity: 'epic' },
  // ── Orbit ──
  orbit_surge:    { name: 'Orbit Surge',      desc: 'Orbit 50% faster, +20% damage',           icon: '🌀', attackTypes: ['orbit'], rarity: 'rare' },
  wider_ring:     { name: 'Wider Ring',       desc: '+40% orbit radius for more coverage',      icon: '⭕', attackTypes: ['orbit'], rarity: 'rare' },
  contact_burn:   { name: 'Contact Burn',     desc: 'Burns enemies on contact 2× faster',       icon: '🔥', attackTypes: ['orbit'], rarity: 'epic' },
  // ── Chain ──
  chain_arc:      { name: 'Chain Arc',        desc: '+3 chain bounces',                         icon: '⚡', attackTypes: ['chain'], rarity: 'rare' },
  overload:       { name: 'Overload',         desc: 'Final chain bounce deals 2× damage',      icon: '⛓', attackTypes: ['chain'], rarity: 'rare' },
  static_mark:    { name: 'Static Mark',      desc: 'Chained foes take +25% damage for 3s',    icon: '⊛', attackTypes: ['chain'], rarity: 'epic' },
  volatile_mark:  { name: 'Volatile Mark',    desc: 'Marked enemies explode on death',          icon: '☢', attackTypes: ['chain'], rarity: 'epic' },
  // ── Aura ──
  linger_field:   { name: 'Lingering Field',  desc: 'Aura cooldown reduced by 40%',             icon: '◉', attackTypes: ['aura'], rarity: 'rare' },
  slow_field:     { name: 'Slow Field',       desc: 'Aura slows enemies by 40% for 2s',        icon: '❄', attackTypes: ['aura'], rarity: 'rare' },
  pulse_echo:     { name: 'Pulse Echo',       desc: 'Aura deals double damage',                 icon: '◎', attackTypes: ['aura'], rarity: 'epic' },
  gravity_well:   { name: 'Gravity Well',     desc: 'Aura pulls enemies toward companion',      icon: '⊕', attackTypes: ['aura'], rarity: 'epic' },
  // ── Beam ──
  fork_beam:      { name: 'Fork Beam',        desc: 'Fires 2 extra beams in a spread',          icon: '⑂', attackTypes: ['beam'], rarity: 'rare' },
  beam_pierce:    { name: 'Beam Pierce',      desc: 'Beam pierces +3 additional enemies',       icon: '⟿', attackTypes: ['beam'], rarity: 'rare' },
  searing_lance:  { name: 'Searing Lance',    desc: '2× beam damage and +50% range',            icon: '🔱', attackTypes: ['beam'], rarity: 'epic' },
  // ── Melee ──
  cleave:         { name: 'Cleave',           desc: '+80% hit radius, hits more enemies',        icon: '⚔', attackTypes: ['melee'], rarity: 'rare' },
  frenzy_strike:  { name: 'Frenzy Strike',    desc: 'Kills halve the remaining cooldown',       icon: '⚡', attackTypes: ['melee'], rarity: 'rare' },
  vampiric:       { name: 'Vampiric',         desc: 'Heal 1 HP per enemy hit',                  icon: '🩸', attackTypes: ['melee'], rarity: 'epic' },
};

// Get modifiers compatible with a given attack type
export function getModifiersForType(attackType) {
  return Object.entries(MODIFIERS)
    .filter(([, m]) => m.attackTypes.includes(attackType))
    .map(([key]) => key);
}

// ── Evolution paths (2 per companion) ──
// Starters evolve at level 5, recruited companions at level 4.
// Each path grants stat multipliers and may auto-grant modifier effects.

export function getEvolveLevel(key) {
  return STARTER_COMPANIONS.includes(key) ? 5 : 4;
}

export const EVOLUTIONS = {
  glintbug: {
    a: {
      name: 'Sunburst', icon: '☼', color: '#ffcc00',
      desc: 'Slower shots that explode on impact',
      statMult: { damage: 1.8, cooldown: 1.6 },
      grants: ['detonate'],
    },
    b: {
      name: 'Swarm Spark', icon: '⁂', color: '#ffe066',
      desc: 'Rapid-fire fan of light sparks',
      statMult: { damage: 0.6, cooldown: 0.4 },
      grants: ['split_bloom'],
    },
  },
  rustmaw: {
    a: {
      name: 'Ironjaw', icon: '⚙', color: '#778899',
      desc: 'Massive, slow hits with extended reach',
      statMult: { damage: 2.5, cooldown: 1.8 },
      statAdd: { range: 25 },
    },
    b: {
      name: 'Bladestorm', icon: '⚙', color: '#c0c0c0',
      desc: 'Rapid whirling slashes',
      statMult: { damage: 0.65, cooldown: 0.35, speed: 1.5 },
    },
  },
  nullwisp: {
    a: {
      name: 'Void Maw', icon: '◈', color: '#6a0dad',
      desc: 'Concentrated kill-zone aura',
      statMult: { damage: 2.5, range: 0.65 },
    },
    b: {
      name: 'Phase Shroud', icon: '◈', color: '#b388ff',
      desc: 'Huge aura that slows enemies',
      statMult: { damage: 0.7, range: 1.8 },
      grants: ['slow_field'],
    },
  },
  thornvine: {
    a: {
      name: 'Thorn Cannon', icon: '❋', color: '#1b8a3e',
      desc: 'Heavy piercing beams',
      statMult: { damage: 2, cooldown: 1.8 },
      statAdd: { pierce: 3 },
    },
    b: {
      name: 'Root Web', icon: '❋', color: '#66bb6a',
      desc: 'Rapid wide-reaching beams',
      statMult: { damage: 0.7, cooldown: 0.5, range: 1.5 },
    },
  },
  prismoth: {
    a: {
      name: 'Crystal Barrage', icon: '◇', color: '#64b5f6',
      desc: 'Machine-gun crystal shards',
      statMult: { damage: 0.5, cooldown: 0.35 },
      statAdd: { pierce: 2 },
    },
    b: {
      name: 'Prismatic Lance', icon: '◇', color: '#1565c0',
      desc: 'Slow homing sniper bolts',
      statMult: { damage: 3, cooldown: 2.5 },
      grants: ['homing'],
    },
  },
  embercell: {
    a: {
      name: 'Inferno Core', icon: '▣', color: '#ff6600',
      desc: 'Fast-burning orbit',
      statMult: { damage: 1.8, speed: 1.5 },
      grants: ['contact_burn'],
    },
    b: {
      name: 'Molten Shield', icon: '▣', color: '#ffab40',
      desc: 'Wide protective ring',
      statMult: { damage: 0.7 },
      statAdd: { range: 50 },
      grants: ['wider_ring'],
    },
  },
  sporeloom: {
    a: {
      name: 'Blight Cloud', icon: '❂', color: '#00897b',
      desc: 'Intense concentrated poison',
      statMult: { damage: 2.5, range: 0.7 },
    },
    b: {
      name: 'Healing Spores', icon: '❂', color: '#80cbc4',
      desc: 'Weaker aura that heals the Warden',
      statMult: { damage: 0.5, range: 1.5 },
      grants: ['heal_pulse'],
    },
  },
  voidlance: {
    a: {
      name: 'Oblivion Bolt', icon: '⟐', color: '#7b1fa2',
      desc: 'Exploding void projectiles',
      statMult: { damage: 1.5 },
      grants: ['detonate'],
    },
    b: {
      name: 'Void Gatling', icon: '⟐', color: '#ce93d8',
      desc: 'Rapid-fire void stream',
      statMult: { damage: 0.4, cooldown: 0.3, projectileSpeed: 1.5 },
    },
  },
  solsentry: {
    a: {
      name: 'Solar Fortress', icon: '☀', color: '#ff8f00',
      desc: 'Fan-spread turret',
      statMult: { damage: 1.8, cooldown: 1.4 },
      grants: ['split_bloom'],
    },
    b: {
      name: 'Lightspeed', icon: '☀', color: '#fff176',
      desc: 'Ultra-rapid light pulses',
      statMult: { damage: 0.6, cooldown: 0.25, projectileSpeed: 1.8 },
    },
  },
  hexweaver: {
    a: {
      name: 'Storm Conduit', icon: '⬡', color: '#1976d2',
      desc: 'Massive chain reach',
      statMult: { damage: 1.5 },
      statAdd: { pierce: 4 },
      grants: ['chain_arc'],
    },
    b: {
      name: 'Hex Snare', icon: '⬡', color: '#4fc3f7',
      desc: 'Chains that slow enemies',
      statMult: { damage: 0.8 },
      statAdd: { pierce: 2 },
      grants: ['auto_slow'],
    },
  },
};

// ── Category synergy bonuses ──
// Active when 2+ companions share a category.

export const SYNERGY_DEFS = {
  Solar:      { label: 'Solar Resonance',  desc: '+20% damage',   damageMult: 1.2 },
  Mechanical: { label: 'Overclock Link',   desc: '-20% cooldown', cooldownMult: 0.8 },
  Void:       { label: 'Void Reach',       desc: '+25% range',    rangeMult: 1.25 },
  Bio:        { label: 'Symbiosis',        desc: 'Heal 1 HP/3s', healInterval: 3 },
  Arcane:     { label: 'Arcane Flow',      desc: '+1 pierce',     pierceAdd: 1 },
};

// ── Tradeoff upgrade cards ──
// Meaningful choices with both upside and downside.

export const TRADEOFF_CARDS = [
  {
    id: 'glass_cannon', icon: '🗡', title: 'Glass Cannon',
    desc: 'All companions +30% damage, −25 max HP',
    rarity: 'rare',
    effects: { allDamageMult: 1.3, maxHpAdd: -25 },
  },
  {
    id: 'iron_fortress', icon: '🛡', title: 'Iron Fortress',
    desc: '+40 max HP, all companions −20% damage',
    rarity: 'rare',
    effects: { allDamageMult: 0.8, maxHpAdd: 40 },
  },
  {
    id: 'berserker_fury', icon: '🔥', title: "Berserker's Fury",
    desc: 'All companions −25% cooldown, take 30% more damage',
    rarity: 'rare',
    effects: { allCooldownMult: 0.75, damageTakenMult: 1.3 },
  },
  {
    id: 'precision_focus', icon: '🎯', title: 'Precision Focus',
    desc: 'All companions +2 pierce, −15% range',
    rarity: 'rare',
    effects: { allPierceAdd: 2, allRangeMult: 0.85 },
  },
];

// ── Cursed upgrades (greed mechanic) ──
// High-power effects with serious downsides that affect game-level state.

export const CURSED_CARDS = [
  {
    id: 'cursed_vitality', icon: '💀', title: 'Cursed Vitality',
    desc: '+60 max HP & full heal. Enemies spawn 20% faster.',
    rarity: 'cursed',
    effects: { maxHpAdd: 60, curseSpawnMult: 0.8 },
  },
  {
    id: 'dark_pact', icon: '🩸', title: 'Dark Pact',
    desc: 'All companions +50% damage. Lose 1 HP every 2 seconds.',
    rarity: 'cursed',
    effects: { allDamageMult: 1.5, curseDrainPerSec: 0.5 },
  },
  {
    id: 'chaos_engine', icon: '⚙', title: 'Chaos Engine',
    desc: 'All companions −35% cooldown. Enemies are 25% faster.',
    rarity: 'cursed',
    effects: { allCooldownMult: 0.65, curseEnemySpeedMult: 1.25 },
  },
];

// ── Mastery upgrades (repeatable, post-build fallback) ──
// mode: 'linear' = flat increment each pick; 'diminish' = baseValue / (1 + 0.3 * rank)
export const MASTERY_DEFS = [
  {
    id: 'mastery_damage', icon: '⚔', title: 'Mastery: Power',
    desc: '+{n}% global damage (Rank {r})',
    stat: 'allDamageMult', baseValue: 0.05, mode: 'diminish',
    maxPicks: 8,
  },
  {
    id: 'mastery_atkspd', icon: '⏱', title: 'Mastery: Tempo',
    desc: '−{n}% cooldowns (Rank {r})',
    stat: 'allCooldownMult', baseValue: 0.04, mode: 'diminish',
    maxPicks: 6,
  },
  {
    id: 'mastery_projspd', icon: '➤', title: 'Mastery: Velocity',
    desc: '+{n} projectile speed (Rank {r})',
    stat: 'projSpeedAdd', baseValue: 12, mode: 'linear',
    maxPicks: 8,
  },
  {
    id: 'mastery_pickup', icon: '✧', title: 'Mastery: Magnetism',
    desc: '+{n} pickup radius (Rank {r})',
    stat: 'magnet', baseValue: 10, mode: 'linear',
    maxPicks: 10,
  },
  {
    id: 'mastery_movespd', icon: '⚡', title: 'Mastery: Stride',
    desc: '+{n} move speed (Rank {r})',
    stat: 'speed', baseValue: 8, mode: 'linear',
    maxPicks: 8,
  },
  {
    id: 'mastery_maxhp', icon: '♥', title: 'Mastery: Fortitude',
    desc: '+{n} max HP (Rank {r})',
    stat: 'maxHp', baseValue: 12, mode: 'linear',
    maxPicks: 10,
  },
  {
    id: 'mastery_heal', icon: '✚', title: 'Mastery: Siphon',
    desc: 'Heal {n} HP per XP orb (Rank {r})',
    stat: 'healOnPickup', baseValue: 1, mode: 'linear',
    maxPicks: 4,
  },
  {
    id: 'mastery_xp', icon: '★', title: 'Mastery: Insight',
    desc: '+{n}% XP gain (Rank {r})',
    stat: 'xpMult', baseValue: 0.06, mode: 'diminish',
    maxPicks: 4,
  },
  {
    id: 'mastery_range', icon: '◎', title: 'Mastery: Reach',
    desc: '+{n} attack range (Rank {r})',
    stat: 'allRangeAdd', baseValue: 8, mode: 'linear',
    maxPicks: 8,
  },
  {
    id: 'mastery_orbitdmg', icon: '⟲', title: 'Mastery: Orbit Force',
    desc: '+{n}% orbit damage (Rank {r})',
    stat: 'orbitDmgMult', baseValue: 0.10, mode: 'diminish',
    maxPicks: 5,
  },
];

/** Compute the effective value for a mastery at given rank (0-indexed pick count) */
export function getMasteryValue(def, rank) {
  if (def.mode === 'diminish') {
    return def.baseValue / (1 + 0.3 * rank);
  }
  return def.baseValue;
}