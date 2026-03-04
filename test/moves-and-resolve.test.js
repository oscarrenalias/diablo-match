import { describe, expect, test } from "vitest";
import { attemptSwap } from "../src/game/moves.js";
import { createRng } from "../src/game/rng.js";
import { resolveBoard } from "../src/game/resolve.js";
import { findMatches } from "../src/game/match.js";

describe("swap validation", () => {
  test("rejects non-adjacent swaps", () => {
    const board = [
      "weapon", "mana", "shield",
      "skill", "coin", "special",
      "weapon", "mana", "shield",
    ];

    const copy = board.slice();
    const result = attemptSwap({ board, indexA: 0, indexB: 8, width: 3, height: 3 });
    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("non_adjacent");
    expect(board).toEqual(copy);
  });

  test("rejects adjacent swaps that create no match", () => {
    const board = [
      "weapon", "mana", "shield",
      "skill", "coin", "special",
      "weapon", "mana", "shield",
    ];

    const copy = board.slice();
    const result = attemptSwap({ board, indexA: 0, indexB: 1, width: 3, height: 3 });
    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("no_match");
    expect(board).toEqual(copy);
  });

  test("keeps adjacent swaps that create at least one match", () => {
    const board = [
      "weapon", "mana", "weapon",
      "shield", "weapon", "coin",
      "special", "weapon", "skill",
    ];

    const result = attemptSwap({ board, indexA: 1, indexB: 4, width: 3, height: 3 });
    expect(result.accepted).toBe(true);
    expect(result.matches.length).toBeGreaterThan(0);
  });
});

describe("resolution loop", () => {
  test("resolves to a stable board with multiplier metadata", () => {
    const board = [
      "weapon", "weapon", "weapon", "mana",
      "mana", "shield", "skill", "coin",
      "mana", "shield", "skill", "coin",
      "mana", "shield", "skill", "coin",
    ];

    const result = resolveBoard({ board, rng: createRng("resolve-a"), width: 4, height: 4 });
    expect(result.cascades.length).toBeGreaterThan(0);
    expect(result.cascades[0].multiplier).toBe(1);
    expect(findMatches(board, 4, 4)).toEqual([]);
  });

  test("same seed + same initial board yields same result", () => {
    const startingBoard = [
      "weapon", "weapon", "weapon", "mana",
      "mana", "shield", "skill", "coin",
      "mana", "shield", "skill", "coin",
      "mana", "shield", "skill", "coin",
    ];

    const boardA = startingBoard.slice();
    const boardB = startingBoard.slice();

    const resultA = resolveBoard({ board: boardA, rng: createRng("stable-seed"), width: 4, height: 4 });
    const resultB = resolveBoard({ board: boardB, rng: createRng("stable-seed"), width: 4, height: 4 });

    expect(boardA).toEqual(boardB);
    expect(resultA).toEqual(resultB);
  });
});
