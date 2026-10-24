"use strict";

const { prepareLegacyPayload } = require("./compatibility");

function createVehicleService({ transport, json2iob, log, clientId }) {
  return {
    async listVehicles(signal) {
      const vehicles = prepareLegacyPayload(await transport.getVehicleList(signal));
      if (json2iob && typeof json2iob.parse === "function") {
        json2iob.parse("user", vehicles);
      }
      if (log && typeof log.info === "function") {
        log.info("Found " + (vehicles && vehicles._embedded && vehicles._embedded.vehicles ? vehicles._embedded.vehicles.length : 0) + " vehicles");
      }
      return vehicles;
    },

    async getVehicleDetails(vehicleId, vin, signal) {
      const url = `https://api.groupe-psa.com/connectedcar/v4/user/vehicles/${vehicleId}`;
      const details = prepareLegacyPayload(await transport.getJson(url, { client_id: clientId }, {}, signal));
      if (json2iob && typeof json2iob.parse === "function") {
        json2iob.parse(`${vin}.details`, details, { preferedArrayName: "type" });
      }
      return details;
    },

    async getVehicleStatus(vehicleId, vin, signal) {
      const url = `https://api.groupe-psa.com/connectedcar/v4/user/vehicles/${vehicleId}/status`;
      const status = prepareLegacyPayload(await transport.getJson(url, { client_id: clientId }, {}, signal));
      if (json2iob && typeof json2iob.parse === "function") {
        json2iob.parse(`${vin}.status`, status, { preferedArrayName: "type" });
      }
      return status;
    },
  };
}

module.exports = {
  createVehicleService,
};
