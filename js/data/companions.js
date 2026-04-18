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
    baseStats: { damage: 12, cooldown: 0.9, range: 220, speed: 3, projectileSpeed: 320, radius: 6, pierce: 1 },
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
    baseStats: { damage: 20, cooldown: 0.7, range: 60, speed: 2.8, projectileSpeed: 0, radius: 14, pierce: 0 },
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
  split_bloom:  { name: 'Split Bloom',      desc: 'Fires 3 projectiles in a fan',         icon: '✿', attackTypes: ['projectile'], rarity: 'rare' },
  detonate:     { name: 'Detonation Core',  desc: 'Projectiles explode on hit for AoE',   icon: '💥', attackTypes: ['projectile'], rarity: 'rare' },
  homing:       { name: 'Homing Sigil',     desc: 'Projectiles track the nearest enemy',  icon: '◎', attackTypes: ['projectile'], rarity: 'epic' },
  // ── Orbit ──
  orbit_surge:  { name: 'Orbit Surge',      desc: 'Orbit 50% faster, +20% damage',        icon: '🌀', attackTypes: ['orbit'], rarity: 'rare' },
  wider_ring:   { name: 'Wider Ring',       desc: '+40% orbit radius for more coverage',   icon: '⭕', attackTypes: ['orbit'], rarity: 'rare' },
  contact_burn: { name: 'Contact Burn',     desc: 'Burns enemies on contact 2× faster',    icon: '🔥', attackTypes: ['orbit'], rarity: 'epic' },
  // ── Chain ──
  chain_arc:    { name: 'Chain Arc',        desc: '+3 chain bounces',                      icon: '⚡', attackTypes: ['chain'], rarity: 'rare' },
  overload:     { name: 'Overload',         desc: 'Chain attacks deal +30% base damage',   icon: '⛓', attackTypes: ['chain'], rarity: 'rare' },
  static_mark:  { name: 'Static Mark',      desc: 'Chained foes take +25% damage for 3s', icon: '⊛', attackTypes: ['chain'], rarity: 'epic' },
  // ── Aura ──
  linger_field: { name: 'Lingering Field',  desc: 'Aura cooldown reduced by 40%',          icon: '◉', attackTypes: ['aura'], rarity: 'rare' },
  slow_field:   { name: 'Slow Field',       desc: 'Aura slows enemies by 40% for 2s',     icon: '❄', attackTypes: ['aura'], rarity: 'rare' },
  pulse_echo:   { name: 'Pulse Echo',       desc: 'Aura deals double damage',              icon: '◎', attackTypes: ['aura'], rarity: 'epic' },
};

// Get modifiers compatible with a given attack type
export function getModifiersForType(attackType) {
  return Object.entries(MODIFIERS)
    .filter(([, m]) => m.attackTypes.includes(attackType))
    .map(([key]) => key);
}