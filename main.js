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

        this.brands = {
            peugot: { brand: "peugot.com", real: "clientsB2CPeugeot" },
            citroen: { brand: "citroen.com", real: "clientsB2CCitroen" },
            driveds: { brand: "driveds.com", real: "clientsB2CDS" },
            opel: { brand: "opel.com", real: "clientsB2COpel" },
            vauxhall: { brand: "vauxhall.co.uk", real: "clientsB2CVauxhall" },
        };
        this.subscribeStates("*");
        this.login()
            .then(() => {
                this.setState("info.connection", true, true);
                this.log.info("Login successful");
                this.getVehicles()
                    .then(() => {
                        this.idArray.forEach((id) => {
                            this.getRequest("https://api.groupe-psa.com/connectedcar/v4/user/vehicles/" + id + "/status", id + "status").catch(() => {
                                this.log.error("Get device status failed");
                            });
                            this.getRequest("https://api.groupe-psa.com/connectedcar/v4/user/vehicles/" + id + "/lastPosition", id + "lastPosition").catch(() => {
                                this.log.error("Get device status failed");
                            });
                        });
                        this.appUpdateInterval = setInterval(() => {
                            this.idArray.forEach((id) => {
                                this.getRequest("https://api.groupe-psa.com/connectedcar/v4/user/vehicles/" + id + "/status", id + "status").catch(() => {
                                    this.log.error("Get device status failed");
                                });
                                this.getRequest("https://api.groupe-psa.com/connectedcar/v4/user/vehicles/" + id + "/lastPosition", id + "lastPosition").catch(() => {
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
                url: "https://idpcvs." + this.brands[this.config.type].brand + ".com/am/oauth2/access_token",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    Authorization: "Basic YjNlOGVjOGEtMmE2NC00MzhlLWE4ZGMtODQ2ZWM1NjY0NjJhOkc0eU82cFczdko0eEcxZFUybVA4eFg0aEo1aVI0eUwwYlM4d1E2Z080aVk3aUc2dVk0",
                },
                data: "realm=" + this.brands[this.config.type].realm + "&grant_type=password&password=" + this.password + "&username=" + this.user + "&scope=profile%20openid",
            })
                .then((response) => {
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
                    this.log.error(JSON.stringify(error.response.data));
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
                    this.log.error(JSON.stringify(error.response.data));
                    reject();
                });
        });
    }
    getVehicles() {
        return new Promise((resolve, reject) => {
            axios({
                method: "get",
                url: "https://api.groupe-psa.com/connectedcar/v4/user",
                headers: {
                    Authorization: "Bearer " + this.aToken,
                },
            })
                .then((response) => {
                    this.log.debug(JSON.stringify(response.data));
                    this.extractKeys(this, ".user", response.data);
                    response.data["_embedded"].Vehicles.forEach((element) => {
                        this.idArray.push(element.id);
                        this.getRequest("https://api.groupe-psa.com/connectedcar/v4/user/vehicles/" + element.id, element.id + ".details").catch(() => {
                            this.log.error("Get Details failed");
                        });
                    });
                    resolve();
                })
                .catch((error) => {
                    this.log.error(error);
                    this.log.error("Get Vehicles failed");
                    this.log.error(JSON.stringify(error.response.data));
                    reject();
                });
        });
    }
    getRequest(url, path) {
        return new Promise((resolve, reject) => {
            axios({
                method: "get",
                url: url,
                headers: {
                    Authorization: "Bearer " + this.aToken,
                },
            })
                .then((response) => {
                    this.log.debug(JSON.stringify(response.data));
                    this.extractKeys(this, "." + path, response.data);
                    resolve();
                })
                .catch((error) => {
                    this.log.error(error);
                    this.log.error("Get " + path + " failed");
                    this.log.error(JSON.stringify(error.response.data));
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
