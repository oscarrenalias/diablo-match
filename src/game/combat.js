import { TILE_TYPES } from "./constants.js";

function clampMin0(value) {
  return Math.max(0, Math.round(value));
}

function applyDamage(target, rawDamage, damageType = "physical") {
  const resistance = target.resistances?.[damageType] ?? 0;
  const afterResistance = Math.max(0, rawDamage * (1 - resistance));

  const armorMitigated = Math.min(target.armor, afterResistance);
  target.armor = clampMin0(target.armor - armorMitigated);

  const finalDamage = clampMin0(afterResistance - armorMitigated);
  target.hp = clampMin0(target.hp - finalDamage);

  return {
    resistance,
    armorMitigated,
    finalDamage,
  };
}

function applyStatusFromDamage(attacker, target, damageType) {
  if (damageType === "fire") {
    target.effects.burnTurns = Math.max(target.effects.burnTurns ?? 0, 2);
    return "burn";
  }
  if (damageType === "poison") {
    target.effects.poisonStacks = (target.effects.poisonStacks ?? 0) + 1;
    return "poison";
  }
  if (damageType === "cold") {
    target.effects.frostTurns = Math.max(target.effects.frostTurns ?? 0, 2);
    return "frost";
  }
  if (damageType === "lightning") {
    target.effects.shockTurns = Math.max(target.effects.shockTurns ?? 0, 1);
    return "shock";
  }
  if (damageType === "physical") {
    target.effects.bleedTurns = Math.max(target.effects.bleedTurns ?? 0, 1);
    return "bleed";
  }
  return null;
}

function buildTileCounts(cascade) {
  const counts = {
    [TILE_TYPES.WEAPON]: 0,
    [TILE_TYPES.MANA]: 0,
    [TILE_TYPES.SHIELD]: 0,
    [TILE_TYPES.SKILL]: 0,
    [TILE_TYPES.COIN]: 0,
    [TILE_TYPES.SPECIAL]: 0,
  };

  for (const match of cascade.matches) {
    if (match.length === 0) {
      continue;
    }
    const tileType = cascade.boardBefore[match[0]];
    counts[tileType] += match.length;
  }

  return counts;
}

function damageTypeForAttacker(attacker) {
  if (attacker.type === "enemy") {
    return attacker.damageType;
  }
  if (attacker.effects.poisonBladeTurns > 0) {
    return "poison";
  }
  return "physical";
}

function weaponBase(attacker) {
  if (attacker.type === "enemy") {
    return attacker.attack;
  }
  return 6 + attacker.attributes.STR;
}

function computeWeaponDamage(attacker, tiles, multiplier, rng) {
  let dmg = weaponBase(attacker) * tiles * multiplier;

  if (attacker.type === "player") {
    dmg *= 1 + attacker.attributes.STR * 0.05;
    if (attacker.effects.weaponBuffTurns > 0) {
      dmg *= attacker.effects.weaponBuffMultiplier;
    }
    if (attacker.effects.frostTurns > 0) {
      dmg *= 0.75;
    }

    const critRoll = rng.next();
    if (critRoll < attacker.derived.critChance) {
      dmg *= 2;
    }
  }

  return clampMin0(dmg);
}

function applySpellResult(state, caster, target, result) {
  if (!result) {
    return { events: [] };
  }

  const events = [];

  if (result.kind === "damage") {
    const damage = applyDamage(target, result.amount, result.damageType ?? "physical");
    const status = applyStatusFromDamage(caster, target, result.damageType ?? "physical");
    events.push({
      type: "spell_damage",
      result,
      damage,
      status,
    });
  } else if (result.kind === "debuff") {
    target.effects.frostTurns = Math.max(target.effects.frostTurns ?? 0, result.turns ?? 2);
    events.push({ type: "spell_debuff", result });
  } else {
    events.push({ type: "spell_buff", result });
  }

  return { events };
}

export function tickStatusEffects(actor) {
  const events = [];

  if ((actor.effects.poisonStacks ?? 0) > 0) {
    const poisonDamage = actor.effects.poisonStacks * 3;
    actor.hp = clampMin0(actor.hp - poisonDamage);
    events.push({ type: "poison_tick", amount: poisonDamage });
  }

  if ((actor.effects.burnTurns ?? 0) > 0) {
    actor.hp = clampMin0(actor.hp - 4);
    actor.effects.burnTurns -= 1;
    events.push({ type: "burn_tick", amount: 4 });
  }

  if ((actor.effects.bleedTurns ?? 0) > 0) {
    actor.hp = clampMin0(actor.hp - 3);
    actor.effects.bleedTurns -= 1;
    events.push({ type: "bleed_tick", amount: 3 });
  }

  if ((actor.effects.frostTurns ?? 0) > 0) {
    actor.effects.frostTurns -= 1;
  }

  if ((actor.effects.shockTurns ?? 0) > 0) {
    actor.effects.shockTurns -= 1;
  }

  return events;
}

export function decayTemporaryEffects(actor) {
  if (actor.type === "player") {
    if (actor.effects.weaponBuffTurns > 0) {
      actor.effects.weaponBuffTurns -= 1;
      if (actor.effects.weaponBuffTurns === 0) {
        actor.effects.weaponBuffMultiplier = 1;
      }
    }

    if (actor.effects.poisonBladeTurns > 0) {
      actor.effects.poisonBladeTurns -= 1;
    }
  }

  for (const spellId of actor.spells ?? []) {
    actor.cooldowns[spellId] = Math.max(0, (actor.cooldowns[spellId] ?? 0) - 1);
  }

  actor.armor = clampMin0(actor.armor - 1);
}

export function applyCascadeEffects({ state, attacker, defender, cascade, rng }) {
  const tileCounts = buildTileCounts(cascade);
  const resourceDelta = { hp: 0, mana: 0, armor: 0, skillCharge: 0, gold: 0 };
  const events = [];

  if (tileCounts[TILE_TYPES.WEAPON] > 0) {
    const damageType = damageTypeForAttacker(attacker);
    const raw = computeWeaponDamage(attacker, tileCounts[TILE_TYPES.WEAPON], cascade.multiplier, rng);
    const damage = applyDamage(defender, raw, damageType);
    const status = applyStatusFromDamage(attacker, defender, damageType);

    resourceDelta.hp -= damage.finalDamage;
    events.push({ type: "weapon_damage", raw, damageType, damage, status });
  }

  if (tileCounts[TILE_TYPES.MANA] > 0) {
    const gain = clampMin0(tileCounts[TILE_TYPES.MANA] * 2 * cascade.multiplier);
    attacker.mana = clampMin0(attacker.mana + gain);
    resourceDelta.mana += gain;
    events.push({ type: "mana_gain", gain });
  }

  if (tileCounts[TILE_TYPES.SHIELD] > 0) {
    const gain = clampMin0(tileCounts[TILE_TYPES.SHIELD] * 2 * cascade.multiplier);
    attacker.armor = clampMin0(attacker.armor + gain);
    resourceDelta.armor += gain;
    events.push({ type: "armor_gain", gain });
  }

  if (tileCounts[TILE_TYPES.SKILL] > 0) {
    const gain = clampMin0(tileCounts[TILE_TYPES.SKILL] * cascade.multiplier);
    attacker.skillCharge = clampMin0((attacker.skillCharge ?? 0) + gain);
    resourceDelta.skillCharge += gain;
    events.push({ type: "skill_gain", gain });
  }

  if (tileCounts[TILE_TYPES.COIN] > 0 && attacker.type === "player") {
    const gain = clampMin0(tileCounts[TILE_TYPES.COIN] * cascade.multiplier);
    attacker.gold = clampMin0(attacker.gold + gain);
    resourceDelta.gold += gain;
    events.push({ type: "gold_gain", gain });
  }

  if (tileCounts[TILE_TYPES.SPECIAL] > 0) {
    const gain = clampMin0(tileCounts[TILE_TYPES.SPECIAL] * cascade.multiplier);
    attacker.mana = clampMin0(attacker.mana + gain);
    resourceDelta.mana += gain;
    events.push({ type: "special_bonus", gain });
  }

  return { tileCounts, resourceDelta, events };
}

export function castSpell({ state, caster, target, spellDef }) {
  const cooldownLeft = caster.cooldowns[spellDef.id] ?? 0;
  if (cooldownLeft > 0) {
    return { ok: false, reason: "cooldown" };
  }

  if (caster.mana < spellDef.manaCost) {
    return { ok: false, reason: "mana" };
  }

  caster.mana -= spellDef.manaCost;
  caster.cooldowns[spellDef.id] = spellDef.cooldown;

  const result = spellDef.resolve(state, caster, target);
  const applied = applySpellResult(state, caster, target, result);

  return {
    ok: true,
    result,
    events: applied.events,
    manaCost: spellDef.manaCost,
    cooldown: spellDef.cooldown,
  };
}
