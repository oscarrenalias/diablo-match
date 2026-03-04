import { BOARD_HEIGHT, BOARD_WIDTH, TILE_TYPES } from "./constants.js";
import { findLegalMoves, swapTiles } from "./board.js";
import { findMatches } from "./match.js";

function scoreMove(board, move, enemy) {
  swapTiles(board, move.indexA, move.indexB);
  const matches = findMatches(board, BOARD_WIDTH, BOARD_HEIGHT);
  const matchTileTypes = matches.map((group) => board[group[0]]);
  swapTiles(board, move.indexA, move.indexB);

  const sizeScore = matches.reduce((sum, group) => sum + group.length, 0);

  let priorityScore = 0;
  for (let i = 0; i < matches.length; i += 1) {
    const group = matches[i];
    const tileType = matchTileTypes[i];
    const idx = enemy.aiPriorities.indexOf(tileType);
    if (idx >= 0) {
      priorityScore += (enemy.aiPriorities.length - idx) * group.length;
    }
  }

  const weaponBonus = matches.some((m) => board[m[0]] === TILE_TYPES.WEAPON) ? 8 : 0;
  return sizeScore * 2 + priorityScore + weaponBonus;
}

export function chooseEnemyMove(board, enemy) {
  const legalMoves = findLegalMoves(board, BOARD_WIDTH, BOARD_HEIGHT);
  if (legalMoves.length === 0) {
    return null;
  }

  let best = legalMoves[0];
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const move of legalMoves) {
    const score = scoreMove(board, move, enemy);
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }

  return best;
}
