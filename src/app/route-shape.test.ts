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

  it.each([
    ["ilan listesi", path.join("(marketing)", "is-ilanlari")],
    ["ilan ayrıntısı", path.join("(marketing)", "is-ilanlari", "[jobId]")],
  ])("herkese açık %s sayfasının yanında loading.tsx yok", (_name, route) => {
    /*
     * Bir segmentin yanına `loading.tsx` konduğunda Next `page.tsx`'i otomatik
     * olarak bir `<Suspense>` sınırına alıyor. Sınır kabuğu erken akıtıyor ve
     * sayfanın asıl içeriği belgeye `<div hidden id="S:1">` içinde, sonradan
     * bir satır içi script'in yerine taşıdığı bir parça olarak giriyor.
     * JavaScript kapalı bir tarayıcıda o taşıma hiç olmuyor: ziyaretçi
     * ilanları değil, sonsuza kadar iskeleti görüyor.
     *
     * İki rota da bu yüzden listede. Liste için bu, sayfanın var oluş sebebini
     * iptal eder (is-koala/koala-web#19: "JavaScript kapalıyken de ilanlar ve
     * sayfalama bağlantıları görünüyor"). Ayrıntı sayfası aynı kusuru
     * bağımsız olarak taşıyordu (is-koala/koala-web#94) ve orada bedel daha
     * ağır: sayfa `JobPosting` yapısal verisi ve kanonik adres taşıyor, yani
     * ilk HTML'i okuyan bir tarayıcıya iskeletten başka bir şey görünmezdi.
     *
     * Ekranda hata gibi görünmüyor — JavaScript açık her tarayıcıda sayfa
     * doğru çalışıyor — o yüzden tek yakalayan yer burası. Yükleniyor durumu
     * bunun yerine gezinme bağlantısının içinde duruyor
     * (`src/components/link-pending.tsx`, `useLinkStatus`): sayfalama
     * bağlantılarında ve ilan kartının başlık bağlantısında.
     */
    const segment = path.join(appRoot, route);

    expect(existsSync(path.join(segment, "page.tsx"))).toBe(true);
    expect(existsSync(path.join(segment, "loading.tsx"))).toBe(false);
  });

  it("kabuk köklerinin hiçbirinde loading.tsx yok", () => {
    // Kabuk kökündeki bir `loading.tsx` yalnız kendi sayfasını değil,
    // altındaki `[...section]` yakalayıcısının 404'ünü de düşürür.
    for (const root of ["(uygulama)/isveren", "(uygulama)/panel"]) {
      expect(existsSync(path.join(appRoot, root, "loading.tsx")), root).toBe(false);
    }
  });
});
