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
                shortBrand: "AP",
                url: "mw-ap-rp.mym.awsmpsa.com",
            },
            citroen: {
                brand: "citroen.com",
                realm: "clientsB2CCitroen",
                clientId: "5364defc-80e6-447b-bec6-4af8d1542cae",
                basic: "NTM2NGRlZmMtODBlNi00NDdiLWJlYzYtNGFmOGQxNTQyY2FlOmlFMGNEOGJCMHlKMGRTNnJPM25OMWhJMndVN3VBNXhSNGdQN2xENnZNMG9IMG5TOGRO",
                siteCode: "AC_DE_ESP",
                shortBrand: "AC",
                url: "mw-ac-rp.mym.awsmpsa.com",
            },
            driveds: {
                brand: "driveds.com",
                realm: "clientsB2CDS",
                clientId: "cbf74ee7-a303-4c3d-aba3-29f5994e2dfa",
                basic: "Y2JmNzRlZTctYTMwMy00YzNkLWFiYTMtMjlmNTk5NGUyZGZhOlg2YkU2eVEzdEgxY0c1b0E2YVc0ZlM2aEswY1IwYUs1eU4yd0U0aFA4dkw4b1c1Z1Uz",
                siteCode: "DS_DE_ESP",
                shortBrand: "DS",
                url: "mw-ds-rp.mym.awsmpsa.com",
            },
            opel: {
                brand: "opel.com",
                realm: "clientsB2COpel",
                clientId: "07364655-93cb-4194-8158-6b035ac2c24c",
                basic: "MDczNjQ2NTUtOTNjYi00MTk0LTgxNTgtNmIwMzVhYzJjMjRjOkYya0s3bEM1a0Y1cU43dE0wd1Q4a0UzY1cxZFAwd0M1cEk2dkMwc1E1aVA1Y044Y0o4",
                siteCode: "OP_DE_ESP",
                shortBrand: "OP",
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
        this.httpsAgent = new https.Agent({
            pfx: fs.readFileSync(__dirname + "/certs/mwp.dat"),
            passphrase: "y5Y2my5B",
        });
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
            this.receiveOldApi()
                .then(() => {
                    this.log.info("OldAPI Login succesful, but only mileage is available");
                    this.oldApiUpdateInterval = setInterval(() => {
                        this.receiveOldApi().catch((error) => {
                            this.log.warn("OldAPI Status failed");
                        });
                    }, this.config.interval * 60 * 1000);
                })
                .catch((error) => {
                    this.log.warn("OldAPI Login failed, only relevant for non eletric cars");
                });
        } catch (error) {
            this.log.error(error);
        }
        await this.loginNewApi();
        if (this.newApi.mym_access_token) {
            this.getnewApiData();
            this.newApiUpdateInterval = setInterval(() => {
                this.getnewApiData();
            }, this.config.interval * 60 * 1000);
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

    async loginNewApi() {
        let data = JSON.stringify({
            fields: { USR_PASSWORD: { value: this.config.password }, USR_EMAIL: { value: this.config.user } },
            action: "authenticate",
            siteCode: this.brands[this.config.type].siteCode,
            culture: "de-DE",
        });
        const access_token = await axios({
            method: "post",
            url: "https://id-dcr." + this.brands[this.config.type].brand + "/mobile-services/GetAccessToken",
            headers: {
                Accept: "*/*",
                Cookie: "PSACountry=DE",
                "User-Agent": "MyPeugeot/1.35.2 (iPhone; iOS 12.5.1; Scale/2.00)",
                "Accept-Language": "de-DE;q=1",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            data: "jsonRequest=" + encodeURIComponent(data),
        })
            .then(async (response) => {
                if (!response.data) {
                    this.log.error("Login old api failed maybe incorrect login information");

                    return;
                }
                this.log.debug(JSON.stringify(response.data));
                if (!response.data.accessToken) {
                    this.log.warn(JSON.stringify(response.data));
                    if (response.data && response.data.returnCode && response.data.returnCode === "NEED_CREATION") {
                        this.log.warn("No account for this e-mail or password incorrect");
                    }
                    if (response.data.returnCode === "NEED_AUTHORIZATION") {
                        this.log.info("new API needs Auth if this is failing please logout and login in the app");
                    } else {
                        this.log.warn("No Token received for old api ");
                        return;
                    }
                } else {
                    return response.data.accessToken;
                }
            })
            .catch((error) => {
                this.log.warn(error);
                this.log.warn("Login new api failed");
                error.response && this.log.warn(JSON.stringify(error.response.data));
            });
        if (!access_token) {
            return;
        }

        data = JSON.stringify({ site_code: this.brands[this.config.type].siteCode, ticket: this.oldAToken });
        this.log.debug(data);
        await axios({
            method: "get",
            url:
                "https://microservices.mym.awsmpsa.com/session/v1/accesstoken?source=APP&v=1.35.2&site_code=" +
                this.brands[this.config.type].siteCode +
                "&language=de&brand=" +
                this.brands[this.config.type].shortBrand +
                "&culture=de_DE",
            headers: {
                Host: "microservices.mym.awsmpsa.com",
                ticket: access_token,
                accept: "*/*",
                "user-agent": "MyPeugeot/1.35.2 (com.psa.mypeugeot; build:202206081500; iOS 14.8.0) Alamofire/5.6.1",
                "accept-language": "de-DE;q=1.0",
            },
            httpsAgent: this.httpsAgent,
        })
            .then(async (response) => {
                this.log.debug(JSON.stringify(response.data));
                if (response.data.success) {
                    await this.setObjectNotExistsAsync("newApi", {
                        type: "device",
                        common: {
                            name: "new API, only mileage available",
                            role: "indicator",
                        },
                        native: {},
                    });
                    this.newApi = response.data.success;
                }
            })
            .catch((error) => {
                this.log.warn(error);
                this.log.warn("receive new api failed");
                error.response && this.log.warn(JSON.stringify(error.response.data));
            });
    }
    async getnewApiData() {
        if (this.newApi && !this.newApi.mym_access_token) {
            return;
        }
        await axios({
            method: "get",
            url:
                "https://microservices.mym.awsmpsa.com/me/v1/user?source=APP&v=1.35.2&site_code=" +
                this.brands[this.config.type].siteCode +
                "&language=de&brand=" +
                this.brands[this.config.type].shortBrand +
                "&culture=de_DE",
            headers: {
                Host: "microservices.mym.awsmpsa.com",
                accept: "*/*",
                "mym-access-token": this.newApi.mym_access_token,
                "refresh-sams-cache": "1",
                "user-agent": "MyPeugeot/1.35.2 (com.psa.mypeugeot; build:202206081500; iOS 14.8.0) Alamofire/5.6.1",
                "accept-language": "de-DE;q=1.0",
            },
            httpsAgent: this.httpsAgent,
        })
            .then((response) => {
                this.log.debug(JSON.stringify(response.data));
                if (response.data.success) {
                    this.extractKeys(this, "newApi", response.data.success);
                }
            })
            .catch((error) => {
                this.log.warn(error);
                error.response && this.log.warn(JSON.stringify(error.response.data));
            });
    }
    receiveOldApi() {
        return new Promise((resolve, reject) => {
            const data = JSON.stringify({
                fields: { USR_PASSWORD: { value: this.config.password }, USR_EMAIL: { value: this.config.user } },
                action: "authenticate",
                siteCode: this.brands[this.config.type].siteCode,
                culture: "de-DE",
            });
            axios({
                method: "post",
                url: "https://id-dcr." + this.brands[this.config.type].brand + "/mobile-services/GetAccessToken",
                headers: {
                    Accept: "*/*",
                    Cookie: "BIGipServerAPAC_DCR_FEND_PROD.app~APAC_DCR_FEND_PROD_pool=655392778.20480.0000; DCROPENIDAP=77f8a8f32fb2c2ef7692bb9afa996486; PSACountry=DE",
                    "User-Agent": "MyPeugeot/1.29.1 (iPhone; iOS 12.5.1; Scale/2.00)",
                    "Accept-Language": "de-DE;q=1",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                data: "jsonRequest=" + encodeURIComponent(data),
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
                        if (response.data.returnCode === "NEED_AUTHORIZATION") {
                            this.log.info("Old API needs Auth if this is failing please logout and login in the app");
                            this.oldSession = response.data.session;
                            this.oldToken = response.data.token;
                            await this.receiveOldApiAuth();
                        } else {
                            this.log.warn("No Token received for old api ");
                            return;
                        }
                    } else {
                        this.oldAToken = response.data.accessToken;
                    }

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
                            reject();
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
    receiveOldApiAuth() {
        return new Promise((resolve, reject) => {
            const data = JSON.stringify({
                action: "authorize",
                siteCode: this.brands[this.config.type].siteCode,
                session: this.oldSession,
                token: this.oldToken,
                culture: "de-DE",
            });
            axios({
                method: "post",
                url: "https://id-dcr." + this.brands[this.config.type].brand + "/mobile-services/GetAccessToken",
                headers: {
                    "User-Agent": "MyPeugeot/1.29.3 (iPhone; iOS 14.7; Scale/2.00)",
                    "Accept-Language": "de-DE;q=1",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                data: "jsonRequest=" + encodeURIComponent(data),
            })
                .then(async (response) => {
                    if (!response.data) {
                        this.log.error("Auth old api failed maybe incorrect login information");
                        reject();
                        return;
                    }
                    this.log.debug(JSON.stringify(response.data));
                    if (!response.data.accessToken) {
                        this.log.warn(JSON.stringify(response.data));
                        this.log.warn("No Auth Token received for old api ");
                        return;
                    }
                    this.oldAToken = response.data.accessToken;
                    resolve();
                })
                .catch((error) => {
                    this.log.warn(error);
                    this.log.warn("Auth old api failed");
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
                    error.response && this.log.error(JSON.stringify(error.response.data));
                    if (error.response && error.response.data && error.response.data.code && error.response.data.code === 40410) {
                        this.log.error("No compatible vehicles found. Only electric cars are available for new api.");
                        this.log.info("You can find under oldAPI the mileage of the car.");
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
                    if (error.response && error.response.status === 401) {
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
        this.newApiUpdateInterval && this.clearInterval(this.newApiUpdateInterval);
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
