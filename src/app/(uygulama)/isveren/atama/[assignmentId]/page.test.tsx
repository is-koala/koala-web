import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const enterShell = vi.hoisted(() => vi.fn());
const readPaymentReconciliation = vi.hoisted(() => vi.fn());
const viewerGates = vi.hoisted(() => vi.fn());
const shellGate = vi.hoisted(() => vi.fn());

vi.mock("@/server/session/viewer", () => ({ enterShell }));
vi.mock("@/server/payments/payments", () => ({ readPaymentReconciliation }));
vi.mock("@/server/session/gates", () => ({ viewerGates }));
vi.mock("@/app/(uygulama)/shell", () => ({ ShellGate: shellGate }));

import Page, { EmployerAssignmentPage } from "./page";

const assignmentId = "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e";
const assignment = {
  id: assignmentId,
  jobId: "9c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60",
  title: "Etkinlik görevlisi",
  position: "Karşılama",
  employerType: "INDIVIDUAL",
  workerName: "Ayşe Yılmaz",
  cityName: "İstanbul",
  districtName: "Kadıköy",
  startsAt: "2026-09-12T09:00:00",
  endsAt: "2026-09-12T18:00:00",
  status: "CONFIRMED",
  paymentStatus: "FAILED",
  pricing: null,
};

describe("işveren atama ayrıntısı", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enterShell.mockResolvedValue({ viewer: { id: "viewer-1" }, failure: null });
    viewerGates.mockReturnValue({
      individualPayment: { open: false, blockedBy: ["identityNumber"] },
    });
    readPaymentReconciliation.mockResolvedValue({
      assignment,
      attempts: [{ id: "attempt-1", status: "FAILED" }],
      resolution: "failed",
    });
  });

  it("merkezi atamalar kapısını veri yüklemeden önce taşır", () => {
    const params = Promise.resolve({ assignmentId });
    const searchParams = Promise.resolve({});
    const route = Page({ params, searchParams });

    expect(route.type).toBe(shellGate);
    expect(route.props).toMatchObject({ shell: "employer", href: "/isveren/atamalar" });
    expect(readPaymentReconciliation).not.toHaveBeenCalled();
  });

  it("dönüş işareti varsa query statüsü yerine backend mutabakatını ve kapıları gösterir", async () => {
    render(await EmployerAssignmentPage({
      params: Promise.resolve({ assignmentId }),
      searchParams: Promise.resolve({ paymentReturn: "1", status: "success" }),
    }));

    expect(screen.getByRole("heading", { name: "Ödeme tamamlanamadı" })).toBeVisible();
    expect(screen.queryByText("Ödeme doğrulandı")).toBeNull();
    expect(screen.getByRole("button", { name: "Ödemeye geç" })).toBeDisabled();
    expect(screen.getByText("Kimlik numaran hesabında kayıtlı değil")).toBeVisible();
  });
});
