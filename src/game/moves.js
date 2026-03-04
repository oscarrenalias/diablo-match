import { BOARD_HEIGHT, BOARD_WIDTH } from "./constants.js";
import { areAdjacent, cloneBoard, swapTiles } from "./board.js";
import { findMatches } from "./match.js";
import { resolveBoard } from "./resolve.js";

export function attemptSwap({
  board,
  indexA,
  indexB,
  width = BOARD_WIDTH,
  height = BOARD_HEIGHT,
}) {
  if (!areAdjacent(indexA, indexB, width, height)) {
    return {
      accepted: false,
      reason: "non_adjacent",
      matches: [],
    };
  }

  swapTiles(board, indexA, indexB);
  const matches = findMatches(board, width, height);

  if (matches.length === 0) {
    swapTiles(board, indexA, indexB);
    return {
      accepted: false,
      reason: "no_match",
      matches: [],
    };
  }

  return {
    accepted: true,
    reason: null,
    matches,
  };
}

export function attemptSwapAndResolve({
  board,
  rng,
  indexA,
  indexB,
  width = BOARD_WIDTH,
  height = BOARD_HEIGHT,
  weights,
  tileOrder,
  onCascadeStep,
}) {
  const before = cloneBoard(board);
  const swapResult = attemptSwap({ board, indexA, indexB, width, height });

  if (!swapResult.accepted) {
    return {
      ...swapResult,
      cascades: [],
      reshuffled: false,
      boardBefore: before,
      boardAfter: cloneBoard(board),
    };
  }

  const { cascades, reshuffled } = resolveBoard({
    board,
    rng,
    width,
    height,
    weights,
    tileOrder,
    onStep: onCascadeStep,
  });

  return {
    ...swapResult,
    cascades,
    reshuffled,
    boardBefore: before,
    boardAfter: cloneBoard(board),
  };
}
