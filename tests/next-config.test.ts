import { describe, expect, it, vi } from "vitest";

vi.mock("@next/mdx", () => ({ default: () => (config: unknown) => config }));
vi.mock("@sentry/nextjs/config", () => ({
  withSentryConfig: (config: unknown) => config,
}));

describe("Next sunucu action yükleme bütçesi", () => {
  it("dört 10 MiB kimlik fotoğrafını multipart payıyla action'a ulaştırır", async () => {
    const { default: nextConfig } = await import("../next.config");

    expect(nextConfig).toMatchObject({
      experimental: {
        serverActions: { bodySizeLimit: "42mb" },
      },
    });
  });
});
