import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { compileSync } from "@mdx-js/mdx";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const sourceRoot = path.resolve(import.meta.dirname);
const projectRoot = path.resolve(sourceRoot, "..");
const dockerfile = path.join(projectRoot, "Dockerfile");
const nextRootEntry = /^(?:instrumentation(?:-client)?|sentry\.(?:server|edge)\.config|next\.config|mdx-components|middleware|proxy)\.tsx?$/;

function parsedSource(file: string, contents: string): ts.SourceFile {
  const mdx = file.endsWith(".mdx");
  const compiled = mdx ? String(compileSync(contents, { jsx: true })) : contents;
  return ts.createSourceFile(
    mdx ? `${file}.tsx` : file,
    compiled,
    ts.ScriptTarget.Latest,
    true,
    /\.(?:tsx|mdx)$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function unsupportedPublicReads(file: string, contents: string): string[] {
  const source = parsedSource(file, contents);
  const unsafe: string[] = [];

  function report(name: string) {
    unsafe.push(`${path.relative(projectRoot, file)}: ${name}`);
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
    if (isProcessEnv(node)) {
      const access = node.parent;
      const directStatic =
        ts.isPropertyAccessExpression(access) && access.expression === node;
      const helperDefault =
        ts.isElementAccessExpression(access) &&
        access.expression === node &&
        allowedHelperDefault(access);
      if (!directStatic && !helperDefault) {
        report("non-static process.env access");
      }
    }
    ts.forEachChild(node, visit);
  }

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

function publicNames(
  file: string,
  contents = readFileSync(file, "utf8"),
): string[] {
  const source = parsedSource(file, contents);
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
  const source = parsedSource(file, readFileSync(file, "utf8"));
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
    [
      "env aliasında bracket erişimi",
      'const env = process.env; void env["NEXT_PUBLIC_ALIAS_BRACKET"];',
    ],
    ["destructuring", "const { NEXT_PUBLIC_PICKED } = process.env;"],
    [
      "yeniden adlandırılmış destructuring",
      "const { NEXT_PUBLIC_RENAMED: value } = process.env;",
    ],
    ["bracket erişimi", 'void process.env["NEXT_PUBLIC_BRACKET"];'],
    [
      "değişken anahtarlı erişim",
      'const key = "NEXT_PUBLIC_DYNAMIC" as const; void process.env[key];',
    ],
    [
      "template anahtarlı erişim",
      'void process.env[`${"NEXT_PUBLIC_TEMPLATE"}`];',
    ],
    [
      "parametre varsayılanında env aliası",
      "function read(env = process.env) { return env.NEXT_PUBLIC_PARAMETER; }",
    ],
    [
      "sonradan env aliası atama",
      "let env; env = process.env; void env.NEXT_PUBLIC_ASSIGNED;",
    ],
    [
      "destructuring assignment",
      "let NEXT_PUBLIC_ASSIGNED; ({ NEXT_PUBLIC_ASSIGNED } = process.env);",
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

  it("MDX JSX ifadelerindeki public erişimleri derlenmiş modülden okuyor", () => {
    const source =
      '# Başlık\n\n<Widget value={process.env.NEXT_PUBLIC_MDX_COMPONENT} />';

    expect(publicNames("fixture.mdx", source)).toContain(
      "NEXT_PUBLIC_MDX_COMPONENT",
    );
  });

  it("MDX JSX ifadelerindeki computed process.env erişimini reddediyor", () => {
    const source =
      '# Başlık\n\n<Widget value={process.env[`NEXT_PUBLIC_MDX_DYNAMIC`]} />';

    expect(unsupportedPublicReads("fixture.mdx", source)).not.toEqual([]);
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
      shippedSourceFiles().flatMap((file) => publicNames(file)),
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
