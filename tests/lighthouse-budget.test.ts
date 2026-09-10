import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

interface LighthouseAssertion {
  aggregationMethod: string;
  maxNumericValue?: number;
  minScore?: number;
}

interface LighthouseBudget {
  urls: string[];
  numberOfRuns: number;
  settings: {
    formFactor: string;
    throttling: {
      cpuSlowdownMultiplier: number;
      rttMs: number;
      throughputKbps: number;
    };
    throttlingMethod: string;
  };
  assertions: Record<string, [string, LighthouseAssertion]>;
}

const require = createRequire(import.meta.url);
const budget = require("../lighthouse-budget.cjs") as LighthouseBudget;

describe("Lighthouse performans bütçesi", () => {
  it("ilan listesi ve ilan ayrıntısını düzenli-3G laboratuvar profilinde ölçer", () => {
    expect(budget.urls).toEqual([
      "/",
      "/is-ilanlari",
      "/is-ilanlari/9c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60",
    ]);
    expect(budget.numberOfRuns).toBe(2);
    expect(budget.settings).toMatchObject({
      formFactor: "mobile",
      throttlingMethod: "simulate",
      throttling: {
        rttMs: 300,
        throughputKbps: 700,
        cpuSlowdownMultiplier: 4,
      },
    });
  });

  it("ilk yük JS, LCP, TBT, CLS ve performans puanı aşıldığında kapıyı kırar", () => {
    const { assertions } = budget;

    expect(assertions["resource-summary:script:size"]).toEqual([
      "error",
      { maxNumericValue: 256_000, aggregationMethod: "optimistic" },
    ]);
    expect(assertions["largest-contentful-paint"]).toEqual([
      "error",
      { maxNumericValue: 12_000, aggregationMethod: "optimistic" },
    ]);
    expect(assertions["total-blocking-time"]).toEqual([
      "error",
      { maxNumericValue: 300, aggregationMethod: "optimistic" },
    ]);
    expect(assertions["cumulative-layout-shift"]).toEqual([
      "error",
      { maxNumericValue: 0.1, aggregationMethod: "optimistic" },
    ]);
    expect(assertions["categories:performance"]).toEqual([
      "error",
      { minScore: 0.7, aggregationMethod: "optimistic" },
    ]);
  });

  it("kalite kapısı Lighthouse'u build sonrası, Playwright Chromium ile koşar", () => {
    const packageMetadata = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf8"),
    ) as { scripts?: Record<string, string> };
    const workflow = readFileSync(join(process.cwd(), ".github/workflows/ci.yml"), "utf8");

    expect(packageMetadata.scripts?.["test:performance"]).toBe("lhci autorun");
    expect(packageMetadata.scripts?.["test:accessibility"]).toContain(
      "tests/e2e/accessibility.spec.ts",
    );
    expect(packageMetadata.scripts?.["test:accessibility"]).toContain(
      "tests/e2e/keyboard.spec.ts",
    );
    expect(packageMetadata.scripts?.["test:e2e"]).toContain("playwright test");
    expect(workflow).toMatch(/npx playwright install --with-deps chromium/);
    expect(workflow).toMatch(/npm run test:performance/);
    expect(workflow.indexOf("npm run test:performance")).toBeGreaterThan(
      workflow.indexOf("npx playwright install --with-deps chromium"),
    );
    expect(workflow.indexOf("npm run test:e2e")).toBeGreaterThan(
      workflow.indexOf("npm run test:performance"),
    );
  });
});
