"use strict";

function getResponseStatus(error) {
  if (!error || typeof error !== "object" || !("response" in error)) {
    return undefined;
  }
  const response = error.response;
  if (!response || typeof response !== "object" || !("status" in response)) {
    return undefined;
  }
  return response.status;
}

function createPsaTransport({ auth, http, log, realm, clientId }) {
  const request = async (config = {}) => {
    const session = auth && typeof auth.getSession === "function" ? auth.getSession() : {};
    const headers = {
      Accept: "application/hal+json",
      "x-introspect-realm": realm,
      ...(config.headers || {}),
    };

    if (session && session.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }

    const requestConfig = {
      method: config.method || "get",
      url: config.url,
      params: {
        ...(config.params || {}),
      },
      headers,
      data: config.data,
      ...config,
    };

    try {
      return await (http && http.request ? http.request(requestConfig) : Promise.reject(new Error("No HTTP transport configured")));
    } catch (error) {
      const status = getResponseStatus(error);
      if (status === 401 && !config.__retried) {
        if (log && typeof log.info === "function") {
          log.info("PSA token expired. Refreshing and retrying once");
        }

        if (auth && typeof auth.refreshToken === "function") {
          await auth.refreshToken();
        }

        const refreshedSession = auth && typeof auth.getSession === "function" ? auth.getSession() : {};
        const retryHeaders = {
          ...headers,
          Authorization: `Bearer ${refreshedSession.access_token}`,
        };

        return http.request({
          ...requestConfig,
          __retried: true,
          headers: retryHeaders,
          params: {
            ...(requestConfig.params || {}),
          },
        });
      }

      throw error;
    }
  };

  return {
    request,
    async getJson(url, params = {}, extraHeaders = {}, signal) {
      const response = await request({
        method: "get",
        url,
        params,
        headers: extraHeaders,
        signal,
      });
      return response && response.data ? response.data : {};
    },
    async getVehicleList(signal) {
      const response = await request({
        method: "get",
        url: "https://api.groupe-psa.com/connectedcar/v4/user",
        params: { client_id: clientId },
        signal,
        headers: {
          Accept: "application/hal+json",
        },
      });
      return response && response.data ? response.data : {};
    },
    async getVehicleStatus(vehicleId, signal) {
      const response = await request({
        method: "get",
        url: `https://api.groupe-psa.com/connectedcar/v4/user/vehicles/${vehicleId}/status`,
        params: { client_id: clientId },
        signal,
        headers: {
          Accept: "application/hal+json",
        },
      });
      return response && response.data ? response.data : {};
    },
  };
}

module.exports = {
  createPsaTransport,
};
