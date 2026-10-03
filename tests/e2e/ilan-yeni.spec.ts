import { expect, test } from "@playwright/test";

/**
 * Bireysel ilan formunun tarayıcıdan görünen sözleşmesi.
 *
 * Formun kendisi buradan sürülemez: sayfa kategorileri, şablonları ve fiyat
 * dökümünü BFF üzerinden okuyor ve `playwright.config.ts` API'yi var olmayan
 * bir adrese bağlıyor, yani `page.route` o çağrıları hiç görmüyor
 * (`uygulama.spec.ts` aynı sınırı anlatıyor). Buradan ölçülebilen ve
 * kırılması en pahalı olan davranış oturumsuz yol: kapı, dönüş hedefi,
 * indeksleme ve var olmayan adresin gerçekten 404 dönmesi.
 */

const jobId = "4d0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f99";

test("oturumsuz kullanıcı ilan formundan girişe düşer ve hedefini taşır", async ({ request }) => {
  const targets = [
    ["/isveren/ilan/yeni", "/giris?next=%2Fisveren%2Filan%2Fyeni"],
    [`/isveren/ilan/${jobId}`, `/giris?next=%2Fisveren%2Filan%2F${jobId}`],
    [`/isveren/ilan/${jobId}/galeri`, `/giris?next=%2Fisveren%2Filan%2F${jobId}%2Fgaleri`],
  ];

  for (const [path, destination] of targets) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(307);
    expect(response.headers().location, path).toBe(destination);
  }
});

test("ilan adresleri indekslenmez", async ({ request }) => {
  for (const path of ["/isveren/ilan/yeni", `/isveren/ilan/${jobId}`, `/isveren/ilan/${jobId}/galeri`]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.headers()["x-robots-tag"], path).toContain("noindex");
    expect(response.headers()["referrer-policy"], path).toBe("strict-origin");
  }
});

test("formun bir üstündeki adres gerçek bir 404 döner", async ({ request }) => {
  // `/isveren/ilan` kayıtta bir bölüm değil. `yeni` segmentinin yanındaki
  // `loading.tsx` bu yolu sarmamalı: bir Suspense sınırı kabuğu erken akıtır
  // ve HTTP durumunu 200'de kilitlerdi (`AGENTS.md`).
  const response = await request.get("/isveren/ilan", { maxRedirects: 0 });

  // Oturumsuz ziyaretçi önce kapıya takılır; kapıdan sonrası da 404 olmalı.
  expect(response.status()).toBe(307);
  expect(response.headers().location).toBe("/giris?next=%2Fisveren%2Filan");
});
