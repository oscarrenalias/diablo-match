import { BOARD_HEIGHT, BOARD_WIDTH } from "./constants.js";
import { indexAt } from "./board.js";

function detectHorizontalMatches(board, width, height) {
  const matches = [];

  for (let y = 0; y < height; y += 1) {
    let runStart = 0;

    for (let x = 1; x <= width; x += 1) {
      const prevIndex = indexAt(x - 1, y, width);
      const currIndex = x < width ? indexAt(x, y, width) : -1;
      const prevTile = board[prevIndex];
      const currTile = x < width ? board[currIndex] : null;

      if (x < width && prevTile === currTile) {
        continue;
      }

      const runLength = x - runStart;
      if (runLength >= 3 && prevTile != null) {
        const group = [];
        for (let mx = runStart; mx < x; mx += 1) {
          group.push(indexAt(mx, y, width));
        }
        matches.push(group);
      }

      runStart = x;
    }
  }

  return matches;
}

function detectVerticalMatches(board, width, height) {
  const matches = [];

  for (let x = 0; x < width; x += 1) {
    let runStart = 0;

    for (let y = 1; y <= height; y += 1) {
      const prevIndex = indexAt(x, y - 1, width);
      const currIndex = y < height ? indexAt(x, y, width) : -1;
      const prevTile = board[prevIndex];
      const currTile = y < height ? board[currIndex] : null;

      if (y < height && prevTile === currTile) {
        continue;
      }

      const runLength = y - runStart;
      if (runLength >= 3 && prevTile != null) {
        const group = [];
        for (let my = runStart; my < y; my += 1) {
          group.push(indexAt(x, my, width));
        }
        matches.push(group);
      }

      runStart = y;
    }
  }

  return matches;
}

export function findMatches(board, width = BOARD_WIDTH, height = BOARD_HEIGHT) {
  return [
    ...detectHorizontalMatches(board, width, height),
    ...detectVerticalMatches(board, width, height),
  ];
}

export function collectMatchedIndices(matches) {
  const seen = new Set();
  for (const match of matches) {
    for (const index of match) {
      seen.add(index);
    }
  }
  return seen;
}
