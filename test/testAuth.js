"use strict";

const { expect } = require("chai");
const { createAuthService, isSessionExpired, buildTokenRequest } = require("../lib/auth");
const { createPsaTransport } = require("../lib/transport");
const { DEFAULT_INTERVAL_MINUTES, normalizeInterval, parseStoredSession } = require("../lib/settings");

describe("PSA auth and transport isolation", function () {
  it("keeps valid persisted sessions intact and rejects only malformed values", function () {
    const legacySession = {
      access_token: "legacy-access-token",
      refresh_token: "legacy-refresh-token",
      expires_in: 3600,
      created_at: 1700000000000,
      custom_field: "preserved",
    };

    expect(parseStoredSession(JSON.stringify(legacySession))).to.deep.equal(legacySession);
    expect(parseStoredSession(legacySession)).to.deep.equal(legacySession);
    expect(parseStoredSession("not-json")).to.equal(null);
  });

  it("uses a safe default interval and preserves configured polling cadence", function () {
    expect(normalizeInterval(undefined)).to.equal(DEFAULT_INTERVAL_MINUTES);
    expect(normalizeInterval(0)).to.equal(0.5);
    expect(normalizeInterval(-1)).to.equal(0.5);
    expect(normalizeInterval("invalid")).to.equal(DEFAULT_INTERVAL_MINUTES);
    expect(normalizeInterval(0.1)).to.equal(0.5);
    expect(normalizeInterval(7)).to.equal(7);
  });

  it("detects an expired session before the expiry safety margin", function () {
    const session = {
      access_token: "abc",
      refresh_token: "xyz",
      expires_in: 60,
      created_at: Date.now() - 120 * 1000,
    };

    expect(isSessionExpired(session, 30 * 1000)).to.equal(true);
  });

  it("builds a refresh request without leaking secrets into the payload", function () {
    const request = buildTokenRequest({
      realm: "clientsB2CPeugeot",
      brand: "peugeot.com",
      refresh_token: "secret-refresh-token",
      grant_type: "refresh_token",
      basic: "Zm9vOmJhcg==",
    });

    expect(request.url).to.equal("https://idpcvs.peugeot.com/am/oauth2/access_token");
    expect(request.headers.Authorization).to.equal("Basic Zm9vOmJhcg==");
    expect(request.data.grant_type).to.equal("refresh_token");
    expect(request.data.refresh_token).to.equal("secret-refresh-token");
  });

  it("retries once after a 401 by refreshing the token before reissuing the request", async function () {
    let requestCount = 0;
    const tokenState = {
      session: {
        access_token: "expired-token",
        refresh_token: "refresh-token",
        expires_in: 3600,
        created_at: Date.now() - 3700 * 1000,
      },
      setState: async () => {},
    };

    const auth = createAuthService({
      brand: "peugeot.com",
      realm: "clientsB2CPeugeot",
      basic: "Zm9vOmJhcg==",
      http: {
        post: async ({ data }) => {
          if (data && data.grant_type === "refresh_token") {
            tokenState.session = {
              access_token: "fresh-token",
              refresh_token: "new-refresh-token",
              expires_in: 3600,
              created_at: Date.now(),
            };
            return { data: tokenState.session };
          }
          return { data: {} };
        },
      },
      storage: {
        load: async () => tokenState.session,
        save: async (session) => {
          tokenState.session = session;
        },
      },
    });

    const client = createPsaTransport({
      auth,
      log: { info() {}, warn() {}, error() {}, debug() {} },
      http: {
        request: async (_config) => {
          requestCount += 1;
          if (requestCount === 1) {
            const error = new Error("401");
            error.response = { status: 401, data: { error: "expired_token" } };
            throw error;
          }
          return { data: { ok: true } };
        },
      },
      brand: "peugeot.com",
      realm: "clientsB2CPeugeot",
      clientId: "client-123",
    });

    const result = await client.getJson("https://api.groupe-psa.com/connectedcar/v4/user/vehicles/veh1", {});
    expect(result.ok).to.equal(true);
    expect(requestCount).to.equal(2);
    expect(auth.getSession().access_token).to.equal("fresh-token");
  });

  it("shares one refresh request between concurrent callers", async function () {
    let refreshCount = 0;
    const session = {
      access_token: "expired-token",
      refresh_token: "refresh-token",
      expires_in: 3600,
      created_at: Date.now() - 3700 * 1000,
    };
    const auth = createAuthService({
      brand: "peugeot.com",
      realm: "clientsB2CPeugeot",
      basic: "Zm9vOmJhcg==",
      http: {
        post: async () => {
          refreshCount += 1;
          await new Promise((resolve) => setTimeout(resolve, 5));
          return {
            data: {
              access_token: "fresh-token",
              refresh_token: "rotated-refresh-token",
              expires_in: 3600,
            },
          };
        },
      },
      storage: {
        load: async () => session,
        save: async (updatedSession) => Object.assign(session, updatedSession),
      },
    });

    const [first, second] = await Promise.all([auth.refreshToken(), auth.refreshToken()]);

    expect(refreshCount).to.equal(1);
    expect(first.access_token).to.equal("fresh-token");
    expect(second.refresh_token).to.equal("rotated-refresh-token");
  });
});
