"use strict";

const { expect } = require("chai");
const { createPollingService } = require("../lib/polling");

describe("PSA polling lifecycle", function () {
  it("prevents overlapping polls when a timer fires repeatedly", async function () {
    let timerCallback;
    let pollCount = 0;
    let finishPoll;
    const service = createPollingService({
      intervalMs: 1000,
      schedule: (callback) => {
        timerCallback = callback;
        return 1;
      },
      cancel() {},
      poll: () => {
        pollCount += 1;
        return new Promise((resolve) => {
          finishPoll = resolve;
        });
      },
    });

    service.start();
    const activePoll = service.run();
    timerCallback();
    await Promise.resolve();

    expect(pollCount).to.equal(1);
    finishPoll();
    expect(await activePoll).to.equal(true);
  });

  it("aborts an in-flight poll and cancels its timer on shutdown", async function () {
    let timerCallback;
    let canceledTimer;
    let wasAborted = false;
    let reportedErrors = 0;
    const service = createPollingService({
      intervalMs: 1000,
      schedule: (callback) => {
        timerCallback = callback;
        return "timer-id";
      },
      cancel: (timerId) => {
        canceledTimer = timerId;
      },
      poll: (signal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => {
            wasAborted = true;
            reject(Object.assign(new Error("canceled"), { code: "ERR_CANCELED" }));
          });
        }),
      onError: () => {
        reportedErrors += 1;
      },
    });

    service.start();
    timerCallback();
    await Promise.resolve();
    service.stop();
    await Promise.resolve();

    expect(canceledTimer).to.equal("timer-id");
    expect(wasAborted).to.equal(true);
    expect(reportedErrors).to.equal(0);
  });

  it("reports poll failures and can recover on the next run", async function () {
    let attempts = 0;
    let reportedErrors = 0;
    const service = createPollingService({
      intervalMs: 1000,
      poll: async () => {
        attempts += 1;
        if (attempts === 1) {
          throw new Error("temporary failure");
        }
      },
      onError: (error) => {
        expect(error.message).to.equal("temporary failure");
        reportedErrors += 1;
      },
    });

    expect(await service.run()).to.equal(false);
    expect(await service.run()).to.equal(true);
    expect(attempts).to.equal(2);
    expect(reportedErrors).to.equal(1);
  });
});
