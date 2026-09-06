import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EmployerAssignment } from "@/payments/contract";
import type { Viewer } from "@/server/session/viewer";

const enterShell = vi.hoisted(() => vi.fn());
const readEmployerAssignment = vi.hoisted(() => vi.fn());
const readPaymentDetailsForAssignment = vi.hoisted(() => vi.fn());
const readEmployerPaymentRequirements = vi.hoisted(() => vi.fn());
const viewerGates = vi.hoisted(() => vi.fn());
const shellGate = vi.hoisted(() => vi.fn());
const notFound = vi.hoisted(() => vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }));

vi.mock("@/server/session/viewer", () => ({ enterShell }));
vi.mock("@/server/payments/payments", () => ({
  readEmployerAssignment,
  readPaymentDetailsForAssignment,
}));
vi.mock("@/server/payments/preflight", () => ({ readEmployerPaymentRequirements }));
vi.mock("@/server/session/gates", () => ({ viewerGates }));
vi.mock("@/app/(uygulama)/shell", () => ({ ShellGate: shellGate }));
vi.mock("next/navigation", () => ({ notFound, unstable_rethrow: vi.fn() }));

import Page, { EmployerAssignmentContent, EmployerAssignmentPage } from "./page";

const assignmentId = "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e";
const assignment: EmployerAssignment = {
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
const viewer: Viewer = {
  id: "viewer-1", firstName: "Ali", lastName: "Yılmaz", displayName: "Ali Yılmaz",
  email: "ali@example.test", phoneNumber: "", emailVerified: true, phoneVerified: true,
  profilePictureUrl: null, jobTitle: null, about: null, qualifications: null, interests: null,
  experiences: [], educations: [], isEmployer: true, identityVerified: true,
  hasIdentityNumber: false, hasAddress: false, companies: [],
};

describe("işveren atama ayrıntısı", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enterShell.mockResolvedValue({ viewer, failure: null });
    readEmployerAssignment.mockResolvedValue(assignment);
    viewerGates.mockReturnValue({ individualPayment: { open: false } });
    readEmployerPaymentRequirements.mockResolvedValue({
      advisories: ["individualBillingAddress"], blocked: ["identityNumber"],
    });
    readPaymentDetailsForAssignment.mockResolvedValue({
      assignment,
      attempts: [{ id: "attempt-1", status: "FAILED" }],
      resolution: "failed",
      hasActiveDispute: true,
    });
  });

  it("merkezi atamalar kapısını veri yüklemeden önce taşır", () => {
    const route = Page({ params: Promise.resolve({ assignmentId }), searchParams: Promise.resolve({}) });
    expect(route.type).toBe(shellGate);
    expect(route.props).toMatchObject({ shell: "employer", href: "/isveren/atamalar" });
    expect(readEmployerAssignment).not.toHaveBeenCalled();
  });

  it("ownership yoksa ödeme ayrıntılarını başlatmadan notFound üretir", async () => {
    readEmployerAssignment.mockResolvedValue(null);
    await expect(EmployerAssignmentPage({
      params: Promise.resolve({ assignmentId }), searchParams: Promise.resolve({}),
    })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(readPaymentDetailsForAssignment).not.toHaveBeenCalled();
  });

  it("bozuk kimlikte ownership backend'ine çıkmadan notFound üretir", async () => {
    await expect(EmployerAssignmentPage({
      params: Promise.resolve({ assignmentId: "42" }), searchParams: Promise.resolve({}),
    })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(readEmployerAssignment).not.toHaveBeenCalled();
  });

  it("dönüş işareti varsa query statüsü yerine backend sonucunu, dispute ve kapı kiplerini gösterir", async () => {
    render(await EmployerAssignmentContent({
      assignment,
      viewer,
      searchParams: Promise.resolve({ paymentReturn: "1", status: "success" }),
    }));

    expect(screen.getByRole("heading", { name: "Ödeme tamamlanamadı" })).toBeVisible();
    expect(screen.queryByText("Ödeme doğrulandı")).toBeNull();
    expect(screen.getByText(/emanetten çıkış bekler/i)).toBeVisible();
    expect(screen.getByRole("button", { name: "Ödemeye geç" })).toBeDisabled();
    expect(screen.getByText("Fatura adresin eksik").closest('[role="status"]')).not.toBeNull();
    expect(screen.getByText("Kimlik numaran hesabında kayıtlı değil").closest('[role="alert"]')).not.toBeNull();
  });
});
