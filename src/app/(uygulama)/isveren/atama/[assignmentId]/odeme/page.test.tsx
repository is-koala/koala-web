import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

import type { EmployerAssignment } from "@/payments/contract";
import type { Viewer } from "@/server/session/viewer";

const enterShell = vi.hoisted(() => vi.fn());
const readEmployerAssignment = vi.hoisted(() => vi.fn());
const readPaymentAttempts = vi.hoisted(() => vi.fn());
const readEmployerPaymentRequirements = vi.hoisted(() => vi.fn());
const fetchPriceQuote = vi.hoisted(() => vi.fn());
const viewerGates = vi.hoisted(() => vi.fn());
const notFound = vi.hoisted(() => vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }));

vi.mock("@/server/session/viewer", () => ({ enterShell }));
vi.mock("@/server/payments/payments", () => ({ readEmployerAssignment, readPaymentAttempts }));
vi.mock("@/server/payments/preflight", () => ({ readEmployerPaymentRequirements }));
vi.mock("@/server/jobs/jobs", () => ({ fetchPriceQuote }));
vi.mock("@/server/session/gates", () => ({ viewerGates }));
vi.mock("@/app/(uygulama)/shell", () => ({ ShellGate: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("next/navigation", () => ({ notFound, unstable_rethrow: vi.fn() }));

import { CheckoutContent, CheckoutPage } from "./page";

const assignmentId = "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e";
const pricing = {
  pricingVersion: "2026-09-v1", currency: "TRY", workerPayout: "1500.50",
  serviceFeeRate: "0.075", serviceFeeAmount: "112.54", employerTotal: "1613.04",
};
const assignment: EmployerAssignment = {
  id: assignmentId,
  jobId: "9c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60",
  title: "Etkinlik görevlisi", position: "Karşılama", employerType: "INDIVIDUAL",
  workerId: "6d2c0e58-2f0a-4b1e-9c3d-7a8b9c0d1e2f", workerName: "Ayşe Yılmaz", workerPictureUrl: null,
  companyName: null, cityName: "İstanbul", districtName: "Kadıköy",
  startsAt: "2026-09-12T09:00:00", endsAt: "2026-09-12T18:00:00",
  status: "CONFIRMED", paymentStatus: "PENDING_COLLECTION", pricing,
  assignedAt: null, confirmedAt: null, paymentSecuredAt: null, cancelledAt: null,
  completedAt: null, workHours: 0, messaging: null, myReview: null, counterpartyReviewed: null,
};
const viewer: Viewer = {
  id: "viewer-1", firstName: "Ali", lastName: "Yılmaz", displayName: "Ali Yılmaz",
  email: "ali@example.test", phoneNumber: "", emailVerified: true, phoneVerified: true,
  profilePictureUrl: null, jobTitle: null, about: null, qualifications: null, interests: null,
  experiences: [], educations: [], badges: [], isEmployer: true, identityVerified: true,
  hasIdentityNumber: false, hasAddress: false, companies: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  enterShell.mockResolvedValue({ viewer, failure: null });
  readEmployerAssignment.mockResolvedValue(assignment);
  viewerGates.mockReturnValue({ individualPayment: { open: false } });
  readEmployerPaymentRequirements.mockResolvedValue({
    advisories: ["individualBillingAddress"], blocked: ["identityNumber"],
  });
  readPaymentAttempts.mockResolvedValue([]);
  fetchPriceQuote.mockRejectedValue(new Error("quote endpoint must not be called"));
});

it("ödeme öncesinde atamanın sabit fiyat özetiyle eksik ön koşulları gösterir", async () => {
  render(await CheckoutContent({ assignment, viewer }));

  expect(fetchPriceQuote).not.toHaveBeenCalled();
  expect(screen.getByText("1.500,50 ₺")).toBeVisible();
  expect(screen.getByText("112,54 ₺")).toBeVisible();
  expect(screen.getByText("1.613,04 ₺")).toBeVisible();
  expect(screen.getByText("2026-09-v1")).toBeVisible();
  expect(screen.getByText("Kimlik numaran hesabında kayıtlı değil")).toBeVisible();
  expect(screen.getByText("Fatura adresin eksik")).toBeVisible();
  expect(screen.getByRole("button", { name: "Iyzico ile güvenli öde" })).toBeDisabled();
});

it.each(["INITIATED", "IN_REVIEW"])(
  "%s denemesi kesinleşmeden ödeme düğmesini açık gerekçeyle kapatır",
  async (status) => {
    readEmployerPaymentRequirements.mockResolvedValue({ advisories: [], blocked: [] });
    readPaymentAttempts.mockResolvedValue([{ status }]);

    render(await CheckoutContent({ assignment, viewer }));

    expect(screen.getByRole("button", { name: "Iyzico ile güvenli öde" })).toBeDisabled();
    expect(screen.getByText(/devam eden ödeme denemenin sonucu bekleniyor/i)).toBeVisible();
  },
);

it("şirket adresi eksiğini companyBillingAddress kapısıyla ödeme öncesinde kapatır", async () => {
  readEmployerPaymentRequirements.mockResolvedValue({
    advisories: ["companyBillingAddress"], blocked: [],
  });
  render(await CheckoutContent({ assignment: { ...assignment, employerType: "COMPANY" }, viewer }));

  expect(screen.getByText("Şirketin fatura adresi kayıtlı değil")).toBeVisible();
  expect(screen.getByRole("button", { name: "Iyzico ile güvenli öde" })).toBeDisabled();
  // Çare web'in şirket bölümü (is-koala/koala-web#172), uygulama aktarımı değil.
  expect(screen.getByRole("link", { name: "Şirket adresini düzenle" })).toHaveAttribute(
    "href",
    "/isveren/sirket?bolum=sirket-adresi",
  );
});

it("ownership bulunamazsa fiyat veya şirket ön kontrolünü başlatmadan notFound üretir", async () => {
  readEmployerAssignment.mockResolvedValue(null);
  await expect(CheckoutPage({ params: Promise.resolve({ assignmentId }) })).rejects.toThrow("NEXT_NOT_FOUND");
  expect(fetchPriceQuote).not.toHaveBeenCalled();
  expect(readEmployerPaymentRequirements).not.toHaveBeenCalled();
  expect(readPaymentAttempts).not.toHaveBeenCalled();
});
