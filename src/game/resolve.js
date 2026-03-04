import { BOARD_HEIGHT, BOARD_WIDTH, CASCADE_MULTIPLIERS, TILE_ORDER, TILE_WEIGHTS } from "./constants.js";
import { cloneBoard, createWeightedPicker, hasAnyLegalMove, indexAt, reshuffleBoard } from "./board.js";
import { collectMatchedIndices, findMatches } from "./match.js";

export function clearMatches(board, matches) {
  const toClear = collectMatchedIndices(matches);
  for (const index of toClear) {
    board[index] = null;
  }
  return toClear;
}

export function applyGravity(board, width = BOARD_WIDTH, height = BOARD_HEIGHT) {
  const drops = [];

  for (let x = 0; x < width; x += 1) {
    let writeY = height - 1;

    for (let y = height - 1; y >= 0; y -= 1) {
      const readIndex = indexAt(x, y, width);
      const value = board[readIndex];
      if (value == null) {
        continue;
      }

      const writeIndex = indexAt(x, writeY, width);
      board[writeIndex] = value;
      if (writeIndex !== readIndex) {
        board[readIndex] = null;
        drops.push({ tile: value, from: readIndex, to: writeIndex });
      }
      writeY -= 1;
    }

    for (let y = writeY; y >= 0; y -= 1) {
      board[indexAt(x, y, width)] = null;
    }
  }

  return drops;
}

export function refillBoard({
  board,
  rng,
  width = BOARD_WIDTH,
  height = BOARD_HEIGHT,
  weights = TILE_WEIGHTS,
  tileOrder = TILE_ORDER,
}) {
  const pickTile = createWeightedPicker(weights, tileOrder);
  const spawned = [];

  for (let i = 0; i < width * height; i += 1) {
    if (board[i] == null) {
      const tile = pickTile(rng);
      board[i] = tile;
      spawned.push({ index: i, tile });
    }
  }

  return spawned;
}

function multiplierForLevel(level) {
  return CASCADE_MULTIPLIERS[Math.min(level, CASCADE_MULTIPLIERS.length - 1)];
}

export function resolveBoard({
  board,
  rng,
  width = BOARD_WIDTH,
  height = BOARD_HEIGHT,
  weights = TILE_WEIGHTS,
  tileOrder = TILE_ORDER,
  onStep,
}) {
  const cascades = [];
  let level = 0;

  while (true) {
    const boardBefore = cloneBoard(board);
    const matches = findMatches(board, width, height);
    if (matches.length === 0) {
      break;
    }

    const cleared = clearMatches(board, matches);
    const drops = applyGravity(board, width, height);
    const spawns = refillBoard({ board, rng, width, height, weights, tileOrder });

    const entry = {
      level,
      multiplier: multiplierForLevel(level),
      boardBefore,
      matches,
      clearedIndices: [...cleared],
      drops,
      spawns,
    };

    cascades.push(entry);
    if (onStep) {
      onStep(entry);
    }

    level += 1;
  }

  let reshuffled = false;
  if (!hasAnyLegalMove(board, width, height)) {
    reshuffleBoard({ board, rng, width, height, weights, tileOrder });
    reshuffled = true;
  }

  return { cascades, reshuffled };
}
