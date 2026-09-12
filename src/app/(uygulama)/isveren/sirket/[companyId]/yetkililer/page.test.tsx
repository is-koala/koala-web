import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/server/api/errors";

import { sessionExpiryRedirect } from "../../../../../../../tests/support/control-flow";

import { ContactsPanel } from "./page";

const enterShell = vi.hoisted(() => vi.fn());
const getCompanyContacts = vi.hoisted(() => vi.fn());
const getCompanyInvitations = vi.hoisted(() => vi.fn());
const companyContactsPageView = vi.hoisted(() => vi.fn(() => null));

vi.mock("@/server/session/viewer", () => ({ enterShell }));
vi.mock("@/server/company/contacts", () => ({ getCompanyContacts, getCompanyInvitations }));
vi.mock("@/components/company-contacts-page", () => ({
  CompanyContactsPageView: companyContactsPageView,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const companyId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

/** Panelin görünüme verdiği prop'lar; bileşen taklit edildiği için ağaçtan okunur. */
async function viewProps(viewerRole = "ADMIN"): Promise<Record<string, unknown>> {
  const tree = (await ContactsPanel({
    companyId,
    companyName: "Koala Etkinlik",
    viewerRole,
  })) as { type: unknown; props: Record<string, unknown> };
  expect(tree.type).toBe(companyContactsPageView);
  return tree.props;
}

describe("şirket yetkilileri paneli", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCompanyContacts.mockResolvedValue([]);
    getCompanyInvitations.mockResolvedValue([]);
  });

  it("yetkililer okunurken biten oturumun yönlendirmesini hata durumuna dönüştürmez", async () => {
    const interrupt = sessionExpiryRedirect(
      `/giris?next=%2Fisveren%2Fsirket%2F${companyId}%2Fyetkililer`,
    );
    getCompanyContacts.mockRejectedValue(interrupt);

    await expect(
      ContactsPanel({ companyId, companyName: "Koala Etkinlik", viewerRole: "ADMIN" }),
    ).rejects.toBe(interrupt);
  });

  it("davet listesi düşerse yetkili listesini yine de verir", async () => {
    // İki liste bağımsız düşebiliyor: davet ucu kapalıyken yetkili listesi
    // okunabilir kalmalı.
    getCompanyInvitations.mockRejectedValue(
      new ApiError({
        status: 503,
        errorCode: "EXTERNAL_SERVICE",
        errorCategory: "EXTERNAL_SERVICE",
        message: "ham mesaj",
      }),
    );

    expect(await viewProps()).toMatchObject({
      contacts: { status: "ready", data: [] },
      invitations: { status: "error", errorCode: "EXTERNAL_SERVICE", httpStatus: 503 },
    });
  });

  it("bilinmeyen hatayı nötr yedeğe düşürür", async () => {
    getCompanyContacts.mockRejectedValue(new Error("ağ koptu"));

    expect(await viewProps()).toMatchObject({
      contacts: { status: "error", errorCode: "UNEXPECTED", httpStatus: 500 },
    });
  });
});
