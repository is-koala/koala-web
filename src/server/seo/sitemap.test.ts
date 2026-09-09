import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { envelope, jsonResponse } from "../../../tests/support/session-cookies";

import {
  parseSitemapShardTarget,
  readSitemapIndex,
  readSitemapShard,
  sitemapEntriesXml,
  sitemapIndexXml,
  type SitemapIndexEntry,
} from "./sitemap";

const version = "11111111-1111-4111-8111-111111111111";
const nilVersion = "00000000-0000-0000-0000-000000000000";
const versionSeven = "01890f12-e7b7-7cc3-98c7-123456789abc";
const firstJob = "00000000-0000-4000-8000-000000000001";
const secondJob = "00000000-0000-4000-8000-000000000002";

describe("manifest tabanlı sitemap yüzeyi", () => {
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

  it("yalnız backend manifestinin ilan ettiği version'lı shard yollarını indexe koyar", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, envelope(manifestDto())),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(readSitemapIndex()).resolves.toEqual({
      entries: [
        { id: "static", url: "https://iskoala.com/sitemap/static.xml" },
        {
          id: `jobs/${version}/0`,
          url: `https://iskoala.com/sitemap/jobs/${version}/0.xml`,
        },
        {
          id: `jobs/${version}/1`,
          url: `https://iskoala.com/sitemap/jobs/${version}/1.xml`,
        },
      ],
      cache: { freshSeconds: 300, staleSeconds: 0 },
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.test/sitemap/jobs/manifest");
    expect(url).not.toContain("/jobs?");
    expect(init).toMatchObject({ cache: "no-store" });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("boş manifestte yalnız statik shard'ı ilan eder", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          200,
          envelope(manifestDto({ entryCount: 0, shards: [] })),
        ),
      ),
    );

    await expect(readSitemapIndex()).resolves.toEqual({
      entries: [{ id: "static", url: "https://iskoala.com/sitemap/static.xml" }],
      cache: { freshSeconds: 300, staleSeconds: 0 },
    });
  });

  it("manifest backend'i geçici olarak okunamazsa statik ve yasal shard'ı korur", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("bağlantı yok")));

    await expect(readSitemapIndex()).resolves.toEqual({
      entries: [{ id: "static", url: "https://iskoala.com/sitemap/static.xml" }],
      cache: { freshSeconds: 300, staleSeconds: 300 },
    });
  });

  it.each([
    ["imkânsız takvim tarihi", { createdAt: "2030-02-30T10:00:00Z" }],
    ["süresi dolmuş manifest", { expiresAt: "2020-09-09T11:00:00Z" }],
    ["protokolü aşan shard", { shardSize: 50_001 }],
    ["toplamla uyuşmayan metadata", { entryCount: 4 }],
    [
      "tekrar eden shard numarası",
      { shards: [{ number: 0, entryCount: 2 }, { number: 0, entryCount: 1 }] },
    ],
  ] as const)("%s taşıyan manifesti fail-closed reddeder", async (_name, override) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(200, envelope(manifestDto(override)))),
    );

    await expect(readSitemapIndex()).rejects.toThrow("Geçersiz sitemap manifesti");
  });

  it("yanıt cache'e girmeden bitecek manifesti fail-closed reddeder", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          200,
          envelope(manifestDto({ expiresAt: new Date(Date.now() + 999).toISOString() })),
        ),
      ),
    );

    await expect(readSitemapIndex()).rejects.toThrow("Geçersiz sitemap manifesti");
  });

  it("index cache'ini authoritative manifest lease'ine kırpar ve stale süre eklemez", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          200,
          envelope(manifestDto({ expiresAt: new Date(Date.now() + 123_000).toISOString() })),
        ),
      ),
    );

    await expect(readSitemapIndex()).resolves.toMatchObject({
      cache: { freshSeconds: 123, staleSeconds: 0 },
    });
  });

  it("49.999 ilan shard'ı ile statik shard'ı 50.000 giriş sınırında kabul eder", async () => {
    const shards = Array.from({ length: 49_999 }, (_, number) => ({ number, entryCount: 1 }));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(200, envelope(manifestDto({ entryCount: 49_999, shardSize: 1, shards }))),
      ),
    );

    const index = await readSitemapIndex();

    expect(index.entries).toHaveLength(50_000);
    expect(index.entries.at(-1)?.id).toBe(`jobs/${version}/49998`);
  });

  it("49.999 sınırını aşan 50.000 ilan shard'ını reddeder", async () => {
    const shards = Array.from({ length: 50_000 }, (_, number) => ({ number, entryCount: 1 }));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          200,
          envelope(
            manifestDto({ entryCount: 50_000, shardSize: 1, shards }),
          ),
        ),
      ),
    );

    await expect(readSitemapIndex()).rejects.toThrow("Geçersiz sitemap manifesti");
  });

  it("version'lı shard'da authoritative updatedAt değerini taşır, null için tarih uydurmaz", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        200,
        envelope({
          version,
          shard: 1,
          entries: [
            { id: firstJob, updatedAt: "2026-09-09T10:11:12.123456Z" },
            { id: secondJob, updatedAt: null },
          ],
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(readSitemapShard({ kind: "jobs", version, shard: 1 })).resolves.toEqual([
      {
        url: `https://iskoala.com/is-ilanlari/${firstJob}`,
        changeFrequency: "weekly",
        lastModified: "2026-09-09T10:11:12.123456Z",
      },
      {
        url: `https://iskoala.com/is-ilanlari/${secondJob}`,
        changeFrequency: "weekly",
      },
    ]);

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      `https://api.example.test/sitemap/jobs/manifests/${version}/shards/1`,
    );
  });

  it.each([
    ["yanlış version", { version: "22222222-2222-4222-8222-222222222222", shard: 1, entries: [] }],
    ["yanlış shard", { version, shard: 0, entries: [] }],
    [
      "tekrar eden ilan",
      { version, shard: 1, entries: [{ id: firstJob, updatedAt: null }, { id: firstJob, updatedAt: null }] },
    ],
    [
      "imkânsız updatedAt",
      { version, shard: 1, entries: [{ id: firstJob, updatedAt: "2026-02-30T10:00:00Z" }] },
    ],
    [
      "fazladan ilan alanı",
      { version, shard: 1, entries: [{ id: firstJob, updatedAt: null, title: "Sızmamalı" }] },
    ],
  ] as const)("%s taşıyan shard yanıtını fail-closed reddeder", async (_name, data) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(200, envelope(data))),
    );

    await expect(
      readSitemapShard({ kind: "jobs", version, shard: 1 }),
    ).rejects.toThrow("Geçersiz sitemap shard'ı");
  });

  it("statik shard kanonikleri taşır ve tarih uydurmaz", async () => {
    const entries = await readSitemapShard({ kind: "static" });

    expect(entries).toContainEqual({
      url: "https://iskoala.com/",
      changeFrequency: "monthly",
    });
    expect(entries).toContainEqual({
      url: "https://iskoala.com/gizlilik-politikasi",
      changeFrequency: "monthly",
    });
    expect(entries.every((entry) => entry.lastModified === undefined)).toBe(true);
  });

  it("version ve signed 32-bit shard biçimini route sınırında ayırır", () => {
    expect(parseSitemapShardTarget(["static.xml"])).toEqual({ kind: "static" });
    expect(parseSitemapShardTarget(["jobs", version, "0.xml"])).toEqual({
      kind: "jobs",
      version,
      shard: 0,
    });
    expect(parseSitemapShardTarget(["jobs", version.toUpperCase(), "-1.xml"])).toEqual({
      kind: "jobs",
      version,
      shard: -1,
    });
    expect(parseSitemapShardTarget(["jobs", "not-a-version", "0.xml"])).toBeNull();
    expect(parseSitemapShardTarget(["jobs", version, "01.xml"])).toBeNull();
    expect(parseSitemapShardTarget(["jobs", version, "2147483648.xml"])).toBeNull();
    expect(parseSitemapShardTarget(["unknown.xml"])).toBeNull();
  });

  it("Java UUID.parse sözleşmesindeki nil ve v7 version'ları backend kararına bırakır", () => {
    expect(parseSitemapShardTarget(["jobs", nilVersion, "0.xml"])).toEqual({
      kind: "jobs",
      version: nilVersion,
      shard: 0,
    });
    expect(parseSitemapShardTarget(["jobs", versionSeven.toUpperCase(), "0.xml"])).toEqual({
      kind: "jobs",
      version: versionSeven,
      shard: 0,
    });
  });

  it("sitemap indexini 50.000 giriş protokol tavanında keser", () => {
    const entries = Array.from(
      { length: 50_001 },
      (_, index): SitemapIndexEntry => ({
        id: String(index),
        url: `https://iskoala.com/sitemap/${index}.xml`,
      }),
    );

    expect(() => sitemapIndexXml(entries)).toThrow("Sitemap index kapasitesi aşıldı");
  });

  it("tek sitemap'i 50.000 URL protokol tavanında keser", () => {
    const entries = Array.from({ length: 50_001 }, (_, index) => ({
      url: `https://iskoala.com/${index}`,
    }));

    expect(() => sitemapEntriesXml(entries)).toThrow("Sitemap kapasitesi aşıldı");
  });
});

function manifestDto(overrides: Record<string, unknown> = {}) {
  return {
    version,
    createdAt: new Date(Date.now() - 60_000).toISOString(),
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    entryCount: 3,
    shardSize: 2,
    shards: [
      { number: 0, entryCount: 2 },
      { number: 1, entryCount: 1 },
    ],
    ...overrides,
  };
}
