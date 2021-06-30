"use strict";

/*
 * Created with @iobroker/create-adapter v1.34.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");
const axios = require("axios");
const https = require("https");
const fs = require("fs");
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
        // this.on("stateChange", this.onStateChange.bind(this));
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
            peugeot: {
                brand: "peugeot.com",
                realm: "clientsB2CPeugeot",
                clientId: "1eebc2d5-5df3-459b-a624-20abfcf82530",
                basic: "MWVlYmMyZDUtNWRmMy00NTliLWE2MjQtMjBhYmZjZjgyNTMwOlQ1dFA3aVMwY084c0MwbEEyaUUyYVI3Z0s2dUU1ckYzbEo4cEMzbk8xcFI3dEw4dlUx",
                siteCode: "AP_DE_ESP",
                url: "mw-ap-rp.mym.awsmpsa.com",
            },
            citroen: {
                brand: "citroen.com",
                realm: "clientsB2CCitroen",
                clientId: "5364defc-80e6-447b-bec6-4af8d1542cae",
                basic: "NTM2NGRlZmMtODBlNi00NDdiLWJlYzYtNGFmOGQxNTQyY2FlOmlFMGNEOGJCMHlKMGRTNnJPM25OMWhJMndVN3VBNXhSNGdQN2xENnZNMG9IMG5TOGRO",
                siteCode: "AC_DE_ESP",
                url: "mw-ac-rp.mym.awsmpsa.com",
            },
            driveds: {
                brand: "driveds.com",
                realm: "clientsB2CDS",
                clientId: "cbf74ee7-a303-4c3d-aba3-29f5994e2dfa",
                basic: "Y2JmNzRlZTctYTMwMy00YzNkLWFiYTMtMjlmNTk5NGUyZGZhOlg2YkU2eVEzdEgxY0c1b0E2YVc0ZlM2aEswY1IwYUs1eU4yd0U0aFA4dkw4b1c1Z1Uz",
                siteCode: "DS_DE_ESP",
                url: "mw-ds-rp.mym.awsmpsa.com",
            },
            opel: {
                brand: "opel.com",
                realm: "clientsB2COpel",
                clientId: "07364655-93cb-4194-8158-6b035ac2c24c",
                basic: "MDczNjQ2NTUtOTNjYi00MTk0LTgxNTgtNmIwMzVhYzJjMjRjOkYya0s3bEM1a0Y1cU43dE0wd1Q4a0UzY1cxZFAwd0M1cEk2dkMwc1E1aVA1Y044Y0o4",
                siteCode: "OP_DE_ESP",
                url: "mw-op-rp.mym.awsmpsa.com",
            },
        };
        if (!this.config.type) {
            this.log.warn("Please select type in settings");
            return;
        }

        if (this.config.interval < 0.5) {
            this.log.info("Set interval to minimum 0.5");
            this.config.interval = 0.5;
        }
        this.clientId = this.brands[this.config.type].clientId;

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
        try {
            this.httpsAgent = new https.Agent({
                pfx: fs.readFileSync(__dirname + "/certs/mwp.dat"),
            });
            this.receiveOldApi()
                .then(() => {
                    this.oldApiUpdateInterval = setInterval(() => {
                        this.receiveOldApi().catch((error) => {
                            this.log.warn("OldAPI Login failed");
                        });
                    }, this.config.interval * 60 * 1000);
                })
                .catch((error) => {
                    this.log.warn("OldAPI Login failed");
                });
        } catch (error) {
            this.log.error(error);
        }
    }

    login() {
        return new Promise((resolve, reject) => {
            axios({
                method: "post",
                url: "https://idpcvs." + this.brands[this.config.type].brand + "/am/oauth2/access_token",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    Authorization: "Basic " + this.brands[this.config.type].basic,
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
                        this.refreshToken().catch((error) => {
                            this.log.error("Refresh token failed");
                        });
                    }, 60 * 60 * 1000);
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

    receiveOldApi() {
        return new Promise((resolve, reject) => {
            const loginData = {
                siteCode: this.brands[this.config.type].siteCode,
                culture: "de-DE",
                action: "authenticate",
                fields: { USR_EMAIL: { value: this.config.user }, USR_PASSWORD: { value: this.config.password } },
            };
            axios({
                method: "get",
                url: "https://id-dcr." + this.brands[this.config.type].brand + "/mobile-services/GetAccessToken?jsonRequest=" + encodeURIComponent(JSON.stringify(loginData)),
                headers: {
                    Accept: "application/json",
                    "User-Agent": "okhttp/2.3.0",
                },
            })
                .then(async (response) => {
                    if (!response.data) {
                        this.log.error("Login old api failed maybe incorrect login information");
                        reject();
                        return;
                    }
                    this.log.debug(JSON.stringify(response.data));
                    if (!response.data.accessToken) {
                        this.log.warn(JSON.stringify(response.data));
                        if (response.data && response.data.returnCode && response.data.returnCode === "NEED_CREATION") {
                            this.log.warn("No account for this e-mail or password incorrect");
                        }
                        this.log.warn("No Token received for old api ");
                        return;
                    }
                    this.oldAToken = response.data.accessToken;
                    await this.setObjectNotExistsAsync("oldApi", {
                        type: "device",
                        common: {
                            name: "old API, only mileage available",
                            role: "indicator",
                        },
                        native: {},
                    });
                    const data = JSON.stringify({ site_code: this.brands[this.config.type].siteCode, ticket: this.oldAToken });
                    const url = "https://" + this.brands[this.config.type].url + "/api/v1/user?culture=de_DE&width=1080&cgu=" + parseInt(Date.now() / 1000) + "&v=1.29.3";
                    this.log.debug(url);
                    this.log.debug(data);
                    axios({
                        method: "post",
                        url: url,
                        headers: {
                            "source-agent": "App-Android",
                            version: "1.29.3",
                            token: this.oldAToken,
                            "content-type": "application/json;charset=UTF-8",
                            "user-agent": "okhttp/4.9.1",
                        },
                        data: data,
                        httpsAgent: this.httpsAgent,
                    })
                        .then((response) => {
                            this.log.debug(JSON.stringify(response.data));
                            if (response.data.success) {
                                this.extractKeys(this, "oldApi", response.data.success);
                            }
                            resolve();
                        })
                        .catch((error) => {
                            this.log.warn(error);
                            this.log.warn("receive old api failed");
                            error.response && this.log.warn(JSON.stringify(error.response.data));
                        });
                })
                .catch((error) => {
                    this.log.warn(error);
                    this.log.warn("Login old api failed");
                    error.response && this.log.warn(JSON.stringify(error.response.data));
                    reject();
                });
        });
    }
    refreshToken() {
        return new Promise((resolve, reject) => {
            axios({
                method: "post",
                url: "https://idpcvs." + this.brands[this.config.type].brand + "/am/oauth2/access_token",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    Authorization: "Basic " + this.brands[this.config.type].basic,
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
                    if (error.response.status === 401) {
                        this.log.info("Token expired. Try to refresh token");
                        this.refreshToken()
                            .then(() => {
                                resolve();
                            })
                            .catch((error) => {
                                this.log.error("Refreshtoken failed");
                                reject();
                            });

                        return;
                    }
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
        this.clearInterval(this.oldApiUpdateInterval);
        this.clearInterval(this.refreshTokenInterval);
        try {
            callback();
        } catch (e) {
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
