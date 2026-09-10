import { access, cp } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

const host = "127.0.0.1";
const webPort = process.env.LHCI_PORT ?? "3200";
const backendPort = process.env.LHCI_BACKEND_PORT ?? "4200";
const root = process.cwd();
const standaloneRoot = path.join(root, ".next", "standalone");
const serverPath = path.join(standaloneRoot, "server.js");
const children = [];
let stopping = false;

await access(serverPath);
await cp(path.join(root, ".next", "static"), path.join(standaloneRoot, ".next", "static"), {
  recursive: true,
});

try {
  await access(path.join(root, "public"));
  await cp(path.join(root, "public"), path.join(standaloneRoot, "public"), { recursive: true });
} catch {
  // `public` isteğe bağlı.
}

children.push(
  start(process.execPath, [path.join(root, "tests", "support", "e2e-backend.mjs"), backendPort], root, {}),
  start(process.execPath, [serverPath], standaloneRoot, {
    API_URL: `http://${host}:${backendPort}`,
    APP_VERSION: process.env.APP_VERSION ?? "0.1.0",
    HOSTNAME: host,
    PORT: webPort,
  }),
);

for (const child of children) {
  child.once("exit", (code, signal) => {
    if (stopping) return;
    console.error(`Lighthouse child exited before shutdown (${code ?? signal ?? "unknown"}).`);
    shutdown("SIGTERM");
    process.exitCode = code ?? 1;
  });
}

await Promise.all([
  waitUntilReady(`http://${host}:${backendPort}/__test__/health`),
  waitUntilReady(`http://${host}:${webPort}/`),
]);
console.log("Lighthouse servers ready");

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => shutdown(signal));
}

await new Promise(() => {});

function start(command, args, cwd, extraEnvironment) {
  return spawn(command, args, {
    cwd,
    env: { ...process.env, ...extraEnvironment },
    stdio: "inherit",
  });
}

async function waitUntilReady(url) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Çocuk süreç hâlâ ayağa kalkıyor.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    child.kill(signal);
  }
}
