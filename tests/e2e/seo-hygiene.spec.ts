import { expect, test } from "@playwright/test";

test("robots.txt işveren kabuğunu kapatır ama işverenler tanıtımını açık bırakır", async ({
  request,
}) => {
  const response = await request.get("/robots.txt");
  const lines = (await response.text()).split("\n");

  expect(response.status()).toBe(200);
  expect(lines).toContain("Disallow: /isveren$");
  expect(lines).toContain("Disallow: /isveren/");
  expect(lines).not.toContain("Disallow: /isveren");
});

test("eski İngilizce yollar Türkçe kanoniklerine 301 ile gider", async ({ request }) => {
  for (const [source, destination] of [
    ["/faq", "/sss"],
    ["/about", "/hakkimizda"],
    ["/privacy", "/gizlilik-politikasi"],
  ] as const) {
    const response = await request.get(source, { maxRedirects: 0 });

    expect(response.status(), source).toBe(301);
    expect(response.headers().location, source).toBe(destination);
  }
});

test("yalnız sıralanan ilan listesi tek kanonik adreste birleşir", async ({ page }) => {
  const response = await page.goto("/is-ilanlari?sirala=ucret-artan");

  expect(response?.status()).toBe(200);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://iskoala.com/is-ilanlari",
  );
});

test("süzgeçli ilan listesi noindex ve normalize edilmiş canonical taşır", async ({ page }) => {
  const response = await page.goto("/is-ilanlari?ara=garson");

  expect(response?.status()).toBe(200);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://iskoala.com/is-ilanlari?ara=garson",
  );
});

test("sitemap index shard'a gider; shard statik kanonikleri taşır ve lastmod uydurmaz", async ({
  request,
}) => {
  const indexResponse = await request.get("/sitemap.xml");
  const index = await indexResponse.text();

  expect(indexResponse.status()).toBe(200);
  expect(index).toContain("<sitemapindex");
  expect(index).toContain("<loc>https://iskoala.com/sitemap/static.xml</loc>");

  const shardResponse = await request.get("/sitemap/static.xml");
  const shard = await shardResponse.text();
  expect(shardResponse.status()).toBe(200);
  expect(shard).toContain("<loc>https://iskoala.com/</loc>");
  expect(shard).toContain("<loc>https://iskoala.com/gizlilik-politikasi</loc>");
  expect(shard).not.toContain("<lastmod>");
});
