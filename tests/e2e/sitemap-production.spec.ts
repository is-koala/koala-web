import { expect, test } from "@playwright/test";

const apiPort = process.env.SITEMAP_PLAYWRIGHT_API_PORT ?? "3630";
const apiURL = `http://127.0.0.1:${apiPort}`;
const postBuildJobCount = 50_001;

test.skip(
  process.env.SITEMAP_PRODUCTION_HTTP !== "1",
  "Bu kabul ayrı production-build Playwright yapılandırmasıyla çalışır.",
);

test("build sonrası manifest değişiminde ilan edilen bütün version'lı shard'lar eksiksiz kalır", async ({
  request,
}) => {
  const constantsResponse = await request.get(`${apiURL}/__test/constants`);
  const constants = (
    (await constantsResponse.json()) as {
      data: {
        initialVersion: string;
        replacementVersion: string;
        rateLimitedVersion: string;
        expiredVersion: string;
        unknownVersion: string;
      };
    }
  ).data;

  const initialIndexResponse = await request.get("/sitemap.xml");
  expect(initialIndexResponse.status()).toBe(200);
  expect(initialIndexResponse.headers()["cache-control"]).toContain("s-maxage=300");
  expect(initialIndexResponse.headers()["cache-control"]).not.toContain("stale-while-revalidate");
  const initiallyAdvertised = locations(await initialIndexResponse.text());
  expect(initiallyAdvertised).toEqual([
    "https://iskoala.com/sitemap/static.xml",
    `https://iskoala.com/sitemap/jobs/${constants.initialVersion}/0.xml`,
  ]);

  const changed = await request.post(`${apiURL}/__test/replace-manifest`);
  expect(changed.status()).toBe(200);

  const indexResponse = await request.get("/sitemap.xml");
  expect(indexResponse.status()).toBe(200);
  const advertised = locations(await indexResponse.text());
  expect(advertised).toEqual([
    "https://iskoala.com/sitemap/static.xml",
    `https://iskoala.com/sitemap/jobs/${constants.replacementVersion}/0.xml`,
    `https://iskoala.com/sitemap/jobs/${constants.replacementVersion}/1.xml`,
  ]);

  const oldShardPath = new URL(initiallyAdvertised[1]!).pathname;
  const oldShardDuringLease = await request.get(oldShardPath);
  expect(oldShardDuringLease.status()).toBe(200);
  expect(oldShardDuringLease.headers()["cache-control"]).toBe("no-store");

  const expired = await request.post(`${apiURL}/__test/expire-initial`);
  expect(expired.status()).toBe(200);
  const oldShardAfterExpiry = await request.get(oldShardPath);
  expect(oldShardAfterExpiry.status()).toBe(404);
  expect(oldShardAfterExpiry.headers()["cache-control"]).toBe("no-store");
  expect(oldShardAfterExpiry.headers()["x-robots-tag"]).toBe("noindex");

  const jobLocations: string[] = [];
  const jobBlocks = new Map<string, string>();
  for (const advertisedURL of advertised) {
    const response = await request.get(new URL(advertisedURL).pathname);
    expect(response.status(), advertisedURL).toBe(200);
    if (advertisedURL.includes("/sitemap/jobs/")) {
      expect(response.headers()["cache-control"], advertisedURL).toBe("no-store");
    } else {
      expect(response.headers()["cache-control"], advertisedURL).toContain("s-maxage=300");
    }
    expect(response.headers()["x-robots-tag"], advertisedURL).toBeUndefined();
    const xml = await response.text();
    const urls = locations(xml);
    expect(urls.length, advertisedURL).toBeLessThanOrEqual(50_000);
    if (advertisedURL.includes("/sitemap/jobs/")) {
      jobLocations.push(...urls);
      for (const [url, block] of urlBlocks(xml)) jobBlocks.set(url, block);
    } else {
      expect(urls).toContain("https://iskoala.com/");
      expect(urls).toContain("https://iskoala.com/gizlilik-politikasi");
      expect(xml).not.toContain("<lastmod>");
    }
  }

  expect(jobLocations).toHaveLength(postBuildJobCount);
  expect(new Set(jobLocations).size).toBe(postBuildJobCount);
  expect(jobLocations[0]).toBe(`https://iskoala.com/is-ilanlari/${jobId(0)}`);
  expect(jobLocations.at(-1)).toBe(`https://iskoala.com/is-ilanlari/${jobId(50_000)}`);
  expect(jobBlocks.get(`https://iskoala.com/is-ilanlari/${jobId(0)}`)).toContain(
    "<lastmod>2026-09-09T10:11:12.123456Z</lastmod>",
  );
  expect(jobBlocks.get(`https://iskoala.com/is-ilanlari/${jobId(1)}`)).not.toContain(
    "<lastmod>",
  );

  for (const path of [
    `/sitemap/jobs/${constants.replacementVersion}/2.xml`,
    `/sitemap/jobs/${constants.replacementVersion}/-1.xml`,
    `/sitemap/jobs/${constants.expiredVersion}/0.xml`,
    `/sitemap/jobs/${constants.unknownVersion}/0.xml`,
  ]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(404);
    expect(response.headers()["cache-control"], path).toBe("no-store");
    expect(response.headers()["x-robots-tag"], path).toBe("noindex");
  }

  for (const path of [
    "/sitemap/jobs/not-a-version/0.xml",
    `/sitemap/jobs/${constants.replacementVersion}/not-a-shard.xml`,
  ]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(400);
    expect(response.headers()["cache-control"], path).toBe("no-store");
    expect(response.headers()["x-robots-tag"], path).toBe("noindex");
  }

  const rateLimited = await request.get(
    `/sitemap/jobs/${constants.rateLimitedVersion}/0.xml`,
  );
  expect(rateLimited.status()).toBe(429);
  expect(rateLimited.headers()["cache-control"]).toBe("no-store");
  expect(rateLimited.headers()["retry-after"]).toBeUndefined();
  expect(rateLimited.headers()["x-robots-tag"]).toBe("noindex");

  const failed = await request.post(`${apiURL}/__test/fail-manifest`);
  expect(failed.status()).toBe(200);
  const fallbackIndex = await request.get("/sitemap.xml");
  expect(fallbackIndex.status()).toBe(200);
  expect(locations(await fallbackIndex.text())).toEqual([
    "https://iskoala.com/sitemap/static.xml",
  ]);

  const requestCountsResponse = await request.get(`${apiURL}/__test/requests`);
  expect(requestCountsResponse.status()).toBe(200);
  expect(await requestCountsResponse.json()).toMatchObject({
    success: true,
    data: { manifest: 3, publicJobs: 0 },
  });
});

function locations(xml: string): readonly string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1] ?? "");
}

function urlBlocks(xml: string): ReadonlyMap<string, string> {
  return new Map(
    [...xml.matchAll(/<url>(.*?)<\/url>/g)].map((match) => {
      const block = match[1] ?? "";
      const location = /<loc>([^<]+)<\/loc>/.exec(block)?.[1] ?? "";
      return [location, block] as const;
    }),
  );
}

function jobId(index: number): string {
  return `00000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`;
}
