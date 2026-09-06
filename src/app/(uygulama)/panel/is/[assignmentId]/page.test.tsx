import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WorkDetail } from "@/assignments/work-detail";
import { ApiError } from "@/server/api/errors";

import Page, { WorkDetailPage } from "./page";

const assignmentId = "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e";
const enterShell = vi.hoisted(() => vi.fn());
const readWorkDetail = vi.hoisted(() => vi.fn());
const shellGate = vi.hoisted(() => vi.fn());
const notFound = vi.hoisted(() => vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }));

vi.mock("@/server/session/viewer", () => ({ enterShell }));
vi.mock("@/server/assignments/work-detail", () => ({ readWorkDetail }));
vi.mock("@/app/(uygulama)/shell", () => ({ ShellGate: shellGate }));
vi.mock("next/navigation", async (original) => {
  const actual = await original<typeof import("next/navigation")>();
  return { ...actual, notFound };
});

const detail = {
  observedAt: new Date("2026-09-12T10:00:00Z").getTime(),
  assignment: {
    id: assignmentId,
    jobId: "9c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60",
    title: "Etkinlik görevlisi",
    position: null,
    categoryName: null,
    companyName: "Koala Etkinlik",
    cityName: "İstanbul",
    districtName: "Kadıköy",
    startsAt: "2026-09-12T09:00:00Z",
    endsAt: "2026-09-12T18:00:00Z",
    status: "CONFIRMED",
    paymentStatus: "HELD_IN_ESCROW",
    workerPayout: "1250.00",
    currency: "TRY",
    assignedAt: "2026-09-06T10:00:00Z",
    completedAt: null,
  },
  description: null,
  duties: null,
  dressCode: null,
  fullAddress: null,
  sessions: [],
  cancellationPreview: null,
} satisfies WorkDetail;

describe("iş ayrıntısı sayfası", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enterShell.mockResolvedValue({ viewer: { firstName: "Ayşe" }, failure: null });
  });

  it("İşlerim bölümünün çalışan kapısını veri okumadan önce taşır", () => {
    const route = Page({ params: Promise.resolve({ assignmentId }) });

    expect(route.type).toBe(shellGate);
    expect(route.props).toMatchObject({ shell: "worker", href: "/panel/islerim" });
    expect(enterShell).not.toHaveBeenCalled();
    expect(readWorkDetail).not.toHaveBeenCalled();
  });

  it("oturumlu çalışanın sunucu ayrıntısını ekrana verir", async () => {
    readWorkDetail.mockResolvedValue(detail);

    render(await WorkDetailPage({ params: Promise.resolve({ assignmentId }) }));

    expect(screen.getByRole("heading", { name: "Etkinlik görevlisi" })).toBeVisible();
    expect(readWorkDetail).toHaveBeenCalledWith(assignmentId);
  });

  it("geçersiz ya da kullanıcıya ait olmayan atama kimliğinde 404 verir", async () => {
    await expect(WorkDetailPage({ params: Promise.resolve({ assignmentId: "../jobs" }) }))
      .rejects.toThrow("NEXT_NOT_FOUND");
    expect(readWorkDetail).not.toHaveBeenCalled();

    readWorkDetail.mockResolvedValueOnce(null);
    await expect(WorkDetailPage({ params: Promise.resolve({ assignmentId }) }))
      .rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("backend hatasını ham mesaj yerine güvenli hata sunumuyla gösterir", async () => {
    readWorkDetail.mockRejectedValue(new ApiError({
      status: 503,
      errorCode: "EXTERNAL_SERVICE",
      errorCategory: "EXTERNAL_SERVICE",
      message: "internal backend message",
    }));

    render(await WorkDetailPage({ params: Promise.resolve({ assignmentId }) }));

    expect(screen.getByRole("alert")).toHaveTextContent("Hizmete ulaşılamıyor");
    expect(screen.queryByText("internal backend message")).toBeNull();
  });
});
