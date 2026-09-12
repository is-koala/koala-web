import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { notFound, redirect, unstable_rethrow } from "next/navigation";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import { ApiError } from "@/server/api/errors";

const appRoot = path.resolve(import.meta.dirname);
const sessionShellRoot = path.join(appRoot, "(uygulama)");
const profileActionSupport = path.join(sessionShellRoot, "panel", "profil", "action-support.ts");

/**
 * Sayfaların dışında duran ama `apiRequest` üzerinden oturumlu backend'e
 * çıkan ve hatayı **kendi** catch'inde ekran durumuna çeviren yükleyiciler.
 *
 * Bunlar `(uygulama)` ağacında değil; dosya tarama onları görmez. Listeye
 * girmeyen bir paylaşılan yükleyici, çağıran action'ın `unstable_rethrow`'u
 * hiç göremeden yönlendirmeyi yutar (is-koala/koala-web#148).
 */
const sharedSessionLoaders = [
  path.resolve(appRoot, "..", "server", "gallery", "gallery.ts"),
  path.resolve(appRoot, "..", "server", "jobs", "submission.ts"),
];

function sourceFiles(directory: string, keep: (name: string) => boolean): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(full, keep);
    return keep(entry.name) ? [full] : [];
  });
}

function actionFiles(): string[] {
  return sourceFiles(appRoot, (name) => name.endsWith("actions.ts"));
}

function isTestFile(name: string): boolean {
  return /\.test\.tsx?$/.test(name);
}

/**
 * Oturumlu kabukların altındaki her kaynak dosya: sayfalar, kabuk parçaları
 * ve sayfaların yanına konmuş yardımcılar. Action dosyaları yukarıdaki
 * kümede zaten tarandığı için burada dışarıda.
 */
function sessionRouteFiles(): string[] {
  return sourceFiles(
    sessionShellRoot,
    (name) =>
      /\.tsx?$/.test(name) && !isTestFile(name) && !name.endsWith("actions.ts"),
  ).filter((file) => file !== profileActionSupport);
}

function parsed(file: string, contents = readFileSync(file, "utf8")): ts.SourceFile {
  return ts.createSourceFile(
    file,
    contents,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function callsSessionGuard(source: ts.SourceFile): boolean {
  let guarded = false;

  function visit(node: ts.Node): void {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "requireSessionForCurrentPath"
    ) {
      guarded = true;
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  return guarded;
}

function protectedActionFiles(): Array<{ file: string; source: ts.SourceFile }> {
  return [...actionFiles(), profileActionSupport]
    .map((file) => ({ file, source: parsed(file) }))
    .filter(
      ({ file, source }) =>
        file.includes(`${path.sep}(uygulama)${path.sep}`) || callsSessionGuard(source),
    );
}

function sessionLoaderFiles(): Array<{ file: string; source: ts.SourceFile }> {
  return [...sessionRouteFiles(), ...sharedSessionLoaders].map((file) => ({
    file,
    source: parsed(file),
  }));
}

function importsControlFlowRethrow(source: ts.SourceFile): boolean {
  return source.statements.some(
    (statement) =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === "next/navigation" &&
      statement.importClause?.namedBindings !== undefined &&
      ts.isNamedImports(statement.importClause.namedBindings) &&
      statement.importClause.namedBindings.elements.some(
        (element) => element.name.text === "unstable_rethrow",
      ),
  );
}

function catchesWithoutControlFlowRethrow(source: ts.SourceFile): number[] {
  const unsafe: number[] = [];
  const imported = importsControlFlowRethrow(source);

  function visit(node: ts.Node): void {
    if (ts.isCatchClause(node)) {
      const caught = node.variableDeclaration?.name;
      const first = node.block.statements[0];
      const expression = first && ts.isExpressionStatement(first) ? first.expression : undefined;
      const call = expression && ts.isCallExpression(expression) ? expression : undefined;
      const argument = call?.arguments[0];
      const safe =
        imported &&
        caught !== undefined &&
        ts.isIdentifier(caught) &&
        call !== undefined &&
        ts.isIdentifier(call.expression) &&
        call.expression.text === "unstable_rethrow" &&
        argument !== undefined &&
        ts.isIdentifier(argument) &&
        argument.text === caught.text;

      if (!safe) unsafe.push(source.getLineAndCharacterOfPosition(node.getStart()).line + 1);
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  return unsafe;
}

function unsafeCatchSites(files: Array<{ file: string; source: ts.SourceFile }>): string[] {
  return files.flatMap(({ file, source }) =>
    catchesWithoutControlFlowRethrow(source).map(
      (line) => `${path.relative(appRoot, file)}:${line}`,
    ),
  );
}

/** Kaynaktan tek bir `unstable_rethrow(error);` satırı silinmiş hâli. */
function withoutFirstRethrow(file: string): string {
  const original = readFileSync(file, "utf8");
  const stripped = original.replace(/^[ \t]*unstable_rethrow\(error\);\n/m, "");
  expect(stripped).not.toBe(original);
  return stripped;
}

describe("korumalı Server Action kontrol akışı", () => {
  it("her catch sınırında Next redirect/notFound hatasını ilk iş olarak yeniden fırlatır", () => {
    expect(unsafeCatchSites(protectedActionFiles())).toEqual([]);
  });

  it.each([
    ["yan etki", "audit(error);"],
    ["erken dönüş", "return failure(error);"],
  ])("%s rethrow'dan önceyse sözleşmeyi reddeder", (_name, precedingStatement) => {
    const source = parsed(
      "unsafe-actions.ts",
      `import { unstable_rethrow } from "next/navigation";
       try { await operation(); } catch (error) {
         ${precedingStatement}
         unstable_rethrow(error);
         return failure(error);
       }`,
    );

    expect(catchesWithoutControlFlowRethrow(source)).toHaveLength(1);
  });

  it("paylaşılan profil mutation catch sınırını da tarar", () => {
    const registered = protectedActionFiles().find(({ file }) => file === profileActionSupport);
    expect(registered).toBeDefined();

    expect(
      catchesWithoutControlFlowRethrow(
        parsed(profileActionSupport, withoutFirstRethrow(profileActionSupport)),
      ),
    ).toHaveLength(1);
  });
});

/**
 * Sayfa yükleyicileri action'larla aynı sözleşmeye tabi.
 *
 * `apiRequest` oturumun render ortasında bittiğini anlarsa `redirect()`
 * fırlatıyor; sayfanın backend hatasını karta çeviren catch'i onu da yutarsa
 * kullanıcı giriş sayfası yerine "beklenmeyen hata" görüyor
 * (is-koala/koala-web#148). Kural dosya adına değil ağaca bağlı: `(uygulama)`
 * altındaki her catch, ne tür dosyada olursa olsun, önce yeniden fırlatır.
 */
describe("oturumlu sayfa yükleyicileri kontrol akışı", () => {
  it("(uygulama) altındaki ve paylaşılan yükleyicilerdeki her catch önce yeniden fırlatır", () => {
    expect(unsafeCatchSites(sessionLoaderFiles())).toEqual([]);
  });

  it("değişkensiz catch'i de reddeder", () => {
    // `catch {` hatayı hiç bağlamaz; yeniden fırlatacak bir şey yoktur.
    const source = parsed(
      "loader.ts",
      `import { unstable_rethrow } from "next/navigation";
       try { await operation(); } catch { return null; }`,
    );

    expect(catchesWithoutControlFlowRethrow(source)).toHaveLength(1);
  });

  it.each(sharedSessionLoaders.map((file) => [path.relative(appRoot, file), file]))(
    "paylaşılan yükleyici %s taranıyor",
    (_name, file) => {
      expect(sessionLoaderFiles().some((entry) => entry.file === file)).toBe(true);
      expect(
        catchesWithoutControlFlowRethrow(parsed(file, withoutFirstRethrow(file))).length,
      ).toBeGreaterThan(0);
    },
  );
});

/**
 * AST kuralı `unstable_rethrow`'a güveniyor; bu blok o güvenin dayandığı
 * çalışma zamanı sözleşmesini sabitliyor. Sürüm notu `AGENTS.md`'de:
 * "This is NOT the Next.js you know" — hata biçimi değişirse önce burası
 * kırılır, sayfalar sessizce hata kartına düşmez.
 */
describe("unstable_rethrow çalışma zamanı sözleşmesi", () => {
  function thrownBy(interrupt: () => never): unknown {
    try {
      interrupt();
    } catch (error) {
      return error;
    }
    throw new Error("kontrol akışı fırlatmadı");
  }

  it("redirect() kesmesini geçirir", () => {
    const interrupt = thrownBy(() => redirect("/giris?next=%2Fpanel%2Fprofil"));

    expect(() => unstable_rethrow(interrupt)).toThrow();
    expect(interrupt).toMatchObject({ digest: expect.stringMatching(/^NEXT_REDIRECT;/) });
  });

  it("notFound() kesmesini geçirir", () => {
    const interrupt = thrownBy(() => notFound());

    expect(() => unstable_rethrow(interrupt)).toThrow();
    expect(interrupt).toMatchObject({ digest: expect.stringMatching(/^NEXT_HTTP_ERROR_FALLBACK;404/) });
  });

  it("backend hatasını ve sıradan hatayı catch'e bırakır", () => {
    const backend = new ApiError({
      status: 503,
      errorCode: "EXTERNAL_SERVICE",
      errorCategory: "EXTERNAL_SERVICE",
      message: "ham mesaj",
    });

    expect(() => unstable_rethrow(backend)).not.toThrow();
    expect(() => unstable_rethrow(new Error("ağ koptu"))).not.toThrow();
    expect(() => unstable_rethrow("dize")).not.toThrow();
  });
});
