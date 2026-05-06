// ── Meta-progression: unlocks, saves ──

import { COMPANION_DEFS, STARTER_COMPANIONS } from './data/companions.js?v=18';

const STORAGE_KEY = 'wardenVigil_progress';

export class Progression {
  constructor() {
    this.data = this._load();
  }

  _defaults() {
    return {
      totalKills: 0,
      bestTime: 0,
      runsCompleted: 0,
      unlocked: ['glintbug', 'rustmaw'],
    };
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...this._defaults(), ...JSON.parse(raw) };
    } catch (e) { /* ignore */ }
    return this._defaults();
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) { /* ignore */ }
  }

  recordRun(kills, time) {
    this.data.totalKills += kills;
    this.data.bestTime = Math.max(this.data.bestTime, time);
    this.data.runsCompleted++;

    // Check unlocks
    this._checkUnlocks(time);
    this.save();
  }

  _checkUnlocks(time) {
    for (const key of STARTER_COMPANIONS) {
      if (this.data.unlocked.includes(key)) continue;
      const def = COMPANION_DEFS[key];
      if (!def || !def.unlockCondition) continue;

      let unlocked = false;
      if (def.unlockCondition === 'Survive 3 minutes' && time >= 180) unlocked = true;
      if (def.unlockCondition === 'Reach level 10') continue; // handled in game.js on death
      if (def.unlockCondition === 'Kill 500 enemies total' && this.data.totalKills >= 500) unlocked = true;

      if (unlocked) this.data.unlocked.push(key);
    }
  }

  isUnlocked(key) {
    return this.data.unlocked.includes(key);
  }

  // Populate title screen companion selector
  populateCompanionSelect(containerEl, onSelect) {
    containerEl.innerHTML = '';
    let selectedKey = this.data.unlocked[0];

    for (const key of STARTER_COMPANIONS) {
      const def = COMPANION_DEFS[key];
      const btn = document.createElement('div');
      btn.className = 'companion-btn';
      if (!this.isUnlocked(key)) {
        btn.classList.add('locked');
        btn.innerHTML = `<div class="comp-icon">🔒</div><div class="comp-name">${def.unlockCondition}</div>`;
      } else {
        btn.innerHTML = `<div class="comp-icon" style="color:${def.color}">${def.icon}</div><div class="comp-name">${def.name}</div>`;
        if (key === selectedKey) btn.classList.add('selected');
        btn.addEventListener('click', () => {
          containerEl.querySelectorAll('.companion-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          selectedKey = key;
          onSelect(key);
        });
      }
      containerEl.appendChild(btn);
    }

    onSelect(selectedKey);
    return selectedKey;
  }
}
