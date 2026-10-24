"use strict";

const { expect } = require("chai");
const { prepareLegacyPayload } = require("../lib/compatibility");

describe("PSA compatibility mapping", function () {
  it("preserves the current legacy structure while stripping undefined values", function () {
    const payload = {
      _embedded: {
        vehicles: [{ id: "veh123", vin: "VF3TEST12345", note: undefined }],
      },
      car: {
        battery: { level: 80 },
        gps: { latitude: 48.1 },
      },
      extra: undefined,
    };

    const prepared = prepareLegacyPayload(payload);

    expect(prepared).to.deep.equal({
      _embedded: {
        vehicles: [{ id: "veh123", vin: "VF3TEST12345" }],
      },
      car: {
        battery: { level: 80 },
        gps: { latitude: 48.1 },
      },
    });
  });
});
