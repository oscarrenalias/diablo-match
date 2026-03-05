# Diablo Match – Post‑Prototype Development Plan

Current status: The core board prototype is functional (8×8 grid, tile swap, match detection, cascades, and turn resolution). The next phase focuses on turning the board simulation into a playable combat loop.

---

# Phase 0 – Debugging, Introspection, and Logging

Goal: Make the engine observable so every step can be traced and troubleshot **in-game**.

Tasks:

1. Structured event log
   - Emit events for: swap attempt, match found, match resolved, cascade step, tile drop, tile spawn, turn start/end, resource changes, damage application
   - Include: step index, RNG seed, board hash, before/after snapshots (or diffs)

2. Toggleable debug overlay panel (dev-only)
   - On/off toggle during gameplay (no reliance on browser console)
   - Live view:
     - Current turn owner (player/enemy)
     - Cascade level + multiplier
     - Last move description
     - Resource deltas (HP/mana/armor)
     - Current RNG seed
   - Optional: pause/step controls (advance one resolution step)

3. Deterministic replay
   - Record: initial seed + sequence of player inputs + key RNG draws (if needed)
   - Re-run to reproduce bugs exactly

4. Diagnostics hooks
   - Enable/disable logging levels
   - Export logs as JSON (download/copy)

Deliverable:
A debug-capable engine with step-by-step introspection, a toggleable in-game overlay panel, and deterministic replay.

Definition of Done:
- Overlay panel can be toggled on/off during gameplay
- Every turn and cascade step produces structured log events
- A saved replay reproduces identical board states and outcomes on re-run
- Logs can be exported as JSON without using the browser console

---

# Phase 1 – Stabilize Core Board System

Goal: Ensure the puzzle layer is deterministic, testable, and robust.

Tasks:

1. Deterministic board generation
   - Seeded RNG for board creation
   - Avoid starting boards with immediate matches
   - Guarantee at least one legal move

2. Move validation system
   - Detect valid swaps
   - Prevent swaps that do not produce matches

3. Cascade resolution system
   - Resolve matches
   - Apply cascade multipliers
   - Drop tiles
   - Spawn new tiles

4. End-of-turn board validation
   - Detect no-move states
   - Board reshuffle logic

5. Board simulation test harness
   - Automated cascade tests
   - Match detection tests
   - No-move detection tests

Deliverable:
A stable puzzle engine that can be run headlessly for automated testing.

Definition of Done:
- Given a seed + input, the board outcome is deterministic
- Invalid swaps are rejected reliably
- Cascades resolve to a stable board state with correct multipliers
- No-move states are detected and resolved via reshuffle
- Automated tests cover match detection, cascades, and no-move scenarios

---

# Phase 2 – Combat Resolution Layer

Goal: Translate tile matches into combat effects.

Tasks:

1. Resource system
   - Health
   - Mana
   - Armor
   - Skill charge

2. Tile effect mapping
   - Weapon tiles → damage
   - Mana tiles → mana generation
   - Shield tiles → armor gain
   - Skill tiles → skill charge
   - Coin tiles → gold

3. Cascade multiplier integration

4. Damage calculation pipeline
   - Base damage
   - Attribute scaling
   - Cascade multiplier
   - Enemy resistance

5. Turn resolution order
   - Player action
   - Board resolution
   - Combat effects
   - Enemy turn

Deliverable:
A full combat resolution system driven by tile results.

Definition of Done:
- Each tile type produces a measurable combat/resource effect
- Cascade multipliers apply consistently to all tile-derived effects
- Damage pipeline is deterministic and supports resistances
- Turn resolution order is consistent and visible via debug events

---

# Phase 3 – Player Character System

Goal: Introduce RPG stats and character identity.

Tasks:

1. Character attributes
   - STR
   - INT
   - DEX
   - VIT
   - LCK

2. Derived stats
   - HP
   - crit chance
   - spell power

3. Class templates
   - Warrior
   - Wizard
   - Assassin

4. Character state container
   - health
   - armor
   - mana
   - cooldowns

Deliverable:
Player character model integrated with combat system.

Definition of Done:
- Player entity has attributes + derived stats and persists across encounters in a run
- Combat calculations read attributes/derived stats correctly
- Class selection changes baseline stats and behavior (at least visibly in damage/mana outcomes)
- State updates (HP/mana/armor/cooldowns) are logged and shown in the overlay

---

# Phase 4 – Spell System

Goal: Implement spell casting during the spell phase.

Tasks:

1. Spell framework
   - mana cost
   - cooldown
   - targeting rules

2. Implement first spells

   Warrior
   - Battle Shout

   Wizard
   - Fireball

   Assassin
   - Poison Blade

3. Spell resolution pipeline

Deliverable:
Working spell casting before tile interaction.

Definition of Done:
- Spells can be cast only if mana is sufficient and cooldown allows
- Casting happens before the tile swap phase
- Spell effects change combat outcomes (damage/buffs/status) in a visible way
- Spell casts, costs, cooldown changes, and effects appear in logs and overlay

---

# Phase 5 – Enemy System

Goal: Enable complete combat encounters.

Tasks:

1. Enemy stat model
   - HP
   - attack
   - armor
   - resistances

2. Implement basic enemies
   - Skeleton Warrior
   - Skeleton Archer
   - Ghost
   - Necromancer

3. Enemy AI (simple heuristic)
   Priority example:
   - lethal match
   - large match
   - weapon match
   - mana match

4. Enemy spell hooks

Deliverable:
Playable player vs enemy combat loop.

Definition of Done:
- Enemies take turns autonomously and use the same board rules
- AI selects a legal move and completes a full turn without stalling
- At least 2 enemy archetypes feel distinct (via stats, priorities, or spell usage)
- Enemy actions and effects are visible in logs and overlay

---

# Phase 6 – Combat UX Layer

Goal: Make combat understandable and responsive.

Tasks:

1. UI panels
   - player health
   - enemy health
   - mana
   - armor

2. Combat log

3. Tile effect feedback
   - damage numbers
   - cascade indicator

4. Turn indicators

Deliverable:
A readable combat interface.

Definition of Done:
- Player and enemy HP/mana/armor are always visible during combat
- Turn ownership is unambiguous
- Players can tell what a move did (damage/resource changes + cascade info)
- Combat log reflects the same events as the engine log (at a player-readable level)

---

# Phase 7 – Run-Based Encounter Loop (No Meta Progression Yet)

Goal: Support repeated encounters in a single run until the player is defeated.

Tasks:

1. Encounter setup
   - Initialize player + enemy
   - Reset per-encounter state (turn counters, temporary buffs)

2. Victory / defeat states
   - Victory → advance to next enemy
   - Defeat → game over (run ends when player HP reaches 0)

3. Enemy sequencing
   - Simple enemy list or tier-based random selection
   - Optional: difficulty ramp per fight (HP/Attack multiplier)

4. Between-fight recovery rules (keep simple)
   - Default: carry over current HP/mana/armor into next fight
   - Optional toggle: small mana refill, no HP refill

5. Run summary
   - Number of enemies defeated
   - Total damage dealt/taken

Deliverable:
A full playable run loop: fight → next enemy → … → game over.

Definition of Done:
- After victory, the next enemy encounter starts automatically
- Player state persists across fights within the run (per the chosen rules)
- Run ends cleanly on player HP = 0 and shows a game-over summary
- Run summary metrics are consistent with logged combat events

---

# Phase 8 – Prototype Validation

Goal: Determine if the core gameplay is fun and tune it.

Playtesting focus:

1. Cascade frequency
2. Resource balance
3. Spell usefulness
4. Enemy difficulty

Adjust:

- tile spawn distribution
- damage formulas
- mana economy

Deliverable:
Playable vertical slice suitable for balancing.

Definition of Done:
- You can complete multiple full runs without crashes or soft-locks
- Core loop (spell → swap → resolve → enemy) feels readable and responsive
- Basic balance targets are met (e.g., fights last a sensible number of turns; no single tile type dominates)
- Debug overlay + exported logs are sufficient to diagnose at least one real balance/bug issue

---

# Suggested Development Order

1. Stabilize board engine
2. Add combat resolution
3. Add player stats
4. Add enemies
5. Add spells
6. Add UI
7. Add rewards and progression

This sequence ensures each layer builds on a stable foundation and keeps the prototype testable at every stage.


---

# Cross‑Reference to Design Bible

This development plan directly implements the systems described in the design bible (Diablo Match Game Design Bible). The mapping below connects each phase to the relevant design sections so implementation decisions stay aligned with the intended gameplay model.

Phase 0 – Debugging / Introspection
Supports validation of all systems described in the design bible, especially:
- Board mechanics
- Cascade multipliers
- Combat formulas
- Enemy AI behavior

Purpose: ensure every rule described in the design document can be inspected and verified during runtime.

Phase 1 – Core Board System
Implements the mechanics defined in:
- Combat System
- Board (8×8 grid)
- Tile Types
- Tile Distribution
- Cascade & Combo Mechanics
- Extra Turn Rule

Key design alignment:
- Cascades must follow the multiplier table
- Tile distribution must match the configured spawn rates

Phase 2 – Combat Resolution Layer
Implements systems defined in:
- Resources
- Damage Types
- Status Effects
- Combat Formulas
- Damage Resolution Order

Key design alignment:
- Damage pipeline must follow the documented order:
  Base Damage → Attribute Scaling → Cascade Multiplier → Enemy Resistance → Status Effects → Final Damage

Phase 3 – Player Character System
Implements:
- Attributes
- Core Classes
- Player Loadout

Key design alignment:
- Attribute scaling must affect puzzle actions (weapon tiles, spells, crit chance).

Phase 4 – Spell System
Implements:
- Spell System
- Initial Spell Lists (MVP)

Key design alignment:
- Spells must be cast before tile interaction as defined in the combat turn structure.

Phase 5 – Enemy System
Implements:
- Enemy System
- Enemy Core Stats
- Enemy Archetypes
- Basic Enemy Set (Undead)
- Enemy AI

Key design alignment:
- Enemies follow the same board rules as the player.

Phase 6 – Combat UX
Supports clarity of systems defined across the design bible, particularly:
- Combat turn structure
- Tile effects
- Cascades
- Resource changes

Goal: ensure the player can visually understand puzzle outcomes and combat effects.

Phase 7 – Run‑Based Encounter Loop
Implements the macro gameplay loop defined in:
- Core Gameplay Loop
- Enemy encounters

This phase creates the first playable loop: encounter → victory → next encounter.

Phase 8 – Prototype Validation
Supports balancing of systems defined in:
- Tile distribution
- Combat formulas
- Enemy scaling
- Spell balance

This phase ensures the implemented mechanics behave according to the intended gameplay design and identifies adjustments needed before expanding the game systems.

---

# Implementation Principle

When implementation details conflict with the design bible, treat the design bible as the authoritative gameplay specification. The development plan exists to operationalize that design in incremental engineering steps.

