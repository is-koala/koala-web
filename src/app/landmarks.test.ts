import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { mainContentId } from "@/lib/landmarks";

const projectRoot = path.resolve(import.meta.dirname, "../..");

const shells = [
  "src/app/(marketing)/layout.tsx",
  "src/app/(account)/layout.tsx",
  "src/app/(legal)/[slug]/v/[version]/page.tsx",
  "src/app/error.tsx",
  "src/app/global-error.tsx",
  "src/app/not-found.tsx",
  "src/components/legal-layout.tsx",
  "src/components/app-shell.tsx",
] as const;

describe("klavye atlama hedefi", () => {
  it("kök yerleşim tekrarlanan menüyü #ana-icerik'e atlar", () => {
    const layout = readFileSync(path.join(import.meta.dirname, "layout.tsx"), "utf8");

    expect(mainContentId).toBe("ana-icerik");
    expect(layout).toContain("href={`#${mainContentId}`}");
    expect(layout).toContain("Ana içeriğe geç");
  });

  it("her kabuk MainContent ile tek atlama hedefini taşıyor", () => {
    const definition = readFileSync(
      path.join(projectRoot, "src/components/main-content.tsx"),
      "utf8",
    );
    expect(definition).toContain("id={mainContentId}");
    expect(definition).toContain("tabIndex={-1}");

    for (const file of shells) {
      expect(readFileSync(path.join(projectRoot, file), "utf8"), file).toContain("<MainContent");
    }
  });
});
