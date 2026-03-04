import { describe, expect, test } from "vitest";
import { BOARD_HEIGHT, BOARD_WIDTH, TILE_ORDER, TILE_WEIGHTS } from "../src/game/constants.js";
import {
  createStartingBoard,
  generateBoard,
  hasAnyLegalMove,
  hasAnyMatches,
  reshuffleBoard,
} from "../src/game/board.js";
import { createRng } from "../src/game/rng.js";

describe("board generation", () => {
  test("generates 8x8 board", () => {
    const rng = createRng("alpha");
    const board = generateBoard({ rng });
    expect(board).toHaveLength(BOARD_WIDTH * BOARD_HEIGHT);
  });

  test("same seed yields same board", () => {
    const a = generateBoard({ rng: createRng("seed-123") });
    const b = generateBoard({ rng: createRng("seed-123") });

    expect(a).toEqual(b);
  });

  test("different seeds typically differ", () => {
    const a = generateBoard({ rng: createRng("seed-a") });
    const b = generateBoard({ rng: createRng("seed-b") });

    expect(a).not.toEqual(b);
  });

  test("distribution follows weights within tolerance", () => {
    const runs = 4000;
    const counts = Object.fromEntries(TILE_ORDER.map((tile) => [tile, 0]));

    for (let i = 0; i < runs; i += 1) {
      const board = generateBoard({ rng: createRng(`seed-${i}`) });
      for (const tile of board) {
        counts[tile] += 1;
      }
    }

    const total = runs * BOARD_WIDTH * BOARD_HEIGHT;
    const tolerance = 0.03;

    for (const tile of TILE_ORDER) {
      const observed = counts[tile] / total;
      expect(observed).toBeGreaterThan(TILE_WEIGHTS[tile] - tolerance);
      expect(observed).toBeLessThan(TILE_WEIGHTS[tile] + tolerance);
    }
  });

  test("starting boards have no immediate matches and at least one legal move", () => {
    const board = createStartingBoard({ rng: createRng("start-board") });
    expect(hasAnyMatches(board)).toBe(false);
    expect(hasAnyLegalMove(board)).toBe(true);
  });

  test("reshuffle resolves no-move board", () => {
    const board = [
      "weapon", "mana", "shield",
      "shield", "weapon", "mana",
      "mana", "shield", "weapon",
    ];

    expect(hasAnyLegalMove(board, 3, 3)).toBe(false);
    reshuffleBoard({ board, rng: createRng("reshuffle-1"), width: 3, height: 3 });
    expect(hasAnyLegalMove(board, 3, 3)).toBe(true);
    expect(hasAnyMatches(board, 3, 3)).toBe(false);
  });
});
