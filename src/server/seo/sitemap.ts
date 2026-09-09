import "server-only";

import type { MetadataRoute } from "next";

import { legalCatalog } from "@/content/legal/catalog";
import { publicJobPath, publicJobsPath } from "@/lib/app-routes";
import { publicEnvironment } from "@/lib/env";
import { apiFetch } from "@/server/api/client";
import { ApiError } from "@/server/api/errors";
import { backendPaths, jobSitemapShardPath } from "@/server/contract";
import { publicReaderCaller } from "@/server/session/session";

const publicPaths = [
  "",
  publicJobsPath,
  "/is-arayanlar",
  "/isverenler",
  "/nasil-calisir",
  "/hakkimizda",
  "/iletisim",
  "/sss",
  "/hesap-silme",
] as const;

export type SitemapIndexEntry = { readonly id: string; readonly url: string };
export type SitemapCacheWindow = {
  readonly freshSeconds: number;
  readonly staleSeconds: number;
};
export type SitemapIndexDocument = {
  readonly entries: readonly SitemapIndexEntry[];
  readonly cache: SitemapCacheWindow;
};
export type SitemapEntries = MetadataRoute.Sitemap;
export type SitemapShardTarget =
  | { readonly kind: "static" }
  | { readonly kind: "jobs"; readonly version: string; readonly shard: number };

const sitemapEntryLimit = 50_000;
const jobShardIndexLimit = sitemapEntryLimit - 1;
const backendTimeoutMilliseconds = 30_000;
const maximumCacheSeconds = 300;
const defaultCacheWindow = { freshSeconds: 300, staleSeconds: 300 } as const;

/**
 * Backend #166'nın manifesti tek REPEATABLE_READ snapshot'ında materyalize
 * edilir. Index yalnız o manifestin açıkça ilan ettiği shard'ları ve version'ı
 * yola taşır; hareketli `/jobs` offset sayfaları sitemap kaynağı değildir.
 */
export async function readSitemapIndex(): Promise<SitemapIndexDocument> {
  const { siteUrl } = publicEnvironment();
  const staticEntry = {
    id: "static",
    url: new URL("/sitemap/static.xml", siteUrl).toString(),
  } as const;
  let rawManifest: unknown;
  try {
    rawManifest = await apiFetch<unknown>(backendPaths.jobSitemapManifest, sitemapRequest());
  } catch (error) {
    // Rate limit arama motoruna aynen görünür; ağ/backend arızası ise yerel,
    // güvenilir pazarlama ve yasal URL'leri sitemap'ten gereksiz yere düşürmez.
    if (error instanceof ApiError && error.status === 429) throw error;
    return { entries: [staticEntry], cache: defaultCacheWindow };
  }
  const manifest = sitemapManifest(rawManifest);
  return {
    entries: [
      staticEntry,
      ...manifest.shards.map(({ number }) => {
        const id = `jobs/${manifest.version}/${number}`;
        return { id, url: new URL(`/sitemap/${id}.xml`, siteUrl).toString() };
      }),
    ],
    cache: manifestCacheWindow(manifest.expiresAt),
  };
}

export async function readSitemapShard(target: SitemapShardTarget): Promise<SitemapEntries> {
  if (target.kind === "static") return staticEntries();

  const dto = sitemapShard(
    await apiFetch<unknown>(
      jobSitemapShardPath(target.version, target.shard),
      sitemapRequest(),
    ),
    target,
  );
  const { siteUrl } = publicEnvironment();
  return dto.entries.map((entry) => ({
    url: new URL(publicJobPath(entry.id), siteUrl).toString(),
    changeFrequency: "weekly",
    ...(entry.updatedAt === null ? {} : { lastModified: entry.updatedAt }),
  }));
}

/**
 * `/sitemap/static.xml` veya version'lı ilan shard yolunu çözer.
 * Null, route'un backend'e hiç gitmeden 400 döndürmesi gereken bozuk biçimdir.
 * Negatif signed int geçerlidir ve backend'de bilinmeyen shard ile aynı 404'e
 * düşer; aralık dışındaki integer ise Spring binding sözleşmesi gibi 400'dür.
 */
export function parseSitemapShardTarget(
  parts: readonly string[] | undefined,
): SitemapShardTarget | null {
  if (parts?.length === 1 && parts[0] === "static.xml") return { kind: "static" };
  if (parts?.length !== 3 || parts[0] !== "jobs") return null;

  const version = canonicalUuid(parts[1]);
  const shardText = parts[2]?.endsWith(".xml") ? parts[2].slice(0, -4) : null;
  if (version === null || shardText === null || !signedIntegerPattern.test(shardText)) return null;

  const shard = Number(shardText);
  return Number.isInteger(shard) && shard >= signedIntMinimum && shard <= signedIntMaximum
    ? { kind: "jobs", version, shard }
    : null;
}

function staticEntries(): SitemapEntries {
  const { siteUrl } = publicEnvironment();
  const legalPaths = Object.entries(legalCatalog).flatMap(([slug, document]) => [
    `/${slug}`,
    `/${slug}/v/${document.version}`,
  ]);
  return [...publicPaths, ...legalPaths].map((path) => ({
    url: new URL(path || "/", siteUrl).toString(),
    changeFrequency: changeFrequency(path),
  }));
}

function changeFrequency(path: string): "never" | "daily" | "monthly" {
  if (path.includes("/v/")) return "never";
  return path === publicJobsPath ? "daily" : "monthly";
}

export function sitemapIndexXml(entries: readonly SitemapIndexEntry[]): string {
  assertProtocolLimit(entries.length, "Sitemap index");
  const body = entries.map(({ url }) => `<sitemap><loc>${xml(url)}</loc></sitemap>`).join("");
  return `${xmlDeclaration}<sitemapindex xmlns="${sitemapNamespace}">${body}</sitemapindex>`;
}

export function sitemapEntriesXml(entries: SitemapEntries): string {
  assertProtocolLimit(entries.length, "Sitemap");
  const body = entries
    .map((entry) => {
      const lastModified = entry.lastModified
        ? `<lastmod>${xml(
            entry.lastModified instanceof Date
              ? entry.lastModified.toISOString()
              : String(entry.lastModified),
          )}</lastmod>`
        : "";
      const frequency = entry.changeFrequency
        ? `<changefreq>${xml(entry.changeFrequency)}</changefreq>`
        : "";
      return `<url><loc>${xml(entry.url)}</loc>${lastModified}${frequency}</url>`;
    })
    .join("");
  return `${xmlDeclaration}<urlset xmlns="${sitemapNamespace}">${body}</urlset>`;
}

const xmlDeclaration = '<?xml version="1.0" encoding="UTF-8"?>';
const sitemapNamespace = "http://www.sitemaps.org/schemas/sitemap/0.9";
const signedIntegerPattern = /^(?:0|[1-9]\d*|-[1-9]\d*)$/;
const instantPattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?Z$/;
const signedIntMinimum = -2_147_483_648;
const signedIntMaximum = 2_147_483_647;

type SitemapManifest = {
  readonly version: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly entryCount: number;
  readonly shardSize: number;
  readonly shards: readonly { readonly number: number; readonly entryCount: number }[];
};

type SitemapShard = {
  readonly version: string;
  readonly shard: number;
  readonly entries: readonly { readonly id: string; readonly updatedAt: string | null }[];
};

function sitemapRequest() {
  return {
    ...publicReaderCaller(),
    cache: "no-store" as const,
    signal: AbortSignal.timeout(backendTimeoutMilliseconds),
  };
}

function sitemapManifest(value: unknown): SitemapManifest {
  if (
    !record(value) ||
    !exactKeys(value, [
      "version",
      "createdAt",
      "expiresAt",
      "entryCount",
      "shardSize",
      "shards",
    ])
  ) {
    return invalidManifest();
  }
  const version = canonicalUuid(value.version);
  const createdAt = strictInstant(value.createdAt);
  const expiresAt = strictInstant(value.expiresAt);
  const entryCount = nonNegativeSafeInteger(value.entryCount);
  const shardSize = boundedInteger(value.shardSize, 1, sitemapEntryLimit);
  const shards = value.shards;
  if (
    version === null ||
    createdAt === null ||
    expiresAt === null ||
    Date.parse(expiresAt) <= Date.parse(createdAt) ||
    Date.parse(expiresAt) <= Date.now() + 1_000 ||
    entryCount === null ||
    shardSize === null ||
    !Array.isArray(shards) ||
    shards.length > jobShardIndexLimit
  ) {
    return invalidManifest();
  }

  const expectedShardCount = entryCount === 0 ? 0 : Math.ceil(entryCount / shardSize);
  if (shards.length !== expectedShardCount) return invalidManifest();

  const parsedShards: Array<{ number: number; entryCount: number }> = [];
  for (let index = 0; index < shards.length; index += 1) {
    const metadata = shards[index];
    if (!record(metadata) || !exactKeys(metadata, ["number", "entryCount"])) {
      return invalidManifest();
    }
    const number = boundedInteger(metadata.number, 0, signedIntMaximum);
    const count = boundedInteger(metadata.entryCount, 1, shardSize);
    const expectedCount = Math.min(shardSize, entryCount - index * shardSize);
    if (number !== index || count !== expectedCount) return invalidManifest();
    parsedShards.push({ number, entryCount: count });
  }

  return { version, createdAt, expiresAt, entryCount, shardSize, shards: parsedShards };
}

function manifestCacheWindow(expiresAt: string): SitemapCacheWindow {
  // Index bir version'ı yalnız backend'in authoritative lease'i içinde ilan
  // edebilir. Stale penceresi eski version'ı expiry sonrasına taşıyacağından
  // bu yanıtta özellikle sıfırdır; uzun lease de beş dakikada bir yenilenir.
  const remainingSeconds = Math.max(0, Math.floor((Date.parse(expiresAt) - Date.now()) / 1_000));
  return {
    freshSeconds: Math.min(maximumCacheSeconds, remainingSeconds),
    staleSeconds: 0,
  };
}

function sitemapShard(value: unknown, target: Extract<SitemapShardTarget, { kind: "jobs" }>): SitemapShard {
  if (!record(value) || !exactKeys(value, ["version", "shard", "entries"])) {
    return invalidShard();
  }
  const version = canonicalUuid(value.version);
  const shard = boundedInteger(value.shard, 0, signedIntMaximum);
  if (
    version !== target.version ||
    shard !== target.shard ||
    !Array.isArray(value.entries) ||
    value.entries.length === 0 ||
    value.entries.length > sitemapEntryLimit
  ) {
    return invalidShard();
  }

  const ids = new Set<string>();
  const entries: Array<{ id: string; updatedAt: string | null }> = [];
  for (const candidate of value.entries) {
    if (!record(candidate) || !exactKeys(candidate, ["id", "updatedAt"])) return invalidShard();
    const id = canonicalUuid(candidate.id);
    const updatedAt = candidate.updatedAt === null ? null : strictInstant(candidate.updatedAt);
    if (
      id === null ||
      (updatedAt === null && candidate.updatedAt !== null) ||
      ids.has(id)
    ) {
      return invalidShard();
    }
    ids.add(id);
    entries.push({ id, updatedAt });
  }
  return { version, shard, entries };
}

function strictInstant(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = instantPattern.exec(value);
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    return null;
  }
  return value;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return leapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function leapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function canonicalUuid(value: unknown): string | null {
  // Spring bu path'i `java.util.UUID` olarak bind ediyor. Version/variant
  // bitleri (nil ve v7 dahil) biçim hatası değildir; varlık kararı backend'in
  // 404 sözleşmesine bırakılır.
  return typeof value === "string" && javaUuidPattern.test(value) ? value.toLowerCase() : null;
}

const javaUuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function nonNegativeSafeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function boundedInteger(value: unknown, minimum: number, maximum: number): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= minimum && value <= maximum
    ? value
    : null;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function invalidManifest(): never {
  throw new Error("Geçersiz sitemap manifesti");
}

function invalidShard(): never {
  throw new Error("Geçersiz sitemap shard'ı");
}

function assertProtocolLimit(length: number, name: string): void {
  if (!Number.isSafeInteger(length) || length < 0 || length > sitemapEntryLimit) {
    throw new Error(`${name} kapasitesi aşıldı`);
  }
}

function xml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
