import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * Hata kataloğunun rota sınırı (is-koala/koala-web#177).
 *
 * İlan ayrıntısı 256.000 baytlık betik bütçesinin sınırında ve kataloğun
 * tamamı bir zamanlar o sayfanın istemci paketine giriyordu: kabuğa yazılan
 * her yeni cümle herkese açık sayfayı büyütüyordu. Bu dosya iki yönü de
 * tutar — herkese açık istemci grafiği kabuk modüllerine ulaşmaz, kabuk da
 * herkese açık küçük kataloğu doğrudan okuyup cümlelerini aile metnine
 * düşürmez. İkisi de kaynak koddan okunuyor, derlenmiş paketten değil;
 * `docs/performance-accessibility-budget.md` ölçümü ayrıca tutar.
 */

const sourceRoot = path.resolve(import.meta.dirname, "..");

const appShellModules = [
  path.join(sourceRoot, "lib", "errors.ts"),
  path.join(sourceRoot, "lib", "gate-notices.ts"),
  path.join(sourceRoot, "lib", "company-errors.ts"),
  path.join(sourceRoot, "lib", "gallery-errors.ts"),
  path.join(sourceRoot, "address", "errors.ts"),
  path.join(sourceRoot, "assignments", "errors.ts"),
  path.join(sourceRoot, "identity", "errors.ts"),
  path.join(sourceRoot, "jobs", "errors.ts"),
  path.join(sourceRoot, "messaging", "errors.ts"),
  path.join(sourceRoot, "payments", "errors.ts"),
  path.join(sourceRoot, "components", "states.tsx"),
  path.join(sourceRoot, "components", "employer-gate.tsx"),
  path.join(sourceRoot, "app", "(uygulama)"),
];

const publicCatalogModules = [
  path.join(sourceRoot, "lib", "public-errors.ts"),
  path.join(sourceRoot, "components", "public-states.tsx"),
];

/** Küçük kataloğu okuması beklenen tek kabuk kodu: onu tam katalogla birleştiren. */
const publicCatalogComposers = [path.join(sourceRoot, "lib", "errors.ts")];

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

function resolveImport(from: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith("@/")) base = path.join(sourceRoot, specifier.slice(2));
  else if (specifier.startsWith(".")) base = path.resolve(path.dirname(from), specifier);
  else return null;

  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
  ]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

type Module = { file: string; client: boolean; imports: string[] };

const modules = new Map<string, Module>();

/**
 * Tip içe aktarmaları derlemeden düşer, pakete girmez; grafikte kenar değil.
 * Dinamik `import()` kenar sayılır: tembel yüklense de sınırın öbür yanına
 * geçmek yine bir sızıntı.
 */
function moduleOf(file: string): Module {
  const cached = modules.get(file);
  if (cached) return cached;

  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const imports = new Set<string>();
  const client = source.statements.some(
    (statement) =>
      ts.isExpressionStatement(statement) &&
      ts.isStringLiteral(statement.expression) &&
      statement.expression.text === "use client",
  );

  function add(specifier: string) {
    const resolved = resolveImport(file, specifier);
    if (resolved) imports.add(resolved);
  }

  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause;
      const typeOnly =
        clause?.isTypeOnly === true ||
        (clause?.namedBindings !== undefined &&
          ts.isNamedImports(clause.namedBindings) &&
          clause.name === undefined &&
          clause.namedBindings.elements.length > 0 &&
          clause.namedBindings.elements.every((element) => element.isTypeOnly));
      if (!typeOnly) add(node.moduleSpecifier.text);
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      !node.isTypeOnly
    ) {
      add(node.moduleSpecifier.text);
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      add(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);

  const graphNode = { file, client, imports: [...imports] };
  modules.set(file, graphNode);
  return graphNode;
}

/** Giriş dosyalarından ulaşılan her modül; `client` ile yalnız istemci grafiği. */
function reachable(entries: string[], { clientOnly }: { clientOnly: boolean }): string[] {
  const seen = new Set<string>();
  const queue = entries.map((file) => ({ file, client: false }));
  const found = new Set<string>();

  while (queue.length > 0) {
    const { file, client: parentClient } = queue.shift()!;
    const node = moduleOf(file);
    const client = parentClient || node.client;
    const key = `${file}:${client}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!clientOnly || client) found.add(file);
    for (const dependency of node.imports) queue.push({ file: dependency, client });
  }
  return [...found].sort();
}

function within(file: string, roots: string[]): boolean {
  return roots.some((root) => file === root || file.startsWith(root + path.sep));
}

const relative = (file: string) => path.relative(sourceRoot, file);

describe("hata kataloğunun rota sınırı", () => {
  it("herkese açık istemci grafiği kabuk modüllerine ulaşmaz", () => {
    // Giriş kümesi `(marketing)` rotalarıyla bitmiyor: kök layout, kök
    // `error.tsx` ve `not-found.tsx` her rotanın ilk yüküne giriyor, yani
    // ilan sayfasının ölçülen paketi onları da taşıyor.
    const entries = [
      ...sourceFiles(path.join(sourceRoot, "app", "(marketing)")),
      path.join(sourceRoot, "app", "layout.tsx"),
      path.join(sourceRoot, "app", "error.tsx"),
      path.join(sourceRoot, "app", "not-found.tsx"),
    ];

    const leaked = reachable(entries, { clientOnly: true })
      .filter((file) => within(file, appShellModules))
      .map(relative);

    expect(leaked).toEqual([]);
  });

  it("herkese açık istemci grafiği küçük kataloğu okur", () => {
    // Sınırın öbür yüzü: ilan sayfasının hata bandı gerçekten bu dosyadan
    // besleniyor. Aksi hâlde yukarıdaki test bir gün "hiç katalog yok" diye
    // de geçerdi.
    const client = reachable(sourceFiles(path.join(sourceRoot, "app", "(marketing)")), {
      clientOnly: true,
    });

    expect(client).toContain(path.join(sourceRoot, "lib", "public-errors.ts"));
    expect(client).toContain(path.join(sourceRoot, "components", "public-states.tsx"));
  });

  it("kabuk küçük kataloğu doğrudan okumaz", () => {
    // Kabuk bir formda `PublicFormAlert` kullanırsa ödeme ya da şirket reddi
    // sessizce aile metnine düşer ve hiçbir test kırılmaz. Herkese açık
    // yüzeyden de ulaşılan modüller (işveren ilan önizlemesinin çizdiği
    // başvuru formu gibi) kabuk kodu sayılmaz: onların cümleleri zaten
    // küçük katalogda. Tek izinli okuyucu küçük kataloğu tam katalogla
    // birleştiren modüller.
    const publicSurface = new Set(
      reachable(
        [
          ...sourceFiles(path.join(sourceRoot, "app", "(marketing)")),
          ...sourceFiles(path.join(sourceRoot, "app", "(account)")),
          path.join(sourceRoot, "app", "layout.tsx"),
          path.join(sourceRoot, "app", "error.tsx"),
          path.join(sourceRoot, "app", "not-found.tsx"),
        ],
        { clientOnly: false },
      ),
    );

    const offenders = reachable(sourceFiles(path.join(sourceRoot, "app", "(uygulama)")), {
      clientOnly: false,
    })
      .filter((file) => !publicSurface.has(file) && !within(file, publicCatalogComposers))
      .filter((file) =>
        moduleOf(file).imports.some((dependency) => within(dependency, publicCatalogModules)),
      )
      .map(relative);

    expect(offenders).toEqual([]);
  });
});
