import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createServer, type Server } from "node:http";

import { expect, test } from "@playwright/test";

const viewerId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
const conversationId = "33333333-3333-4333-8333-333333333333";
const messageId = "44444444-4444-4444-8444-444444444444";
const firstPageConversationId = "88888888-8888-4888-8888-888888888888";
const firstPageUserId = "99999999-9999-4999-8999-999999999999";
const groupConversationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const groupJobId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const groupWorkerId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const groupLeftWorkerId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

let backend: Server;
let web: ChildProcessWithoutNullStreams;
let backendOrigin = "";
let webOrigin = "";
let blocked = false;
const reports: unknown[] = [];

test.beforeAll(async () => {
  // Pi'de soğuk Turbopack 30 sn kancasını aşıyor; süreç ayrı olsa da
  // derleme paylaşılan süitten sonra disk önbelleği soğuk kalabiliyor.
  test.setTimeout(180_000);
  backend = createBackend();
  const backendPort = await listen(backend);
  backendOrigin = `http://127.0.0.1:${backendPort}`;

  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    API_URL: backendOrigin,
    APP_VERSION: "1.4.0",
    NEXT_ISOLATED_TEST_BUILD: "messaging-safety",
    NEXT_PUBLIC_APP_URL_SCHEME: "koala",
    NEXT_PUBLIC_SITE_URL: "https://iskoala.com",
  };
  delete environment.PORT;
  web = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1"],
    {
      cwd: process.cwd(),
      env: environment,
    },
  );
  webOrigin = await waitForWeb(web);
});

test.afterAll(async () => {
  await stop(web);
  await new Promise<void>((resolve) => backend?.close(() => resolve()));
});

test.describe.configure({ timeout: 120_000 });

test("çalışan ve işveren konuşmalarında engelleme, engel kaldırma ve şikâyet çalışır", async ({
  browser,
}) => {
  for (const basePath of ["/panel/mesajlar", "/isveren/mesajlar"]) {
    blocked = false;
    reports.length = 0;
    const context = await browser.newContext();
    await context.addCookies([
      { name: "koala_at", value: "access-placeholder", url: webOrigin },
      { name: "koala_rt", value: "refresh-placeholder", url: webOrigin },
      { name: "koala_did", value: "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e", url: webOrigin },
    ]);
    const page = await context.newPage();
    const browserBackendRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().startsWith(backendOrigin)) browserBackendRequests.push(request.url());
    });

    await page.goto(`${webOrigin}${basePath}`);
    // Şerit hidrate olana kadar beklenmeli: `isVisible()` anında false döner
    // ve sonraki tıklamayı `Çerez tercihleri` keser.
    await page.getByRole("button", { name: "Yalnız zorunlu" }).click();
    await expect(page.getByRole("region", { name: "Çerez tercihleri" })).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1, name: "Konuşmaların" })).toBeVisible();
    await page.getByRole("button", { name: "Daha fazla konuşma" }).click();
    // Grup satırının alt metni de "Ece Yılmaz" içeriyor; ikili satır adıyla başlar.
    const laterPageConversation = page.getByRole("link", { name: /^Ece Yılmaz/ });
    await expect(laterPageConversation).toHaveAttribute(
      "href",
      `${basePath}/${conversationId}?conversationPage=1`,
    );
    await laterPageConversation.click();
    await expect(page.getByRole("heading", { level: 1, name: "Ece Yılmaz" })).toBeVisible();

    await page.getByRole("textbox", { name: "Mesaj" }).fill("Sonraki sayfadan merhaba");
    await page.getByRole("button", { name: "Gönder" }).click();
    await expect(page.getByText("Sonraki sayfadan merhaba")).toBeVisible();

    const blockTrigger = page.getByRole("button", { name: "Kullanıcıyı engelle" });
    await blockTrigger.click();
    const blockDialog = page.getByRole("dialog", { name: "Kullanıcıyı engelle" });
    await expect(blockDialog).toContainText("iki taraf da mesaj gönderemeyecek");
    await expect(blockDialog.getByRole("button", { name: "Vazgeç" })).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(blockDialog.getByRole("button", { name: "Engellemeyi onayla" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(blockDialog).toBeHidden();
    await expect(blockTrigger).toBeFocused();
    await blockTrigger.click();
    await blockDialog.getByRole("button", { name: "Engellemeyi onayla" }).click();
    await expect(page.getByRole("textbox", { name: "Mesaj" })).toBeDisabled();

    await page.getByRole("button", { name: "Engeli kaldır" }).click();
    const unblockDialog = page.getByRole("dialog", { name: "Engeli kaldır" });
    await unblockDialog.getByRole("button", { name: "Engeli kaldırmayı onayla" }).click();
    await expect(page.getByRole("textbox", { name: "Mesaj" })).toBeEnabled();

    await page.getByRole("button", { name: /^Mesajı şikâyet et:/ }).click();
    const reportDialog = page.getByRole("dialog", { name: "Mesajı şikâyet et" });
    await reportDialog.getByLabel("Gerekçe").selectOption("INAPPROPRIATE_CONTENT");
    await reportDialog.getByLabel("Açıklama (isteğe bağlı)").fill("Uygunsuz içerik");
    await reportDialog.getByRole("button", { name: "Şikâyeti gönder" }).click();

    await expect(page.getByRole("status").filter({ hasText: "Şikâyetin alındı" })).toBeVisible();
    expect(reports).toEqual([{
      messageId,
      reason: "INAPPROPRIATE_CONTENT",
      description: "Uygunsuz içerik",
    }]);
    expect(browserBackendRequests).toEqual([]);
    await context.close();
  }
});

test("grup sohbeti gönderen adını, görenleri ve katılımcılar panelini gösterir", async ({ browser }) => {
  // Sahte backend #281 sözleşmesini konuşuyor: `senderName`, katılımcı rolü,
  // `joinedAt`, `lastReadAt`, `left`. Ayrılan çalışan listede kalıyor ki eski
  // mesajı adıyla çözülsün; "görüldü" `lastReadAt >= sentAt` ile hesaplanıyor.
  const context = await browser.newContext();
  await context.addCookies([
    { name: "koala_at", value: "access-placeholder", url: webOrigin },
    { name: "koala_rt", value: "refresh-placeholder", url: webOrigin },
    { name: "koala_did", value: "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e", url: webOrigin },
  ]);
  const page = await context.newPage();
  const browserBackendRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().startsWith(backendOrigin)) browserBackendRequests.push(request.url());
  });

  await page.goto(`${webOrigin}/panel/mesajlar`);
  await page.getByRole("button", { name: "Yalnız zorunlu" }).click();
  await expect(page.getByRole("region", { name: "Çerez tercihleri" })).toHaveCount(0);
  const groupRow = page.getByRole("link", { name: /Depo sayımı/ });
  await expect(groupRow).toContainText("Grup sohbeti · 3 katılımcı: Bora Kaya, Ece Yılmaz");
  await groupRow.click();

  const title = page.getByRole("heading", { level: 1 }).getByRole("button", { name: "Depo sayımı" });
  await expect(title).toBeVisible();

  const fromEce = page.locator("article", { hasText: "Raflar sayıldı" });
  await expect(fromEce.locator(".message-sender")).toHaveText("Ece Yılmaz");
  const fromLeft = page.locator("article", { hasText: "Ben ayrılıyorum" });
  await expect(fromLeft.locator(".message-sender")).toContainText("Zeynep Demir");
  await expect(fromLeft.locator(".message-sender")).toContainText("Ayrıldı");
  const mine = page.locator("article", { hasText: "Yarın 09:00'da başlıyoruz" });
  await expect(mine.locator(".message-sender")).toHaveCount(0);
  await mine.getByText("1 kişi gördü").click();
  await expect(mine.getByRole("listitem")).toHaveText(/Ece Yılmaz/);

  await title.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Katılımcılar" });
  await expect(dialog).toBeVisible();
  const rows = dialog.getByRole("list", { name: "Katılımcılar" }).getByRole("listitem");
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(0)).toContainText("Deniz Ak");
  await expect(rows.nth(0)).toContainText("İşveren");
  await expect(rows.nth(0).getByRole("link", { name: "Profilim" })).toHaveAttribute("href", "/panel/profil");
  await expect(rows.nth(1)).toContainText("Bora Kaya");
  await expect(rows.nth(1)).toContainText("Şirket yetkilisi");
  await expect(rows.nth(2)).toContainText("Ece Yılmaz");
  await expect(rows.nth(2)).toContainText("Çalışan");
  await expect(rows.nth(2)).toContainText("Katıldı: 2 Eylül 2026");
  await expect(rows.nth(3)).toContainText("Zeynep Demir");
  await expect(rows.nth(3)).toContainText("Ayrıldı");
  await expect(rows.nth(3)).toHaveClass(/participant-row-left/);
  await expect(dialog.getByRole("link", { name: "Profilim" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(title).toBeFocused();

  expect(browserBackendRequests).toEqual([]);
  await context.close();
});

function createBackend() {
  return createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://backend.test");
    const send = (data: unknown, status = 200) => {
      response.writeHead(status, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ success: true, data, httpStatus: status, message: "" }));
    };

    if (request.method === "GET" && url.pathname === "/users/me") {
      send({
        id: viewerId,
        firstName: "Deniz",
        lastName: "Ak",
        email: "deniz@example.test",
        isEmployer: true,
        companies: [],
      });
      return;
    }
    if (request.method === "GET" && url.pathname === "/conversations") {
      const requestedPage = Number(url.searchParams.get("page") ?? 0);
      const requestedSize = Number(url.searchParams.get("size") ?? 0);
      if (requestedSize !== 100) {
        response.writeHead(400, { "Content-Type": "application/json" });
        response.end(JSON.stringify({
          success: false,
          errorCode: "INVALID_PAGE_SIZE",
          errorCategory: "VALIDATION",
          message: "conversation page size must stay aligned",
          httpStatus: 400,
        }));
        return;
      }
      const isFirstPage = requestedPage === 0;
      send({
        content: requestedPage > 1 ? [] : [
          {
            id: isFirstPage ? firstPageConversationId : conversationId,
            kind: "DIRECT",
            participants: [
              { id: viewerId, firstName: "Deniz", lastName: "Ak" },
              isFirstPage
                ? { id: firstPageUserId, firstName: "Bora", lastName: "Kaya" }
                : { id: otherId, firstName: "Ece", lastName: "Yılmaz" },
            ],
            lastMessageAt: "2026-09-07T12:00:00Z",
            lastMessageBody: isFirstPage ? "İlk sayfa konuşması" : "Uygunsuz içerik",
            unreadCount: isFirstPage ? 0 : 1,
            closed: false,
          },
          ...(isFirstPage ? [groupConversation()] : []),
        ],
        page: requestedPage,
        totalPages: 2,
        totalElements: 3,
        last: requestedPage >= 1,
      });
      return;
    }
    if (request.method === "GET" && url.pathname === `/conversations/${groupConversationId}/messages`) {
      send({
        content: [...groupMessages()].reverse(),
        page: 0,
        totalPages: 1,
        totalElements: 3,
        last: true,
      });
      return;
    }
    if (request.method === "POST" && url.pathname === `/conversations/${groupConversationId}/read`) {
      send(null);
      return;
    }
    if (request.method === "GET" && url.pathname === `/conversations/${conversationId}/messages`) {
      send({
        content: [{
          id: messageId,
          senderId: otherId,
          body: "Uygunsuz içerik",
          sentAt: "2026-09-07T12:00:00Z",
          readAt: null,
        }],
        page: 0,
        totalPages: 1,
        totalElements: 1,
        last: true,
      });
      return;
    }
    if (request.method === "POST" && url.pathname === `/conversations/${conversationId}/messages`) {
      const body = await requestBody(request);
      send({
        id: "77777777-7777-4777-8777-777777777777",
        senderId: viewerId,
        body: body.body,
        sentAt: "2026-09-09T13:00:00Z",
        readAt: null,
      }, 201);
      return;
    }
    if (request.method === "POST" && url.pathname === "/presence/lookup") {
      send([]);
      return;
    }
    if (request.method === "GET" && url.pathname === `/users/${otherId}/presence`) {
      send({ userId: otherId, online: true });
      return;
    }
    if (request.method === "GET" && url.pathname === `/users/${firstPageUserId}/presence`) {
      send({ userId: firstPageUserId, online: false });
      return;
    }
    if (request.method === "GET" && url.pathname === "/users/me/blocks") {
      send(blocked ? [{ id: "55555555-5555-4555-8555-555555555555", blocked: { id: otherId } }] : []);
      return;
    }
    if (url.pathname === `/users/me/blocks/${otherId}` && request.method === "POST") {
      blocked = true;
      send(null);
      return;
    }
    if (url.pathname === `/users/me/blocks/${otherId}` && request.method === "DELETE") {
      blocked = false;
      send(null);
      return;
    }
    if (request.method === "POST" && url.pathname === `/conversations/${conversationId}/read`) {
      send(null);
      return;
    }
    if (request.method === "POST" && url.pathname === "/users/me/realtime-credential") {
      send({ token: "realtime-test-token", expiresAt: "2099-01-01T00:00:00Z" });
      return;
    }
    if (request.method === "POST" && url.pathname === "/reports") {
      reports.push(await requestBody(request));
      send({ id: "66666666-6666-4666-8666-666666666666", status: "OPEN" }, 201);
      return;
    }

    response.writeHead(404, { "Content-Type": "application/json" });
    response.end(JSON.stringify({
      success: false,
      errorCode: "NOT_FOUND",
      errorCategory: "RESOURCE_NOT_FOUND",
      message: "not found",
      httpStatus: 404,
    }));
  });
}

/**
 * İlanın ekip sohbeti, is-koala/koala-backend#281 sözleşmesiyle. Bora şirket
 * yetkilisi; Zeynep ayrılmış ama eski mesajı adıyla çözülsün diye listede.
 */
function groupConversation() {
  return {
    id: groupConversationId,
    jobId: groupJobId,
    jobTitle: "Depo sayımı",
    kind: "GROUP",
    participants: [
      {
        id: viewerId, firstName: "Deniz", lastName: "Ak", profilePictureUrl: null,
        role: "EMPLOYER", joinedAt: "2026-09-01T09:00:00Z", lastReadAt: "2026-09-08T09:00:00Z", left: false,
      },
      {
        id: firstPageUserId, firstName: "Bora", lastName: "Kaya", profilePictureUrl: null,
        role: "COMPANY_CONTACT", joinedAt: "2026-09-01T09:00:00Z", lastReadAt: "2026-09-07T08:00:00Z", left: false,
      },
      {
        id: groupWorkerId, firstName: "Ece", lastName: "Yılmaz", profilePictureUrl: null,
        role: "WORKER", joinedAt: "2026-09-02T09:00:00Z", lastReadAt: "2026-09-07T12:30:00Z", left: false,
      },
      {
        id: groupLeftWorkerId, firstName: "Zeynep", lastName: "Demir", profilePictureUrl: null,
        role: "WORKER", joinedAt: "2026-09-02T09:00:00Z", lastReadAt: "2026-09-07T10:30:00Z", left: true,
      },
    ],
    lastMessageAt: "2026-09-07T12:10:00Z",
    lastMessageBody: "Raflar sayıldı",
    unreadCount: 0,
    closed: false,
  };
}

function groupMessages() {
  return [
    {
      id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", senderId: groupLeftWorkerId, senderName: "Zeynep Demir",
      senderProfilePictureUrl: null, body: "Ben ayrılıyorum", sentAt: "2026-09-07T10:00:00Z", readAt: null,
    },
    {
      id: "ffffffff-ffff-4fff-8fff-ffffffffffff", senderId: viewerId, senderName: "Deniz Ak",
      senderProfilePictureUrl: null, body: "Yarın 09:00'da başlıyoruz", sentAt: "2026-09-07T12:00:00Z", readAt: null,
    },
    {
      id: "12121212-1212-4121-8121-121212121212", senderId: groupWorkerId, senderName: "Ece Yılmaz",
      senderProfilePictureUrl: null, body: "Raflar sayıldı", sentAt: "2026-09-07T12:10:00Z", readAt: null,
    },
  ];
}

async function requestBody(request: AsyncIterable<Uint8Array>) {
  const chunks: Uint8Array[] = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function listen(server: Server) {
  await new Promise<void>((resolve, reject) => {
    const rejectOnce = (error: Error) => reject(error);
    server.once("error", rejectOnce);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", rejectOnce);
      resolve();
    });
  });
  const address = server.address();
  if (typeof address !== "object" || address === null) {
    throw new Error("Fake backend did not expose a TCP port");
  }
  return address.port;
}

async function waitForWeb(child: ChildProcessWithoutNullStreams) {
  let output = "";
  child.stdout.on("data", (chunk) => { output += String(chunk); });
  child.stderr.on("data", (chunk) => { output += String(chunk); });
  for (let attempt = 0; attempt < 360; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Next dev exited early:\n${output}`);
    const port = output.match(/http:\/\/(?:127\.0\.0\.1|localhost):(\d+)/)?.[1];
    if (port) {
      const origin = `http://127.0.0.1:${port}`;
      try {
        const response = await fetch(`${origin}/api/health`);
        if (response.status < 500) return origin;
      } catch {
        // Derleyici portu seçti ama henüz dinlemiyor.
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Next dev did not become ready:\n${output}`);
}

async function stop(child: ChildProcessWithoutNullStreams | undefined) {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise<void>((resolve) => child.once("exit", () => resolve())),
    new Promise<void>((resolve) => setTimeout(() => {
      child.kill("SIGKILL");
      resolve();
    }, 5_000)),
  ]);
}
