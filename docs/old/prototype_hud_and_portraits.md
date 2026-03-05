GOALS

- Add a dramatic Diablo-II-inspired HUD that frames a centered 8x8 board.
- Prominent HERO + ENEMY portraits that “break the frame” (overlap the board frame by ~60–80px on desktop).
- Clean HUD: no combo counters or match counters in HUD. Combos and big feedback appear as floating effects over the board; match info goes to the combat log.
- Portrait reactions for the hero using existing PNGs. Enemies have idle only.
- Responsive: works on 1920x1080 and scales down to mobile; on narrow screens portraits stack above the board.

ASSETS (INPUT)
- Hero portraits: assets/sources/portraits/warrior/
  Files (PNG): idle.png, hurt.png, coin.png, victory.png, lowhp.png, cast.png
- Enemy portraits: assets/sources/portraits/<enemyName>/idle.png (idle only; multiple folders exist)
- You may create derived/build assets under assets/generated/ and/or assets/ui/ as appropriate.
- It is up to you to bundle portrait assets into an atlas (or multiple). Use a scriptable pipeline so future portraits can be added without manual steps.

DELIVERABLES
1) A HUD/Combat UI implementation (Phaser) with clear layering and responsive layout.
2) An atlas build step (node script) that packs portraits + UI chrome (frames, bars, icons if needed) into atlas(es).
3) Minimal placeholder UI chrome if none exists yet (simple pixel-style frames/bars with solid fills; no external art dependencies).
4) Integrate into the existing combat scene so it renders and updates from game state.
5) Add portrait reaction triggers + timers and a simple API for the rest of the game to call.

DESIGN REQUIREMENTS (LAYOUT)
- Reference layout for desktop (1920x1080):
  - Board remains dominant and centered.
  - Recommended target sizes:
    - Board: 640x640 (assumes 80px tiles; if current board differs, adapt layout to current board bounds but keep the same relative placements).
    - Portraits: prefer 384x384 for presentation, but source images may be 256x256; scale with nearest-neighbor (pixel crisp). If the portraits are already larger, fit them within the portrait frame.
  - Top status strip (optional) up to ~80px: Pause button, turn phase indicator (Spell Phase / Swap Phase), gold/xp (if available).
  - Bottom UI strip ~160px: 3 spell buttons (placeholders if spells UI not implemented yet), small utility buttons.
  - Combat log: bottom-left above spells (2–4 lines visible). Match outcomes should appear here (e.g., “3x Weapon → 24 dmg”, “4x Mana → +8 mana”, “Cascade x2”).
  - Portrait anchoring trick:
    - Hero portrait left of board; enemy portrait right of board.
    - Portrait frames connect visually to board frame; portraits overlap into board frame by 60–80px (desktop only).
    - Add subtle glow spill from portraits into board frame:
      - Hero: warm torch flicker (subtle)
      - Enemy: green/blue necro glow depending on enemy (default subtle green)
- Mobile / narrow width (< ~900px):
  - Stack: hero portrait row, enemy portrait row (or side-by-side if it fits), then board, then spells, then log (or log over spells).
  - Reduce portrait visual size to ~160–192px.
  - Keep board centered and large as possible.
- All scaling must preserve crisp pixels: use NEAREST and disable smoothing where required.

LAYERING (IMPORTANT)
Implement distinct display layers (containers) with consistent depth ordering:
- backgroundLayer
- boardLayer (existing)
- boardEffectsLayer (for floating combat text, combo callouts, damage numbers, spell bursts)
- hudLayer (frames, bars, buttons, portraits)
- modalLayer (pause panel etc., optional)

COMBOS / EFFECTS OVER BOARD
- Do NOT show combo counters in HUD.
- Create a boardEffects system that can display:
  - “COMBO xN” (when cascades occur)
  - “CRITICAL”, “EXTRA TURN”
  - big damage numbers
- These should spawn near the board center or near the affected target area (enemy side), move upward ~30–50px, scale slightly, then fade out in ~0.8–1.2s.
- Use simple bitmap text (or Phaser Text) with pixel font style; if no pixel font exists, use default but keep it readable.

PORTRAIT SYSTEM
- Hero portrait state machine with these states mapped to files:
  - idle → idle.png
  - hurt → hurt.png (trigger when player takes damage)
  - coin → coin.png (trigger when gold gained)
  - victory → victory.png (trigger on win)
  - lowhp → lowhp.png (when HP < 25% max; can be persistent while low, but allow temporary overrides like hurt/cast)
  - cast → cast.png (trigger when player casts a spell)
- Enemies: only idle.png for now, but architect so future reaction states can be added later.
- Priority rules for hero portrait:
  - victory overrides all and persists until scene ends.
  - hurt is a short override (~500ms) then returns to lowhp if low, else idle.
  - cast is a short override (~500ms) then returns to lowhp if low, else idle.
  - coin is a short override (~500ms) then returns to lowhp if low, else idle.
  - lowhp is the “base idle” when low HP; otherwise base is idle.
- Provide a public API on HUD: setHeroState(eventName), setEnemyPortrait(enemyIdOrFolder), updateVitals({hp,maxHp,mana,maxMana,armor,...}), pushCombatLog(line).

UI ELEMENTS (MINIMUM)
- Portrait frames (simple pixel frame with dark stone + iron corners). If no art, draw using Phaser Graphics + renderTexture OR generate as a 9-slice style simple frame.
- Bars:
  - HP bar (red)
  - Mana bar (blue)
  - Armor bar (gray/steel)
  Use chunky 1–2px outline, no gradients required. Label with current/max numbers.
- Enemy intent icon placeholder near enemy portrait (if intent not implemented, show none; keep space reserved).
- Spell bar with 3 slots (placeholders). Buttons can be simple framed rectangles with text like “1”, “2”, “3” until spells UI exists.
- Combat log panel frame (2–4 lines).

ATLAS / BUILD PIPELINE
- Add a node script (e.g., scripts/build-ui-atlas.js) that:
  - Scans assets/sources/portraits/**/ for PNGs.
  - Packs them into an atlas (or one atlas per category if too large).
  - Outputs to assets/generated/atlas/ (json + png).
  - Uses a standard packer (e.g., free-tex-packer-core, texturepacker-cli if available, or a minimal JS packer). Choose something that works with node and the repo environment; add dependency if needed.
  - Ensure no smoothing / correct pixel alignment. Keep original pixel data; do not resample during packing.
- Update Phaser preload to load the atlas(es) and use frame names consistently:
  - Suggested frame naming: portraits/<folder>/<fileBaseName>
    e.g., portraits/warrior/idle, portraits/warrior/hurt, portraits/skeleton_warrior/idle
- If you create UI chrome textures procedurally, you may skip packing them, but if you create PNG assets for frames/icons, include them in the atlas.

IMPLEMENTATION STEPS
1) Create HUD class/module (e.g., CombatHUD) responsible for:
   - Creating containers for hudLayer elements
   - Layout computation based on scene scale/resize
   - Loading portrait sprites (from atlas frames)
   - Managing portrait state machine
   - Rendering bars and updating text
   - Combat log ring buffer + redraw
   - Simple button wiring hooks (pause/spell buttons), with no hard dependency on actual spell logic
2) Add resize handling:
   - Subscribe to Phaser Scale resize event and recompute layout.
   - Use a single “layout(rect)” method that positions everything given viewport size.
3) Integrate into combat scene:
   - Instantiate HUD after board creation so it can read board bounds.
   - Provide small integration points:
     - On damage to player: hud.heroEvent("hurt")
     - On player casts: hud.heroEvent("cast")
     - On gold gain: hud.heroEvent("coin")
     - On victory: hud.heroEvent("victory")
     - On hp change: hud.updateVitals(...)
     - On match resolved: hud.pushCombatLog(...)
     - On cascades: spawn boardEffects text “COMBO xN” (but not in HUD)
4) BoardEffects:
   - Implement helper to spawn floating text in boardEffectsLayer with tween (y up + alpha down).
   - Provide functions: showCombo(mult), showDamage(amount, target="enemy"), showExtraTurn(), showCrit().
5) Ensure pixel crispness:
   - Set texture filtering to NEAREST for portrait sprites and UI art.
   - Disable smoothing on canvas if needed (project setting).
6) Keep changes minimal and clean; avoid refactoring unrelated gameplay.

DEFAULTS / ASSUMPTIONS
- If game state/events aren’t formalized, create a minimal interface the scene can call directly.
- If board bounds are not easily accessible, compute them from board container position/size.
- If the current board is not 640x640, keep the board size as-is; scale portraits to fit around it and keep overlap proportionally similar.
- If fonts are missing, use Phaser default; keep sizes legible.

ACCEPTANCE CHECKLIST
- Portraits visible, prominent, and overlap the board frame on desktop.
- Hero portrait swaps correctly between idle/hurt/coin/cast/lowhp/victory based on triggers.
- Enemy portrait loads from enemy folder idle.png (atlas frame).
- HUD scales to mobile layout without overlapping the board.
- Combos/damage feedback appear as floating effects over the board, not in HUD.
- Combat log shows match outcomes (at least placeholder lines are displayed).
- Atlas build script works and is documented in package scripts (e.g., “npm run build:ui-atlas”).

DOCUMENTATION
- Add a short README section or comment block explaining:
  - How to add new portraits (drop PNGs into assets/sources/portraits/<name>/)
  - How to rebuild atlas
  - How to trigger portrait events from the combat scene

Now implement it.