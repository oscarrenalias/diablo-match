import { BOARD_HEIGHT, BOARD_WIDTH, TILE_ORDER, TILE_WEIGHTS } from "./constants.js";
import { findMatches } from "./match.js";

export function indexAt(x, y, width = BOARD_WIDTH) {
  return y * width + x;
}

export function coordsAt(index, width = BOARD_WIDTH) {
  return {
    x: index % width,
    y: Math.floor(index / width),
  };
}

export function createWeightedPicker(weights = TILE_WEIGHTS, tileOrder = TILE_ORDER) {
  const cumulative = [];
  let runningTotal = 0;

  for (const tileType of tileOrder) {
    runningTotal += weights[tileType] ?? 0;
    cumulative.push([tileType, runningTotal]);
  }

  return function pickTile(rng) {
    const roll = rng.next() * runningTotal;
    for (const [tileType, upper] of cumulative) {
      if (roll < upper) {
        return tileType;
      }
    }

    return tileOrder[tileOrder.length - 1];
  };
}

export function generateBoard({
  rng,
  width = BOARD_WIDTH,
  height = BOARD_HEIGHT,
  weights = TILE_WEIGHTS,
  tileOrder = TILE_ORDER,
}) {
  const pickTile = createWeightedPicker(weights, tileOrder);
  const size = width * height;
  const board = new Array(size);

  for (let i = 0; i < size; i += 1) {
    board[i] = pickTile(rng);
  }

  return board;
}

export function cloneBoard(board) {
  return board.slice();
}

export function areAdjacent(indexA, indexB, width = BOARD_WIDTH, height = BOARD_HEIGHT) {
  if (indexA < 0 || indexB < 0 || indexA >= width * height || indexB >= width * height) {
    return false;
  }

  const a = coordsAt(indexA, width);
  const b = coordsAt(indexB, width);

  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);

  return dx + dy === 1;
}

export function swapTiles(board, indexA, indexB) {
  const temp = board[indexA];
  board[indexA] = board[indexB];
  board[indexB] = temp;
}

export function hasAnyMatches(board, width = BOARD_WIDTH, height = BOARD_HEIGHT) {
  return findMatches(board, width, height).length > 0;
}

export function findLegalMoves(board, width = BOARD_WIDTH, height = BOARD_HEIGHT) {
  const legalMoves = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = indexAt(x, y, width);
      const neighbors = [];
      if (x + 1 < width) {
        neighbors.push(indexAt(x + 1, y, width));
      }
      if (y + 1 < height) {
        neighbors.push(indexAt(x, y + 1, width));
      }

      for (const neighbor of neighbors) {
        swapTiles(board, index, neighbor);
        const matched = hasAnyMatches(board, width, height);
        swapTiles(board, index, neighbor);

        if (matched) {
          legalMoves.push({ indexA: index, indexB: neighbor });
        }
      }
    }
  }

  return legalMoves;
}

export function hasAnyLegalMove(board, width = BOARD_WIDTH, height = BOARD_HEIGHT) {
  return findLegalMoves(board, width, height).length > 0;
}

export function createStartingBoard({
  rng,
  width = BOARD_WIDTH,
  height = BOARD_HEIGHT,
  weights = TILE_WEIGHTS,
  tileOrder = TILE_ORDER,
  maxAttempts = 500,
}) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const board = generateBoard({ rng, width, height, weights, tileOrder });
    if (!hasAnyMatches(board, width, height) && hasAnyLegalMove(board, width, height)) {
      return board;
    }
  }

  throw new Error("Unable to generate starting board with no matches and at least one legal move");
}

export function reshuffleBoard({
  board,
  rng,
  width = BOARD_WIDTH,
  height = BOARD_HEIGHT,
  weights = TILE_WEIGHTS,
  tileOrder = TILE_ORDER,
  maxAttempts = 500,
}) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const next = generateBoard({ rng, width, height, weights, tileOrder });
    if (!hasAnyMatches(next, width, height) && hasAnyLegalMove(next, width, height)) {
      for (let i = 0; i < board.length; i += 1) {
        board[i] = next[i];
      }
      return board;
    }
  }

  throw new Error("Unable to reshuffle board into legal state");
}
