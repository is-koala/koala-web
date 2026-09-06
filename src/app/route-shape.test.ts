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

  it("kabuk köklerinin hiçbirinde loading.tsx yok", () => {
    // Kabuk kökündeki bir `loading.tsx` yalnız kendi sayfasını değil,
    // altındaki `[...section]` yakalayıcısının 404'ünü de düşürür.
    for (const root of ["(uygulama)/isveren", "(uygulama)/panel"]) {
      expect(existsSync(path.join(appRoot, root, "loading.tsx")), root).toBe(false);
    }
  });
});
