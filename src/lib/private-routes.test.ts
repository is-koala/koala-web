import { describe, expect, it } from "vitest";

import { privateDisallowRules, privateHeaderSources, privateRouteTrees } from "./private-routes";

/**
 * robots.txt eşleşme kuralının bağımsız uygulaması.
 *
 * Kural dosyadan değil, protokolden alındı: `Disallow` değeri **önek** olarak
 * eşleşir, `*` herhangi bir diziyi, sondaki `$` yolun bitişini karşılar. Kodun
 * ürettiği listeyi kendi mantığıyla yeniden hesaplayan bir test, listenin
 * yanlış olduğu durumda da geçerdi; bu yüzden beklenti tarayıcının okuduğu
 * anlamdan türetiliyor.
 */
function disallows(rule: string, path: string): boolean {
  const anchored = rule.endsWith("$");
  const pattern = (anchored ? rule.slice(0, -1) : rule)
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  return new RegExp(`^${pattern}${anchored ? "$" : ""}`).test(path);
}

const blocked = (path: string) => privateDisallowRules.some((rule) => disallows(rule, path));

describe("arama motorlarına kapalı rotalar", () => {
  it("kabuk köklerini ve altındaki her yolu robots.txt'te kapatır", () => {
    for (const path of ["/isveren", "/isveren/ilanlar", "/isveren/ilan/yeni", "/panel", "/panel/islerim", "/panel/profil"]) {
      expect(blocked(path)).toBe(true);
    }
  });

  it("aynı önekle başlayan tanıtım sayfasını indekslenebilir bırakır", () => {
    // `/isveren` bir önek olarak yazılırsa `/isverenler` de düşer; tanıtım
    // sayfası arama sonuçlarından kaybolur ve bunu kimse fark etmez.
    expect(blocked("/isverenler")).toBe(false);
    expect(blocked("/is-arayanlar")).toBe(false);
    expect(blocked("/")).toBe(false);
  });

  it("davet adreslerini ağaç olarak kapatır", () => {
    /*
     * Davet adresi bir kimlik taşıyor ve o kimlik daveti cevaplamaya yetiyor:
     * `getInvitationById` sahiplik denetimi yapmıyor. Adres arama motoruna,
     * `Referrer` başlığına ve önbelleğe hiç girmemeli — `next.config.ts`
     * üç başlığı da bu listeden basıyor.
     *
     * Tek satırlık bir `Disallow: /davet` alt yolları kapatırdı ama başlık
     * kalıbı kapatmazdı; ağaç iki satıra açılıyor.
     */
    expect(blocked("/davet")).toBe(true);
    expect(blocked("/davet/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")).toBe(true);
    expect(privateHeaderSources).toContain("/davet/:path*");
  });

  it("uyuşmazlık kanıtı BFF adreslerini ağaç olarak kapatır", () => {
    expect(blocked("/api/disputes")).toBe(true);
    expect(blocked("/api/disputes/dispute-id/evidence/evidence-id/download")).toBe(true);
    expect(privateHeaderSources).toContain("/api/disputes/:path*");
  });

  it("hesap akışlarının tek tek yolları kapalı kalır", () => {
    for (const path of ["/giris", "/cikis", "/kayit", "/payment/result"]) {
      expect(blocked(path)).toBe(true);
    }
  });

  it("başlık kuralı her kabuk kökü için alt yolları da kapsar", () => {
    for (const root of privateRouteTrees) {
      expect(privateHeaderSources).toContain(root);
      expect(privateHeaderSources).toContain(`${root}/:path*`);
    }
    expect(privateHeaderSources).toContain("/giris");
    expect(privateHeaderSources).not.toContain("/isverenler");
  });
});
