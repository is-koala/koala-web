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
    // ya tokensız uçlar (giriş, kayıt, parola, yasal metinler) ya da
    // yenilemenin kendisi.
    const allowed = [
      path.join(sourceRoot, "server", "session", "session.ts"),
      path.join(sourceRoot, "server", "session", "refresh.ts"),
      path.join(sourceRoot, "server", "auth"),
      path.join(sourceRoot, "server", "legal"),
    ];

    const direct = sourceFiles(sourceRoot)
      .filter((file) => !allowed.some((prefix) => file.startsWith(prefix)))
      .filter((file) => /from "@\/server\/api\/client"/.test(readFileSync(file, "utf8")));

    expect(direct).toEqual([]);
  });

  it("GET /users/me'yi yalnız kabuğun bağlam okuyucusu ister", () => {
    // Kabuk profili bir kez okuyup `React.cache()` ile paylaşıyor. İkinci bir
    // çağıran, her sayfa render'ına ikinci bir tur ekler.
    const callers = sourceFiles(sourceRoot).filter((file) =>
      /backendPaths\.usersMe|["'`]\/users\/me["'`]/.test(readFileSync(file, "utf8")),
    );

    expect(callers).toEqual([
      path.join(sourceRoot, "server", "contract.ts"),
      path.join(sourceRoot, "server", "session", "viewer.ts"),
    ]);
  });
});
