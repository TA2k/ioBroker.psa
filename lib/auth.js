"use strict";

/** @typedef {Record<string, any> & {access_token?: string, refresh_token?: string, expires_in?: number, created_at?: number, expires_at?: number}} Session */

/**
 * @param {Session | null | undefined} session
 * @returns {Session}
 */
function normalizeSession(session) {
  if (!session || typeof session !== "object") {
    return {};
  }

  const normalized = { ...session };
  if (normalized.expires_in && !normalized.created_at) {
    normalized.created_at = Date.now();
  }

  if (normalized.expires_in && !normalized.expires_at) {
    normalized.expires_at = Number(normalized.created_at || Date.now()) + Number(normalized.expires_in) * 1000;
  }

  return normalized;
}

function isSessionExpired(session, safetyMarginMs = 60 * 1000) {
  if (!session || !session.access_token) {
    return true;
  }

  const expiresAt = Number(session.expires_at || 0);
  if (expiresAt) {
    return Date.now() >= expiresAt - Number(safetyMarginMs);
  }

  if (session.created_at && session.expires_in) {
    const computedExpiry = Number(session.created_at) + Number(session.expires_in) * 1000;
    return Date.now() >= computedExpiry - Number(safetyMarginMs);
  }

  return false;
}

/**
 * @param {{brand: string, realm: string, basic: string, grant_type: "refresh_token" | "authorization_code", refresh_token?: string, code?: string, redirect_uri?: string}} options
 */
function buildTokenRequest({ brand, realm, basic, grant_type, refresh_token, code, redirect_uri }) {
  const data = {
    realm,
    grant_type,
  };

  if (grant_type === "refresh_token") {
    data.refresh_token = refresh_token;
  }

  if (grant_type === "authorization_code") {
    data.code = code;
    data.redirect_uri = redirect_uri;
  }

  return {
    method: "post",
    url: `https://idpcvs.${brand}/am/oauth2/access_token`,
    headers: {
      accept: "application/json",
      "User-Agent": "okhttp/4.10.0",
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    data,
  };
}

/**
 * @param {{brand: string, realm: string, basic: string, http: {post: (config: any) => Promise<any>}, storage?: {load?: () => Promise<Session | null | undefined>, save?: (session: Session) => Promise<void>}, log: {info: (message: string) => void, debug?: (message: string) => void, warn?: (message: string) => void, error?: (message: string) => void}}} options
 */
function createAuthService({ brand, realm, basic, http, storage, log }) {
  const state = {
    /** @type {Session | null} */
    session: null,
  };
  let refreshInFlight = null;

  const saveSession = async (session) => {
    const normalized = normalizeSession(session || {});
    state.session = normalized;
    if (storage && typeof storage.save === "function") {
      await storage.save(normalized);
    }
    return normalized;
  };

  return {
    async loadSession() {
      const loaded = storage && typeof storage.load === "function" ? await storage.load() : null;
      const session = loaded || state.session || {};
      state.session = normalizeSession(session);
      return state.session;
    },

    getSession() {
      return state.session || {};
    },

    refreshToken() {
      if (refreshInFlight) {
        return refreshInFlight;
      }

      refreshInFlight = (async () => {
        const current = state.session || (await this.loadSession());
        if (!current || !current.refresh_token) {
          throw new Error("Missing refresh token for PSA session refresh");
        }

        const response = await http.post(
          buildTokenRequest({
            brand,
            realm,
            basic,
            grant_type: "refresh_token",
            refresh_token: current.refresh_token,
          }),
        );

        const refreshed = normalizeSession(response && response.data ? response.data : {});
        if (!refreshed.access_token) {
          throw new Error("Refresh token response did not contain an access token");
        }

        refreshed.created_at = Date.now();
        refreshed.expires_at = refreshed.created_at + Number(refreshed.expires_in || 3600) * 1000;

        await saveSession(refreshed);
        if (log && typeof log.info === "function") {
          log.info("PSA token refreshed successfully");
        }
        return refreshed;
      })();

      const refreshPromise = refreshInFlight;
      return refreshPromise.finally(() => {
        refreshInFlight = null;
      });
    },

    async exchangeAuthorizationCode(code, redirectUri) {
      const response = await http.post(
        buildTokenRequest({
          brand,
          realm,
          basic,
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
        }),
      );

      const session = normalizeSession(response && response.data ? response.data : {});
      if (!session.access_token) {
        throw new Error("Authorization code response did not contain an access token");
      }

      session.created_at = Date.now();
      session.expires_at = session.created_at + Number(session.expires_in || 3600) * 1000;
      await saveSession(session);
      return session;
    },

    async ensureValidSession() {
      const session = state.session || (await this.loadSession());
      if (!session || !session.access_token) {
        return null;
      }

      if (isSessionExpired(session, 60 * 1000)) {
        if (!session.refresh_token) {
          return null;
        }
        return this.refreshToken();
      }

      return session;
    },
  };
}

module.exports = {
  buildTokenRequest,
  createAuthService,
  isSessionExpired,
  normalizeSession,
};
