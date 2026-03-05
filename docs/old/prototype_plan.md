# Prototype build plan (Codex-ready) — Phaser 3 + Vite + JavaScript

## Locked decisions
- **Engine:** Phaser 3
- **Language/build:** JavaScript (ES modules) + Vite
- **State:** simple plain objects + pure functions (no state library)
- **RNG:** seeded (deterministic)
- **Input:** tap-select + tap-adjacent-tap to swap (no drag)
- **Assets:** placeholder colored tiles + text/icons (no art dependency)
- **Testing:** Vitest
- **Board mutation model:** mutate in place for prototype simplicity

The goal is to provide **clear incremental development tickets** that can be fed to coding agents (Codex or similar). The tickets intentionally avoid prescribing exact file structures, interfaces, or method names so that the agent can design the implementation details.

---

# Codex Tickets (Incremental Development)

## Ticket 0 — Project scaffold and basic game boot

**Goal**  
Create a minimal browser project that launches a Phaser game instance using Vite as the development server.

**Expected behavior**
- Running the development server launches a browser page containing a Phaser canvas.
- A single scene loads successfully.
- The scene displays a background color and a simple debug text confirming the prototype is running.

**Acceptance criteria**
- The project starts with a single command (`npm run dev` or equivalent).
- The canvas appears without runtime errors.
- Phaser successfully initializes and renders the scene.

**Out of scope**
- Game board logic
- Input handling
- Combat systems

---

## Ticket 1 — Board model, tile types, and deterministic RNG

**Goal**  
Implement the internal board representation and deterministic tile generation.

The board should support:
- An 8×8 grid
- Six tile categories (weapon, mana, shield, skill, coin, special)
- Weighted random generation of tiles
- Deterministic generation using a seeded random number generator

**Expected behavior**
- The system can generate a new board using a seed value.
- Using the same seed always produces the same board.
- Different seeds produce different boards.
- Tile distribution approximately follows configured weights when tested over many generations.

**Acceptance criteria**
- Board size is correct (64 tiles).
- Deterministic board generation works reliably.
- Tile generation respects probability weights within reasonable tolerance.

**Out of scope**
- Rendering tiles
- Preventing matches in the initial board

---

## Ticket 2 — Match detection logic

**Goal**  
Implement logic that detects valid matches on the board.

Matches consist of:
- Three or more identical tiles
- Horizontal or vertical alignment

**Expected behavior**
- The system scans the entire board.
- All valid matches are detected and returned as grouped results.
- Cross-shaped matches may appear as two independent matches (horizontal and vertical).

**Acceptance criteria**
- Horizontal matches of length ≥3 are detected.
- Vertical matches of length ≥3 are detected.
- Boards without matches produce empty results.
- Cross matches are correctly identified.

**Out of scope**
- Cascades
- Tile removal
- Score or combat effects

---

## Ticket 3 — Tile swapping and move validation

**Goal**  
Implement the rule system allowing tiles to be swapped by the player.

**Game rule**
- Only adjacent tiles may be swapped.
- A swap is valid only if it produces at least one match.

**Expected behavior**
- Attempting to swap non-adjacent tiles is rejected.
- Adjacent tiles may temporarily swap.
- If the swap produces no match, the swap is reverted.
- If the swap produces a match, the new board state is kept.

**Acceptance criteria**
- Illegal swaps never change the board state.
- Valid swaps result in detectable matches.

**Out of scope**
- Cascades
- Turn system
- Extra turn rules

---

## Ticket 4 — Match resolution loop (clear, gravity, refill, cascades)

**Goal**  
Implement the core resolution loop that stabilizes the board after a valid swap.

The loop should repeatedly perform:
1. Detect matches
2. Remove matched tiles
3. Apply gravity so tiles fall downward
4. Refill empty spaces with new random tiles
5. Repeat until no matches remain

The system should also track cascade progression.

**Cascade tracking**
- The initial matches created by the swap are cascade level 0.
- Subsequent automatic matches are cascade level 1, 2, etc.

**Expected behavior**
- After resolution, the board reaches a stable state with no matches remaining.
- Cascades are recorded in order.
- Tile refilling uses the seeded RNG so results remain deterministic.

**Acceptance criteria**
- The resolve process always terminates.
- Gravity behaves correctly (tiles never float above empty spaces).
- Identical seeds and initial boards always produce identical cascade results.

**Out of scope**
- Damage, mana, or resource effects
- Extra turn rules
- Board reshuffling when no moves exist

---

# Upcoming tickets (later phases)

After the board mechanics are stable, the next development stages will introduce:

1. Cascade multipliers
2. Converting tile matches into combat/resource events
3. Rendering the board visually in Phaser
4. Touch-based input for selecting and swapping tiles
5. Turn structure (player vs enemy)
6. Extra-turn rules for 4+ matches
7. Player and enemy combat stats
8. Basic enemy AI
9. Spell system
10. Status effects (burn, poison, frost)

These should only be implemented once the deterministic board engine is stable and fully testable.

