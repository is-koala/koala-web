import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

const sourceRoot = path.resolve(import.meta.dirname);
const projectRoot = path.resolve(sourceRoot, "..");
const dockerfile = path.join(projectRoot, "Dockerfile");
const nextRootEntry = /^(?:instrumentation(?:-client)?|sentry\.(?:server|edge)\.config|next\.config|mdx-components|middleware|proxy)\.tsx?$/;

function unsupportedPublicReads(file: string, contents: string): string[] {
  const source = ts.createSourceFile(
    file,
    contents,
    ts.ScriptTarget.Latest,
    true,
    /\.(?:tsx|mdx)$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const unsafe: string[] = [];
  const processEnvAliases = new Set<string>();

  function report(name: string) {
    unsafe.push(`${path.relative(projectRoot, file)}: ${name}`);
  }

  function collectAliases(node: ts.Node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      (isProcessEnv(node.initializer) ||
        (ts.isIdentifier(node.initializer) &&
          processEnvAliases.has(node.initializer.text)))
    ) {
      processEnvAliases.add(node.name.text);
    }
    ts.forEachChild(node, collectAliases);
  }

  function allowedHelperDefault(node: ts.ElementAccessExpression): boolean {
    if (path.relative(projectRoot, file) !== path.join("src", "lib", "env.ts")) {
      return false;
    }
    const parameter = node.parent;
    const fn = parameter.parent;
    return (
      ts.isParameter(parameter) &&
      parameter.initializer === node &&
      ts.isFunctionDeclaration(fn) &&
      fn.name?.text === "requiredEnvironmentValue" &&
      ts.isIdentifier(node.argumentExpression) &&
      ts.isIdentifier(fn.parameters[0]?.name) &&
      node.argumentExpression.text === fn.parameters[0].name.text
    );
  }

  function visit(node: ts.Node) {
    if (
      ts.isPropertyAccessExpression(node) &&
      /^NEXT_PUBLIC_[A-Z0-9_]+$/.test(node.name.text) &&
      ts.isIdentifier(node.expression) &&
      processEnvAliases.has(node.expression.text)
    ) {
      report(node.name.text);
    }
    if (
      ts.isElementAccessExpression(node) &&
      isProcessEnv(node.expression) &&
      !allowedHelperDefault(node)
    ) {
      report(
        ts.isStringLiteral(node.argumentExpression)
          ? node.argumentExpression.text
          : "computed process.env access",
      );
    }
    if (
      ts.isBindingElement(node) &&
      ts.isIdentifier(node.name) &&
      /^NEXT_PUBLIC_[A-Z0-9_]+$/.test(node.name.text) &&
      ts.isObjectBindingPattern(node.parent) &&
      ts.isVariableDeclaration(node.parent.parent) &&
      node.parent.parent.initializer &&
      isProcessEnv(node.parent.parent.initializer)
    ) {
      report(node.name.text);
    }
    ts.forEachChild(node, visit);
  }

  collectAliases(source);
  visit(source);
  return unsafe;
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    // Testler derlemeye girmez; yalnız gönderilen kaynak taranır.
    return /\.(?:tsx?|mdx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

function shippedSourceFiles(): string[] {
  const rootEntries = readdirSync(projectRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && nextRootEntry.test(entry.name))
    .map((entry) => path.join(projectRoot, entry.name));
  return [...sourceFiles(sourceRoot), ...rootEntries];
}

function publicNames(file: string): string[] {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const names: string[] = [];

  function visit(node: ts.Node) {
    if (
      ts.isPropertyAccessExpression(node) &&
      isProcessEnv(node.expression) &&
      /^NEXT_PUBLIC_[A-Z0-9_]+$/.test(node.name.text)
    ) {
      names.push(node.name.text);
    }
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "requiredEnvironmentValue" &&
      ts.isStringLiteral(node.arguments[0]) &&
      /^NEXT_PUBLIC_[A-Z0-9_]+$/.test(node.arguments[0].text)
    ) {
      names.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  return names;
}

function isProcessEnv(node: ts.Node): node is ts.PropertyAccessExpression {
  return (
    ts.isPropertyAccessExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === "process" &&
    node.name.text === "env"
  );
}

function unsafeRequiredPublicReads(file: string): string[] {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const unsafe: string[] = [];

  function visit(node: ts.Node) {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "requiredEnvironmentValue" &&
      ts.isStringLiteral(node.arguments[0]) &&
      /^NEXT_PUBLIC_[A-Z0-9_]+$/.test(node.arguments[0].text)
    ) {
      const name = node.arguments[0].text;
      const value = node.arguments[1];
      if (
        !value ||
        !ts.isPropertyAccessExpression(value) ||
        !isProcessEnv(value.expression) ||
        value.name.text !== name
      ) {
        unsafe.push(`${path.relative(projectRoot, file)}: ${name}`);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  return unsafe;
}

function builderBeforeBuild(dockerfileContents: string): string {
  const builder = dockerfileContents.match(
    /^FROM .* AS builder\s*$([\s\S]*?)^FROM /m,
  )?.[1];
  expect(builder, "Dockerfile builder aşaması eksik").toBeDefined();
  const build = builder!.indexOf("RUN npm run build");
  expect(build, "builder aşamasında npm run build eksik").toBeGreaterThanOrEqual(0);
  return builder!.slice(0, build);
}

function declaredArgs(builder: string): Set<string> {
  return new Set(
    [...builder.matchAll(/^ARG (NEXT_PUBLIC_[A-Z0-9_]+)\s*$/gm)].map(
      (match) => match[1],
    ),
  );
}

describe("public ortam değişkenleri derlemeye gömülüyor", () => {
  it.each([
    ["env aliası", "const env = process.env; void env.NEXT_PUBLIC_ALIAS;"],
    ["destructuring", "const { NEXT_PUBLIC_PICKED } = process.env;"],
    ["bracket erişimi", 'void process.env["NEXT_PUBLIC_BRACKET"];'],
    [
      "değişken anahtarlı erişim",
      'const key = "NEXT_PUBLIC_DYNAMIC" as const; void process.env[key];',
    ],
    [
      "template anahtarlı erişim",
      'void process.env[`${"NEXT_PUBLIC_TEMPLATE"}`];',
    ],
  ])("inline edilmeyen %s biçimini reddediyor", (_, source) => {
    expect(unsupportedPublicReads("fixture.ts", source)).not.toEqual([]);
  });

  it("type alanlarını ortam değişkeni erişimi saymıyor", () => {
    expect(
      unsupportedPublicReads(
        "fixture.ts",
        "interface PublicEnv { NEXT_PUBLIC_TYPED: string }",
      ),
    ).toEqual([]);
  });

  it("Next tarafından derlenen MDX modüllerini de tarıyor", () => {
    expect(shippedSourceFiles().some((file) => file.endsWith(".mdx"))).toBe(true);
  });

  it("gönderilen kaynakta inline edilmeyen public erişim bırakmıyor", () => {
    const unsafe = shippedSourceFiles().flatMap((file) =>
      unsupportedPublicReads(file, readFileSync(file, "utf8")),
    );

    expect(unsafe).toEqual([]);
  });

  it("zorunlu public değerleri Next'in inline edebildiği statik erişimle okuyor", () => {
    const unsafe = shippedSourceFiles().flatMap(unsafeRequiredPublicReads);

    expect(unsafe).toEqual([]);
  });

  it("kodda okunan her NEXT_PUBLIC_ değişkeni Dockerfile'da ARG olarak tanımlı", () => {
    // `NEXT_PUBLIC_` değişkenleri `next build` sırasında bundle'a gömülür,
    // çalışma anında okunmaz. Dockerfile'da ARG olarak tanımlanmayan bir
    // değişken derlemede boş kalır ve hata vermez: sayfa açılır, özellik
    // sessizce çalışmaz. Sentry'nin üç değişkeni tam olarak böyle kalmıştı.
    const used = new Set(
      shippedSourceFiles().flatMap(publicNames),
    );

    const declared = declaredArgs(
      builderBeforeBuild(readFileSync(dockerfile, "utf8")),
    );
    const missing = [...used].filter((name) => !declared.has(name)).sort();

    expect(missing).toEqual([]);
  });

  it("Dockerfile'da tanımlı her NEXT_PUBLIC_ değişkeni build aşamasında ENV'e de bağlanıyor", () => {
    // ARG tek başına yetmiyor: `npm run build` ancak ENV üzerinden görüyor.
    // ARG yazılıp ENV unutulursa değişken yine sessizce boş kalır.
    const builder = builderBeforeBuild(readFileSync(dockerfile, "utf8"));
    const args = declaredArgs(builder);
    const bindings = new Set(
      [...builder.matchAll(/^ENV (NEXT_PUBLIC_[A-Z0-9_]+)=\$\1\s*$/gm)].map(
        (match) => match[1],
      ),
    );

    const unbound = [...args].filter((name) => !bindings.has(name)).sort();

    expect(unbound).toEqual([]);
  });
});
