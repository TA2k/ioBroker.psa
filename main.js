"use strict";

/*
 * Created with @iobroker/create-adapter v1.34.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");
const axios = require("axios").default;
const Json2iob = require("json2iob");
const { createAuthService } = require("./lib/auth");
const { createPsaTransport } = require("./lib/transport");
const { createVehicleService } = require("./lib/vehicle");
const { createPollingService } = require("./lib/polling");
const { normalizeInterval, parseStoredSession } = require("./lib/settings");

function getSafeErrorDescription(error) {
  if (error && typeof error === "object" && "response" in error) {
    const response = error.response;
    if (response && typeof response === "object" && "status" in response && Number.isFinite(response.status)) {
      return "HTTP " + response.status;
    }
  }
  if (error && typeof error === "object" && "code" in error && error.code === "ERR_CANCELED") {
    return "request canceled";
  }
  return "network or request error";
}

function getErrorResponseCode(error) {
  if (!error || typeof error !== "object" || !("response" in error)) {
    return undefined;
  }
  const response = error.response;
  if (!response || typeof response !== "object" || !("data" in response)) {
    return undefined;
  }
  const data = response.data;
  if (!data || typeof data !== "object" || !("code" in data)) {
    return undefined;
  }
  return data.code;
}

class Psa extends utils.Adapter {
  /**
   * @param {Partial<utils.AdapterOptions>} [options={}]
   */
  constructor(options) {
    super({
      ...options,
      name: "psa",
    });
    this.on("ready", this.onReady.bind(this));
    this.on("unload", this.onUnload.bind(this));

    this.json2iob = new Json2iob(this);
    this.idArray = [];
    this.session = {};
    /** @type {ReturnType<typeof createAuthService> | null} */
    this.authService = null;
    this.transport = null;
    /** @type {ReturnType<typeof createVehicleService> | null} */
    this.vehicleService = null;
    this.pollingService = null;
    this.lifecycleAbortController = null;
    this.isUnloading = false;
    /** @type {NodeJS.Timeout | undefined} */
    this.refreshTokenInterval = undefined;
    this.brands = {
      peugeot: {
        brand: "peugeot.com",
        realm: "clientsB2CPeugeot",
        clientId: "1eebc2d5-5df3-459b-a624-20abfcf82530",
        basic: "MWVlYmMyZDUtNWRmMy00NTliLWE2MjQtMjBhYmZjZjgyNTMwOlQ1dFA3aVMwY084c0MwbEEyaUUyYVI3Z0s2dUU1ckYzbEo4cEMzbk8xcFI3dEw4dlUx",
        redirectUri: "mymap://oauth2redirect/de",
      },
      citroen: {
        brand: "citroen.com",
        realm: "clientsB2CCitroen",
        clientId: "5364defc-80e6-447b-bec6-4af8d1542cae",
        basic: "NTM2NGRlZmMtODBlNi00NDdiLWJlYzYtNGFmOGQxNTQyY2FlOmlFMGNEOGJCMHlKMGRTNnJPM25OMWhJMndVN3VBNXhSNGdQN2xENnZNMG9IMG5TOGRO",
        redirectUri: "mymacsdk://oauth2redirect/de", //mymacsdk
      },
      driveds: {
        brand: "driveds.com",
        realm: "clientsB2CDS",
        clientId: "cbf74ee7-a303-4c3d-aba3-29f5994e2dfa",
        basic: "Y2JmNzRlZTctYTMwMy00YzNkLWFiYTMtMjlmNTk5NGUyZGZhOlg2YkU2eVEzdEgxY0c1b0E2YVc0ZlM2aEswY1IwYUs1eU4yd0U0aFA4dkw4b1c1Z1Uz",
        redirectUri: "mymdssdk://oauth2redirect/de",
      },
      opel: {
        brand: "opel.com",
        realm: "clientsB2COpel",
        clientId: "07364655-93cb-4194-8158-6b035ac2c24c",
        basic: "MDczNjQ2NTUtOTNjYi00MTk0LTgxNTgtNmIwMzVhYzJjMjRjOkYya0s3bEM1a0Y1cU43dE0wd1Q4a0UzY1cx",
        redirectUri: "mymop://oauth2redirect/de",
      },
    };
  }

  /**
   * Is called when databases are connected and adapter received configuration.
   */
  async onReady() {
    // Initialize your adapter here

    this.setState("info.connection", false, true);
    this.lifecycleAbortController = new AbortController();
    if (!this.config.type || !Object.prototype.hasOwnProperty.call(this.brands, this.config.type)) {
      this.log.warn("Please select a supported brand in settings");
      return;
    }

    const configuredInterval = Number(this.config.interval);
    this.config.interval = normalizeInterval(this.config.interval);
    if (this.config.interval !== configuredInterval) {
      this.log.info("Using a safe polling interval of " + this.config.interval + " minutes");
    }
    await this.setObjectNotExistsAsync("diagnostics", {
      type: "channel",
      common: { name: "Diagnostics" },
      native: {},
    });
    await this.setObjectNotExistsAsync("diagnostics.lastSuccessfulUpdate", {
      type: "state",
      common: {
        name: "Last successful vehicle status update",
        type: "number",
        role: "value.time",
        unit: "ms",
        read: true,
        write: false,
        def: 0,
      },
      native: {},
    });
    this.clientId = this.brands[this.config.type].clientId;
    this.authService = createAuthService({
      brand: this.brands[this.config.type].brand,
      realm: this.brands[this.config.type].realm,
      basic: this.brands[this.config.type].basic,
      http: {
        post: async (config) => axios(config),
      },
      storage: {
        load: async () => {
          const sessionState = await this.getStateAsync("auth.session");
          const session = parseStoredSession(sessionState && sessionState.val);
          if (!session) {
            this.log.warn("Failed to parse auth.session; stored value is left unchanged");
            return {};
          }
          return session;
        },
        save: async (session) => {
          this.setState("auth.session", JSON.stringify(session), true);
        },
      },
      log: {
        info: (message) => this.log.info(message),
        debug: (message) => this.log.debug(message),
        warn: (message) => this.log.warn(message),
        error: (message) => this.log.error(message),
      },
    });

    this.transport = createPsaTransport({
      auth: this.authService,
      http: {
        request: async (config) => axios(config),
      },
      log: this,
      realm: this.brands[this.config.type].realm,
      clientId: this.clientId,
    });
    this.vehicleService = createVehicleService({
      transport: this.transport,
      json2iob: this.json2iob,
      log: this,
      clientId: this.clientId,
    });

    await this.extendObject("auth", {
      type: "channel",
      common: {
        name: "Authentification",
      },
      native: {},
    });
    await this.extendObject("auth.session", {
      type: "state",
      common: {
        name: "Session",
        type: "string",
        role: "value",
        read: true,
        write: true,
      },
      native: {},
    });
    const sessionState = await this.getStateAsync("auth.session");
    const storedSession = parseStoredSession(sessionState && sessionState.val);
    if (storedSession) {
      this.session = storedSession;
      await this.authService.loadSession();
      if (this.session.refresh_token) {
        this.log.info("Found old session. Try to refresh token");
        await this.refreshToken();
      }
    } else {
      if (sessionState && sessionState.val) {
        this.log.warn("Stored auth.session is invalid; keeping it unchanged until a new login succeeds");
      }
      if (this.config.auth_code) {
        this.log.info("Found auth code. Try to login");
        await this.loginAuthCode();
      } else {
        this.log.warn("Please enter authorization code in settings");
      }
    }
    if (this.authService && this.authService.getSession && this.authService.getSession().access_token) {
      this.session = this.authService.getSession();
    }
    this.log.info("Get vehicles");
    await this.getVehicles(this.lifecycleAbortController.signal);
    this.log.info("Get vehicle status");
    await this.updateVehicle(this.lifecycleAbortController.signal);

    this.pollingService = createPollingService({
      intervalMs: this.config.interval * 60 * 1000,
      poll: (signal) => this.updateVehicle(signal),
      onError: (error) => this.log.error("Polling failed: " + getSafeErrorDescription(error)),
    });
    this.pollingService.start();

    if (this.authService.getSession().refresh_token) {
      this.refreshTokenInterval = setInterval(() => {
        void this.refreshToken();
      }, 60 * 60 * 1000 - 150);
    }
  }

  async loginAuthCode() {
    //check if auth code is a url and extract code or if it is a code
    if (this.config.auth_code.includes("code=")) {
      const code = new URL(this.config.auth_code).searchParams.get("code");
      if (!code) {
        this.log.error("Authorization URL does not contain a code parameter");
        this.config.auth_code = "";
        return;
      }
      this.config.auth_code = code;
    }
    const authService = this.authService;
    if (!authService) {
      this.log.error("Authentication service is not initialized");
      return;
    }
    try {
      const session = await authService.exchangeAuthorizationCode(
        this.config.auth_code,
        this.brands[this.config.type].redirectUri,
      );
      if (!session || !session.access_token) {
        this.log.error("Login failed maybe incorrect login information");
        return;
      }
      this.log.info("Login succesful. Save session for relogin");
      this.session = session;
      this.setState("auth.session", JSON.stringify(session), true);
    } catch (error) {
      this.log.error("Login failed: " + getSafeErrorDescription(error));
      this.config.auth_code = "";
      this.log.error("Renew authorization code");
    }
  }
  async updateVehicle(signal = this.lifecycleAbortController && this.lifecycleAbortController.signal) {
    // Vehicle IDs remain cached on errors so temporary outages do not disable future polling.
    let attempted = 0;
    let succeeded = 0;
    for (const element of this.idArray) {
      if (this.isUnloading || (signal && signal.aborted)) {
        break;
      }
      attempted += 1;
      if (await this.getRequest(element.id, element.vin + ".status", signal)) {
        succeeded += 1;
      }
    }
    if (attempted > 0 && !this.isUnloading) {
      this.setState("info.connection", succeeded > 0, true);
    }
    return succeeded > 0;
  }

  async refreshToken() {
    if (this.isUnloading || !this.authService) {
      return;
    }
    try {
      const session = await this.authService.refreshToken();
      this.log.debug("Refresh Token succesful");
      this.session = session;
      this.setState("auth.session", JSON.stringify(session), true);
    } catch (error) {
      if (!this.isUnloading) {
        this.setState("info.connection", false, true);
      }
      this.log.error("Token refresh failed: " + getSafeErrorDescription(error));
      this.log.error("Refreshtoken failed. Please delete auth.session and restart adapter");
    }
  }

  async getVehicles(signal) {
    try {
      const vehicleService = this.vehicleService;
      if (!vehicleService) {
        throw new Error("Vehicle service is not initialized");
      }
      const response = await vehicleService.listVehicles(signal);
      if (!response || !response._embedded || !Array.isArray(response._embedded.vehicles)) {
        throw new Error("Vehicle list response did not include a vehicle array");
      }
      this.idArray = response._embedded.vehicles
        .filter((vehicle) => vehicle && vehicle.id && vehicle.vin)
        .map((vehicle) => ({ id: vehicle.id, vin: vehicle.vin }));
      if (!this.isUnloading) {
        this.setState("info.connection", true, true);
      }
      for (const element of this.idArray) {
        if (this.isUnloading || (signal && signal.aborted)) {
          break;
        }
        await this.extendObject(element.vin, {
          type: "device",
          common: {
            name: element.vin,
            role: "indicator",
          },
          native: {},
        });

        await vehicleService.getVehicleDetails(element.id, element.vin, signal).catch((error) => {
          if (!this.isUnloading && !(signal && signal.aborted)) {
            this.log.error("Get vehicle details failed: " + getSafeErrorDescription(error));
          }
        });
      }
      return true;
    } catch (error) {
      if (this.isUnloading || (signal && signal.aborted)) {
        return false;
      }
      this.setState("info.connection", false, true);
      this.log.error("Get vehicles failed: " + getSafeErrorDescription(error));
      if (getErrorResponseCode(error) === 40410) {
        this.log.error("No compatible vehicles found. Only electric cars are available for new api.");
      }
      return false;
    }
  }

  async getRequest(vehicleId, path, signal) {
    try {
      const vehicleService = this.vehicleService;
      if (!vehicleService) {
        throw new Error("Vehicle service is not initialized");
      }
      await vehicleService.getVehicleStatus(vehicleId, path.split(".")[0], signal);
      if (this.isUnloading || (signal && signal.aborted)) {
        return false;
      }
      this.setState("diagnostics.lastSuccessfulUpdate", Date.now(), true);
      return true;
    } catch (error) {
      if (this.isUnloading || (signal && signal.aborted)) {
        return false;
      }
      this.log.error("Get " + path + " failed: " + getSafeErrorDescription(error));
      return false;
    }
  }

  /**
   * Is called when adapter shuts down - callback has to be called under any circumstances!
   * @param {() => void} callback
   */
  async onUnload(callback) {
    this.isUnloading = true;
    if (this.pollingService) {
      this.pollingService.stop();
    }
    if (this.lifecycleAbortController) {
      this.lifecycleAbortController.abort();
    }
    clearInterval(this.refreshTokenInterval);
    try {
      if (this.config.auth_code) {
        const adapterSettings = await this.getForeignObjectAsync("system.adapter." + this.namespace);
        if (adapterSettings && adapterSettings.native) {
          adapterSettings.native.auth_code = null;
          await this.setForeignObjectAsync("system.adapter." + this.namespace, adapterSettings);
        }
      }
    } catch (error) {
      this.log.error("Unload cleanup failed: " + getSafeErrorDescription(error));
    } finally {
      callback();
    }
  }
}

if (require.main !== module) {
  // Export the constructor in compact mode
  /**
   * @param {Partial<utils.AdapterOptions>} [options={}]
   */
  module.exports = (options) => new Psa(options);
} else {
  // otherwise start the instance directly
  new Psa();
}
