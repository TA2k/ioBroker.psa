"use strict";

function stripUndefinedValues(value) {
  if (Array.isArray(value)) {
    return value.map(stripUndefinedValues).filter((entry) => entry !== undefined);
  }

  if (value && typeof value === "object") {
    const cleaned = {};
    for (const [key, entry] of Object.entries(value)) {
      if (entry === undefined) {
        continue;
      }
      cleaned[key] = stripUndefinedValues(entry);
    }
    return cleaned;
  }

  return value;
}

function prepareLegacyPayload(payload) {
  if (payload === null || payload === undefined) {
    return {};
  }

  return stripUndefinedValues(payload);
}

module.exports = {
  prepareLegacyPayload,
  stripUndefinedValues,
};
