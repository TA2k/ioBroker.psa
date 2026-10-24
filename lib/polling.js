"use strict";

function createPollingService({ intervalMs, poll, onError, schedule = setInterval, cancel = clearInterval }) {
  let timer = null;
  let inFlight = null;
  let controller = null;
  let stopped = false;

  async function run() {
    if (stopped || inFlight) {
      return false;
    }

    controller = new AbortController();
    const activeController = controller;
    const operation = Promise.resolve().then(() => poll(activeController.signal));
    inFlight = operation;

    try {
      await operation;
      return true;
    } catch (error) {
      if (!activeController.signal.aborted && typeof onError === "function") {
        try {
          onError(error);
        } catch {
          // Error reporting must not create an unhandled rejection from the timer callback.
        }
      }
      return false;
    } finally {
      if (inFlight === operation) {
        inFlight = null;
        controller = null;
      }
    }
  }

  return {
    start() {
      if (timer !== null || stopped) {
        return;
      }
      timer = schedule(() => {
        void run();
      }, intervalMs);
    },

    stop() {
      stopped = true;
      if (timer !== null) {
        cancel(timer);
        timer = null;
      }
      if (controller) {
        controller.abort();
      }
    },

    run,
  };
}

module.exports = { createPollingService };
