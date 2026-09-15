import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { notFound, redirect, unstable_rethrow } from "next/navigation";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import { ApiError } from "@/server/api/errors";

/*
 * Next `redirect()` ve `notFound()` bir istisnayla ilerliyor. Oturumlu bir
 * yükleyicinin backend hatasını karta çeviren catch'i o istisnayı da yutarsa
 * kullanıcı giriş sayfası yerine "beklenmeyen hata" görüyor
 * (is-koala/koala-web#148). Kural: böyle bir catch sınırının ilk işi
 * `unstable_rethrow(error)`.
 *
 * **Hangi dosyaların tarandığı klasöre değil oturuma bağlı.** Kaynak koddan
 * bir çağrı grafiği çıkarılıyor: `next/navigation`'dan `redirect` alan her
 * fonksiyon kök, onu (aynı dosyada ya da adıyla içe aktararak) çağıran her
 * fonksiyon da yönlendirebilir. Bir modül böyle bir fonksiyonu içe aktarıp
 * **çağırıyorsa** oturum modülüdür ve içindeki her catch sınırı taranır. Elle
 * tutulan bir kapı listesi yok: `redirect()` çağıran yeni bir kapı kendiliğinden
 * kök olur, ona ulaşan yeni bir sayfa kendiliğinden taranır. `(uygulama)` ağacı
 * ayrıca tümüyle taranıyor, çünkü orası tanım gereği oturumlu (`AGENTS.md`) ve
 * çağrı grafiği bir callback'in içini göremez (`action-support.ts` gibi
 * yüksek dereceli yardımcılar).
 *
 * İstisnalar `reviewedBoundaries` listesinde, fonksiyon adıyla ve gerekçesiyle.
 * Her giriş hâlâ var olan, hâlâ catch taşıyan ve hâlâ tarama kapsamındaki bir
 * fonksiyona çözülmek zorunda; çözülemeyen giriş ölü sayılır ve test kırılır.
 */

const srcRoot = path.resolve(import.meta.dirname, "..");
const appRoot = path.join(srcRoot, "app");
const sessionShellRoot = path.join(appRoot, "(uygulama)");

/** `src/` köküne göre yol; hata mesajları ve liste girişleri bu biçimde. */
function relative(file: string): string {
  return path.relative(srcRoot, file);
}

function absolute(relativePath: string): string {
  return path.join(srcRoot, relativePath);
}

/**
 * Yönlendirmeyi yeniden fırlatmayan ama bunun bilinçli olduğu sınırlar.
 *
 * `fn` sınırı saran en dıştaki bildirim; satır numarası değil, çünkü satır
 * kayınca giriş sessizce başka bir yere işaret ederdi.
 */
const reviewedBoundaries: ReadonlyArray<{ file: string; fn: string; reason: string }> = [
  {
    file: "server/session/viewer.ts",
    fn: "loadProfile",
    reason:
      "Kökün kendisi: ApiError olmayan her şeyi `throw error` ile geçiriyor, yönlendirme dahil.",
  },
  {
    file: "server/auth/logout.ts",
    fn: "signOut",
    reason: "Çıkışın hedefi zaten oturumu bitirmek; yenilemenin yönlendirmesi bilerek yutuluyor.",
  },
  {
    file: "server/identity/upload-auth.ts",
    fn: "verifyIdentityUploadSession",
    reason: "fetch ile çağrılan rota: yönlendirme HTML giriş sayfası olurdu, 401'e çevriliyor.",
  },
  {
    file: "server/address/routes.ts",
    fn: "open",
    reason: "fetch ile çağrılan rota: yönlendirme `isRedirect` ile 401'e çevriliyor.",
  },
  {
    file: "server/address/routes.ts",
    fn: "readCoordinates",
    reason: "try gövdesi yalnız `request.json()`; içinde Next API yok.",
  },
  {
    file: "app/api/disputes/[disputeId]/evidence/[evidenceId]/download/route.ts",
    fn: "fetchSignedDownload",
    reason: "try gövdesi depoya ham `fetch`; oturum katmanı ve Next API çağrılmıyor.",
  },
  {
    file: "app/api/disputes/[disputeId]/evidence/[evidenceId]/download/route.ts",
    fn: "isAllowedStorageUrl",
    reason: "try gövdesi yalnız `new URL()`.",
  },
  {
    file: "app/api/users/me/identity-documents/route.ts",
    fn: "POST",
    reason:
      "fetch ile çağrılan rota: yönlendirme önce `identityUploadAuthenticationFailure` ile 401'e çevriliyor, rethrow ondan sonra.",
  },
  {
    file: "app/api/realtime-credential/route.ts",
    fn: "POST",
    reason:
      "fetch ile çağrılan rota: her hata gibi yönlendirme de kimlik sızdırmamak için 503'e çevriliyor.",
  },
];

const navigationModule = "next/navigation";
const redirectApis = new Set(["redirect", "permanentRedirect"]);
/** try gövdesinde doğrudan geçmesi catch'i tek başına kapsama sokan Next kesmeleri. */
const interruptApis = new Set([...redirectApis, "notFound", "forbidden", "unauthorized"]);

// ---------------------------------------------------------------------------
// Modül keşfi
// ---------------------------------------------------------------------------

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry.name) && !/\.(test|d)\.tsx?$/.test(entry.name) ? [full] : [];
  });
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

/** Tarayıcıda çalışan modül sunucunun fırlattığı yönlendirmeyi istisna olarak görmez. */
function isClientModule(source: ts.SourceFile): boolean {
  const first = source.statements[0];
  return (
    first !== undefined &&
    ts.isExpressionStatement(first) &&
    ts.isStringLiteral(first.expression) &&
    first.expression.text === "use client"
  );
}

function resolveImport(from: string, specifier: string): string | null {
  const base = specifier.startsWith("@/")
    ? path.join(srcRoot, specifier.slice(2))
    : specifier.startsWith(".")
      ? path.resolve(path.dirname(from), specifier)
      : null;
  if (base === null) return null;
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

// ---------------------------------------------------------------------------
// Modül analizi
// ---------------------------------------------------------------------------

type ImportBinding = { module: string; exported: string };

type Module = {
  file: string;
  source: ts.SourceFile;
  /** Yerel ad → `next/navigation`'daki gerçek adı. */
  navigationBindings: Map<string, string>;
  /** Yerel ad → içe aktarıldığı modül ve oradaki adı. */
  imports: Map<string, ImportBinding>;
  /** Üst düzey fonksiyon/değişken bildirimi → çağırdığı tanımlayıcılar. */
  declarations: Map<string, Set<string>>;
  /** Dışa aktarılan ad → yerel bildirim adı ya da başka modülün dışa aktarımı. */
  exports: Map<string, string | ImportBinding>;
};

/**
 * Bir bildirimin **çağırdığı** tanımlayıcılar: çağrı konumundakiler ve bir
 * çağrıya argüman olarak verilenler (`cache(loadViewer)` gibi sarmalayıcılar).
 *
 * Yalnız geçmek yetmiyor, bilerek: bir sayfa form action'ını
 * `action={publish.bind(null, id)}` diye prop olarak veriyor ama hiç
 * çağırmıyor; o action'ın sondaki `redirect()`'i bu sayfanın catch'ine hiçbir
 * yoldan düşemez. Referans sayılsaydı her form sayfası oturum modülü olurdu.
 */
function calledIdentifiers(root: ts.Node): Set<string> {
  const names = new Set<string>();

  function visit(node: ts.Node): void {
    if (ts.isTypeNode(node) || ts.isImportDeclaration(node)) return;
    if (ts.isCallExpression(node)) {
      if (ts.isIdentifier(node.expression)) names.add(node.expression.text);
      for (const argument of node.arguments) {
        if (ts.isIdentifier(argument)) names.add(argument.text);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(root);
  return names;
}

/**
 * Bir düğümde **değer olarak** geçen tanımlayıcılar. Tip düğümleri, üye adları
 * (`a.b`'deki `b`) ve nesne anahtarları sayılmaz: `options.redirect` bir
 * yönlendirme değil.
 */
function referencedIdentifiers(root: ts.Node): Set<string> {
  const names = new Set<string>();

  function visit(node: ts.Node): void {
    if (ts.isTypeNode(node) || ts.isImportDeclaration(node)) return;
    if (ts.isPropertyAccessExpression(node)) return visit(node.expression);
    if (ts.isPropertyAssignment(node)) return visit(node.initializer);
    if (ts.isShorthandPropertyAssignment(node)) {
      names.add(node.name.text);
      return;
    }
    if (ts.isIdentifier(node)) names.add(node.text);
    ts.forEachChild(node, visit);
  }

  visit(root);
  return names;
}

function hasExportModifier(node: ts.Node): boolean {
  return (
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
  );
}

function analyzeModule(file: string, source = parsed(file)): Module {
  const navigationBindings = new Map<string, string>();
  const imports = new Map<string, ImportBinding>();
  const declarations = new Map<string, Set<string>>();
  const exports = new Map<string, string | ImportBinding>();

  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const clause = statement.importClause;
      if (!clause || clause.isTypeOnly) continue;
      const specifier = statement.moduleSpecifier.text;
      const target = resolveImport(file, specifier);
      const bindings = clause.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) {
          if (element.isTypeOnly) continue;
          const local = element.name.text;
          const exported = element.propertyName?.text ?? local;
          if (specifier === navigationModule) navigationBindings.set(local, exported);
          if (target) imports.set(local, { module: target, exported });
        }
      }
      if (clause.name && target) imports.set(clause.name.text, { module: target, exported: "default" });
      continue;
    }

    if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      const target =
        statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)
          ? resolveImport(file, statement.moduleSpecifier.text)
          : null;
      for (const element of statement.exportClause.elements) {
        const exported = element.name.text;
        const local = element.propertyName?.text ?? exported;
        exports.set(exported, target ? { module: target, exported: local } : local);
      }
      continue;
    }

    if (ts.isFunctionDeclaration(statement) && statement.name) {
      const name = statement.name.text;
      declarations.set(name, calledIdentifiers(statement));
      if (hasExportModifier(statement)) {
        const isDefault = (ts.getModifiers(statement) ?? []).some(
          (modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword,
        );
        exports.set(isDefault ? "default" : name, name);
      }
      continue;
    }

    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) continue;
        const name = declaration.name.text;
        declarations.set(name, calledIdentifiers(declaration));
        if (hasExportModifier(statement)) exports.set(name, name);
      }
    }
  }

  return { file, source, navigationBindings, imports, declarations, exports };
}

/** Tüm sunucu tarafı modüller; testler ve `"use client"` dosyaları dışarıda. */
function serverModules(): Map<string, Module> {
  const modules = new Map<string, Module>();
  for (const file of sourceFiles(srcRoot)) {
    const source = parsed(file);
    if (isClientModule(source)) continue;
    modules.set(file, analyzeModule(file, source));
  }
  return modules;
}

// ---------------------------------------------------------------------------
// Çağrı grafiği: kim yönlendirebilir?
// ---------------------------------------------------------------------------

type Graph = {
  modules: Map<string, Module>;
  /** Modül → yönlendirebilen üst düzey bildirim adları. */
  redirecting: Map<string, Set<string>>;
};

function exportIsRedirecting(graph: Graph, binding: ImportBinding, seen = new Set<string>()): boolean {
  const key = `${binding.module}#${binding.exported}`;
  if (seen.has(key)) return false;
  seen.add(key);
  const unit = graph.modules.get(binding.module);
  const target = unit?.exports.get(binding.exported);
  if (unit === undefined || target === undefined) return false;
  if (typeof target === "string") return graph.redirecting.get(unit.file)?.has(target) ?? false;
  return exportIsRedirecting(graph, target, seen);
}

/** Bir modülün yönlendirebilen **yerel** adları: kendi bildirimleri + içe aktarımları + `redirect` bağları. */
function redirectingNames(graph: Graph, unit: Module): Set<string> {
  const names = new Set<string>();
  for (const [local, api] of unit.navigationBindings) if (redirectApis.has(api)) names.add(local);
  for (const name of graph.redirecting.get(unit.file) ?? []) names.add(name);
  for (const [local, binding] of unit.imports) {
    if (exportIsRedirecting(graph, binding)) names.add(local);
  }
  return names;
}

function buildGraph(modules = serverModules()): Graph {
  const graph: Graph = { modules, redirecting: new Map() };
  for (const file of modules.keys()) graph.redirecting.set(file, new Set());

  let changed = true;
  while (changed) {
    changed = false;
    for (const unit of modules.values()) {
      const known = graph.redirecting.get(unit.file)!;
      const reachable = redirectingNames(graph, unit);
      for (const [name, references] of unit.declarations) {
        if (known.has(name)) continue;
        for (const reference of references) {
          if (reachable.has(reference)) {
            known.add(name);
            changed = true;
            break;
          }
        }
      }
    }
  }

  return graph;
}

/**
 * Yönlendirebilen bir fonksiyonu içe aktarıp **çağıran** modül: catch'i o
 * çağrıyı sarabilir. İçe aktarıp yalnız prop olarak geçiren sayfa sayılmaz;
 * kendi gövdesinde doğrudan `redirect()` çağıran action da sayılmaz — orada
 * tek soru yönlendirmenin `try` içinde olup olmadığı ve onu sınır başına
 * bakan kural (`unsafeBoundaries`) yakalıyor.
 */
function callsImportedRedirectingFunction(graph: Graph, unit: Module): boolean {
  const imported = new Set<string>();
  for (const [local, binding] of unit.imports) {
    if (exportIsRedirecting(graph, binding)) imported.add(local);
  }
  if (imported.size === 0) return false;
  for (const calls of unit.declarations.values()) {
    for (const name of calls) if (imported.has(name)) return true;
  }
  return false;
}

function isSessionShellModule(file: string): boolean {
  return file.startsWith(`${sessionShellRoot}${path.sep}`);
}

function scannedModules(graph: Graph): Module[] {
  return [...graph.modules.values()].filter(
    (unit) => isSessionShellModule(unit.file) || callsImportedRedirectingFunction(graph, unit),
  );
}

// ---------------------------------------------------------------------------
// Catch sınırları
// ---------------------------------------------------------------------------

type Boundary = {
  kind: "catch" | ".catch";
  line: number;
  /** Sınırı saran üst düzey bildirim; istisna listesi buna bakar. */
  enclosing: string | null;
  safe: boolean;
  /** try gövdesinin (ya da promise ifadesinin) değer olarak geçirdiği adlar. */
  guarded: Set<string>;
};

function enclosingDeclaration(node: ts.Node): string | null {
  let current: ts.Node | undefined = node;
  while (current && !ts.isSourceFile(current.parent)) current = current.parent;
  if (!current) return null;
  if (ts.isFunctionDeclaration(current) && current.name) return current.name.text;
  if (ts.isVariableStatement(current)) {
    const first = current.declarationList.declarations[0];
    return first && ts.isIdentifier(first.name) ? first.name.text : null;
  }
  return null;
}

function importsControlFlowRethrow(source: ts.SourceFile): boolean {
  return source.statements.some(
    (statement) =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === navigationModule &&
      statement.importClause?.namedBindings !== undefined &&
      ts.isNamedImports(statement.importClause.namedBindings) &&
      statement.importClause.namedBindings.elements.some(
        (element) => element.name.text === "unstable_rethrow",
      ),
  );
}

/** `unstable_rethrow(<caught>)` gövdenin ilk deyimi mi? */
function rethrowsFirst(body: ts.Block, caught: ts.BindingName | undefined): boolean {
  const first = body.statements[0];
  const expression = first && ts.isExpressionStatement(first) ? first.expression : undefined;
  const call = expression && ts.isCallExpression(expression) ? expression : undefined;
  const argument = call?.arguments[0];
  return (
    caught !== undefined &&
    ts.isIdentifier(caught) &&
    call !== undefined &&
    ts.isIdentifier(call.expression) &&
    call.expression.text === "unstable_rethrow" &&
    argument !== undefined &&
    ts.isIdentifier(argument) &&
    argument.text === caught.text
  );
}

function functionLikeRethrowsFirst(handler: ts.SignatureDeclaration & { body?: ts.Node }): boolean {
  const body = handler.body;
  if (!body || !ts.isBlock(body)) return false;
  return rethrowsFirst(body, handler.parameters[0]?.name);
}

/** `.catch(handler)` içindeki `handler` bir ada çözülüyorsa aynı dosyadaki bildirimi. */
function namedHandler(source: ts.SourceFile, name: string): ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression | undefined {
  for (const statement of source.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name?.text === name) return statement;
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (
          ts.isIdentifier(declaration.name) &&
          declaration.name.text === name &&
          declaration.initializer &&
          (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer))
        ) {
          return declaration.initializer;
        }
      }
    }
  }
  return undefined;
}

function rejectionHandlerIsSafe(source: ts.SourceFile, handler: ts.Expression): boolean {
  if (ts.isArrowFunction(handler) || ts.isFunctionExpression(handler)) {
    return functionLikeRethrowsFirst(handler);
  }
  if (ts.isIdentifier(handler)) {
    const declared = namedHandler(source, handler.text);
    return declared !== undefined && functionLikeRethrowsFirst(declared);
  }
  return false;
}

/** Bir promise zincirindeki ret sınırı: `.catch(h)` ya da `.then(ok, h)`. */
function rejectionHandlerOf(call: ts.CallExpression): ts.Expression | undefined {
  if (!ts.isPropertyAccessExpression(call.expression)) return undefined;
  const method = call.expression.name.text;
  if (method === "catch") return call.arguments[0];
  if (method === "then") return call.arguments[1];
  return undefined;
}

function boundariesOf(source: ts.SourceFile): Boundary[] {
  const boundaries: Boundary[] = [];
  const imported = importsControlFlowRethrow(source);
  const line = (node: ts.Node) => source.getLineAndCharacterOfPosition(node.getStart()).line + 1;

  function visit(node: ts.Node): void {
    if (ts.isCatchClause(node)) {
      boundaries.push({
        kind: "catch",
        line: line(node),
        enclosing: enclosingDeclaration(node),
        safe: imported && rethrowsFirst(node.block, node.variableDeclaration?.name),
        guarded: referencedIdentifiers(node.parent.tryBlock),
      });
    } else if (ts.isCallExpression(node)) {
      const handler = rejectionHandlerOf(node);
      if (handler !== undefined && ts.isPropertyAccessExpression(node.expression)) {
        boundaries.push({
          kind: ".catch",
          line: line(node),
          enclosing: enclosingDeclaration(node),
          safe: imported && rejectionHandlerIsSafe(source, handler),
          guarded: referencedIdentifiers(node.expression.expression),
        });
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  return boundaries;
}

function isReviewed(file: string, boundary: Boundary): boolean {
  return reviewedBoundaries.some(
    (entry) => absolute(entry.file) === file && entry.fn === boundary.enclosing,
  );
}

/** `next/navigation` kesmelerinin bu modüldeki yerel adları. */
function interruptNames(graph: Graph, unit: Module): Set<string> {
  const names = redirectingNames(graph, unit);
  for (const [local, api] of unit.navigationBindings) if (interruptApis.has(api)) names.add(local);
  return names;
}

type Finding = { file: string; boundary: Boundary };

/**
 * Kuralı ihlal eden sınırlar.
 *
 * İki kapsam: taranan modüllerde **her** sınır; diğer modüllerde yalnız try
 * gövdesi (ya da promise ifadesi) bir Next kesmesine ya da yönlendirebilen
 * bir fonksiyona doğrudan dokunan sınır — `redirect()` bir gün `try` içine
 * taşınırsa o dosya oturum modülü olmasa da yakalanır.
 */
function unsafeBoundaries(graph: Graph): Finding[] {
  const scanned = new Set(scannedModules(graph).map((unit) => unit.file));
  const findings: Finding[] = [];

  for (const unit of graph.modules.values()) {
    const interrupts = interruptNames(graph, unit);
    for (const boundary of boundariesOf(unit.source)) {
      if (boundary.safe || isReviewed(unit.file, boundary)) continue;
      const touchesInterrupt = [...boundary.guarded].some((name) => interrupts.has(name));
      if (scanned.has(unit.file) || touchesInterrupt) findings.push({ file: unit.file, boundary });
    }
  }

  return findings;
}

function describeFindings(findings: Finding[]): string[] {
  return findings
    .map(({ file, boundary }) => `${relative(file)}:${boundary.line} (${boundary.kind})`)
    .sort();
}

/** Kaynaktan ilk `unstable_rethrow(error);` satırı silinmiş hâli. */
function withoutFirstRethrow(file: string): string {
  const original = readFileSync(file, "utf8");
  const stripped = original.replace(/^[ \t]*unstable_rethrow\(error\);\n/m, "");
  expect(stripped).not.toBe(original);
  return stripped;
}

/** Aynı grafik, tek bir dosyanın kaynağı değiştirilmiş olarak. */
function graphWith(file: string, contents: string): Graph {
  const modules = serverModules();
  modules.set(file, analyzeModule(file, parsed(file, contents)));
  return buildGraph(modules);
}

// ---------------------------------------------------------------------------
// Testler
// ---------------------------------------------------------------------------

const graph = buildGraph();

describe("oturumlu catch sınırları Next kontrol akışını yeniden fırlatır", () => {
  it("taranan her modüldeki her catch ve .catch sınırı önce unstable_rethrow çağırır", () => {
    expect(describeFindings(unsafeBoundaries(graph))).toEqual([]);
  });

  /*
   * Boş tarama yeşil görünür: yürüyüş hiçbir dosya bulmazsa yukarıdaki iddia
   * hiçbir şey ölçmeden geçer (bu depoda bilinen tuzak: birden çok yol
   * verilen vitest "No test files found" ile yeşil çıkıyor). Tabanlar bu
   * yazıldığında ölçülen sayılar; bir düşüş bilinçli bir düzenleme olmalı,
   * sessiz bir daralma değil.
   */
  it("en az 123 modül, 38 page.tsx, 85 catch ve 17 .catch sınırı tarar", () => {
    const scanned = scannedModules(graph);
    const pages = scanned.filter((unit) => path.basename(unit.file) === "page.tsx");
    const boundaries = scanned.flatMap((unit) => boundariesOf(unit.source));

    expect(scanned.length).toBeGreaterThanOrEqual(123);
    expect(pages.length).toBeGreaterThanOrEqual(38);
    expect(boundaries.filter((boundary) => boundary.kind === "catch").length).toBeGreaterThanOrEqual(85);
    expect(boundaries.filter((boundary) => boundary.kind === ".catch").length).toBeGreaterThanOrEqual(17);
  });

  it.each([
    ["app/(account)/davet/[invitationId]/page.tsx", "enterShell"],
    ["app/(account)/payment/result/page.tsx", "redirect"],
    ["app/(uygulama)/panel/profil/page.tsx", "enterShell + apiRequest yükleyicileri"],
    ["app/api/users/me/identity-documents/route.ts", "loadViewer"],
    ["server/gallery/gallery.ts", "apiRequest"],
    ["server/jobs/submission.ts", "fetchJobCategories → apiRequest"],
    ["app/(account)/giris/actions.ts", "viewerShell → currentViewer → loadProfile"],
  ])("%s oturum modülü olarak taranır (%s)", (file) => {
    expect(scannedModules(graph).map((unit) => unit.file)).toContain(absolute(file));
  });

  it.each([
    ["app/(account)/hesap-dogrula/page.tsx", "oturumsuz doğrulama; action yalnız prop olarak geçiyor"],
    ["app/(marketing)/is-ilanlari/[jobId]/page.tsx", "herkese açık ilan; başvuru action'ı yalnız prop"],
    ["app/(account)/kayit/actions.ts", "oturumsuz kayıt"],
    ["server/seo/sitemap.ts", "publicReaderCaller"],
  ])("%s taranmaz (%s)", (file) => {
    expect(graph.modules.has(absolute(file))).toBe(true);
    expect(scannedModules(graph).map((unit) => unit.file)).not.toContain(absolute(file));
  });

  it("\"use client\" modülleri grafiğe hiç girmez", () => {
    expect(graph.modules.has(absolute("components/messaging/conversation-thread.tsx"))).toBe(false);
  });

  it("kapıları elle listelemez: kökler redirect'i içe aktaran modüllerden türer", () => {
    const roots = [...graph.modules.values()]
      .filter((unit) => [...unit.navigationBindings.values()].some((api) => redirectApis.has(api)))
      .map((unit) => relative(unit.file));

    expect(roots).toEqual(
      expect.arrayContaining([
        "server/session/guard.ts",
        "server/session/session.ts",
        "server/session/viewer.ts",
      ]),
    );
    expect(graph.redirecting.get(absolute("server/session/session.ts"))).toContain("apiRequest");
    expect(graph.redirecting.get(absolute("server/session/viewer.ts"))).toContain("enterShell");
    expect(graph.redirecting.get(absolute("server/session/gates.ts"))).toContain("currentGates");
    expect(graph.redirecting.get(absolute("server/gallery/gallery.ts"))).toContain("listJobImages");
  });
});

describe("istisna listesi bayatlayamaz", () => {
  it.each(reviewedBoundaries.map((entry) => [`${entry.file}#${entry.fn}`, entry]))(
    "%s hâlâ taranan bir modülde, hâlâ yeniden fırlatmayan bir sınırı sarıyor",
    (_name, entry) => {
      const unit = graph.modules.get(absolute(entry.file));
      expect(unit, "dosya artık yok ya da istemci modülü").toBeDefined();
      expect(scannedModules(graph)).toContain(unit);

      const boundaries = boundariesOf(unit!.source).filter(
        (boundary) => boundary.enclosing === entry.fn && !boundary.safe,
      );
      expect(boundaries, "fonksiyon artık yok ya da zaten yeniden fırlatıyor").not.toHaveLength(0);
      expect(entry.reason.length).toBeGreaterThan(0);
    },
  );
});

describe("tarayıcı sözleşmesi", () => {
  function synthetic(contents: string): Boundary[] {
    return boundariesOf(
      parsed("synthetic.ts", `import { unstable_rethrow } from "next/navigation";\n${contents}`),
    );
  }

  it.each([
    ["yan etki rethrow'dan önce", "try { await op(); } catch (error) { audit(error); unstable_rethrow(error); }"],
    ["erken dönüş rethrow'dan önce", "try { await op(); } catch (error) { return failure(error); unstable_rethrow(error); }"],
    ["değişkensiz catch", "try { await op(); } catch { return null; }"],
    ["ifade gövdeli .catch", "const v = op().catch(() => null);"],
    [".catch içinde rethrow ilk değil", "const v = op().catch((error: unknown) => { audit(error); unstable_rethrow(error); });"],
    ["adı çözülemeyen .catch handler'ı", "const v = op().catch(handler);"],
    [".then'in ret kolu", "const v = op().then(ok, (error: unknown) => { return null; });"],
  ])("%s güvensiz sayılır", (_name, contents) => {
    const boundaries = synthetic(contents);
    expect(boundaries).toHaveLength(1);
    expect(boundaries[0].safe).toBe(false);
  });

  it.each([
    ["catch", "try { await op(); } catch (error) { unstable_rethrow(error); return null; }"],
    [".catch", "const v = op().catch((error: unknown) => { unstable_rethrow(error); return null; });"],
    ["adı çözülen .catch handler'ı", "function ignore(error: unknown) { unstable_rethrow(error); return null; }\nconst v = op().catch(ignore);"],
    [".then'in ret kolu", "const v = op().then(ok, (error: unknown) => { unstable_rethrow(error); return null; });"],
  ])("%s ilk iş yeniden fırlatıyorsa güvenli sayılır", (_name, contents) => {
    const boundaries = synthetic(contents);
    expect(boundaries).toHaveLength(1);
    expect(boundaries[0].safe).toBe(true);
  });

  it("unstable_rethrow içe aktarılmamışsa aynı adlı yerel çağrı güvenli sayılmaz", () => {
    const boundaries = boundariesOf(
      parsed("local.ts", "try { await op(); } catch (error) { unstable_rethrow(error); }"),
    );
    expect(boundaries[0].safe).toBe(false);
  });

  it("try gövdesi redirect'e doğrudan dokunuyorsa oturum modülü olmasa da yakalar", () => {
    // Kayıt action'ı oturumsuz ve taranmıyor; try gövdesine bir `redirect()`
    // konduğunda catch'i yine yakalanmalı.
    const file = absolute("app/(account)/kayit/actions.ts");
    const original = readFileSync(file, "utf8");
    const moved = original
      .replace('"use server";\n', '"use server";\n\nimport { redirect } from "next/navigation";\n')
      .replace(/\n  \} catch \(error\) \{\n    return failureState\(error\);\n  \}\n/, "\n    redirect(\"/\");\n  } catch (error) {\n    return failureState(error);\n  }\n");
    expect(moved).not.toBe(original);
    const catchLine = moved.slice(0, moved.indexOf("} catch (error)")).split("\n").length;

    expect(describeFindings(unsafeBoundaries(graphWith(file, moved)))).toEqual([
      `app/(account)/kayit/actions.ts:${catchLine} (catch)`,
    ]);
  });
});

/**
 * Gerçek dosyalar üzerinde mutasyon: tek bir `unstable_rethrow(error);`
 * silindiğinde ana iddia o satırı bildirmek zorunda. Sayfa, `.catch` zinciri,
 * `(uygulama)` dışındaki iki oturumlu sayfa, yüksek dereceli yardımcı ve
 * paylaşılan yükleyiciler ayrı ayrı kanıtlanıyor.
 */
describe("mutasyon kanıtı", () => {
  it.each([
    ["app/(uygulama)/panel/profil/page.tsx", "catch"],
    ["app/(account)/davet/[invitationId]/page.tsx", "catch"],
    ["app/(uygulama)/panel/islerim/page.tsx", ".catch"],
    ["app/(account)/payment/result/page.tsx", ".catch"],
    ["app/(uygulama)/panel/profil/action-support.ts", "catch"],
    ["server/gallery/gallery.ts", "catch"],
    ["server/jobs/submission.ts", "catch"],
  ])("%s içinden rethrow silinirse %s sınırı bildirilir", (file, kind) => {
    const target = absolute(file);
    const findings = unsafeBoundaries(graphWith(target, withoutFirstRethrow(target)));

    expect(findings.map((finding) => finding.file)).toContain(target);
    expect(findings.find((finding) => finding.file === target)?.boundary.kind).toBe(kind);
  });
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
