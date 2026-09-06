import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/server/api/errors";

import Page from "./page";

const enterShell = vi.hoisted(() => vi.fn());
const readWorkerAssignments = vi.hoisted(() => vi.fn());

vi.mock("@/server/session/viewer", () => ({ enterShell }));
vi.mock("@/server/assignments/assignments", () => ({ readWorkerAssignments }));

describe("İşlerim sayfası durumları", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enterShell.mockResolvedValue({ viewer: { firstName: "Ayşe" }, failure: null });
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

    render(await Page());

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

    render(await Page());

    expect(screen.getByRole("alert")).toHaveTextContent("Hizmete ulaşılamıyor");
    expect(screen.queryByText("internal backend message")).toBeNull();
  });

  it("beklenmeyen ağ hatasını nötr Türkçe duruma çevirir", async () => {
    readWorkerAssignments.mockRejectedValue(new TypeError("fetch failed"));

    render(await Page());

    expect(screen.getByRole("alert")).toHaveTextContent("Bir sorun oluştu");
    expect(screen.queryByText("fetch failed")).toBeNull();
  });

  it("oturum kapısı yönlendirirse liste isteğine çıkmaz", async () => {
    enterShell.mockRejectedValueOnce(new Error("NEXT_REDIRECT"));

    await expect(Page()).rejects.toThrow("NEXT_REDIRECT");

    expect(readWorkerAssignments).not.toHaveBeenCalled();
  });
});
