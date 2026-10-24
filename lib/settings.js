"use strict";

const DEFAULT_INTERVAL_MINUTES = 5;
const MIN_INTERVAL_MINUTES = 0.5;

function normalizeInterval(value) {
  const interval = Number(value);
  if (!Number.isFinite(interval)) {
    return DEFAULT_INTERVAL_MINUTES;
  }
  return Math.max(interval, MIN_INTERVAL_MINUTES);
}

function parseStoredSession(value) {
  if (!value) {
    return null;
  }

  let session = value;
  if (typeof value === "string") {
    try {
      session = JSON.parse(value);
    } catch {
      return null;
    }
  }

  if (!session || typeof session !== "object" || Array.isArray(session)) {
    return null;
  }

  return session;
}

module.exports = {
  DEFAULT_INTERVAL_MINUTES,
  MIN_INTERVAL_MINUTES,
  normalizeInterval,
  parseStoredSession,
};
