import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { idleFormState } from "@/lib/form-state";
import {
  cookieStore,
  envelope,
  jsonResponse,
  requestHeaders,
} from "../../../../../tests/support/session-cookies";
import { redirectTo, throwingRedirect } from "../../../../../tests/support/navigation";

import { answerInvitationAction } from "./actions";

const redirect = vi.hoisted(() => vi.fn());
const revalidatePath = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", async () => ({
  redirect,
  unstable_rethrow: (await import("../../../../../tests/support/navigation"))
    .rethrowTestNavigationError,
}));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/headers", async () => {
  const support = await import("../../../../../tests/support/session-cookies");
  return {
    cookies: () => Promise.resolve(support.cookieStore),
    headers: () => Promise.resolve(support.requestHeaders),
  };
});

const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";
const invitationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const companyId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function answerForm(accepted: string): FormData {
  const formData = new FormData();
  formData.set("accepted", accepted);
  return formData;
}

describe("davet cevaplama Server Action'ı", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "https://api.example.test");
    vi.stubEnv("APP_VERSION", "1.4.0");
    requestHeaders.set("x-koala-path", `/davet/${invitationId}`);
    cookieStore.values.clear();
    cookieStore.values.set("koala_did", deviceId);
    cookieStore.values.set("koala_at", "access-placeholder");
    cookieStore.values.set("koala_rt", "refresh-placeholder");
    redirect.mockReset();
    redirect.mockImplementation(throwingRedirect());
    revalidatePath.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("kabulü açık gövdeyle gönderip kullanıcıyı şirket profiline bırakır", async () => {
    const fetchMock = successfulFetch();

    await expect(
      answerInvitationAction(invitationId, idleFormState, answerForm("true")),
    ).rejects.toThrow(redirectTo(`/isveren/sirket/${companyId}`));

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.example.test/contact-invitations/${invitationId}`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ accepted: true });
  });

  it("kabulden sonra kabuğun önbelleklediği profili tazeler", async () => {
    /*
     * Yeni üyelik `GET /users/me` yanıtındaki `companies[]` listesine giriyor.
     * Kabuk önbelleği tazelenmezse `/isveren/sirket` boş görünür — kullanıcı
     * kabul ettiği şirketi yokmuş gibi bulur.
     */
    successfulFetch();

    await expect(
      answerInvitationAction(invitationId, idleFormState, answerForm("true")),
    ).rejects.toThrow();

    expect(revalidatePath).toHaveBeenCalledWith("/isveren", "layout");
  });

  it("reddi aynı uca `false` ile gönderir ve sayfayı değiştirmez", async () => {
    // Ret ayrı bir uç değil, aynı gövdenin `false` hâli.
    const fetchMock = successfulFetch();

    await expect(
      answerInvitationAction(invitationId, idleFormState, answerForm("false")),
    ).resolves.toEqual({ status: "done" });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ accepted: false });
    expect(redirect).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("kararı taşımayan gönderimi backend'e hiç çıkarmaz", async () => {
    // `accepted` `@NotNull`; eksik değeri `false` saymak kullanıcının kabul
    // etmek isterken sessizce reddetmesine yol açardı ve karar geri alınamaz.
    const fetchMock = successfulFetch();

    const state = await answerInvitationAction(invitationId, idleFormState, new FormData());

    expect(state).toMatchObject({ status: "error", httpStatus: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("biçimi bozuk davet kimliğiyle backend'e hiç çıkmaz", async () => {
    const fetchMock = successfulFetch();

    const state = await answerInvitationAction("not-a-uuid", idleFormState, answerForm("true"));

    expect(state).toMatchObject({ status: "error", httpStatus: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("başkasına ait davetin 403'ünü kendi koduyla forma taşır", async () => {
    // Belge bu yanıtı 404 diye yazıyor ama uç 403 döndürüyor; dallanma
    // `errorCode` ile, duruma ya da belgeye göre değil.
    failingFetch(403, "USER_NOT_ASSOCIATED_WITH_INVITATION");

    await expect(
      answerInvitationAction(invitationId, idleFormState, answerForm("true")),
    ).resolves.toMatchObject({
      status: "error",
      errorCode: "USER_NOT_ASSOCIATED_WITH_INVITATION",
      httpStatus: 403,
    });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("ikinci cevaplamanın 409'unu kendi koduyla forma taşır", async () => {
    failingFetch(409, "INVITATION_ALREADY_ANSWERED");

    await expect(
      answerInvitationAction(invitationId, idleFormState, answerForm("false")),
    ).resolves.toMatchObject({
      status: "error",
      errorCode: "INVITATION_ALREADY_ANSWERED",
      httpStatus: 409,
    });
  });
});

function successfulFetch() {
  const fetchMock = vi.fn().mockImplementation(() =>
    Promise.resolve(
      jsonResponse(
        200,
        envelope({
          id: invitationId,
          company: { id: companyId, name: "Koala Temizlik" },
          status: "ACCEPTED",
        }),
      ),
    ),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function failingFetch(status: number, errorCode: string) {
  const fetchMock = vi.fn().mockImplementation(() =>
    Promise.resolve(jsonResponse(status, { success: false, errorCode, message: "ham metin" })),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
