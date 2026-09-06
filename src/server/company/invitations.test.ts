import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cookieStore,
  envelope,
  jsonResponse,
  requestHeaders,
} from "../../../tests/support/session-cookies";

import { answerInvitation, getInvitation } from "./invitations";

vi.mock("next/headers", async () => {
  const support = await import("../../../tests/support/session-cookies");
  return {
    cookies: () => Promise.resolve(support.cookieStore),
    headers: () => Promise.resolve(support.requestHeaders),
  };
});

const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";
const invitationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("davet backend modülü", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "https://api.example.test");
    vi.stubEnv("APP_VERSION", "1.4.0");
    requestHeaders.delete("x-real-ip");
    cookieStore.values.clear();
    cookieStore.values.set("koala_did", deviceId);
    cookieStore.values.set("koala_at", "access-placeholder");
    cookieStore.values.set("koala_rt", "refresh-placeholder");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("daveti kendi kanonik ucundan okur", async () => {
    const fetchMock = successfulFetch({ id: invitationId });

    await getInvitation(invitationId);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.example.test/contact-invitations/${invitationId}`);
    expect(init.method).toBe("GET");
  });

  it("kabul ve reddi aynı uca, gövdedeki bayrakla ayırarak gönderir", async () => {
    /*
     * Ret ayrı bir uç değil, aynı gövdenin `false` hâli. `accepted`
     * `@NotNull`: gövdesiz bir `POST` alan doğrulamasına takılır ve
     * kullanıcıya hiçbir şey anlatmayan bir 400 döner.
     */
    const fetchMock = successfulFetch({ id: invitationId });

    await answerInvitation(invitationId, true);
    await answerInvitation(invitationId, false);

    for (const [index, accepted] of [true, false].entries()) {
      const [url, init] = fetchMock.mock.calls[index] as [string, RequestInit];
      expect(url).toBe(`https://api.example.test/contact-invitations/${invitationId}`);
      expect(init.method).toBe("POST");
      expect(JSON.parse(init.body as string)).toEqual({ accepted });
    }
  });

  it("şirketi ve iki kişiyi eksik alanlara düşmeden daraltır", async () => {
    // `OnlyCompanyDto` logo taşımayabiliyor ve `SafeUserDto` alanları boş
    // gelebiliyor; ekranın `undefined` üzerinde patlamaması gerekiyor.
    successfulFetch({
      id: invitationId,
      company: { id: "sirket-1", name: "Koala Temizlik" },
      invitedBy: { id: "davet-eden" },
      invitedUser: { id: "davet-edilen" },
      role: "STAFF",
      status: "PENDING",
      invitedAt: "2026-08-01T09:00:00Z",
    });

    expect(await getInvitation(invitationId)).toEqual({
      id: invitationId,
      company: { id: "sirket-1", name: "Koala Temizlik", logoUrl: null },
      invitedBy: {
        id: "davet-eden",
        firstName: "",
        lastName: "",
        username: "",
        profilePictureUrl: null,
      },
      invitedUser: {
        id: "davet-edilen",
        firstName: "",
        lastName: "",
        username: "",
        profilePictureUrl: null,
      },
      role: "STAFF",
      status: "PENDING",
      invitedAt: "2026-08-01T09:00:00Z",
      answeredAt: null,
    });
  });

  it("kimliği yola koymadan önce kaçırır", async () => {
    const fetchMock = successfulFetch({ id: invitationId });

    await getInvitation("a b/../companies");

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.test/contact-invitations/a%20b%2F..%2Fcompanies");
  });
});

function successfulFetch(data: unknown) {
  const fetchMock = vi.fn().mockImplementation(() =>
    Promise.resolve(jsonResponse(200, envelope(data))),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
