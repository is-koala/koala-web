import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { legalCatalog } from "./catalog";

describe("yasal metin sürüm arşivi", () => {
  it("çerez politikasında 1.0 dosyasını korurken 1.1'i güncel yapar", () => {
    expect(legalCatalog["cerez-politikasi"].version).toBe("1.1");

    const policyDirectory = join(
      process.cwd(),
      "src/content/legal/cerez-politikasi",
    );
    expect(existsSync(join(policyDirectory, "1.0.mdx"))).toBe(true);
    expect(existsSync(join(policyDirectory, "1.1.mdx"))).toBe(true);
  });
});
