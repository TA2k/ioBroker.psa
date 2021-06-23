"use strict";

/*
 * Created with @iobroker/create-adapter v1.34.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");
const axios = require("axios");
const { extractKeys } = require("./lib/extractKeys");

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
        this.on("stateChange", this.onStateChange.bind(this));
        this.on("unload", this.onUnload.bind(this));
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        // Initialize your adapter here

        this.extractKeys = extractKeys;
        this.idArray = [];
        this.clientId = "b3e8ec8a-2a64-438e-a8dc-846ec566462a";
        this.clientId = "1eebc2d5-5df3-459b-a624-20abfcf82530";
        this.brands = {
            peugot: { brand: "peugeot.com", realm: "clientsB2CPeugeot" },
            citroen: { brand: "citroen.com", realm: "clientsB2CCitroen" },
            driveds: { brand: "driveds.com", realm: "clientsB2CDS" },
            opel: { brand: "opel.com", realm: "clientsB2COpel" },
            vauxhall: { brand: "vauxhall.co.uk", realm: "clientsB2CVauxhall" },
        };
        this.subscribeStates("*");
        this.login()
            .then(() => {
                this.setState("info.connection", true, true);
                this.log.info("Login successful");
                this.getVehicles()
                    .then(() => {
                        this.idArray.forEach((element) => {
                            this.getRequest("https://api.groupe-psa.com/connectedcar/v4/user/vehicles/" + element.id + "/status", element.vin + ".status").catch(() => {
                                this.log.error("Get device status failed");
                            });
                        });
                        this.appUpdateInterval = setInterval(() => {
                            this.idArray.forEach((element) => {
                                this.getRequest("https://api.groupe-psa.com/connectedcar/v4/user/vehicles/" + element.id + "/status", element.vin + ".status").catch(() => {
                                    this.log.error("Get device status failed");
                                });
                            });
                        }, this.config.interval * 60 * 1000);
                    })
                    .catch(() => {
                        this.log.error("Get vehicles failed");
                    });
            })
            .catch(() => {
                this.log.error("Login failed");
                this.setState("info.connection", false, true);
            });
    }

    login() {
        return new Promise((resolve, reject) => {
            axios({
                method: "post",
                url: "https://idpcvs." + this.brands[this.config.type].brand + "/am/oauth2/access_token",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    Authorization: "Basic MWVlYmMyZDUtNWRmMy00NTliLWE2MjQtMjBhYmZjZjgyNTMwOlQ1dFA3aVMwY084c0MwbEEyaUUyYVI3Z0s2dUU1ckYzbEo4cEMzbk8xcFI3dEw4dlUx", //YjNlOGVjOGEtMmE2NC00MzhlLWE4ZGMtODQ2ZWM1NjY0NjJhOkc0eU82cFczdko0eEcxZFUybVA4eFg0aEo1aVI0eUwwYlM4d1E2Z080aVk3aUc2dVk0",
                },
                data:
                    "realm=" +
                    this.brands[this.config.type].realm +
                    "&grant_type=password&password=" +
                    encodeURIComponent(this.config.password) +
                    "&username=" +
                    encodeURIComponent(this.config.user) +
                    "&scope=profile%20openid",
            })
                .then((response) => {
                    if (!response.data) {
                        this.log.error("Login failed maybe incorrect login information");
                        reject();
                        return;
                    }
                    this.log.debug(JSON.stringify(response.data));
                    this.aToken = response.data.access_token;
                    this.rToken = response.data.refresh_token;
                    this.refreshTokenInterval = setInterval(() => {
                        this.refreshToken();
                    }, 3599 * 1000);
                    resolve();
                })
                .catch((error) => {
                    this.log.error(error);
                    this.log.error("Login failed");
                    error.response && this.log.error(JSON.stringify(error.response.data));
                    reject();
                });
        });
    }
    refreshToken() {
        return new Promise((resolve, reject) => {
            axios({
                method: "post",
                url: "https://idpcvs." + this.brands[this.config.type].brand + ".com/am/oauth2/access_token",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    Authorization: "Basic YjNlOGVjOGEtMmE2NC00MzhlLWE4ZGMtODQ2ZWM1NjY0NjJhOkc0eU82cFczdko0eEcxZFUybVA4eFg0aEo1aVI0eUwwYlM4d1E2Z080aVk3aUc2dVk0",
                },
                data: "realm=" + this.brands[this.config.type].realm + "&grant_type=refresh_token&refresh_token=" + this.rToken,
            })
                .then((response) => {
                    this.log.debug(JSON.stringify(response.data));
                    this.aToken = response.data.access_token;
                    this.rToken = response.data.refresh_token;
                    resolve();
                })
                .catch((error) => {
                    this.log.error(error);
                    this.log.error("Refreshtoken failed");
                    error.response && this.log.error(JSON.stringify(error.response.data));
                    reject();
                });
        });
    }
    getVehicles() {
        return new Promise((resolve, reject) => {
            axios({
                method: "get",
                url: "https://api.groupe-psa.com/connectedcar/v4/user?client_id=" + this.clientId,
                headers: {
                    Authorization: "Bearer " + this.aToken,
                    Accept: "application/hal+json",
                    "x-introspect-realm": this.brands[this.config.type].realm,
                },
            })
                .then((response) => {
                    this.log.debug(JSON.stringify(response.data));
                    this.extractKeys(this, "user", response.data);
                    response.data["_embedded"].vehicles.forEach(async (element) => {
                        this.idArray.push({ id: element.id, vin: element.vin });
                        await this.setObjectNotExistsAsync(element.vin, {
                            type: "device",
                            common: {
                                name: element.vin,
                                role: "indicator",
                            },
                            native: {},
                        });

                        this.getRequest("https://api.groupe-psa.com/connectedcar/v4/user/vehicles/" + element.id, element.vin + ".details").catch(() => {
                            this.log.error("Get Details failed");
                        });
                    });
                    resolve();
                })
                .catch((error) => {
                    this.log.error(error);
                    this.log.error("Get Vehicles failed");
                    error.response && this.log.error(JSON.stringify(error.response.data));
                    if (error.response && error.response.data && error.response.data.code && error.response.data.code === 40410) {
                        this.log.error("No compatible vehicles found. Maybe your vehicle is too old.");
                    }
                    reject();
                });
        });
    }
    getRequest(url, path) {
        return new Promise((resolve, reject) => {
            this.log.debug(url + "?client_id=" + this.clientId);
            axios({
                method: "get",
                url: url + "?client_id=" + this.clientId,
                headers: {
                    Authorization: "Bearer " + this.aToken,
                    Accept: "application/hal+json",
                    "x-introspect-realm": this.brands[this.config.type].realm,
                },
            })
                .then((response) => {
                    this.log.debug(JSON.stringify(response.data));
                    this.extractKeys(this, path, response.data, "type");
                    resolve();
                })
                .catch((error) => {
                    this.log.error(error);
                    this.log.error("Get " + path + " failed");
                    error.response && this.log.error(JSON.stringify(error.response.data));
                    reject();
                });
        });
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
    onUnload(callback) {
        this.clearInterval(this.appUpdateInterval);
        this.clearInterval(this.refreshTokenInterval);
        try {
            callback();
        } catch (e) {
            callback();
        }
    }

    /**
     * Is called if a subscribed state changes
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
    onStateChange(id, state) {
        if (state) {
            // The state was changed
        } else {
            // The state was deleted
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
