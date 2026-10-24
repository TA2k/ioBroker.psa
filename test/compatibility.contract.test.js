"use strict";

const fs = require("fs");
const path = require("path");
const { expect } = require("chai");
const Json2iob = require("json2iob");

function createMockAdapter() {
  return {
    states: {},
    objects: {},
    log: {
      debug() {},
      info() {},
      warn() {},
      error() {},
    },
    setStateAsync: async function (key, value) {
      this.states[key] = value;
      return Promise.resolve();
    },
    extendObjectAsync: async function (id, obj) {
      this.objects[id] = { ...obj, id };
      return Promise.resolve();
    },
  };
}

function loadFixture(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", name), "utf8"));
}

describe("PSA legacy object contract", function () {
  it("preserves the current legacy state IDs and value paths for user and vehicle status payloads", async function () {
    const adapter = createMockAdapter();
    const parser = new Json2iob(adapter);
    const userPayload = loadFixture("stellantis-user.json");
    const statusPayload = loadFixture("stellantis-status.json");

    await parser.parse("user", userPayload, { write: true });
    await parser.parse("VF3TEST12345.status", statusPayload, { preferedArrayName: "type", write: true });

    expect(adapter.states).to.deep.equal({
      "user._embedded.veh123.id": "veh123",
      "user._embedded.veh123.vin": "VF3TEST12345",
      "user._embedded.veh123.brand": "Peugeot",
      "user._embedded.veh123.model": "e-208",
      "VF3TEST12345.status.car.gps.latitude": 48.1,
      "VF3TEST12345.status.car.gps.longitude": 11.6,
      "VF3TEST12345.status.car.battery.level": 80,
      "VF3TEST12345.status.type": "vehicle",
    });

    expect(adapter.objects["user._embedded.veh123.vin"].common).to.deep.include({
      name: "vin",
      role: "text",
      type: "string",
      read: true,
      write: true,
    });

    expect(adapter.objects["VF3TEST12345.status.car.gps.latitude"].common).to.deep.include({
      name: "latitude",
      role: "level",
      type: "number",
      read: true,
      write: true,
    });
  });

  it("detects a renamed ID or changed common metadata as a compatibility regression", async function () {
    const adapter = createMockAdapter();
    const parser = new Json2iob(adapter);
    const userPayload = loadFixture("stellantis-user.json");

    await parser.parse("user", userPayload, { write: true });

    expect(Object.keys(adapter.objects)).to.include.members([
      "user",
      "user._embedded",
      "user._embedded.veh123",
      "user._embedded.veh123.id",
      "user._embedded.veh123.vin",
      "user._embedded.veh123.brand",
      "user._embedded.veh123.model",
    ]);

    expect(adapter.objects["user._embedded.veh123.vin"].common.type).to.equal("string");
    expect(adapter.objects["user._embedded.veh123.brand"].common.type).to.equal("string");
    expect(adapter.objects["user._embedded.veh123.id"].common.type).to.equal("string");
  });
});
