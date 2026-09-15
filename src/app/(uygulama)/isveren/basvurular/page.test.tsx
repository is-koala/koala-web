import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/server/api/errors";

const enterShell = vi.hoisted(() => vi.fn());
const readReceivedApplications = vi.hoisted(() => vi.fn());
const shellGate = vi.hoisted(() => vi.fn());

vi.mock("@/server/session/viewer", () => ({ enterShell }));
vi.mock("@/server/applications/inbox", () => ({ readReceivedApplications }));
vi.mock("@/app/(uygulama)/shell", () => ({ ShellGate: shellGate }));
vi.mock("next/navigation", () => ({ unstable_rethrow: vi.fn() }));

import Page, { EmployerInboxPage } from "./page";

const jobId = "9c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60";
const companyId = "5d3c1b0a-7f60-4c2f-8a9e-9c1f0d244f6c";
const foreignCompanyId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function emptyPage() {
  return {
    content: [],
    page: 0,
    size: 20,
    totalElements: 0,
    totalPages: 0,
    first: true,
    last: true,
  };
}

describe("işveren başvuru gelen kutusu sayfası", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enterShell.mockResolvedValue({
      viewer: {
        id: "viewer",
        companies: [{ companyId, companyName: "Koala Etkinlik", role: "ADMIN", approved: true }],
      },
      failure: null,
    });
  });

  it("bölümün kapısını veri yüklemeden önce taşır", () => {
    const searchParams = Promise.resolve({ status: "APPLIED" });
    const route = Page({ searchParams });

    expect(route.type).toBe(shellGate);
    expect(route.props).toMatchObject({ shell: "employer", href: "/isveren/basvurular" });
    expect(route.props.children.type).toBe(EmployerInboxPage);
    expect(enterShell).not.toHaveBeenCalled();
    expect(readReceivedApplications).not.toHaveBeenCalled();
  });

  it("URL süzgeçlerini ve sayfayı sunucu okumasına taşır", async () => {
    readReceivedApplications.mockResolvedValue(emptyPage());

    await EmployerInboxPage({
      searchParams: Promise.resolve({ status: "REJECTED", jobId, companyId, page: "2" }),
    });

    expect(readReceivedApplications).toHaveBeenCalledWith({
      status: "REJECTED",
      jobId,
      companyId,
      page: 2,
    });
  });

  it("UUID olmayan ilan ve şirket kimliğini backend'e hiç sormaz", async () => {
    readReceivedApplications.mockResolvedValue(emptyPage());

    await EmployerInboxPage({
      searchParams: Promise.resolve({ jobId: "../hesap", companyId: "abc", page: "-1" }),
    });

    expect(readReceivedApplications).toHaveBeenCalledWith({
      status: "ALL",
      jobId: null,
      companyId: null,
      page: 0,
    });
  });

  it("yetkili listesinde olmayan şirket kimliğini yine de sorar; boş sayfa backend'in kararıdır", async () => {
    readReceivedApplications.mockResolvedValue(emptyPage());

    await EmployerInboxPage({
      searchParams: Promise.resolve({ companyId: foreignCompanyId }),
    });

    expect(readReceivedApplications).toHaveBeenCalledWith({
      status: "ALL",
      jobId: null,
      companyId: foreignCompanyId,
      page: 0,
    });
  });

  it("kabuk profili çözülemediyse ikinci istek yapmaz", async () => {
    enterShell.mockResolvedValue({ viewer: null, failure: { errorCode: "X", httpStatus: 500 } });

    await expect(EmployerInboxPage({ searchParams: Promise.resolve({}) })).resolves.toBeNull();
    expect(readReceivedApplications).not.toHaveBeenCalled();
  });

  it("okuma başarısızsa hata kartı çizer", async () => {
    readReceivedApplications.mockRejectedValue(
      new ApiError({
        status: 400,
        errorCode: "PAGE_SORT_FIELD_NOT_ALLOWED",
        errorCategory: "VALIDATION_FAILED",
        message: "",
      }),
    );

    render(await EmployerInboxPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
