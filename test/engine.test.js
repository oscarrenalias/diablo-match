import { describe, expect, test } from "vitest";
import { createGameEngine } from "../src/game/engine.js";
import { findLegalMoves } from "../src/game/board.js";

function advanceUntilPlayerTurn(engine, guardMax = 20) {
  let guard = 0;
  while (engine.state.turnOwner !== "player" && !engine.state.gameOver && engine.state.outcome === "none" && guard < guardMax) {
    guard += 1;
    engine.processEnemyTurn();
  }
}

function forceVictory(engine) {
  engine.state.enemy.hp = 0;
  const legalMoves = findLegalMoves(engine.state.board);
  if (legalMoves.length === 0) {
    return false;
  }

  const move = legalMoves[0];
  if (engine.state.turnOwner !== "player") {
    advanceUntilPlayerTurn(engine);
  }
  if (engine.state.turnPhase === "spell") {
    engine.skipSpellPhase();
  }

  const result = engine.playerSwap(move.indexA, move.indexB, { autoEnemyTurn: false });
  return result.ok;
}

describe("engine replay determinism", () => {
  test("same replay produces identical board and actor states", () => {
    const engine = createGameEngine({ seed: "replay-seed", classId: "wizard" });

    advanceUntilPlayerTurn(engine);

    engine.playerCastSpell("fireball");
    engine.skipSpellPhase();

    let actionCount = 0;
    let guard = 0;
    while (actionCount < 3 && guard < 300) {
      guard += 1;

      if (engine.state.turnOwner !== "player") {
        engine.processEnemyTurn();
        continue;
      }

      if (engine.state.turnPhase === "spell") {
        engine.skipSpellPhase();
      }

      let moved = false;
      for (let i = 0; i < engine.state.board.length - 1; i += 1) {
        const result = engine.playerSwap(i, i + 1);
        if (result.ok) {
          actionCount += 1;
          moved = true;
          break;
        }
      }

      if (!moved) {
        break;
      }
    }

    const replay = engine.getReplayData();
    const replayed = engine.runReplay(replay);

    expect(replayed.getDebugSnapshot().boardHash).toBe(engine.getDebugSnapshot().boardHash);
    expect(replayed.state.player.hp).toBe(engine.state.player.hp);
    expect(replayed.state.enemy.hp).toBe(engine.state.enemy.hp);
  });

  test("logs include turn and cascade events", () => {
    const engine = createGameEngine({ seed: "log-seed", classId: "warrior", logLevel: "DEBUG" });

    advanceUntilPlayerTurn(engine);
    engine.skipSpellPhase();

    let found = false;
    for (let i = 0; i < engine.state.board.length - 1; i += 1) {
      const result = engine.playerSwap(i, i + 1);
      if (result.ok) {
        found = true;
        break;
      }
    }

    expect(found).toBe(true);
    const eventTypes = engine.state.logger.getEvents().map((e) => e.type);
    expect(eventTypes).toContain("turn_start");
    expect(eventTypes).toContain("turn_end");
    expect(eventTypes).toContain("swap_attempt");
  });

  test("completes multiple automated runs without soft-lock", () => {
    const seeds = ["run-a", "run-b", "run-c"];

    for (const seed of seeds) {
      const engine = createGameEngine({ seed, classId: "assassin", logLevel: "WARN" });

      let turns = 0;
      let softLocked = false;
      while (!engine.state.gameOver && turns < 400) {
        turns += 1;

        if (engine.state.outcome === "victory") {
          engine.continueAfterVictory();
          continue;
        }

        if (engine.state.turnOwner !== "player") {
          engine.processEnemyTurn();
          continue;
        }

        if (engine.state.turnPhase === "spell") {
          engine.skipSpellPhase();
        }

        const legalMoves = findLegalMoves(engine.state.board);
        if (legalMoves.length === 0) {
          softLocked = true;
          break;
        }

        const move = legalMoves[0];
        engine.playerSwap(move.indexA, move.indexB);
      }

      expect(turns).toBeLessThan(400);
      expect(softLocked).toBe(false);
      expect(engine.state.replay.actions.length).toBeGreaterThan(0);
    }
  });
});

describe("starting player and encounter outcomes", () => {
  test("starting roll metadata is logged on encounter start", () => {
    const engine = createGameEngine({ seed: "starter-roll-seed", classId: "warrior" });
    const encounterStart = engine.state.logger.getEvents().find((event) => event.type === "encounter_start");

    expect(encounterStart).toBeTruthy();
    expect(encounterStart.payload.playerRollTotal).toBeTypeOf("number");
    expect(encounterStart.payload.enemyRollTotal).toBeTypeOf("number");
    expect(["player", "enemy"]).toContain(encounterStart.payload.starter);
  });

  test("higher player LCK starts more frequently over many seeds", () => {
    let warriorStarts = 0;
    let assassinStarts = 0;

    for (let i = 0; i < 200; i += 1) {
      const warrior = createGameEngine({ seed: `start-warrior-${i}`, classId: "warrior" });
      const assassin = createGameEngine({ seed: `start-assassin-${i}`, classId: "assassin" });

      if (warrior.state.currentStarter === "player") {
        warriorStarts += 1;
      }
      if (assassin.state.currentStarter === "player") {
        assassinStarts += 1;
      }
    }

    expect(assassinStarts).toBeGreaterThan(warriorStarts);
  });

  test("victory blocks progression until continueAfterVictory is called", () => {
    const engine = createGameEngine({ seed: "victory-gate-seed", classId: "warrior" });
    engine.markEncounterIntroShown();

    advanceUntilPlayerTurn(engine);
    const won = forceVictory(engine);

    expect(won).toBe(true);
    expect(engine.state.outcome).toBe("victory");
    expect(engine.state.pendingEncounterStart).toBe(false);

    const beforeEncounter = engine.state.encounterIndex;
    const swapWhileVictorious = engine.playerSwap(0, 1, { autoEnemyTurn: false });
    expect(swapWhileVictorious.ok).toBe(false);

    const continued = engine.continueAfterVictory();
    expect(continued.ok).toBe(true);
    expect(engine.state.outcome).toBe("none");
    expect(engine.state.encounterIndex).toBe(beforeEncounter + 1);
    expect(engine.state.pendingEncounterStart).toBe(true);
  });
});
