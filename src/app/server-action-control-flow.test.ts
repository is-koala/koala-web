import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

const appRoot = path.resolve(import.meta.dirname);
const profileActionSupport = path.join(
  appRoot,
  "(uygulama)",
  "panel",
  "profil",
  "action-support.ts",
);

function actionFiles(directory = appRoot): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return actionFiles(full);
    return entry.name.endsWith("actions.ts") ? [full] : [];
  });
}

function parsed(file: string, contents = readFileSync(file, "utf8")): ts.SourceFile {
  return ts.createSourceFile(
    file,
    contents,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
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

describe("korumalı Server Action kontrol akışı", () => {
  it("her catch sınırında Next redirect/notFound hatasını ilk iş olarak yeniden fırlatır", () => {
    const unsafe = protectedActionFiles().flatMap(({ file, source }) =>
      catchesWithoutControlFlowRethrow(source).map(
        (line) => `${path.relative(appRoot, file)}:${line}`,
      ),
    );

    expect(unsafe).toEqual([]);
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

    const withoutRethrow = readFileSync(profileActionSupport, "utf8").replace(
      "    unstable_rethrow(error);\n",
      "",
    );
    expect(withoutRethrow).not.toBe(readFileSync(profileActionSupport, "utf8"));
    expect(catchesWithoutControlFlowRethrow(parsed(profileActionSupport, withoutRethrow))).toHaveLength(
      1,
    );
  });
});
