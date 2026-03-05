# Diablo Match — UX Improvements Implementation Plan

This document defines **implementation stories for UX improvements** in the combat prototype.
Each ticket is designed to be **Codex-friendly**, implementation-agnostic, and focused on behavior rather than specific code structure.

---

# Ticket 1 — Resolution pacing timeline

## Goal

Slow down board resolution so players can visually follow matches, cascades, and resulting effects.

## Scope

Implement a **step-based resolution timeline**:

1. Swap animation
2. Match highlight
3. Tile destruction
4. Effect popups (damage/mana/armor)
5. Gravity / tile fall
6. Cascade detection pause

Delays should be controlled via **configurable constants**.

Example target timing (tunable):

| Step             | Duration |
| ---------------- | -------- |
| Swap animation   | ~120 ms  |
| Match highlight  | ~150 ms  |
| Tile destruction | ~120 ms  |
| Effect popups    | ~200 ms  |
| Tile fall        | ~150 ms  |
| Cascade pause    | ~120 ms  |

Input must be **disabled only while resolution is running**.

## Acceptance Criteria

* Swap → resolution sequence always plays in the same order.
* Cascades show a visible pause between cascade levels.
* Timing can be tuned from a configuration object without code changes.
* Player input is ignored during resolution.

## Definition of Done

* Resolution pacing is visibly slower and readable.
* Cascades clearly appear as separate steps.
* No inputs are processed while the resolution queue runs.
* No deadlocks or stuck states occur during cascades.

---

# Ticket 2 — Improve selected tile feedback

## Goal

Make tile selection visually obvious and intuitive.

## Scope

Add a **selection state** with visual feedback:

Selected tile effects:

* Bright outline
* Subtle glow
* Slight scale increase (~1.05)

Interaction rules:

| Action                | Result         |
| --------------------- | -------------- |
| Tap tile              | Select tile    |
| Tap same tile         | Deselect       |
| Tap adjacent tile     | Attempt swap   |
| Tap non-adjacent tile | Move selection |

## Acceptance Criteria

* Selected tile is visually distinguishable from others.
* Selection updates correctly across all interaction patterns.
* Selection visuals disappear when deselected.

## Definition of Done

* Tile selection state is always clear on mobile screen.
* Tapping behavior works consistently.
* Selection effects never remain stuck on tiles.

---

# Ticket 3 — Turn indicator around portraits

## Goal

Clearly indicate whose turn it is.

## Scope

Portrait UI behavior:

Active portrait:

* Bright frame
* Subtle glow/pulse

Inactive portrait:

* Dimmed or desaturated

Indicator must change **immediately when turns change**.

## Acceptance Criteria

* Player always knows whose turn it is at a glance.
* Indicator switches instantly when turn ends.
* Indicator behaves correctly during extra turns.

## Definition of Done

* Portrait highlight transitions smoothly.
* Indicator state always matches game turn state.
* Extra turns correctly preserve the active highlight.

---

# Ticket 4 — LCK-weighted starting player + start overlay

## Goal

Use the **Luck (LCK) stat** to influence which side starts combat.

## Scope

Starting roll formula:

```
roll = random(0..100) + LCK × 2
```

Higher roll begins combat.

Add intro overlay:

```
PLAYER STARTS
or
ENEMY STARTS
```

Display time: ~900 ms.

## Acceptance Criteria

* Equal LCK produces approximately 50/50 starts.
* Higher LCK increases probability of starting.
* Overlay appears before any actions occur.

## Definition of Done

* Starting player logic works with seeded RNG.
* Overlay always appears and fades correctly.
* Combat begins only after overlay disappears.

---

# Ticket 5 — Victory screen

## Goal

Provide clear feedback when the enemy is defeated.

## Scope

Trigger when:

```
enemy HP <= 0
```

Display minimal victory screen:

```
VICTORY

XP gained: 0
Gold found: 0
```

Button:

```
Continue
```

## Acceptance Criteria

* Board interaction stops after victory.
* Victory screen blocks interaction until dismissed.

## Definition of Done

* Victory UI appears immediately when enemy dies.
* Continue button transitions to next state without errors.
* No board interactions possible during victory screen.

---

# Ticket 6 — Game Over screen

## Goal

Handle player death cleanly.

## Scope

Trigger when:

```
player HP <= 0
```

Show screen:

```
YOU DIED
```

Button:

```
Restart
```

Restart resets combat state.

## Acceptance Criteria

* Board interaction stops immediately on death.
* Restart always returns to a playable state.

## Definition of Done

* Player death during cascades does not break game state.
* Restart works reliably from any death scenario.

---

# Ticket 7 — Floating combat text

## Goal

Improve readability of combat effects.

## Scope

Add floating combat text events for:

| Event        | Example  |
| ------------ | -------- |
| Damage dealt | -24      |
| Mana gained  | +6 mana  |
| Armor gained | +3 armor |
| Gold gained  | +5 gold  |

Text appears near portraits or board edge.

Use **object pooling** if needed.

## Acceptance Criteria

* All damage and resource effects produce text.
* Multiple events stack without unreadable overlap.

## Definition of Done

* Text animations play smoothly.
* Effects remain readable during cascades.
* No performance issues from spawning text objects.

---

# Ticket 8 — Highlight matches before destruction

## Goal

Ensure players can clearly see which tiles matched.

## Scope

Resolution order:

```
match detected
→ highlight matched tiles
→ destroy tiles
```

Highlight can be:

* flash
* glow
* outline

Duration controlled by resolution timing config.

## Acceptance Criteria

* Every match highlights before destruction.
* Cascades also show highlights.

## Definition of Done

* Highlight consistently occurs before tile removal.
* Cascades remain readable.

---

# Ticket 9 — Idle hint (possible move indicator)

## Goal

Help players find moves if they pause.

## Scope

If **no input for 3–5 seconds**:

* Find a valid move
* Highlight both tiles with subtle pulse

Hint disappears immediately on interaction.

## Acceptance Criteria

* Hint always represents a valid move.
* Hint disappears instantly when input occurs.

## Definition of Done

* Idle timer works reliably.
* Hint does not appear during animations or cascades.

---

# Ticket 10 — Turn phase banner (CAST vs SWAP)

## Goal

Clarify the two-phase turn structure.

Turns consist of:

1. Spell phase
2. Tile swap phase

Banner examples:

```
CAST (optional)
```

then

```
SWAP
```

Banner should not obstruct the board.

## Acceptance Criteria

* Banner always reflects the current phase.
* Banner disappears during resolution.

## Definition of Done

* Banner state correctly tracks turn phase.
* Banner never blocks tile interaction.

---

# Recommended Implementation Order

1. Selection feedback
2. Turn indicator
3. Resolution pacing
4. Match highlight
5. Floating combat text
6. Starting player + overlay
7. Victory / defeat screens
8. Turn phase banner
9. Idle hint system

---

End of document.
