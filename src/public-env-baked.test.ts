import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const sourceRoot = path.resolve(import.meta.dirname);
const dockerfile = path.resolve(sourceRoot, "..", "Dockerfile");

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    // Testler derlemeye girmez; yalnız gönderilen kaynak taranır.
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

function publicNames(source: string): string[] {
  return [...source.matchAll(/NEXT_PUBLIC_[A-Z0-9_]+/g)].map((match) => match[0]);
}

function declaredArgs(dockerfileContents: string): Set<string> {
  // Yalnız ARG satırları sayılır. "Adı Dockerfile'da geçiyor mu" diye sormak
  // yetmez: ENV satırı da aynı adı taşıdığı için ARG silinse bile iddia
  // yeşil kalırdı — komşu düğümün tatmin ettiği bir iddia hiçbir şey ölçmez.
  return new Set(
    [...dockerfileContents.matchAll(/^ARG (NEXT_PUBLIC_[A-Z0-9_]+)\s*$/gm)].map(
      (match) => match[1],
    ),
  );
}

describe("public ortam değişkenleri derlemeye gömülüyor", () => {
  it("kodda okunan her NEXT_PUBLIC_ değişkeni Dockerfile'da ARG olarak tanımlı", () => {
    // `NEXT_PUBLIC_` değişkenleri `next build` sırasında bundle'a gömülür,
    // çalışma anında okunmaz. Dockerfile'da ARG olarak tanımlanmayan bir
    // değişken derlemede boş kalır ve hata vermez: sayfa açılır, özellik
    // sessizce çalışmaz. Sentry'nin üç değişkeni tam olarak böyle kalmıştı.
    const used = new Set(
      sourceFiles(sourceRoot)
        .flatMap((file) => publicNames(readFileSync(file, "utf8")))
        // `server-only.test.ts` bu adı sızmadığını kanıtlamak için anıyor;
        // gerçek bir okuma değil ve kasıtlı olarak hiçbir yere gömülmemeli.
        .filter((name) => name !== "NEXT_PUBLIC_API"),
    );

    const declared = declaredArgs(readFileSync(dockerfile, "utf8"));
    const missing = [...used].filter((name) => !declared.has(name)).sort();

    expect(missing).toEqual([]);
  });

  it("Dockerfile'da tanımlı her NEXT_PUBLIC_ değişkeni build aşamasında ENV'e de bağlanıyor", () => {
    // ARG tek başına yetmiyor: `npm run build` ancak ENV üzerinden görüyor.
    // ARG yazılıp ENV unutulursa değişken yine sessizce boş kalır.
    const contents = readFileSync(dockerfile, "utf8");
    const args = new Set(
      [...contents.matchAll(/^ARG (NEXT_PUBLIC_[A-Z0-9_]+)$/gm)].map((match) => match[1]),
    );
    const envs = new Set(
      [...contents.matchAll(/^ENV (NEXT_PUBLIC_[A-Z0-9_]+)=/gm)].map((match) => match[1]),
    );

    const unbound = [...args].filter((name) => !envs.has(name)).sort();

    expect(unbound).toEqual([]);
  });
});
