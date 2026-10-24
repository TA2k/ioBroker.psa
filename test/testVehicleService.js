"use strict";

const { expect } = require("chai");
const { createVehicleService } = require("../lib/vehicle");

describe("PSA vehicle v4 service", function () {
  it("loads vehicle list and detail payloads without mutating object state directly", async function () {
    const calls = [];
    const vehicleService = createVehicleService({
      transport: {
        getVehicleList: async () => ({
          _embedded: {
            vehicles: [{ id: "veh123", vin: "VF3TEST12345" }],
          },
        }),
        getJson: async (url) => {
          calls.push(url);
          if (url.includes("/veh123")) {
            return { brand: "Peugeot", model: "e-208" };
          }
          return { battery: { level: 80 } };
        },
      },
      json2iob: {
        parse: () => {},
      },
      log: {
        info() {},
        debug() {},
        warn() {},
        error() {},
      },
    });

    const vehicles = await vehicleService.listVehicles();
    const details = await vehicleService.getVehicleDetails("veh123", "VF3TEST12345");

    expect(vehicles._embedded.vehicles[0].vin).to.equal("VF3TEST12345");
    expect(details.brand).to.equal("Peugeot");
    expect(calls).to.include("https://api.groupe-psa.com/connectedcar/v4/user/vehicles/veh123");
  });

  it("forwards an abort signal to status requests", async function () {
    const controller = new AbortController();
    let forwardedSignal;
    const vehicleService = createVehicleService({
      transport: {
        getJson: async (_url, _params, _headers, signal) => {
          forwardedSignal = signal;
          return { battery: { level: 80 } };
        },
      },
      json2iob: { parse() {} },
      log: { info() {} },
    });

    await vehicleService.getVehicleStatus("veh123", "VF3TEST12345", controller.signal);

    expect(forwardedSignal).to.equal(controller.signal);
  });
});
