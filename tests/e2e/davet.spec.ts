import { expect, test } from "@playwright/test";

/**
 * Davet karşılama yolunun tarayıcıdan görünen sözleşmesi.
 *
 * Kabul ve ret kararının kendisi buradan sürülemez: backend çağrıları BFF'ten
 * çıkıyor ve `playwright.config.ts` API'yi var olmayan bir adrese bağlıyor,
 * bu yüzden `page.route` onları hiç görmüyor (`uygulama.spec.ts` ile aynı
 * sınır). Ölçülebilen ve kırılması en pahalı olan davranış oturumsuz yol:
 * davet kimliğinin adres çubuğunda taşındığı bir sayfada kapı, dönüş hedefi
 * ve adresin sızdırılmaması.
 */

const invitationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

test("oturumsuz kullanıcı davetten girişe düşer ve davete geri döner", async ({
  page,
  request,
}) => {
  // Dalga 3'te inen `requireSession` / `returnDestination` çifti bu akışın
  // "önce giriş yap, sonra davete dön" ihtiyacını zaten karşılıyor; bu dilim
  // yeni bir dönüş mekanizması yazmıyor, var olanı kullanıyor.
  const response = await request.get(`/davet/${invitationId}`, { maxRedirects: 0 });

  expect(response.status()).toBe(307);
  expect(response.headers().location).toBe(`/giris?next=%2Fdavet%2F${invitationId}`);

  await page.goto(`/davet/${invitationId}`);
  await expect(page).toHaveURL(`/giris?next=%2Fdavet%2F${invitationId}`);
  await expect(page.locator("input[name='next']")).toHaveValue(`/davet/${invitationId}`);
});

test("biçimi bozuk davet kimliği de önce oturum kapısına takılır", async ({ request }) => {
  // Kimlik denetimi kapıdan **sonra**: aksi hâlde hangi davet kimliklerinin
  // geçerli biçimde olduğu oturum açmadan sorgulanabilirdi.
  const response = await request.get("/davet/abc", { maxRedirects: 0 });

  expect(response.status()).toBe(307);
  expect(response.headers().location).toBe("/giris?next=%2Fdavet%2Fabc");
});

test("davet adresi indekslenmez, referrer taşımaz ve önbelleğe girmez", async ({ request }) => {
  /*
   * Adres bir davet kimliği taşıyor ve `getInvitationById` sahiplik denetimi
   * yapmıyor: kimliği bilen her oturumlu kullanıcı daveti okuyabiliyor. Yani
   * adresin arama sonuçlarına, dış sitelere giden `Referer` başlığına ya da
   * paylaşılan bir önbelleğe girmesi davetin kendisini sızdırır.
   */
  for (const path of [`/davet/${invitationId}`, "/davet/abc"]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.headers()["x-robots-tag"], path).toContain("noindex");
    expect(response.headers()["referrer-policy"], path).toBe("strict-origin");
  }

  /*
   * `Cache-Control: no-store` burada **doğrulanmıyor**, çünkü bu koşu
   * `npm run dev` üzerinden gidiyor ve geliştirme sunucusu her dinamik
   * yanıtın üzerine kendi `no-cache, must-revalidate` başlığını yazıyor;
   * `next start` ile aynı adres `no-store` döndürüyor. Başlığın kaynağı olan
   * liste girdisi (`/davet/:path*`) `private-routes.test.ts` içinde
   * doğrulanıyor. `uygulama.spec.ts` aynı nedenle yalnız iki başlığa bakıyor.
   */

  const robots = await (await request.get("/robots.txt")).text();
  for (const rule of ["Disallow: /davet$", "Disallow: /davet/"]) {
    expect(robots).toContain(rule);
  }
});
