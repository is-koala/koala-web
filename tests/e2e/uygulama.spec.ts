import { expect, test } from "@playwright/test";

/**
 * Kabuğun tarayıcıdan görünen sözleşmesi.
 *
 * Oturumlu ekranların kendisi buradan sürülemez: backend çağrıları BFF'ten
 * çıkıyor ve `playwright.config.ts` API'yi var olmayan bir adrese bağlıyor, bu
 * yüzden `page.route` onları hiç görmüyor. Ölçülebilen ve kırılması en pahalı
 * olan davranış oturumsuz yol: kapı, dönüş hedefi ve indeksleme.
 */

test("oturumsuz kullanıcı kabuğun her yolundan girişe düşer ve hedefini taşır", async ({
  request,
}) => {
  const targets = [
    ["/isveren", "/giris?next=%2Fisveren"],
    ["/isveren/ilanlar", "/giris?next=%2Fisveren%2Filanlar"],
    ["/panel", "/giris?next=%2Fpanel"],
    ["/panel/profil", "/giris?next=%2Fpanel%2Fprofil"],
    ["/panel/islerim", "/giris?next=%2Fpanel%2Fislerim"],
  ];

  for (const [path, destination] of targets) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(307);
    expect(response.headers().location, path).toBe(destination);
  }
});

test("girişten sonra kullanıcı bıraktığı kabuk adresine döner", async ({ page }) => {
  await page.goto("/isveren/ilanlar");

  await expect(page).toHaveURL("/giris?next=%2Fisveren%2Filanlar");
  await expect(page.locator("input[name='next']")).toHaveValue("/isveren/ilanlar");
});

test("kabuk adresleri indekslenmez", async ({ request }) => {
  for (const path of ["/isveren", "/isveren/ilanlar", "/panel", "/panel/profil", "/panel/islerim"]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.headers()["x-robots-tag"], path).toContain("noindex");
    expect(response.headers()["referrer-policy"], path).toBe("no-referrer");
  }

  const robots = await (await request.get("/robots.txt")).text();
  for (const rule of ["Disallow: /isveren$", "Disallow: /isveren/", "Disallow: /panel$", "Disallow: /panel/"]) {
    expect(robots).toContain(rule);
  }
});

test("işverenler tanıtım sayfası aynı önekten etkilenmez", async ({ request }) => {
  // `/isveren` bir önek olarak yazılırsa `/isverenler` de kapanır: robots.txt
  // eşleşmesi önek temellidir ve başlık kalıbı da gevşetilebilir. İki hata da
  // sayfayı arama sonuçlarından sessizce düşürür.
  const response = await request.get("/isverenler", { maxRedirects: 0 });
  expect(response.status()).toBe(200);
  expect(response.headers()["x-robots-tag"]).toBeUndefined();

  const robots = await (await request.get("/robots.txt")).text();
  expect(robots.split("\n")).not.toContain("Disallow: /isveren");
});
