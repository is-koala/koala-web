import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const appRoot = path.resolve(import.meta.dirname);

function routeDirectories(directory: string): string[] {
  return [
    directory,
    ...readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory() ? routeDirectories(path.join(directory, entry.name)) : [],
    ),
  ];
}

const directories = routeDirectories(appRoot);

describe("rota dosya biçimi", () => {
  it("notFound() çağıran hiçbir sayfanın yanında loading.tsx durmaz", () => {
    /*
     * Belgelenmiş tuzak (`AGENTS.md`, "Yapı"): bir segment `loading.tsx` ile
     * sarıldığında Next o segmenti bir Suspense sınırına alır, kabuk
     * render'ın başında akıtılır ve HTTP durumu 200'de kilitlenir. Sayfa
     * `notFound()` çağırsa bile 404 gövdesi 200 ile döner — arama motoru ve
     * izleme için sessizce yanlış, ekranda ise doğru görünür. Yani bu hata
     * gözle bulunamaz; tek yakalayan yer burası.
     *
     * Yükleniyor durumu bu sayfalarda `notFound()` kararı verildikten
     * **sonra** açılan bir `Suspense` sınırına konur.
     */
    const violations = directories.filter((directory) => {
      const page = path.join(directory, "page.tsx");
      if (!existsSync(page) || !existsSync(path.join(directory, "loading.tsx"))) return false;
      return /notFound\(\)/.test(readFileSync(page, "utf8"));
    });

    expect(violations).toEqual([]);
  });

  it("herkese açık ilan listesinin yanında loading.tsx yok", () => {
    /*
     * Bir segmentin yanına `loading.tsx` konduğunda Next `page.tsx`'i otomatik
     * olarak bir `<Suspense>` sınırına alıyor. Sınır kabuğu erken akıtıyor ve
     * sayfanın asıl içeriği belgeye `<div hidden id="S:1">` içinde, sonradan
     * bir satır içi script'in yerine taşıdığı bir parça olarak giriyor.
     * JavaScript kapalı bir tarayıcıda o taşıma hiç olmuyor: ziyaretçi
     * ilanları değil, sonsuza kadar iskeleti görüyor.
     *
     * `/is-ilanlari` için bu, sayfanın var oluş sebebini iptal eder
     * (is-koala/koala-web#19: "JavaScript kapalıyken de ilanlar ve sayfalama
     * bağlantıları görünüyor"). Ekranda hata gibi görünmüyor — JavaScript açık
     * her tarayıcıda sayfa doğru çalışıyor — o yüzden tek yakalayan yer burası.
     * Yükleniyor durumu bunun yerine sayfalama bağlantısının içinde duruyor
     * (`src/components/link-pending.tsx`, `useLinkStatus`).
     */
    const listRoute = path.join(appRoot, "(marketing)", "is-ilanlari");

    expect(existsSync(path.join(listRoute, "page.tsx"))).toBe(true);
    expect(existsSync(path.join(listRoute, "loading.tsx"))).toBe(false);
  });

  it("kabuk köklerinin hiçbirinde loading.tsx yok", () => {
    // Kabuk kökündeki bir `loading.tsx` yalnız kendi sayfasını değil,
    // altındaki `[...section]` yakalayıcısının 404'ünü de düşürür.
    for (const root of ["(uygulama)/isveren", "(uygulama)/panel"]) {
      expect(existsSync(path.join(appRoot, root, "loading.tsx")), root).toBe(false);
    }
  });
});
