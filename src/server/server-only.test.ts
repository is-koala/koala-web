import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const sourceRoot = path.resolve(import.meta.dirname, "..");

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    // Testler derlemeye girmez; yalnız gönderilen kaynak taranır.
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

describe("server-only sınırı", () => {
  it("src/server altındaki her modül ilk satırında server-only işaretini taşır", () => {
    const unmarked = sourceFiles(path.join(sourceRoot, "server")).filter(
      (file) => readFileSync(file, "utf8").split("\n")[0] !== 'import "server-only";',
    );

    expect(unmarked).toEqual([]);
  });

  it("backend adresini yalnız server katmanı okur", () => {
    const leaking = sourceFiles(sourceRoot)
      .filter((file) => !file.startsWith(path.join(sourceRoot, "server")))
      .filter((file) => /process\.env(\.|\[")API_URL/.test(readFileSync(file, "utf8")));

    expect(leaking).toEqual([]);
  });

  it("backend adresi public ortam değişkeni olarak sızmaz", () => {
    const sources = sourceFiles(sourceRoot).map((file) => readFileSync(file, "utf8"));

    expect(sources.some((source) => source.includes("NEXT_PUBLIC_API"))).toBe(false);
  });
});

describe("oturumlu backend çağrısının tek kapısı", () => {
  it("ham istemciyi yalnız oturumsuz uçlar ve oturum katmanı içe aktarır", () => {
    // `apiFetch` token taşımaz ve 401'de yenilemez. Oturumlu bir çağrı onu
    // doğrudan kullanırsa yenileme o yol için sessizce devre dışı kalır ve
    // kullanıcı süresi dolmuş bir tokenla hata ekranına düşer. Listedekiler
    // ya tokensız uçlar (giriş, kayıt, parola, yasal metinler, herkese açık
    // ilan araması) ya da yenilemenin kendisi.
    //
    // İlan uçları dizin değil **tek tek dosya** olarak yazılı: kardeşleri
    // `server/jobs/jobs.ts` oturumlu uçları taşıyor (başvuru, kapatma,
    // iptal, "ilanlarım") ve dizin izni, onun bir gün sessizce `apiFetch`'e
    // kaymasına kapıyı açardı. `public-jobs.ts` ayrı bir dosya olarak
    // duruyor tam da bu yüzden: herkese açık ilan okuması oturumsuz olmak
    // **zorunda** (ADR-0003 adres kesinliği bakan kişiye göre değişiyor) ve
    // ayrımı dosya sınırına koymak, iznin oturumlu uçlara bulaşmasını
    // engelliyor.
    const allowed = [
      path.join(sourceRoot, "server", "session", "session.ts"),
      path.join(sourceRoot, "server", "session", "refresh.ts"),
      path.join(sourceRoot, "server", "auth"),
      path.join(sourceRoot, "server", "legal"),
      path.join(sourceRoot, "server", "jobs", "search.ts"),
      path.join(sourceRoot, "server", "jobs", "public-jobs.ts"),
    ];

    const direct = sourceFiles(sourceRoot)
      .filter((file) => !allowed.some((prefix) => file.startsWith(prefix)))
      .filter((file) => /from "@\/server\/api\/client"/.test(readFileSync(file, "utf8")));

    expect(direct).toEqual([]);
  });

  it("GET /users/me'yi yalnız kabuk okur; profil modülü bu kaynağa yalnız PATCH yazar", () => {
    // Kabuk profili bir kez okuyup `React.cache()` ile paylaşıyor. İkinci bir
    // çağıran, her sayfa render'ına ikinci bir tur ekler.
    const callers = sourceFiles(sourceRoot).filter((file) =>
      /backendPaths\.usersMe|["'`]\/users\/me["'`]/.test(readFileSync(file, "utf8")),
    );

    const profileModule = path.join(sourceRoot, "server", "profile", "profile.ts");

    expect(callers).toEqual([
      path.join(sourceRoot, "server", "contract.ts"),
      profileModule,
      path.join(sourceRoot, "server", "session", "viewer.ts"),
    ]);
    expect(readFileSync(profileModule, "utf8")).toContain(
      'apiRequest("/users/me", { method: "PATCH", body: input })',
    );
  });
});

describe("kapı katmanının gizlilik sınırı", () => {
  it("kimlik numarasını yalnız daraltmayı yapan modül görür", () => {
    // Kapıların sorduğu soru "var mı"; ham değeri taşımak hiçbir kapıyı
    // açmaz ama veriyi log'a, Sentry olayına ve ölçümlemeye açık hâle
    // getirirdi. Değeri okuyabilecek tek yer, onu boolean'a çeviren yer.
    const readers = sourceFiles(sourceRoot)
      .filter((file) => /maskedTcIdentityNumber|tcIdentityNumber/.test(readFileSync(file, "utf8")))
      // `contract.ts` yalnız yorumda, `/users/me`'nin ne taşıdığını anlatırken anıyor.
      .filter((file) => file !== path.join(sourceRoot, "server", "contract.ts"));

    expect(readers).toEqual([path.join(sourceRoot, "server", "session", "viewer.ts")]);
  });

  it("kapı kararları hiçbir yerde log'a ya da ölçümlemeye yazılmaz", () => {
    // `sendHandoffEvent` kapalı bir olay birliği taşıyor ve `console` yalnız
    // ölçümleme ucunda; kapı modülleri ikisine de dokunmamalı.
    const gateModules = [
      path.join(sourceRoot, "server", "session", "gates.ts"),
      path.join(sourceRoot, "lib", "gates.ts"),
      path.join(sourceRoot, "components", "employer-gate.tsx"),
    ];

    for (const file of gateModules) {
      const source = readFileSync(file, "utf8");
      expect(/console\.|captureException|sendHandoffEvent/.test(source), file).toBe(false);
    }
  });
});
