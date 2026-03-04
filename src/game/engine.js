import { TILE_ORDER, TILE_WEIGHTS } from "./constants.js";
import { chooseEnemyMove } from "./ai.js";
import { createStartingBoard, cloneBoard } from "./board.js";
import { applyCascadeEffects, castSpell, decayTemporaryEffects, tickStatusEffects } from "./combat.js";
import { ENEMY_ARCHETYPES, SPELL_DEFS, createEnemy, createPlayer } from "./entities.js";
import { createEventLogger, hashBoard } from "./logger.js";
import { attemptSwapAndResolve } from "./moves.js";
import { createRng } from "./rng.js";

function makeEncounterQueue() {
  return [
    ENEMY_ARCHETYPES[0],
    ENEMY_ARCHETYPES[1],
    ENEMY_ARCHETYPES[2],
    ENEMY_ARCHETYPES[3],
  ];
}

function actorView(actor) {
  return {
    name: actor.name,
    hp: actor.hp,
    maxHp: actor.maxHp,
    mana: actor.mana,
    armor: actor.armor,
    skillCharge: actor.skillCharge ?? 0,
    gold: actor.gold ?? 0,
    cooldowns: { ...(actor.cooldowns ?? {}) },
    effects: { ...(actor.effects ?? {}) },
  };
}

export function createGameEngine({ seed = "diablo-match-v2", classId = "warrior", logLevel = "INFO" } = {}) {
  const rng = createRng(seed);
  const logger = createEventLogger({ seed });
  logger.setMinLevel(logLevel);

  const state = {
    seed,
    rng,
    logger,
    board: createStartingBoard({ rng, weights: TILE_WEIGHTS, tileOrder: TILE_ORDER }),
    turnOwner: "player",
    turnPhase: "spell",
    stepIndex: 0,
    replay: {
      seed,
      classId,
      actions: [],
    },
    metrics: {
      enemiesDefeated: 0,
      totalDamageDealt: 0,
      totalDamageTaken: 0,
    },
    encounterIndex: 0,
    encounterQueue: makeEncounterQueue(),
    player: createPlayer(classId),
    enemy: null,
    statusText: "",
    gameOver: false,
    lastAction: "",
    debug: {
      lastCascadeLevel: 0,
      lastCascadeMultiplier: 1,
      resourceDelta: { hp: 0, mana: 0, armor: 0, skillCharge: 0, gold: 0 },
    },
  };

  function logEvent(type, payload = {}, level = "INFO") {
    logger.emit(level, type, {
      stepIndex: state.stepIndex,
      turnOwner: state.turnOwner,
      boardHash: hashBoard(state.board),
      ...payload,
    });
  }

  function startEncounter() {
    const archetype = state.encounterQueue[state.encounterIndex % state.encounterQueue.length];
    const tier = 1 + state.encounterIndex;
    state.enemy = createEnemy(archetype, tier);
    state.board = createStartingBoard({ rng: state.rng, weights: TILE_WEIGHTS, tileOrder: TILE_ORDER });
    state.turnOwner = "player";
    state.turnPhase = "spell";
    state.stepIndex += 1;

    logEvent("encounter_start", {
      encounterIndex: state.encounterIndex,
      enemy: actorView(state.enemy),
      player: actorView(state.player),
    });
  }

  function finishIfNeeded() {
    if (state.player.hp <= 0) {
      state.gameOver = true;
      state.statusText = "Defeat. Run ended.";
      logEvent("run_end", {
        reason: "player_dead",
        metrics: { ...state.metrics },
      });
      return true;
    }

    if (state.enemy.hp <= 0) {
      state.metrics.enemiesDefeated += 1;
      logEvent("encounter_victory", {
        encounterIndex: state.encounterIndex,
        metrics: { ...state.metrics },
      });
      state.encounterIndex += 1;
      startEncounter();
      state.statusText = `${state.enemy.name} appears.`;
      return false;
    }

    return false;
  }

  function beginTurn(owner) {
    state.turnOwner = owner;
    state.turnPhase = owner === "player" ? "spell" : "swap";
    state.stepIndex += 1;

    const actor = owner === "player" ? state.player : state.enemy;
    logEvent("turn_start", {
      owner,
      actor: actorView(actor),
    });

    const statusEvents = tickStatusEffects(actor);
    for (const statusEvent of statusEvents) {
      logEvent("status_tick", { owner, event: statusEvent });
    }
  }

  function endTurn(owner) {
    const actor = owner === "player" ? state.player : state.enemy;
    decayTemporaryEffects(actor);
    logEvent("turn_end", {
      owner,
      actor: actorView(actor),
    });
  }

  function resolveSwapByActor({ actor, opponent, indexA, indexB, origin }) {
    const boardBefore = cloneBoard(state.board);
    logEvent("swap_attempt", { origin, indexA, indexB });

    const result = attemptSwapAndResolve({
      board: state.board,
      rng: state.rng,
      indexA,
      indexB,
      weights: TILE_WEIGHTS,
      tileOrder: TILE_ORDER,
      onCascadeStep: (cascadeEntry) => {
        logEvent(
          "cascade_step",
          {
            level: cascadeEntry.level,
            multiplier: cascadeEntry.multiplier,
            matches: cascadeEntry.matches,
            drops: cascadeEntry.drops,
            spawns: cascadeEntry.spawns,
          },
          "DEBUG",
        );
      },
    });

    if (!result.accepted) {
      logEvent("swap_rejected", { reason: result.reason });
      return { ok: false, reason: result.reason, boardBefore, boardAfter: cloneBoard(state.board) };
    }

    logEvent("match_found", { matchCount: result.matches.length });

    for (const cascade of result.cascades) {
      for (const group of cascade.matches) {
        const tileType = cascade.boardBefore[group[0]];
        logEvent("match_resolved", {
          level: cascade.level,
          multiplier: cascade.multiplier,
          tileType,
          size: group.length,
          group,
        });
      }

      const effect = applyCascadeEffects({
        state,
        attacker: actor,
        defender: opponent,
        cascade,
        rng: state.rng,
      });

      for (const event of effect.events) {
        if (event.type === "weapon_damage") {
          if (actor.type === "player") {
            state.metrics.totalDamageDealt += event.damage.finalDamage;
          } else {
            state.metrics.totalDamageTaken += event.damage.finalDamage;
          }
        }

        logEvent("damage_application", {
          by: actor.name,
          to: opponent.name,
          detail: event,
          resourceDelta: effect.resourceDelta,
        });
      }

      state.debug.lastCascadeLevel = cascade.level;
      state.debug.lastCascadeMultiplier = cascade.multiplier;
      state.debug.resourceDelta = { ...effect.resourceDelta };
    }

    if (result.reshuffled) {
      logEvent("board_reshuffle", { reshuffled: true }, "WARN");
    }

    logEvent("turn_resolution", {
      boardBefore,
      boardAfter: cloneBoard(state.board),
      reshuffled: result.reshuffled,
    });

    return {
      ok: true,
      indexA,
      indexB,
      origin,
      boardBefore,
      boardAfter: cloneBoard(state.board),
      cascades: result.cascades,
      reshuffled: result.reshuffled,
    };
  }

  function playerCastSpell(spellId) {
    if (state.gameOver || state.turnOwner !== "player" || state.turnPhase !== "spell") {
      return { ok: false, reason: "not_spell_phase" };
    }

    const spellDef = SPELL_DEFS[spellId];
    if (!spellDef) {
      return { ok: false, reason: "unknown_spell" };
    }

    const result = castSpell({ state, caster: state.player, target: state.enemy, spellDef });
    if (!result.ok) {
      logEvent("spell_failed", { spellId, reason: result.reason });
      return result;
    }

    for (const event of result.events) {
      if (event.type === "spell_damage") {
        state.metrics.totalDamageDealt += event.damage.finalDamage;
      }
    }

    logEvent("spell_cast", {
      caster: state.player.name,
      spellId,
      manaCost: result.manaCost,
      cooldown: result.cooldown,
      effects: result.events,
      player: actorView(state.player),
      enemy: actorView(state.enemy),
    });

    state.lastAction = `Cast ${spellDef.name}`;
    state.replay.actions.push({ type: "cast_spell", spellId });
    finishIfNeeded();
    return result;
  }

  function playerSwap(indexA, indexB, options = {}) {
    const { autoEnemyTurn = true } = options;
    if (state.gameOver || state.turnOwner !== "player") {
      return { ok: false, reason: "not_player_turn" };
    }

    const resolved = resolveSwapByActor({
      actor: state.player,
      opponent: state.enemy,
      indexA,
      indexB,
      origin: "player",
    });

    if (!resolved.ok) {
      state.lastAction = resolved.reason === "non_adjacent" ? "Tiles must be adjacent." : "Swap must create a match.";
      return resolved;
    }

    state.replay.actions.push({ type: "swap", indexA, indexB });
    state.lastAction = `Player swap resolved (${resolved.cascades.length} cascades)`;

    if (finishIfNeeded()) {
      return resolved;
    }

    endTurn("player");
    beginTurn("enemy");
    if (autoEnemyTurn) {
      const enemyTurnResult = processEnemyTurn();
      return {
        ...resolved,
        enemyTurnResult,
      };
    }

    return resolved;
  }

  function enemyTrySpell() {
    for (const spellId of state.enemy.spells) {
      const spellDef = SPELL_DEFS[spellId];
      if (!spellDef) {
        continue;
      }

      const result = castSpell({ state, caster: state.enemy, target: state.player, spellDef });
      if (!result.ok) {
        continue;
      }

      for (const event of result.events) {
        if (event.type === "spell_damage") {
          state.metrics.totalDamageTaken += event.damage.finalDamage;
        }
      }

      logEvent("spell_cast", {
        caster: state.enemy.name,
        spellId,
        manaCost: result.manaCost,
        cooldown: result.cooldown,
        effects: result.events,
        player: actorView(state.player),
        enemy: actorView(state.enemy),
      });

      finishIfNeeded();
      return true;
    }

    return false;
  }

  function processEnemyTurn() {
    if (state.gameOver || state.turnOwner !== "enemy") {
      return { ok: false, reason: "not_enemy_turn", didMove: false, didCastSpell: false };
    }

    const didCastSpell = enemyTrySpell();
    if (state.gameOver) {
      return { ok: true, didMove: false, didCastSpell, move: null, resolved: null };
    }

    const move = chooseEnemyMove(state.board, state.enemy);
    if (!move) {
      state.statusText = "Enemy has no legal move. Turn passes.";
      endTurn("enemy");
      beginTurn("player");
      state.turnPhase = "spell";
      return { ok: true, didMove: false, didCastSpell, move: null, resolved: null };
    }

    const resolved = resolveSwapByActor({
      actor: state.enemy,
      opponent: state.player,
      indexA: move.indexA,
      indexB: move.indexB,
      origin: "enemy",
    });

    state.lastAction = `${state.enemy.name} moved (${move.indexA}<->${move.indexB})`;

    if (finishIfNeeded()) {
      return { ok: true, didMove: true, didCastSpell, move, resolved };
    }

    endTurn("enemy");
    beginTurn("player");
    state.turnPhase = "spell";
    return { ok: true, didMove: true, didCastSpell, move, resolved };
  }

  function skipSpellPhase(recordAction = true) {
    if (state.turnOwner !== "player" || state.turnPhase !== "spell") {
      return;
    }
    state.turnPhase = "swap";
    state.lastAction = "Spell phase skipped.";
    if (recordAction) {
      state.replay.actions.push({ type: "skip_spell_phase" });
    }
  }

  function getDebugSnapshot() {
    return {
      turnOwner: state.turnOwner,
      turnPhase: state.turnPhase,
      seed: state.seed,
      boardHash: hashBoard(state.board),
      lastMove: state.lastAction,
      cascadeLevel: state.debug.lastCascadeLevel,
      cascadeMultiplier: state.debug.lastCascadeMultiplier,
      resourceDelta: { ...state.debug.resourceDelta },
      player: actorView(state.player),
      enemy: actorView(state.enemy),
    };
  }

  function exportLogsJson() {
    return logger.exportJson();
  }

  function getReplayData() {
    return JSON.parse(JSON.stringify(state.replay));
  }

  function runReplay(replayData) {
    const replayEngine = createGameEngine({
      seed: replayData.seed,
      classId: replayData.classId,
      logLevel,
    });

    for (const action of replayData.actions) {
      if (action.type === "cast_spell") {
        replayEngine.playerCastSpell(action.spellId);
      } else if (action.type === "skip_spell_phase") {
        replayEngine.skipSpellPhase(false);
      } else if (action.type === "swap") {
        replayEngine.playerSwap(action.indexA, action.indexB);
      }

      if (replayEngine.state.gameOver) {
        break;
      }
    }

    return replayEngine;
  }

  startEncounter();
  beginTurn("player");

  return {
    state,
    playerCastSpell,
    playerSwap,
    skipSpellPhase,
    processEnemyTurn,
    getDebugSnapshot,
    exportLogsJson,
    getReplayData,
    runReplay,
    setLogLevel(level) {
      logger.setMinLevel(level);
    },
  };
}
