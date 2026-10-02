import { expect, test } from "@playwright/test";

/**
 * Abonelikten çıkma sayfasının tokenı HTML'e yazmadığı yalnız üretim
 * derlemesinde ölçülebiliyor: `next dev` her isteği dinamik çiziyor ve
 * adresin sorgu dizisini RSC yüküne (`c`, `q`) yazıyor. Üretimde sayfa
 * statik; sayfa ya da yerleşimi istek-zamanı bir API okumaya başlarsa
 * sorgu — yani 90 gün geçerli token — yeniden HTML'e girer ve bu test kırılır.
 */
test("üretim sunucusu çıkış bağlantısının tokenını HTML'e yazmaz ve sayfayı kapalı sunar", async ({
  request,
}) => {
  const token = "abone-uretim-tokeni_Zx81Qm4LkP0aT7wR";

  const response = await request.get(`/bildirim-tercihleri/cikis?token=${token}`);

  expect(response.status()).toBe(200);
  expect(response.headers()["referrer-policy"]).toBe("no-referrer");
  expect(response.headers()["x-robots-tag"]).toContain("noindex");
  const html = await response.text();
  expect(html).toContain("Abonelikten çık");
  expect(html).toContain('<meta name="referrer" content="no-referrer"/>');
  expect(html).not.toContain(token);
});
