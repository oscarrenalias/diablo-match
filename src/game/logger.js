import { LOG_LEVELS } from "./constants.js";

function stableStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  const keys = Object.keys(value).sort();
  const body = keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(",");
  return `{${body}}`;
}

export function hashBoard(board) {
  const serialized = board.join("|");
  let hash = 2166136261;
  for (let i = 0; i < serialized.length; i += 1) {
    hash ^= serialized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

export function createEventLogger({ seed, minLevel = LOG_LEVELS.INFO }) {
  const events = [];

  function emit(levelName, type, payload = {}) {
    const level = LOG_LEVELS[levelName] ?? LOG_LEVELS.INFO;
    if (level < minLevel) {
      return;
    }

    events.push({
      index: events.length,
      level: levelName.toLowerCase(),
      type,
      seed,
      timestamp: Date.now(),
      payload: JSON.parse(stableStringify(payload)),
    });
  }

  return {
    emit,
    getEvents() {
      return events.slice();
    },
    clear() {
      events.length = 0;
    },
    setMinLevel(levelName) {
      minLevel = LOG_LEVELS[levelName] ?? LOG_LEVELS.INFO;
    },
    exportJson() {
      return JSON.stringify(events, null, 2);
    },
  };
}
