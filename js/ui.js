// ── UI: HUD + Upgrade selection ──

import { COMPANION_DEFS, DROPPABLE_COMPANIONS, MODIFIERS, getModifiersForType } from './data/companions.js';
import { pick, weightedPick } from './utils.js';

// Rarity weight multipliers — lower = rarer
const RARITY_WEIGHTS = { common: 1, rare: 0.45, epic: 0.18 };

export class UI {
  constructor() {
    this.xpBar = document.getElementById('xp-bar');
    this.xpText = document.getElementById('xp-text');
    this.hpBar = document.getElementById('hp-bar');
    this.hpText = document.getElementById('hp-text');
    this.timer = document.getElementById('timer');
    this.killCount = document.getElementById('kill-count');
    this.upgradeModal = document.getElementById('upgrade-modal');
    this.upgradeChoices = document.getElementById('upgrade-choices');
    this.rerollBtn = document.getElementById('reroll-btn');
    this._rerolls = 0;
  }

  updateHUD(player, elapsed) {
    const xpPct = (player.xp / player.xpToNext) * 100;
    this.xpBar.style.width = xpPct + '%';
    this.xpText.textContent = `Lv ${player.level}`;

    const hpPct = (player.hp / player.maxHp) * 100;
    this.hpBar.style.width = hpPct + '%';
    this.hpText.textContent = `${player.hp}/${player.maxHp}`;

    const m = Math.floor(elapsed / 60);
    const s = Math.floor(elapsed % 60);
    this.timer.textContent = `${m}:${s.toString().padStart(2, '0')}`;

    this.killCount.textContent = `Kills: ${player.kills}`;
  }

  showUpgradeSelection(player, companions, onSelect, guaranteedRare = false) {
    this.upgradeModal.classList.remove('hidden');
    this._rerolls = 1;
    this._renderChoices(player, companions, onSelect, guaranteedRare);
  }

  _renderChoices(player, companions, onSelect, guaranteedRare) {
    this.upgradeChoices.innerHTML = '';
    const choices = this._generateChoices(player, companions, guaranteedRare);

    for (const choice of choices) {
      const card = document.createElement('div');
      card.className = `upgrade-card rarity-border-${choice.rarity}`;
      card.innerHTML = `
        <div class="card-icon">${choice.icon}</div>
        <div class="card-title">${choice.title}</div>
        <div class="card-desc">${choice.desc}</div>
        <div class="card-rarity rarity-${choice.rarity}">${choice.rarity}</div>
      `;
      card.addEventListener('click', () => {
        this.upgradeModal.classList.add('hidden');
        this.rerollBtn.classList.add('hidden');
        onSelect(choice);
      });
      this.upgradeChoices.appendChild(card);
    }

    // Reroll button
    this.rerollBtn.textContent = `Reroll (${this._rerolls})`;
    this.rerollBtn.disabled = this._rerolls <= 0;
    this.rerollBtn.classList.remove('hidden');
    // Clone to remove old listeners
    const freshBtn = this.rerollBtn.cloneNode(true);
    this.rerollBtn.replaceWith(freshBtn);
    this.rerollBtn = freshBtn;
    freshBtn.addEventListener('click', () => {
      if (this._rerolls > 0) {
        this._rerolls--;
        this._renderChoices(player, companions, onSelect, guaranteedRare);
      }
    });
  }

  hideUpgrade() {
    this.upgradeModal.classList.add('hidden');
    this.rerollBtn.classList.add('hidden');
  }

  _generateChoices(player, companions, guaranteedRare) {
    const choices = [];
    const pool = [];

    // ── New companion ──
    if (companions.length < 5) {
      const ownedKeys = companions.map(c => c.key);
      const available = DROPPABLE_COMPANIONS.filter(k => !ownedKeys.includes(k));
      if (available.length > 0) {
        const key = pick(available);
        const def = COMPANION_DEFS[key];
        pool.push({
          type: 'new_companion', key,
          icon: def.icon,
          title: `Summon ${def.name}`,
          desc: `${def.desc} (${def.category})`,
          rarity: 'rare',
          weight: 3 * RARITY_WEIGHTS.rare,
        });
      }
    }

    // ── Companion level-ups (common) ──
    for (const c of companions) {
      if (c.level < 8) {
        pool.push({
          type: 'level_up', companionId: c.id,
          icon: c.def.icon,
          title: `${c.def.name} → Lv${c.level + 1}`,
          desc: '+20% damage, +10 range, faster attacks',
          rarity: 'common',
          weight: 6 * RARITY_WEIGHTS.common,
        });
      }
    }

    // ── Type-specific modifiers ──
    for (const c of companions) {
      if (c.modifiers.length >= 2) continue;
      const compatibleKeys = getModifiersForType(c.def.attack);
      const availMods = compatibleKeys.filter(m => !c.modifiers.includes(m));
      for (const modKey of availMods) {
        const mod = MODIFIERS[modKey];
        const rarity = mod.rarity || 'rare';
        pool.push({
          type: 'modifier', companionId: c.id, modKey,
          icon: mod.icon,
          title: `${c.def.name}: ${mod.name}`,
          desc: mod.desc,
          rarity,
          weight: 2 * RARITY_WEIGHTS[rarity],
        });
      }
    }

    // ── Common stat boosts ──
    pool.push({
      type: 'stat', stat: 'speed', value: 18,
      icon: '⚡', title: 'Swift Stride', desc: '+18 movement speed',
      rarity: 'common', weight: 2,
    });
    pool.push({
      type: 'stat', stat: 'maxHp', value: 20,
      icon: '♥', title: 'Vitality Shard', desc: '+20 max HP and heal 20',
      rarity: 'common', weight: 2,
    });
    pool.push({
      type: 'stat', stat: 'magnet', value: 18,
      icon: '✧', title: 'Attraction Field', desc: '+18 XP pickup range',
      rarity: 'common', weight: 1,
    });
    pool.push({
      type: 'heal', value: 30,
      icon: '✚', title: 'Mend Wounds', desc: 'Heal 30 HP',
      rarity: 'common',
      weight: player.hp < player.maxHp * 0.45 ? 4 : 0.5,
    });

    // ── Epic stat boosts (meaningfully stronger) ──
    pool.push({
      type: 'stat', stat: 'speed', value: 40,
      icon: '⚡', title: "Warden's Haste", desc: '+40 movement speed',
      rarity: 'epic', weight: 1 * RARITY_WEIGHTS.epic,
    });
    pool.push({
      type: 'stat', stat: 'maxHp', value: 50,
      icon: '♥', title: 'Iron Heart', desc: '+50 max HP and full heal',
      rarity: 'epic', weight: 1 * RARITY_WEIGHTS.epic,
    });

    // ── Guaranteed rare filter ──
    let filtered = pool;
    if (guaranteedRare) {
      const rareOrAbove = pool.filter(c => c.rarity === 'rare' || c.rarity === 'epic');
      if (rareOrAbove.length >= 3) filtered = rareOrAbove;
    }

    // Pick 3 unique choices
    while (choices.length < 3 && filtered.length > 0) {
      const weights = filtered.map(c => c.weight);
      const selected = weightedPick(filtered, weights);
      choices.push(selected);
      filtered.splice(filtered.indexOf(selected), 1);
    }

    return choices;
  }
}