# Diablo Match Prototype

## Portrait Asset Workflow

Add portrait PNGs under:

- `assets/sources/portraits/<name>/<state>.png`

Examples:

- `assets/sources/portraits/warrior/idle.png`
- `assets/sources/portraits/warrior/hurt.png`
- `assets/sources/portraits/skeleton/idle.png`

### Build Portrait Atlas

Run:

```bash
npm run build:ui-atlas
```

This generates:

- `public/assets/generated/atlas/ui-portraits-atlas.png`
- `public/assets/generated/atlas/ui-portraits-atlas.json`

The full asset pipeline can be run with:

```bash
npm run build:assets
```

## HUD Trigger API (Scene Integration)

The combat HUD exposes these methods:

- `setHeroState(eventName)`
- `setEnemyPortrait(enemyIdOrFolder)`
- `updateVitals({ hero, enemy })`
- `pushCombatLog(line)`
- `setTurnPhaseLabel(text)`

Current scene integrations:

- Player cast -> `setHeroState("cast")`
- Player hurt -> `setHeroState("hurt")`
- Gold gain -> `setHeroState("coin")`
- Victory -> `setHeroState("victory")`
- Enemy swap/damage/match/cascade -> combat log lines + floating board text

## Notes

- If class-specific hero portraits are missing, HUD falls back to `warrior` portraits.
- Enemy portrait folder mapping is explicit for current enemy IDs.
