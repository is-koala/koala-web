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
    // İlan uçları dizin değil **tek tek dosya** olarak yazılı, ve iki satır
    // olmaları tek bir kuralın iki kez yazılması değil: `server/jobs/` altında
    // üç modül var ve üçü üç ayrı istek-bağlamı kademesinde duruyor
    // (`public-jobs.ts` modül başlığı bunu açıyor). `jobs.ts` oturumlu uçları
    // taşıyor (başvuru, kapatma, iptal, "ilanlarım") ve **listede olmamalı**;
    // öbür ikisi oturumsuz ve olmalı. Dizin izni üçünü birden kapsar, yani
    // `jobs.ts`'in bir gün sessizce `apiFetch`'e kaymasına kapıyı açardı —
    // izin listesinin tek işi tam olarak bunu engellemek. İki satır, o üçlü
    // ayrımın izin listesindeki karşılığı.
    const allowed = [
      path.join(sourceRoot, "server", "session", "session.ts"),
      path.join(sourceRoot, "server", "session", "refresh.ts"),
      path.join(sourceRoot, "server", "auth"),
      path.join(sourceRoot, "server", "legal"),
      path.join(sourceRoot, "server", "jobs", "search.ts"),
      path.join(sourceRoot, "server", "jobs", "public-jobs.ts"),
      // Destek formu oturumsuz; SMTP Next'te yok, BFF `apiFetch` ile
      // `POST /public/contact` çağırır. Dizin izni `submit.ts`'i de açardı.
      path.join(sourceRoot, "server", "support", "contact.ts"),
      // Ticari e-postanın çıkış bağlantısı girişsiz: kimlik tokenın kendisi,
      // backend ucu `permitAll` (is-koala/koala-web#54). Dizin değil dosya.
      path.join(sourceRoot, "server", "notifications", "unsubscribe.ts"),
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

    expect(readers).toEqual([
      // İşçi kimliğini işverene gösterme (is-koala/koala-web#185): burada
      // değer bir kapı girdisi değil, ekranın kendisi — model, sunucu okuyucu
      // ve bölüm. Üçü de aşağıdaki testte log/depo yasağına bağlı.
      path.join(sourceRoot, "assignments", "identity-reveal.ts"),
      path.join(sourceRoot, "components", "worker-identity-reveal.tsx"),
      path.join(sourceRoot, "server", "assignments", "identity-reveal.ts"),
      path.join(sourceRoot, "server", "identity", "documents.ts"),
      path.join(sourceRoot, "server", "session", "viewer.ts"),
    ]);
  });

  it("işçi kimliği yanıtı hiçbir yerde günlüğe, ölçümlemeye ya da tarayıcı deposuna yazılmaz", () => {
    // Backend her okumayı kayda geçirip işçiye bildiriyor; web'in tek işi
    // değeri 60 saniye ekranda tutmak. Değeri taşıyan üç modül ve action
    // dosyası `console`, Sentry, ölçümleme ve kalıcı tarayıcı deposundan uzak
    // durur (is-koala/koala-web#185).
    const revealModules = [
      path.join(sourceRoot, "assignments", "identity-reveal.ts"),
      path.join(sourceRoot, "components", "worker-identity-reveal.tsx"),
      path.join(sourceRoot, "server", "assignments", "identity-reveal.ts"),
      path.join(sourceRoot, "app", "(uygulama)", "isveren", "atama", "[assignmentId]", "actions.ts"),
    ];

    for (const file of revealModules) {
      const source = readFileSync(file, "utf8");
      expect(
        /console\.|captureException|sendHandoffEvent|localStorage|sessionStorage|indexedDB|document\.cookie/.test(source),
        file,
      ).toBe(false);
    }
  });

  it("abonelikten çıkma tokenı hiçbir yerde günlüğe, ölçümlemeye ya da tarayıcı deposuna yazılmaz", () => {
    // Ticari e-postanın çıkış tokenı 90 gün geçerli ve girişsiz bir tercihi
    // kapatıyor (is-koala/koala-web#54). Tokenı okuyan ya da taşıyan her
    // modül — istemci paneli dahil — `console`, Sentry, ölçümleme ve kalıcı
    // tarayıcı deposundan uzak durur; adres çubuğu dışında hiçbir yere düşmez.
    const tokenModules = [
      path.join(sourceRoot, "notifications", "unsubscribe.ts"),
      path.join(sourceRoot, "components", "unsubscribe-panel.tsx"),
      path.join(sourceRoot, "server", "notifications", "unsubscribe.ts"),
      path.join(sourceRoot, "app", "api", "notification-preferences", "unsubscribe", "route.ts"),
      path.join(sourceRoot, "app", "(account)", "bildirim-tercihleri", "cikis", "page.tsx"),
    ];

    for (const file of tokenModules) {
      const source = readFileSync(file, "utf8");
      expect(
        /console\.|@sentry\/|Sentry\.|captureException|captureMessage|sendHandoffEvent|localStorage|sessionStorage|indexedDB|document\.cookie/.test(source),
        file,
      ).toBe(false);
    }
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
