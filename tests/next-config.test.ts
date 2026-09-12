import { describe, expect, it, vi } from "vitest";

vi.mock("@next/mdx", () => ({ default: () => (config: unknown) => config }));
vi.mock("@sentry/nextjs/config", () => ({
  withSentryConfig: (config: unknown) => config,
}));

describe("Next sunucu action yükleme bütçesi", () => {
  it("kimlik yüklemesi ayrıldıktan sonra genel action sınırını büyütmez", async () => {
    const { default: nextConfig } = await import("../next.config");

    expect(nextConfig).toMatchObject({
      experimental: {
        serverActions: { bodySizeLimit: "11mb" },
      },
    });
  });
});
