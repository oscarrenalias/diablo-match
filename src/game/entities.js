import { TILE_TYPES } from "./constants.js";

export const CLASSES = {
  warrior: {
    id: "warrior",
    name: "Warrior",
    attributes: { STR: 8, INT: 3, DEX: 4, VIT: 7, LCK: 2 },
    spells: ["battle_shout"],
  },
  wizard: {
    id: "wizard",
    name: "Wizard",
    attributes: { STR: 2, INT: 9, DEX: 4, VIT: 5, LCK: 3 },
    spells: ["fireball"],
  },
  assassin: {
    id: "assassin",
    name: "Assassin",
    attributes: { STR: 4, INT: 3, DEX: 9, VIT: 4, LCK: 7 },
    spells: ["poison_blade"],
  },
};

export const ENEMY_ARCHETYPES = [
  {
    id: "skeleton_warrior",
    name: "Skeleton Warrior",
    hp: 90,
    attack: 10,
    armor: 0,
    resistances: { poison: 0.5 },
    aiPriorities: [TILE_TYPES.WEAPON, TILE_TYPES.SHIELD, TILE_TYPES.MANA],
    damageType: "physical",
    spells: [],
  },
  {
    id: "ghost",
    name: "Ghost",
    hp: 70,
    attack: 8,
    armor: 2,
    resistances: { physical: 0.5 },
    aiPriorities: [TILE_TYPES.MANA, TILE_TYPES.SKILL, TILE_TYPES.WEAPON],
    damageType: "cold",
    spells: ["haunt"],
  },
  {
    id: "skeleton_archer",
    name: "Skeleton Archer",
    hp: 75,
    attack: 12,
    armor: 0,
    resistances: {},
    aiPriorities: [TILE_TYPES.WEAPON, TILE_TYPES.COIN, TILE_TYPES.MANA],
    damageType: "physical",
    spells: [],
  },
  {
    id: "necromancer",
    name: "Necromancer",
    hp: 100,
    attack: 6,
    armor: 1,
    resistances: { poison: 0.5 },
    aiPriorities: [TILE_TYPES.MANA, TILE_TYPES.SKILL, TILE_TYPES.WEAPON],
    damageType: "poison",
    spells: ["raise_skeleton"],
  },
];

export const SPELL_DEFS = {
  battle_shout: {
    id: "battle_shout",
    name: "Battle Shout",
    manaCost: 8,
    cooldown: 3,
    owner: "player",
    resolve(state, caster) {
      caster.effects.weaponBuffTurns = 2;
      caster.effects.weaponBuffMultiplier = 1.5;
      return { kind: "buff", description: "Weapon damage boosted for 2 turns." };
    },
  },
  fireball: {
    id: "fireball",
    name: "Fireball",
    manaCost: 10,
    cooldown: 2,
    owner: "player",
    resolve(state, caster, target) {
      const dmg = Math.round(14 * (1 + caster.attributes.INT * 0.05));
      return { kind: "damage", amount: dmg, damageType: "fire", description: `Fireball hits for ${dmg}.` };
    },
  },
  poison_blade: {
    id: "poison_blade",
    name: "Poison Blade",
    manaCost: 9,
    cooldown: 3,
    owner: "player",
    resolve(state, caster) {
      caster.effects.poisonBladeTurns = 3;
      return { kind: "buff", description: "Weapon matches apply poison for 3 turns." };
    },
  },
  haunt: {
    id: "haunt",
    name: "Haunt",
    manaCost: 8,
    cooldown: 3,
    owner: "enemy",
    resolve() {
      return { kind: "debuff", effect: "frost", turns: 2, description: "Player damage reduced by frost." };
    },
  },
  raise_skeleton: {
    id: "raise_skeleton",
    name: "Raise Skeleton",
    manaCost: 12,
    cooldown: 4,
    owner: "enemy",
    resolve() {
      return { kind: "damage", amount: 10, damageType: "poison", description: "Necromantic blast for 10." };
    },
  },
};

function deriveStats(attributes) {
  return {
    maxHp: 80 + attributes.VIT * 12,
    critChance: 0.05 + attributes.DEX * 0.003,
    spellPower: 1 + attributes.INT * 0.05,
  };
}

export function createPlayer(classId = "warrior") {
  const template = CLASSES[classId] ?? CLASSES.warrior;
  const derived = deriveStats(template.attributes);

  return {
    type: "player",
    classId: template.id,
    name: template.name,
    attributes: { ...template.attributes },
    derived,
    maxHp: derived.maxHp,
    hp: derived.maxHp,
    mana: 20,
    armor: 0,
    skillCharge: 0,
    gold: 0,
    cooldowns: {},
    effects: {
      weaponBuffTurns: 0,
      weaponBuffMultiplier: 1,
      poisonBladeTurns: 0,
      poisonStacks: 0,
      burnTurns: 0,
      frostTurns: 0,
      shockTurns: 0,
      bleedTurns: 0,
    },
    spells: template.spells.slice(),
  };
}

export function createEnemy(archetype, tier = 1) {
  const hpScale = 1 + (tier - 1) * 0.12;
  const atkScale = 1 + (tier - 1) * 0.08;

  return {
    type: "enemy",
    id: archetype.id,
    name: archetype.name,
    lck: archetype.lck ?? 0,
    hp: Math.round(archetype.hp * hpScale),
    maxHp: Math.round(archetype.hp * hpScale),
    attack: Math.round(archetype.attack * atkScale),
    mana: 0,
    armor: archetype.armor,
    resistances: { ...archetype.resistances },
    aiPriorities: archetype.aiPriorities.slice(),
    damageType: archetype.damageType,
    cooldowns: {},
    effects: {
      poisonStacks: 0,
      burnTurns: 0,
      frostTurns: 0,
      shockTurns: 0,
      bleedTurns: 0,
    },
    spells: archetype.spells.slice(),
  };
}
