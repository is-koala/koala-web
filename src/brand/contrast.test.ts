import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { brandTokens } from "./tokens";

const paper = "#fffdf9";
const ink = "#282828";

describe("metin kontrast bütçesi", () => {
  it("açık zemindeki marka ve soluk metin WCAG AA 4,5:1 geçiyor", () => {
    expect(contrast(brandTokens.brandPrimary, paper)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(brandTokens.brandAccent, paper)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(cssVariable("--muted"), paper)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(brandTokens.ink, paper)).toBeGreaterThanOrEqual(4.5);
  });

  it("koyu manifesto kaşlığı da AA eşiğini geçiyor", () => {
    expect(contrast(cssVariable("--manifesto-eyebrow"), ink)).toBeGreaterThanOrEqual(4.5);
  });

  it("CSS değişkenleri adlandırılmış marka tokenlarıyla aynı kalıyor", () => {
    expect(cssVariable("--brand-primary")).toBe(brandTokens.brandPrimary);
    expect(cssVariable("--brand-accent")).toBe(brandTokens.brandAccent);
    expect(cssVariable("--ink")).toBe(brandTokens.ink);
  });
});

function cssVariable(name: string): string {
  const css = readFileSync(join(import.meta.dirname, "../app/globals.css"), "utf8");
  const match = new RegExp(`${name.replaceAll("-", "\\-")}:\\s*(#[0-9a-fA-F]{3,8})`).exec(css);
  if (!match) throw new Error(`${name} globals.css içinde bulunamadı`);
  return match[1];
}

function contrast(foreground: string, background: string): number {
  const [brighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)].sort(
    (left, right) => right - left,
  );
  return (brighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(hex: string): number {
  const value = hex.replace("#", "");
  const channels = [0, 1, 2].map((index) => {
    const channel = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}
