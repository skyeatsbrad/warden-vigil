# Warden's Vigil

A vampire survivors-style auto-battler survival game built with vanilla HTML5 Canvas + JavaScript. No frameworks, no build tools — just open and play.

**[▶ Play Now](https://skyeatsbrad.github.io/warden-vigil/)**

## How to Play

You are the **Warden** — a summoner who commands Companions to fight waves of enemies.
Your companions attack automatically; your job is to **dodge, collect XP, and choose upgrades**.

### Controls
| Action | Keyboard | Touch |
|--------|----------|-------|
| Move | WASD / Arrow keys | Virtual joystick |
| Ultimate | Spacebar | ULT button |
| Panic Pulse | Q | PANIC button |

### Gameplay Loop
1. **Move** to avoid enemies (contact = damage)
2. **Companions** auto-attack nearby enemies
3. **Collect XP orbs** (purple) from defeated enemies
4. **Level up** → choose from 3 upgrades (new companions, level-ups, modifiers, stats)
5. **Survive** as long as possible against escalating waves

### Companion Categories
- **Solar** — light-based attacks
- **Void** — dark energy / gravity
- **Bio** — organic / nature
- **Mechanical** — gear / tech
- **Arcane** — crystalline / magic

### Starting Companions
| Companion | Category | Attack | Ultimate |
|-----------|----------|--------|----------|
| Glintbug ✦ | Solar | Projectile | Nova Burst |
| Rustmaw ⚙ | Mechanical | Melee | Overclock |
| Nullwisp ◈ | Void | Aura | Rift Collapse |
| Thornvine ❋ | Bio | Beam | Overgrowth |
| Prismoth ◇ | Arcane | Projectile | Shatter Field |

### Unlocks
- **Nullwisp** — Survive 3 minutes
- **Thornvine** — Reach level 10
- **Prismoth** — Kill 500 enemies total

## Running Locally

### Option 1: Python (simplest)
```bash
cd warden-vigil
python -m http.server 8080
# Open http://localhost:8080
```

### Option 2: Node.js
```bash
npx serve .
```

### Option 3: VS Code
Install the "Live Server" extension, right-click `index.html` → Open with Live Server.

> **Note:** Opening `index.html` directly as a file won't work because ES modules require an HTTP server.

## Hosting

This project is designed for **GitHub Pages** (static hosting). No build step required — just push and enable Pages from the `main` branch root (`/`).

## Project Structure
```
warden-vigil/
├── index.html            — HTML shell + UI overlays
├── .gitignore
├── css/
│   └── style.css         — All styling
├── js/
│   ├── main.js           — Entry point + game loop
│   ├── game.js           — State manager + orchestration
│   ├── input.js          — Keyboard + touch joystick
│   ├── camera.js         — Smooth camera follow + screen shake
│   ├── player.js         — Warden entity
│   ├── companion.js      — Companion behaviors + attacks
│   ├── enemy.js          — Enemy spawning + AI + boss mechanics
│   ├── projectile.js     — Projectile system + modifiers
│   ├── collision.js      — Hit detection + damage
│   ├── xp.js             — XP orbs + leveling
│   ├── ui.js             — HUD + upgrade selection
│   ├── progression.js    — Meta-progression + localStorage
│   ├── particles.js      — Visual effects + damage numbers
│   ├── utils.js          — Math helpers
│   └── data/
│       ├── companions.js — Companion stat tables
│       └── enemies.js    — Enemy stat tables
└── README.md
```

## License

All rights reserved.
