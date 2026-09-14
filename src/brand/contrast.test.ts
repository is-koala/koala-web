import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { brandTokens } from "./tokens";

const { paper, surface, ink, greenInk, greenDeep, muted, subtle } = brandTokens;

describe("metin kontrast bütçesi", () => {
  it("açık zeminde yazı renkleri WCAG AA 4,5:1 geçiyor", () => {
    for (const background of [paper, surface]) {
      expect(contrast(greenInk, background), `greenInk on ${background}`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(greenDeep, background), `greenDeep on ${background}`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(muted, background), `muted on ${background}`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(subtle, background), `subtle on ${background}`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(ink, background), `ink on ${background}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("yeşil dolgu üstündeki beyaz yazı AA eşiğini geçiyor", () => {
    // Marka yeşili (#82C180) bu eşiği geçmiyor; düğme ve koyu yüzeyler bu
    // yüzden mürekkep yeşilini kullanıyor. Test iki dolguyu da tutuyor.
    expect(contrast("#FFFFFF", greenInk)).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#FFFFFF", greenDeep)).toBeGreaterThanOrEqual(4.5);
  });

  it("CSS değişkenleri adlandırılmış marka tokenlarıyla aynı kalıyor", () => {
    expect(cssVariable("--koala-green")).toBe(brandTokens.green);
    expect(cssVariable("--koala-green-ink")).toBe(greenInk);
    expect(cssVariable("--koala-green-deep")).toBe(greenDeep);
    expect(cssVariable("--grey-900")).toBe(ink);
    expect(cssVariable("--grey-100")).toBe(surface);
    expect(cssVariable("--grey-700")).toBe(muted);
    expect(cssVariable("--text-subtle")).toBe(subtle);
    expect(cssVariable("--paper")).toBe(paper);
  });

  it("yazı ve düğme dolgusu mürekkep yeşilinden, marka yeşili dekor için", () => {
    const css = globalsCss();
    expect(css).toMatch(/--primary:\s*var\(--koala-green-ink\)/);
    expect(css).toMatch(/--brand-primary:\s*var\(--koala-green-ink\)/);
  });
});

function globalsCss(): string {
  return readFileSync(join(import.meta.dirname, "../app/globals.css"), "utf8");
}

function cssVariable(name: string): string {
  const match = new RegExp(`${name.replaceAll("-", "\\-")}:\\s*(#[0-9a-fA-F]{3,8})`).exec(globalsCss());
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
