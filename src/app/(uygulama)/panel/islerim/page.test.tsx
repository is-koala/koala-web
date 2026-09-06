import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/server/api/errors";

import Page, { AssignmentsPage } from "./page";

const enterShell = vi.hoisted(() => vi.fn());
const readWorkerAssignments = vi.hoisted(() => vi.fn());
const shellGate = vi.hoisted(() => vi.fn());

vi.mock("@/server/session/viewer", () => ({ enterShell }));
vi.mock("@/server/assignments/assignments", () => ({ readWorkerAssignments }));
vi.mock("@/app/(uygulama)/shell", () => ({ ShellGate: shellGate }));

describe("İşlerim sayfası durumları", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enterShell.mockResolvedValue({ viewer: { firstName: "Ayşe" }, failure: null });
  });

  it("bölümün merkezi çalışan kapısını veri yüklemeden önce taşır", async () => {
    const route = await Page();

    expect(route.type).toBe(shellGate);
    expect(route.props).toMatchObject({ shell: "worker", href: "/panel/islerim" });
    expect(enterShell).not.toHaveBeenCalled();
    expect(readWorkerAssignments).not.toHaveBeenCalled();
  });

  it("atama yoksa boş durumu gösterir", async () => {
    readWorkerAssignments.mockResolvedValue({
      content: [],
      page: 0,
      size: 20,
      totalElements: 0,
      totalPages: 0,
      first: true,
      last: true,
    });

    render(await AssignmentsPage());

    expect(screen.getByRole("status")).toHaveTextContent("Henüz atama yok");
  });

  it("backend hatasını ham mesaj yerine koduyla gösterir", async () => {
    readWorkerAssignments.mockRejectedValue(
      new ApiError({
        status: 503,
        errorCode: "EXTERNAL_SERVICE",
        errorCategory: "EXTERNAL_SERVICE",
        message: "internal backend message",
      }),
    );

    render(await AssignmentsPage());

    expect(screen.getByRole("alert")).toHaveTextContent("Hizmete ulaşılamıyor");
    expect(screen.queryByText("internal backend message")).toBeNull();
  });

  it("beklenmeyen ağ hatasını nötr Türkçe duruma çevirir", async () => {
    readWorkerAssignments.mockRejectedValue(new TypeError("fetch failed"));

    render(await AssignmentsPage());

    expect(screen.getByRole("alert")).toHaveTextContent("Bir sorun oluştu");
    expect(screen.queryByText("fetch failed")).toBeNull();
  });

  it("oturum kapısı yönlendirirse liste isteğine çıkmaz", async () => {
    enterShell.mockRejectedValueOnce(new Error("NEXT_REDIRECT"));

    await expect(AssignmentsPage()).rejects.toThrow("NEXT_REDIRECT");

    expect(readWorkerAssignments).not.toHaveBeenCalled();
  });
});
