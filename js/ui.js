// ── UI: HUD + Upgrade selection ──

import { COMPANION_DEFS, DROPPABLE_COMPANIONS, MODIFIERS, getModifiersForType, EVOLUTIONS, getEvolveLevel, TRADEOFF_CARDS, CURSED_CARDS, PERK_CARDS, MASTERY_DEFS, getMasteryValue } from './data/companions.js?v=19';
import { pick, weightedPick } from './utils.js?v=19';

// Rarity weight multipliers — lower = rarer
const RARITY_WEIGHTS = { common: 1, rare: 0.45, epic: 0.18, cursed: 0.10 };

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
    this._currentChoices = null;
    this._lockedIndex = null;
    this._modalHeading = this.upgradeModal.querySelector('h2');
  }

  updateHUD(player, elapsed, realmIndex, realmState, realmDef) {
    const xpPct = (player.xp / player.xpToNext) * 100;
    this.xpBar.style.width = xpPct + '%';
    this.xpText.textContent = `Lv ${player.level}`;

    const hpPct = (player.hp / player.maxHp) * 100;
    this.hpBar.style.width = hpPct + '%';
    this.hpText.textContent = `${player.hp}/${player.maxHp}`;

    const m = Math.floor(elapsed / 60);
    const s = Math.floor(elapsed % 60);
    const realmLabel = realmDef ? realmDef.name : `Realm ${realmIndex + 1}`;
    this.timer.textContent = `${realmLabel} · ${m}:${s.toString().padStart(2, '0')}`;

    this.killCount.textContent = `Kills: ${player.kills}`;
  }

  showUpgradeSelection(player, companions, onSelect, guaranteedRare = false, masteryPicks = {}) {
    this.upgradeModal.classList.remove('hidden');
    requestAnimationFrame(() => this.upgradeModal.classList.add('visible'));
    this._modalHeading.textContent = 'Choose an Upgrade';
    this._rerolls = 1;
    this._lockedIndex = null;
    this._currentChoices = null;
    this._masteryPicks = masteryPicks;
    this._renderChoices(player, companions, onSelect, guaranteedRare);
  }

  showChestSelection(player, companions, onSelect, masteryPicks = {}) {
    this.upgradeModal.classList.remove('hidden');
    requestAnimationFrame(() => this.upgradeModal.classList.add('visible'));
    this._modalHeading.textContent = '🎁 Chest Opened!';
    this._rerolls = 0;
    this._lockedIndex = null;
    this._masteryPicks = masteryPicks;
    this._currentChoices = this._generateChestChoices(player, companions, masteryPicks);
    this._renderCards(this._currentChoices, onSelect, false);
    this.rerollBtn.classList.add('hidden');
  }

  _renderChoices(player, companions, onSelect, guaranteedRare) {
    if (!this._currentChoices) {
      this._currentChoices = this._generateChoices(player, companions, guaranteedRare, this._masteryPicks);
    }

    this._renderCards(this._currentChoices, onSelect, true);

    // Reroll button
    this.rerollBtn.textContent = `Reroll (${this._rerolls})`;
    this.rerollBtn.disabled = this._rerolls <= 0;
    this.rerollBtn.classList.remove('hidden');
    // Clone to remove old listeners
    const freshBtn = this.rerollBtn.cloneNode(true);
    this.rerollBtn.replaceWith(freshBtn);
    this.rerollBtn = freshBtn;
    freshBtn.addEventListener('click', () => {
      if (this._rerolls <= 0) return;
      this._rerolls--;

      const newAll = this._generateChoices(player, companions, guaranteedRare, this._masteryPicks);
      if (this._lockedIndex !== null) {
        const locked = this._currentChoices[this._lockedIndex];
        const others = newAll.filter(c => c.title !== locked.title);
        const rebuilt = [];
        let otherIdx = 0;
        for (let i = 0; i < this._currentChoices.length; i++) {
          if (i === this._lockedIndex) {
            rebuilt.push(locked);
          } else {
            rebuilt.push(others[otherIdx] || newAll[otherIdx] || this._currentChoices[i]);
            otherIdx++;
          }
        }
        this._currentChoices = rebuilt;
      } else {
        this._currentChoices = newAll;
      }
      this._renderChoices(player, companions, onSelect, guaranteedRare);
    });
  }

  _renderCards(choices, onSelect, showLock) {
    this.upgradeChoices.innerHTML = '';

    for (let idx = 0; idx < choices.length; idx++) {
      const choice = choices[idx];
      const isLocked = this._lockedIndex === idx;
      const isMastery = choice.type === 'mastery';
      const card = document.createElement('div');
      card.className = `upgrade-card rarity-border-${choice.rarity}${isMastery ? ' mastery-card' : ''}`;
      const rarityLabel = isMastery ? 'mastery' : choice.rarity;
      card.innerHTML = `
        <div class="card-icon">${choice.icon}</div>
        <div class="card-title">${choice.title}</div>
        <div class="card-desc">${choice.desc}</div>
        <div class="card-rarity ${isMastery ? 'rarity-mastery' : `rarity-${choice.rarity}`}">${rarityLabel}</div>
        ${showLock ? `<button class="lock-btn${isLocked ? ' locked' : ''}" data-idx="${idx}">${isLocked ? '🔒' : '🔓'}</button>` : ''}
      `;
      card.addEventListener('click', (e) => {
        if (e.target.classList.contains('lock-btn')) return;
        this.upgradeModal.classList.remove('visible');
        this.upgradeModal.classList.add('hidden');
        this.rerollBtn.classList.add('hidden');
        this._currentChoices = null;
        this._lockedIndex = null;
        onSelect(choice);
      });

      // Lock button handler
      if (showLock) {
        const lockBtn = card.querySelector('.lock-btn');
        if (lockBtn) {
          lockBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this._lockedIndex === idx) {
              this._lockedIndex = null;
            } else {
              this._lockedIndex = idx;
            }
            // Re-render lock state
            this.upgradeChoices.querySelectorAll('.lock-btn').forEach((btn, i) => {
              btn.textContent = this._lockedIndex === i ? '🔒' : '🔓';
              btn.classList.toggle('locked', this._lockedIndex === i);
            });
          });
        }
      }

      this.upgradeChoices.appendChild(card);
    }
  }

  hideUpgrade() {
    this.upgradeModal.classList.remove('visible');
    this.upgradeModal.classList.add('hidden');
    this.rerollBtn.classList.add('hidden');
  }

  /** Show a guaranteed 2-card evolution choice for a companion */
  showEvolutionChoice(companion, onSelect) {
    this.upgradeModal.classList.remove('hidden');
    requestAnimationFrame(() => this.upgradeModal.classList.add('visible'));
    this.rerollBtn.classList.add('hidden');
    this._modalHeading.textContent = '⚡ EVOLUTION!';
    this.upgradeChoices.innerHTML = '';

    const evo = EVOLUTIONS[companion.key];
    if (!evo) return;

    for (const path of ['a', 'b']) {
      const e = evo[path];
      const card = document.createElement('div');
      card.className = 'upgrade-card rarity-border-legendary';
      // Build a summary of stat changes
      let statLine = '';
      if (e.statMult) {
        const parts = [];
        for (const [s, m] of Object.entries(e.statMult)) {
          if (m > 1) parts.push(`+${Math.round((m - 1) * 100)}% ${s}`);
          else parts.push(`−${Math.round((1 - m) * 100)}% ${s}`);
        }
        statLine = parts.join(', ');
      }
      if (e.grants && e.grants.length) {
        const modNames = e.grants.map(g => {
          const mod = MODIFIERS[g];
          return mod ? mod.name : g;
        }).join(', ');
        if (statLine) statLine += '<br>';
        statLine += `Grants: ${modNames}`;
      }
      card.innerHTML = `
        <div class="card-icon">${e.icon}</div>
        <div class="card-title" style="color:${e.color}">${e.name}</div>
        <div class="card-desc">${e.desc}</div>
        <div class="card-desc evo-stat-line">${statLine}</div>
        <div class="card-rarity rarity-legendary">EVOLUTION</div>
      `;
      card.addEventListener('click', () => {
        this.upgradeModal.classList.remove('visible');
        this.upgradeModal.classList.add('hidden');
        this._modalHeading.textContent = 'Choose an Upgrade';
        onSelect(path);
      });
      this.upgradeChoices.appendChild(card);
    }
  }

  // ── Pool building (shared between normal + chest selections) ──

  _buildUpgradePool(player, companions, masteryPicks = {}) {
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

    // ── Companion level-ups ──
    for (const c of companions) {
      if (c.level < 8) {
        const evoLevel = getEvolveLevel(c.key);
        const isEvoLevel = c.level + 1 === evoLevel && EVOLUTIONS[c.key] && !c.evolution;
        const name = c.evolutionDef ? c.evolutionDef.name : c.def.name;
        pool.push({
          type: 'level_up', companionId: c.id,
          icon: c.evolutionDef ? c.evolutionDef.icon : c.def.icon,
          title: `${name} → Lv${c.level + 1}`,
          desc: isEvoLevel ? '⚡ EVOLUTION! Choose a new form!' : '+20% damage, +10 range, faster attacks',
          rarity: isEvoLevel ? 'epic' : 'common',
          weight: isEvoLevel ? 10 : 6 * RARITY_WEIGHTS.common,
        });
      }
    }

    // ── Type-specific modifiers ──
    for (const c of companions) {
      if (c.modifiers.length >= 2) continue;
      const compatibleKeys = getModifiersForType(c.def.attack);
      const availMods = compatibleKeys.filter(m => !c.modifiers.includes(m) && !c.evolutionGrants.includes(m));
      for (const modKey of availMods) {
        const mod = MODIFIERS[modKey];
        const rarity = mod.rarity || 'rare';
        const name = c.evolutionDef ? c.evolutionDef.name : c.def.name;
        pool.push({
          type: 'modifier', companionId: c.id, modKey,
          icon: mod.icon,
          title: `${name}: ${mod.name}`,
          desc: mod.desc,
          rarity,
          weight: 2 * RARITY_WEIGHTS[rarity],
        });
      }
    }

    // ── Tradeoff cards ──
    for (const tc of TRADEOFF_CARDS) {
      if (!this._pickedTradeoffs) this._pickedTradeoffs = new Set();
      if (this._pickedTradeoffs.has(tc.id)) continue;
      pool.push({
        type: 'tradeoff', tradeoffId: tc.id,
        icon: tc.icon,
        title: tc.title,
        desc: tc.desc,
        rarity: tc.rarity,
        weight: 2 * RARITY_WEIGHTS[tc.rarity],
      });
    }

    // ── Cursed cards (greed mechanic) ──
    for (const cc of CURSED_CARDS) {
      if (!this._pickedTradeoffs) this._pickedTradeoffs = new Set();
      if (this._pickedTradeoffs.has(cc.id)) continue;
      pool.push({
        type: 'cursed', cursedId: cc.id,
        icon: cc.icon,
        title: cc.title,
        desc: cc.desc,
        rarity: 'cursed',
        weight: 2 * RARITY_WEIGHTS.cursed,
      });
    }

    // ── Perk cards (build-defining one-time picks) ──
    // Gate: only appear after level 3. Sample up to 2 to avoid crowding.
    if (player.level >= 3) {
      if (!this._pickedPerks) this._pickedPerks = new Set();
      const availPerks = PERK_CARDS.filter(p => !this._pickedPerks.has(p.id));
      const sampledPerks = availPerks.sort(() => Math.random() - 0.5).slice(0, 2);
      for (const perk of sampledPerks) {
        pool.push({
          type: 'perk', perkId: perk.id,
          icon: perk.icon,
          title: perk.title,
          desc: perk.desc,
          rarity: perk.rarity,
          weight: 2.5 * RARITY_WEIGHTS[perk.rarity],
        });
      }
    }

    // ── Mastery cards (repeatable fallback) ──
    // Inject when build-defining options are running low (< 4 unique cards)
    // or player has hit level 15+
    const uniqueCount = pool.filter(c =>
      c.type === 'new_companion' || c.type === 'level_up' || c.type === 'modifier'
    ).length;
    if (uniqueCount < 4 || player.level >= 15) {
      const eligible = MASTERY_DEFS.filter(m => (masteryPicks[m.id] || 0) < m.maxPicks);
      // Sample up to 4 to avoid flooding
      const shuffled = eligible.sort(() => Math.random() - 0.5).slice(0, 4);
      for (const m of shuffled) {
        const rank = masteryPicks[m.id] || 0;
        const val = getMasteryValue(m, rank);
        const displayVal = val < 1 ? Math.round(val * 100) : Math.round(val);
        pool.push({
          type: 'mastery', masteryId: m.id,
          icon: m.icon,
          title: m.title,
          desc: m.desc.replace('{n}', displayVal).replace('{r}', rank + 1),
          rarity: 'common',
          weight: 2.5,
        });
      }
    }

    return pool;
  }

  _generateChoices(player, companions, guaranteedRare, masteryPicks = {}) {
    const pool = this._buildUpgradePool(player, companions, masteryPicks);

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

    // ── Epic stat boosts ──
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
      const rareOrAbove = pool.filter(c => c.rarity === 'rare' || c.rarity === 'epic' || c.rarity === 'cursed');
      if (rareOrAbove.length >= 3) filtered = rareOrAbove;
    }

    // Pick 3 unique choices
    const choices = [];
    while (choices.length < 3 && filtered.length > 0) {
      const weights = filtered.map(c => c.weight);
      const selected = weightedPick(filtered, weights);
      choices.push(selected);
      filtered.splice(filtered.indexOf(selected), 1);
    }

    return choices;
  }

  _generateChestChoices(player, companions, masteryPicks = {}) {
    const pool = this._buildUpgradePool(player, companions, masteryPicks);
    if (pool.length === 0) return this._generateChoices(player, companions, true, masteryPicks);

    const choices = [];

    // Force at least 1 epic/cursed
    const epics = pool.filter(c => c.rarity === 'epic' || c.rarity === 'cursed');
    if (epics.length > 0) {
      const epic = pick(epics);
      choices.push(epic);
      pool.splice(pool.indexOf(epic), 1);
    }

    // Fill remaining from pool
    while (choices.length < 3 && pool.length > 0) {
      const weights = pool.map(c => c.weight);
      const selected = weightedPick(pool, weights);
      choices.push(selected);
      pool.splice(pool.indexOf(selected), 1);
    }

    return choices;
  }
}