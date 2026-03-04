import { describe, expect, test } from "vitest";
import { findMatches } from "../src/game/match.js";

describe("match detection", () => {
  test("detects horizontal match", () => {
    const board = [
      "weapon", "weapon", "weapon", "mana",
      "mana", "shield", "skill", "coin",
      "mana", "shield", "skill", "coin",
      "mana", "shield", "skill", "coin",
    ];

    const matches = findMatches(board, 4, 4);
    expect(matches.some((m) => m.length === 3 && m.includes(0) && m.includes(1) && m.includes(2))).toBe(true);
  });

  test("detects vertical match", () => {
    const board = [
      "weapon", "mana", "shield", "skill",
      "weapon", "coin", "shield", "skill",
      "weapon", "coin", "special", "skill",
      "mana", "coin", "special", "skill",
    ];

    const matches = findMatches(board, 4, 4);
    expect(matches.some((m) => m.length === 3 && m.includes(0) && m.includes(4) && m.includes(8))).toBe(true);
  });

  test("returns empty when no match exists", () => {
    const board = [
      "weapon", "mana", "shield",
      "mana", "shield", "skill",
      "coin", "special", "weapon",
    ];

    const matches = findMatches(board, 3, 3);
    expect(matches).toEqual([]);
  });

  test("cross patterns are reported as independent matches", () => {
    const board = [
      "mana", "weapon", "mana",
      "weapon", "weapon", "weapon",
      "mana", "weapon", "mana",
    ];

    const matches = findMatches(board, 3, 3);
    expect(matches).toHaveLength(2);
  });
});
