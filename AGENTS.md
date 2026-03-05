# AGENTS.md — Diablo Match Agent Guide

## Project Purpose
Diablo Match is an early playable prototype of a dark-fantasy match-combat game.
Primary objective right now: validate fun/readability of the core combat loop, not ship a polished production game.

## Tech Stack
- Runtime: Phaser 3 + Vite
- Language: JavaScript (ESM)
- Tests: Vitest
- Asset tools: Node scripts + ImageMagick pipeline for tile preprocessing + Free Texture Packer (via `free-tex-packer-core`)

## Repository Map
- `src/main.js`
  - Phaser bootstrap and renderer config (`pixelArt`, no antialiasing, resize mode).
- `src/scenes/PrototypeScene.js`
  - Main playable scene and orchestration layer.
  - Handles board rendering/input, turn flow visualization, overlays/modals, and animation pacing.
- `src/game/*`
  - Pure gameplay/domain logic:
  - `engine.js`: turn state machine, encounters, replay, event emission.
  - `board.js`, `match.js`, `moves.js`, `resolve.js`: board generation, legal moves, matching, cascades.
  - `combat.js`, `entities.js`, `ai.js`: combat effects, actor data, enemy behavior.
  - `rng.js`, `logger.js`: deterministic RNG and structured event log.
- `src/ui/*`
  - `CombatHUD.js`: portraits, bars, turn/phase indicators, spell panel.
  - `BoardEffects.js`: floating combat text and VFX helpers.
  - `hudConfig.js`: timing + presentation tunables.
- `tools/*`
  - `process-tiles.mjs`: raw tile preprocessing.
  - `build-tiles-atlas.mjs`: board tile atlas generation.
  - `build-ui-atlas.mjs`: portrait/UI atlas generation.
- `assets/sources/*`
  - Source assets (tiles, portraits).
- `assets/tiles/*`
  - Processed tile outputs (used by atlas build).
- `public/assets/generated/*`
  - Generated atlas artifacts consumed at runtime.
- `docs/*`
  - Planning/history docs. `docs/old/*` contains archived prototype plans.

## Current Gameplay/UX Contracts (Do Not Break)
- Board is 8x8, tile size currently 64x64.
- Pixel-art rendering must remain crisp:
  - Phaser: `pixelArt: true`, antialias disabled.
  - Texture filter uses `NEAREST`.
- Resolution sequence is intentionally step-based and paced:
  - swap -> match highlight -> destruction -> effect popup window -> gravity/fall -> cascade pause.
- Input must be blocked during resolution and modal overlays.
- Encounter start is gated by start overlay (`PLAYER STARTS` / `ENEMY STARTS`).
- Victory/defeat are modal-gated outcomes.
- Replay determinism must hold for seeded runs.

## Engine/Event Model Notes
- UI should react to engine events from logger, not infer combat outcomes by reading raw state diffs when avoidable.
- Keep `engine.js` as source-of-truth for turn/outcome transitions.
- Preserve deterministic behavior when adding randomness:
  - use engine RNG only.
  - avoid `Math.random()` in gameplay paths.

## Asset Pipeline Rules
- Standard build flow:
  - `npm run build:assets`
  - this runs tile processing, tile atlas, and UI atlas generation.
- Source-of-truth for editable art:
  - tiles: `assets/sources/tiles/`
  - portraits: `assets/sources/portraits/`
- Generated runtime assets:
  - `public/assets/generated/`
- If adding portraits/tiles, confirm atlas generation picks them up.
- Keep pixel-art constraints (nearest-neighbor scaling, no smoothing).

## Coding Guidelines for Agents
- Prefer small, targeted changes over large rewrites.
- Keep game logic (`src/game`) decoupled from Phaser scene code.
- Add new tunables to `src/ui/hudConfig.js` instead of hardcoding magic numbers.
- For new UI states:
  - define clear entry/exit conditions,
  - ensure no stuck visual states after interrupts/resets.
- Respect existing commit history and avoid reverting unrelated user work.

## Testing & Validation Checklist
Run after non-trivial changes:
1. `npm test`
2. `npm run build`
3. Manual smoke pass in `npm run dev` for:
   - tile interactions and selection UX
   - turn/phase indicator correctness
   - cascade readability
   - victory/defeat/start overlays
   - portrait state transitions

## Common Safe Workflows
- New gameplay rule:
  - update `src/game/*` first, then wire scene/UI reactions.
- New visual timing:
  - update `hudConfig.js`, not inline constants.
- New tile/portrait:
  - add source asset -> run `npm run build:assets` -> verify generated atlas frames.

## Known Non-Goals (Current Phase)
- Final art polish/effects-heavy presentation.
- Large-scale content systems (inventory/progression/meta loops).
- Premature optimization over readability/determinism.

## Definition of Done for Agent Tasks
A task is complete when:
- behavior matches requested plan/spec,
- tests pass,
- build succeeds,
- generated assets are updated if relevant,
- no regressions in input gating, turn flow, or overlay state.
