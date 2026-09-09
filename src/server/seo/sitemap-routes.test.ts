import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET as getIndex } from "@/app/sitemap.xml/route";
import { GET as getShard } from "@/app/sitemap/[...file]/route";
import { envelope, jsonResponse } from "../../../tests/support/session-cookies";

const version = "11111111-1111-4111-8111-111111111111";
const nilVersion = "00000000-0000-0000-0000-000000000000";
const versionSeven = "01890f12-e7b7-7cc3-98c7-123456789abc";
const jobId = "00000000-0000-4000-8000-000000000001";

describe("sitemap HTTP sınırı", () => {
  beforeEach(() => {
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-09-09T12:00:00Z"));
    vi.stubEnv("API_URL", "https://api.example.test");
    vi.stubEnv("APP_VERSION", "1.4.0");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://iskoala.com");
    vi.stubEnv("NEXT_PUBLIC_APP_URL_SCHEME", "koala");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("bozuk version veya shard biçimini backend'e göndermeden 400/no-store yapar", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    for (const file of [
      ["jobs", "not-a-version", "0.xml"],
      ["jobs", version, "not-a-shard.xml"],
      ["jobs", version, "2147483648.xml"],
    ]) {
      const response = await shard(file);
      expect(response.status).toBe(400);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("x-robots-tag")).toBe("noindex");
      expect(await response.text()).toBe("Geçersiz site haritası isteği");
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("bilinmeyen version ve negatif/geçerli shard için backend 404'ünü aynen ve cache'siz taşır", async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        jsonResponse(404, {
          success: false,
          errorCode: "SITEMAP_MANIFEST_NOT_FOUND",
          errorCategory: "RESOURCE_NOT_FOUND",
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    for (const [candidateVersion, shardNumber] of [
      [version, -1],
      [nilVersion, 0],
      [versionSeven, 0],
    ] as const) {
      const response = await shard(["jobs", candidateVersion, `${shardNumber}.xml`]);

      expect(response.status).toBe(404);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("x-robots-tag")).toBe("noindex");
      expect(await response.text()).toBe("Bulunamadı");
    }
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(`/manifests/${version}/shards/-1`);
  });

  it("backend sitemap rate limitini 429/no-store olarak taşır", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          jsonResponse(429, {
            success: false,
            errorCode: "AUTH_TOO_MANY_REQUESTS",
            errorCategory: "RATE_LIMITED",
          }),
        ),
      ),
    );

    const shardResponse = await shard(["jobs", version, "0.xml"]);
    const indexResponse = await getIndex();

    for (const response of [shardResponse, indexResponse]) {
      expect(response.status).toBe(429);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("retry-after")).toBeNull();
      expect(response.headers.get("x-robots-tag")).toBe("noindex");
      expect(await response.text()).toBe("Çok fazla site haritası isteği");
    }
  });

  it("backend Retry-After gönderirse 429 yanıtına taşır, değer yoksa uydurmaz", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: false,
            errorCode: "AUTH_TOO_MANY_REQUESTS",
            errorCategory: "RATE_LIMITED",
          }),
          {
            status: 429,
            headers: { "Content-Type": "application/json", "Retry-After": "17" },
          },
        ),
      ),
    );

    const response = await shard(["jobs", version, "0.xml"]);

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("17");
  });

  it("geçerli version'lı shard'ı XML ve cache'siz döndürür", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          200,
          envelope({
            version,
            shard: 0,
            entries: [{ id: jobId, updatedAt: "2026-09-09T10:11:12Z" }],
          }),
        ),
      ),
    );

    const response = await shard(["jobs", version, "0.xml"]);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/xml");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toContain(
      `<loc>https://iskoala.com/is-ilanlari/${jobId}</loc><lastmod>2026-09-09T10:11:12Z</lastmod>`,
    );
  });

  it("index cache başlığını manifest expiry'sine kırpar ve stale ilan etmez", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          200,
          envelope({
            version,
            createdAt: "2026-09-09T11:59:00Z",
            expiresAt: "2026-09-09T12:02:03Z",
            entryCount: 0,
            shardSize: 50_000,
            shards: [],
          }),
        ),
      ),
    );

    const response = await getIndex();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, max-age=123, s-maxage=123");
  });

  it("manifest backend'i 5xx verirse index yalnız güvenilir statik sitemap ile ayakta kalır", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(503, {
          success: false,
          errorCode: "SITEMAP_TEMPORARILY_UNAVAILABLE",
          errorCategory: "UNEXPECTED",
          message: "Internal upstream detail",
        }),
      ),
    );

    const response = await getIndex();
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain("https://iskoala.com/sitemap/static.xml");
    expect(body).not.toContain("Internal upstream detail");
  });
});

async function shard(file: readonly string[]): Promise<Response> {
  return getShard(new Request("https://iskoala.com/sitemap/test"), {
    params: Promise.resolve({ file }),
  });
}
