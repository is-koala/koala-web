import { beforeEach, describe, expect, it, vi } from "vitest";

import Page from "./page";

const enterShell = vi.hoisted(() => vi.fn());
const readWorkerApplications = vi.hoisted(() => vi.fn());

vi.mock("@/server/session/viewer", () => ({ enterShell }));
vi.mock("@/server/applications/applications", () => ({ readWorkerApplications }));

describe("başvurularım sayfası", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enterShell.mockResolvedValue({ viewer: { id: "viewer" }, failure: null });
  });

  it("URL filtresi ve sayfayı sunucu okumasına taşır", async () => {
    readWorkerApplications.mockResolvedValue({
      content: [], page: 2, size: 20, totalElements: 0, totalPages: 0, first: false, last: true,
    });

    const result = await Page({
      searchParams: Promise.resolve({ status: "REJECTED", page: "2" }),
    });

    expect(readWorkerApplications).toHaveBeenCalledWith({ status: "REJECTED", page: 2 });
    expect(result).not.toBeNull();
  });

  it("bilinmeyen filtre ve sayfayı güvenli varsayılanlara indirir", async () => {
    readWorkerApplications.mockResolvedValue({
      content: [], page: 0, size: 20, totalElements: 0, totalPages: 0, first: true, last: true,
    });

    await Page({ searchParams: Promise.resolve({ status: ["APPLIED", "REJECTED"], page: "-1" }) });

    expect(readWorkerApplications).toHaveBeenCalledWith({ status: "ALL", page: 0 });
  });

  it("kabuk profili çözülemediyse ikinci istek yapmaz", async () => {
    enterShell.mockResolvedValue({ viewer: null, failure: { errorCode: "X", httpStatus: 500 } });

    await expect(Page({ searchParams: Promise.resolve({}) })).resolves.toBeNull();
    expect(readWorkerApplications).not.toHaveBeenCalled();
  });
});
