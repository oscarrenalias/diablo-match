import { BOARD_HEIGHT, BOARD_WIDTH } from "../game/constants.js";

export const TILE_SIZE = 56;
export const TILE_GAP = 4;

export let BOARD_INNER_X = 0;
export let BOARD_INNER_Y = 0;
export let BOARD_INNER_W = 0;
export let BOARD_INNER_H = 0;

export function setBoardInnerRect({ x, y, w, h }) {
  const gridWidth = BOARD_WIDTH * TILE_SIZE + (BOARD_WIDTH - 1) * TILE_GAP;
  const gridHeight = BOARD_HEIGHT * TILE_SIZE + (BOARD_HEIGHT - 1) * TILE_GAP;

  BOARD_INNER_W = Math.round(w);
  BOARD_INNER_H = Math.round(h);
  BOARD_INNER_X = Math.round(x + (w - gridWidth) / 2);
  BOARD_INNER_Y = Math.round(y + (h - gridHeight) / 2);
}
