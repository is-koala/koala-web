import { beforeEach, describe, expect, it, vi } from "vitest";

import Page, { ApplicationsPage } from "./page";

const enterShell = vi.hoisted(() => vi.fn());
const readWorkerApplications = vi.hoisted(() => vi.fn());
const shellGate = vi.hoisted(() => vi.fn());

vi.mock("@/server/session/viewer", () => ({ enterShell }));
vi.mock("@/server/applications/applications", () => ({ readWorkerApplications }));
vi.mock("@/app/(uygulama)/shell", () => ({ ShellGate: shellGate }));

describe("başvurularım sayfası", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enterShell.mockResolvedValue({ viewer: { id: "viewer" }, failure: null });
  });

  it("bölümün merkezi çalışan kapısını veri yüklemeden önce taşır", () => {
    const searchParams = Promise.resolve({ status: "APPLIED" });
    const route = Page({ searchParams });

    expect(route.type).toBe(shellGate);
    expect(route.props).toMatchObject({ shell: "worker", href: "/panel/basvurularim" });
    expect(route.props.children.type).toBe(ApplicationsPage);
    expect(route.props.children.props.searchParams).toBe(searchParams);
    expect(enterShell).not.toHaveBeenCalled();
    expect(readWorkerApplications).not.toHaveBeenCalled();
  });

  it("URL filtresi ve sayfayı sunucu okumasına taşır", async () => {
    readWorkerApplications.mockResolvedValue({
      content: [], page: 2, size: 20, totalElements: 0, totalPages: 0, first: false, last: true,
    });

    const result = await ApplicationsPage({
      searchParams: Promise.resolve({ status: "REJECTED", page: "2" }),
    });

    expect(readWorkerApplications).toHaveBeenCalledWith({ status: "REJECTED", page: 2 });
    expect(result).not.toBeNull();
  });

  it("bilinmeyen filtre ve sayfayı güvenli varsayılanlara indirir", async () => {
    readWorkerApplications.mockResolvedValue({
      content: [], page: 0, size: 20, totalElements: 0, totalPages: 0, first: true, last: true,
    });

    await ApplicationsPage({
      searchParams: Promise.resolve({ status: ["APPLIED", "REJECTED"], page: "-1" }),
    });

    expect(readWorkerApplications).toHaveBeenCalledWith({ status: "ALL", page: 0 });
  });

  it("kabuk profili çözülemediyse ikinci istek yapmaz", async () => {
    enterShell.mockResolvedValue({ viewer: null, failure: { errorCode: "X", httpStatus: 500 } });

    await expect(ApplicationsPage({ searchParams: Promise.resolve({}) })).resolves.toBeNull();
    expect(readWorkerApplications).not.toHaveBeenCalled();
  });
});
