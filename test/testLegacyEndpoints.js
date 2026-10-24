"use strict";

const fs = require("fs");
const path = require("path");
const { expect } = require("chai");

describe("PSA runtime backend boundary", function () {
  it("uses the v4 runtime endpoints and contains no retired v1/v2 fallbacks", function () {
    const mainSource = fs.readFileSync(path.join(__dirname, "..", "main.js"), "utf8");
    const transportSource = fs.readFileSync(path.join(__dirname, "..", "lib", "transport.js"), "utf8");
    const vehicleSource = fs.readFileSync(path.join(__dirname, "..", "lib", "vehicle.js"), "utf8");
    const retiredRuntimePatterns = [
      /\/api\/v1\/user/,
      /mobile-services\/GetAccessToken/,
      /microservices\.mym\.awsmpsa\.com/,
      /receiveOldApi(?:Auth)?\s*\(/,
      /getnewApiData\s*\(/,
      /loginNewApi\s*\(/,
      /mwp\.dat/,
    ];

    expect(transportSource).to.include("connectedcar/v4");
    expect(vehicleSource).to.include("connectedcar/v4");
    for (const pattern of retiredRuntimePatterns) {
      expect(mainSource, `main.js must not contain retired runtime path ${pattern}`).not.to.match(pattern);
      expect(transportSource, `lib/transport.js must not contain retired runtime path ${pattern}`).not.to.match(pattern);
      expect(vehicleSource, `lib/vehicle.js must not contain retired runtime path ${pattern}`).not.to.match(pattern);
    }
  });
});
