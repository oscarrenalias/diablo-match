export const BOARD_WIDTH = 8;
export const BOARD_HEIGHT = 8;

export const TILE_TYPES = {
  WEAPON: "weapon",
  MANA: "mana",
  SHIELD: "shield",
  SKILL: "skill",
  COIN: "coin",
  SPECIAL: "special",
};

export const TILE_ORDER = [
  TILE_TYPES.WEAPON,
  TILE_TYPES.MANA,
  TILE_TYPES.SHIELD,
  TILE_TYPES.SKILL,
  TILE_TYPES.COIN,
  TILE_TYPES.SPECIAL,
];

export const TILE_WEIGHTS = {
  [TILE_TYPES.WEAPON]: 0.25,
  [TILE_TYPES.MANA]: 0.2,
  [TILE_TYPES.SHIELD]: 0.2,
  [TILE_TYPES.SKILL]: 0.15,
  [TILE_TYPES.COIN]: 0.1,
  [TILE_TYPES.SPECIAL]: 0.1,
};

export const TILE_COLORS = {
  [TILE_TYPES.WEAPON]: 0xb33a3a,
  [TILE_TYPES.MANA]: 0x3f66d4,
  [TILE_TYPES.SHIELD]: 0x8f8f8f,
  [TILE_TYPES.SKILL]: 0x825ecf,
  [TILE_TYPES.COIN]: 0xcaa437,
  [TILE_TYPES.SPECIAL]: 0x56b88d,
};

export const CASCADE_MULTIPLIERS = [1, 2, 3, 4];

export const LOG_LEVELS = {
  DEBUG: 10,
  INFO: 20,
  WARN: 30,
  ERROR: 40,
};
