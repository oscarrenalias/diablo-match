import { describe, expect, test } from "vitest";
import { createGameEngine } from "../src/game/engine.js";
import { findLegalMoves } from "../src/game/board.js";

describe("engine replay determinism", () => {
  test("same replay produces identical board and actor states", () => {
    const engine = createGameEngine({ seed: "replay-seed", classId: "wizard" });

    engine.playerCastSpell("fireball");
    engine.skipSpellPhase();

    let actionCount = 0;
    let guard = 0;
    while (actionCount < 3 && guard < 300) {
      guard += 1;
      if (engine.state.turnOwner !== "player") {
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
        if (engine.state.turnOwner !== "player") {
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
