import { describe, expect, it } from "vitest";

import {
  privateDisallowRules,
  privateHeaderSources,
  privateRouteTrees,
  privateRoutes,
} from "./private-routes";

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
    for (const path of ["/isveren", "/isveren/ilanlar", "/isveren/ilan/yeni", "/isveren/adres", "/panel", "/panel/islerim", "/panel/profil", "/panel/adres"]) {
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

  it("dinamik ödeme sonucu API adresini Next ve robots sözdizimleriyle ayrı ayrı kapatır", () => {
    /*
     * `:assignmentId` Next'in yol kalıbı sözdizimidir; robots.txt bunu bir
     * parametre olarak yorumlamaz. Aynı dize iki tüketiciye verilirse başlık
     * eşleşse bile robots.txt anlamsız bir literal yayımlar.
     */
    expect(privateHeaderSources).toContain("/api/payments/:assignmentId/result");
    expect(privateDisallowRules).toContain("/api/payments/*/result");
    expect(privateDisallowRules.join("\n")).not.toContain(":assignmentId");
    expect(blocked("/api/payments/3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e/result")).toBe(true);
  });

  it("kabuk altında olmayan kimlikli adres ekranlarını tek tek kapatır", () => {
    // Ağaç zaten `/panel/` ve `/isveren/` altını kapatır. Exact kayıt, kapı
    // şeridinin (`errors.test.ts` fatura adresi) ve başvuru çözümünün
    // `privateRoutes` kümesinde durması için durur.
    expect(privateRoutes).toContain("/isveren/adres");
    expect(privateRoutes).toContain("/panel/adres");
  });

  it("hesap akışlarının tek tek yolları kapalı kalır", () => {
    for (const path of ["/giris", "/cikis", "/kayit", "/payment/result", "/kimlik-dogrula"]) {
      expect(blocked(path)).toBe(true);
    }
  });

  it("abonelikten çıkma bağlantısını ve BFF ucunu kapatır", () => {
    /*
     * Ticari e-postadaki bağlantı 90 gün geçerli bir token taşıyor ve giriş
     * istemeden bir tercihi kapatıyor (is-koala/koala-web#54). Adres arama
     * motoruna, `Referer` başlığına ve önbelleğe girmemeli; tokenı gövdede
     * taşıyan BFF ucu da aynı politikayla yanıt verir.
     */
    expect(blocked("/bildirim-tercihleri/cikis")).toBe(true);
    expect(blocked("/bildirim-tercihleri/cikis?token=abc")).toBe(true);
    expect(privateHeaderSources).toContain("/bildirim-tercihleri/cikis");
    expect(blocked("/api/notification-preferences/unsubscribe")).toBe(true);
    expect(privateHeaderSources).toContain("/api/notification-preferences/unsubscribe");
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
