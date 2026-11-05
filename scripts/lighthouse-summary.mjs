// `lhci autorun` sonrası her ölçümün puanını ve metriklerini tablo olarak
// basar (CI'da adım özetine de yazar). Kapı kararını vermez; yalnız görünürlük.
import { appendFile, readFile } from "node:fs/promises";
import path from "node:path";

const reportsDir = path.join(process.cwd(), ".lighthouseci", "reports");

let manifest;
try {
  manifest = JSON.parse(await readFile(path.join(reportsDir, "manifest.json"), "utf8"));
} catch {
  console.log("Lighthouse raporu yok; özet atlandı.");
  process.exit(0);
}

const ms = (value) => (value == null ? "-" : `${Math.round(value)}`);
const rows = [];

for (const entry of manifest) {
  const report = JSON.parse(await readFile(entry.jsonPath, "utf8"));
  const audit = (id) => report.audits[id]?.numericValue;
  const scriptBytes = report.audits["resource-summary"]?.details?.items?.find(
    (item) => item.resourceType === "script",
  )?.transferSize;
  rows.push(
    [
      new URL(entry.url).pathname,
      entry.isRepresentativeRun ? "evet" : "",
      report.categories.performance.score?.toFixed(2) ?? "-",
      ms(audit("first-contentful-paint")),
      ms(audit("largest-contentful-paint")),
      ms(audit("speed-index")),
      ms(audit("total-blocking-time")),
      audit("cumulative-layout-shift")?.toFixed(3) ?? "-",
      scriptBytes ?? "-",
      ms(report.environment?.benchmarkIndex),
    ].join(" | "),
  );
}

const table = [
  "| URL | Medyan | Puan | FCP | LCP | SI | TBT | CLS | Betik bayt | benchmarkIndex |",
  "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ...rows.map((row) => `| ${row} |`),
].join("\n");

console.log(table);
if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `### Lighthouse ölçümleri\n\n${table}\n`);
}
