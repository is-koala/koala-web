import { beforeEach, describe, expect, it, vi } from "vitest";

const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
);

vi.mock("next/navigation", () => ({ notFound }));
vi.mock("@/content/legal/cerez-politikasi/1.0.mdx", () => ({
  default: () => null,
}));
vi.mock("@/content/legal/cerez-politikasi/1.1.mdx", () => ({
  default: () => null,
}));
vi.mock("@/content/legal/gizlilik-politikasi/1.0.mdx", () => ({
  default: () => null,
}));
vi.mock("@/content/legal/kullanim-kosullari/1.0.mdx", () => ({
  default: () => null,
}));
vi.mock("@/content/legal/kvkk-aydinlatma/1.0.mdx", () => ({
  default: () => null,
}));
vi.mock("@/content/legal/mesafeli-hizmet-sozlesmesi/1.0.mdx", () => ({
  default: () => null,
}));

import Page, { generateMetadata } from "./page";

const invalidRoutes = [
  {
    name: "bilinmeyen slug",
    slug: "sir-112-loga-girmemeli",
    version: "1.0",
  },
  {
    name: "bilinmeyen sürüm",
    slug: "cerez-politikasi",
    version: "9.9",
  },
] as const;

describe("sürümlü yasal metin rotası", () => {
  beforeEach(() => {
    notFound.mockClear();
  });

  it.each(invalidRoutes)(
    "$name metadata sınırında güvenli 404 üretir",
    async ({ slug, version }) => {
      await expect(
        generateMetadata({
          params: Promise.resolve({ slug, version }),
        }),
      ).rejects.toHaveProperty("message", "NEXT_NOT_FOUND");
    },
  );

  it.each(invalidRoutes)(
    "$name sayfa sınırında güvenli 404 üretir",
    async ({ slug, version }) => {
      await expect(
        Page({ params: Promise.resolve({ slug, version }) }),
      ).rejects.toHaveProperty("message", "NEXT_NOT_FOUND");
    },
  );
});
