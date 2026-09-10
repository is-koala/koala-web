// LHCI CommonJS yükler; Playwright, CI'ın kurduğu Chromium ikilisini verir.
/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require("@playwright/test");
const budget = require("./lighthouse-budget.cjs");

const host = "127.0.0.1";
const port = process.env.LHCI_PORT ?? "3200";
const origin = `http://${host}:${port}`;

module.exports = {
  ci: {
    collect: {
      chromePath: chromium.executablePath(),
      startServerCommand: "node scripts/start-lighthouse-server.mjs",
      startServerReadyPattern: "Lighthouse servers ready",
      startServerReadyTimeout: 90_000,
      url: budget.urls.map((path) => `${origin}${path}`),
      numberOfRuns: budget.numberOfRuns,
      settings: budget.settings,
    },
    assert: {
      assertions: budget.assertions,
    },
    upload: {
      target: "filesystem",
      outputDir: ".lighthouseci/reports",
    },
  },
};
