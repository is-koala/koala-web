import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const sourceRoot = path.resolve(import.meta.dirname, "..");

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    // Testler derlemeye girmez; yalnız gönderilen kaynak taranır.
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

describe("server-only sınırı", () => {
  it("src/server altındaki her modül ilk satırında server-only işaretini taşır", () => {
    const unmarked = sourceFiles(path.join(sourceRoot, "server")).filter(
      (file) => readFileSync(file, "utf8").split("\n")[0] !== 'import "server-only";',
    );

    expect(unmarked).toEqual([]);
  });

  it("backend adresini yalnız server katmanı okur", () => {
    const leaking = sourceFiles(sourceRoot)
      .filter((file) => !file.startsWith(path.join(sourceRoot, "server")))
      .filter((file) => /process\.env(\.|\[")API_URL/.test(readFileSync(file, "utf8")));

    expect(leaking).toEqual([]);
  });

  it("backend adresi public ortam değişkeni olarak sızmaz", () => {
    const sources = sourceFiles(sourceRoot).map((file) => readFileSync(file, "utf8"));

    expect(sources.some((source) => source.includes("NEXT_PUBLIC_API"))).toBe(false);
  });
});
