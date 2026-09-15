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
 * tutar — herkese açık rotaların import grafiği (sunucu dahil) hiçbir
 * kabuk kataloğuna ulaşmaz, kabuk da herkese açık küçük kataloğu doğrudan
 * okuyup cümlelerini aile metnine düşürmez. Katalog modülleri bir listeden
 * değil bildirimlerinden bulunuyor. İkisi de kaynak koddan okunuyor,
 * derlenmiş paketten değil;
 * `docs/performance-accessibility-budget.md` ölçümü ayrıca tutar.
 */

const sourceRoot = path.resolve(import.meta.dirname, "..");

const publicCatalog = path.join(sourceRoot, "lib", "public-errors.ts");
const publicCatalogModules = [publicCatalog, path.join(sourceRoot, "components", "public-states.tsx")];

/** Küçük kataloğu okuması beklenen tek kabuk kodu: onu tam katalogla birleştiren. */
const publicCatalogComposers = [path.join(sourceRoot, "lib", "errors.ts")];

/**
 * `(account)` altında kabuk kataloğunu haklı olarak okuyan üç rota: davet
 * şirket kodlarını, ödeme sonucu ödeme kodlarını, kimlik ekranı belge
 * kodlarını gösteriyor. Geri kalanı giriş/kayıt/parola akışı ve herkese
 * açık sayılıyor.
 */
const accountShellRoutes = ["davet", "kimlik-dogrula", "payment"].map((route) =>
  path.join(sourceRoot, "app", "(account)", route),
);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

/**
 * Katalog modülü: bir `ErrorCatalog` değeri ya da kapı sözlüğü bildiren her
 * dosya. Elle tutulan bir liste yerine kaynaktan okunuyor ki yeni bir alan
 * kataloğu sınırın dışında kalamasın; yalnız küçük katalog muaf.
 */
function catalogModules(): string[] {
  return sourceFiles(sourceRoot).filter(
    (file) =>
      file !== publicCatalog &&
      /: ErrorCatalog = \{|Record<GateId, GateNotice>> = \{/.test(readFileSync(file, "utf8")),
  );
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

const rootEntries = [
  path.join(sourceRoot, "app", "layout.tsx"),
  path.join(sourceRoot, "app", "error.tsx"),
  path.join(sourceRoot, "app", "not-found.tsx"),
];

const publicAccountEntries = () =>
  sourceFiles(path.join(sourceRoot, "app", "(account)")).filter(
    (file) => !within(file, accountShellRoutes),
  );

describe("hata kataloğunun rota sınırı", () => {
  it("katalog modülleri kaynaktan bulunuyor", () => {
    // Kural bir listeye değil bildirime bağlı; bu test bildirimin gerçekten
    // yakalandığını gösteriyor ki aşağıdaki boş liste "hiç katalog yok" diye
    // de geçmesin.
    const found = catalogModules().map(relative);

    expect(found).toContain(path.join("lib", "errors.ts"));
    expect(found).toContain(path.join("lib", "gate-notices.ts"));
    expect(found).toContain(path.join("payments", "errors.ts"));
    expect(found).not.toContain(path.join("lib", "public-errors.ts"));
  });

  it("herkese açık rotalar kabuk kataloğuna ulaşmaz", () => {
    // Giriş kümesi `(marketing)` rotalarıyla bitmiyor: kök layout, kök
    // `error.tsx` ve `not-found.tsx` her rotanın ilk yüküne giriyor, ve
    // `(account)` giriş/kayıt/parola formları da küçük kataloğa taşındı.
    // Sunucu grafiği de dahil: sunucu sayfasının çizdiği hata kartı da aynı
    // küçük kataloğu okumalı ki iki yüzey aynı kodda ayrışmasın.
    const entries = [
      ...sourceFiles(path.join(sourceRoot, "app", "(marketing)")),
      ...publicAccountEntries(),
      ...rootEntries,
    ];
    const forbidden = catalogModules();

    const leaked = reachable(entries, { clientOnly: false })
      .filter((file) => within(file, forbidden) || within(file, [path.join(sourceRoot, "app", "(uygulama)")]))
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

    expect(client).toContain(publicCatalog);
    expect(client).toContain(path.join(sourceRoot, "components", "public-states.tsx"));
  });

  it("kabuk küçük kataloğu doğrudan okumaz", () => {
    // Kabuk bir formda `PublicFormAlert` kullanırsa ödeme ya da şirket reddi
    // sessizce aile metnine düşer ve hiçbir test kırılmaz. Herkese açık
    // yüzeyden de ulaşılan modüller (işveren ilan önizlemesinin çizdiği
    // başvuru formu gibi) kabuk kodu sayılmaz: onların cümleleri zaten
    // küçük katalogda. Tek izinli okuyucu küçük kataloğu tam katalogla
    // birleştiren modül.
    const publicSurface = new Set(
      reachable(
        [
          ...sourceFiles(path.join(sourceRoot, "app", "(marketing)")),
          ...publicAccountEntries(),
          ...rootEntries,
        ],
        { clientOnly: false },
      ),
    );

    const offenders = reachable(
      [
        ...sourceFiles(path.join(sourceRoot, "app", "(uygulama)")),
        ...accountShellRoutes.flatMap((route) => sourceFiles(route)),
      ],
      { clientOnly: false },
    )
      .filter((file) => !publicSurface.has(file) && !within(file, publicCatalogComposers))
      .filter((file) =>
        moduleOf(file).imports.some((dependency) => within(dependency, publicCatalogModules)),
      )
      .map(relative);

    expect(offenders).toEqual([]);
  });
});
