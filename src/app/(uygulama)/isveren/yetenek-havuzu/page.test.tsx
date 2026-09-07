import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/server/api/errors";

const enterShell = vi.hoisted(() => vi.fn());
const readTalentPool = vi.hoisted(() => vi.fn());
const shellGate = vi.hoisted(() => vi.fn());

vi.mock("@/server/session/viewer", () => ({ enterShell }));
vi.mock("@/server/applications/employer-review", () => ({ readTalentPool }));
vi.mock("@/app/(uygulama)/shell", () => ({ ShellGate: shellGate }));
vi.mock("next/navigation", () => ({ unstable_rethrow: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import Page, { TalentPoolPageBody } from "./page";

describe("yetenek havuzu sayfası", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enterShell.mockResolvedValue({ viewer: { id: "viewer" }, failure: null });
  });

  it("bölümün kapısını veri yüklemeden önce taşır", () => {
    const searchParams = Promise.resolve({});
    const route = Page({ searchParams });

    expect(route.type).toBe(shellGate);
    expect(route.props).toMatchObject({ shell: "employer", href: "/isveren/yetenek-havuzu" });
    expect(readTalentPool).not.toHaveBeenCalled();
  });

  it("adres çubuğundaki sayfayı sıfır tabanlı okumaya çevirir", async () => {
    readTalentPool.mockResolvedValue(emptyPool());

    await TalentPoolPageBody({ searchParams: Promise.resolve({ sayfa: "3" }) });

    expect(readTalentPool).toHaveBeenCalledWith(2);
  });

  it("bozuk sayfa numarasını ilk sayfaya indirir", async () => {
    readTalentPool.mockResolvedValue(emptyPool());

    await TalentPoolPageBody({ searchParams: Promise.resolve({ sayfa: ["2", "5"] }) });

    expect(readTalentPool).toHaveBeenCalledWith(0);
  });

  it("havuz boşken boş durumu gösterir", async () => {
    readTalentPool.mockResolvedValue(emptyPool());

    render(await TalentPoolPageBody({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("status")).toHaveTextContent("Yetenek havuzun boş");
  });

  it("havuzdaki adayı notuyla listeler ve çıkarma formuna kimliğini koyar", async () => {
    readTalentPool.mockResolvedValue({
      ...emptyPool(),
      content: [{
        id: "entry-1",
        workerId: "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e",
        fullName: "Ayşe Yılmaz",
        profilePictureUrl: null,
        note: "Hızlı öğreniyor.",
        createdAt: "2026-08-01T10:00:00Z",
      }],
      totalElements: 1,
      totalPages: 1,
    });

    render(await TalentPoolPageBody({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText("Ayşe Yılmaz")).toBeInTheDocument();
    expect(screen.getByText("Hızlı öğreniyor.")).toBeInTheDocument();

    // Eylem sunucuda koşuyor; burada denetlenen, formun doğru kimliği taşıdığı.
    const form = screen.getByRole("button", { name: "Havuzdan çıkar" }).closest("form");
    expect(new FormData(form!).get("workerId")).toBe("3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e");
  });

  it("okuma başarısızsa hata kartı çizer", async () => {
    readTalentPool.mockRejectedValue(
      new ApiError({ status: 500, errorCode: "UNEXPECTED", errorCategory: "UNEXPECTED", message: "" }),
    );

    render(await TalentPoolPageBody({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});

function emptyPool() {
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
