import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/server/api/errors";

const enterShell = vi.hoisted(() => vi.fn());
const fetchJobDetail = vi.hoisted(() => vi.fn());
const readJobApplicants = vi.hoisted(() => vi.fn());
const readTalentPoolMembership = vi.hoisted(() => vi.fn());
const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
);
const applicantReview = vi.hoisted(() =>
  vi.fn((props: unknown) => {
    void props;
    return null;
  }),
);

vi.mock("@/server/session/viewer", () => ({ enterShell }));
vi.mock("@/server/jobs/jobs", () => ({ fetchJobDetail }));
vi.mock("@/server/applications/employer-review", () => ({
  readJobApplicants,
  readTalentPoolMembership,
}));
vi.mock("next/navigation", () => ({ notFound, unstable_rethrow: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/components/applicant-review", () => ({ ApplicantReview: applicantReview }));

import Page, { JobApplicantsPanel } from "./page";

const jobId = "4d0a1e58-6a3c-4a3f-9a10-6a1c2d3e4f99";
const workerId = "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e";

describe("ilanın başvuru listesi sayfası", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enterShell.mockResolvedValue({ viewer: { id: "viewer" }, failure: null });
    fetchJobDetail.mockResolvedValue({
      id: jobId,
      title: "Hafta sonu garson",
      status: "OPEN",
      headcount: null,
      hiredCount: 0,
    });
  });

  it("UUID olmayan ilan kimliğini backend'e hiç sormaz", async () => {
    await expect(Page({ params: Promise.resolve({ id: "../hesap" }) })).rejects.toThrow("NOT_FOUND");

    expect(notFound).toHaveBeenCalled();
    expect(fetchJobDetail).not.toHaveBeenCalled();
    expect(readJobApplicants).not.toHaveBeenCalled();
  });

  it("ilan yoksa 404 verir; başvuru listesine hiç çıkmaz", async () => {
    fetchJobDetail.mockRejectedValue(
      new ApiError({ status: 404, errorCode: "JOB_NOT_FOUND", errorCategory: "RESOURCE_NOT_FOUND", message: "" }),
    );

    await expect(Page({ params: Promise.resolve({ id: jobId }) })).rejects.toThrow("NOT_FOUND");
    expect(readJobApplicants).not.toHaveBeenCalled();
  });

  it("kabuk profili çözülemediyse hiçbir okuma yapmaz", async () => {
    enterShell.mockResolvedValue({ viewer: null, failure: { errorCode: "X", httpStatus: 500 } });

    await expect(Page({ params: Promise.resolve({ id: jobId }) })).resolves.toBeNull();
    expect(fetchJobDetail).not.toHaveBeenCalled();
  });

  it("ilan başlığını ve ilana dönüş bağlantısını yazar", async () => {
    render(await Page({ params: Promise.resolve({ id: jobId }) }));

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Hafta sonu garson");
    expect(screen.getByRole("link", { name: "İlana dön" })).toHaveAttribute(
      "href",
      `/isveren/ilan/${jobId}`,
    );
  });

  it("kaç kişinin işe alındığını ve kalan kontenjanı yazar", async () => {
    fetchJobDetail.mockResolvedValue({
      id: jobId,
      title: "Hafta sonu garson",
      status: "OPEN",
      headcount: 5,
      hiredCount: 2,
    });

    render(await Page({ params: Promise.resolve({ id: jobId }) }));

    expect(screen.getByText(/2 \/ 5 kişi işe alındı/)).toBeVisible();
    expect(screen.getByText(/3 kişilik yer kaldı/)).toBeVisible();
  });

  it("kalan kontenjanın bekleyen teklifleri saymadığını da yazar", async () => {
    // `hiredCount` ile kabul kapısının saydığı kümeler ayrışıyor; sayı
    // gösterilirken bunun söylenmemesi kullanıcıyı beklenmedik bir 409'a
    // hazırlıksız bırakırdı.
    fetchJobDetail.mockResolvedValue({
      id: jobId,
      title: "Hafta sonu garson",
      status: "OPEN",
      headcount: 5,
      hiredCount: 2,
    });

    render(await Page({ params: Promise.resolve({ id: jobId }) }));

    expect(screen.getByText(/cevabını bekleyen teklifler de yer kaplıyor/i)).toBeVisible();
  });

  it("kontenjan bildirilmemiş ilanda kalan sayı uydurmaz", async () => {
    render(await Page({ params: Promise.resolve({ id: jobId }) }));

    expect(screen.getByText("0 kişi işe alındı")).toBeVisible();
    expect(screen.queryByText(/yer kaldı/)).toBeNull();
  });

  it("başvuruları ve havuz üyeliğini listeye taşır", async () => {
    const applicants = [{ id: "application-1" }];
    readJobApplicants.mockResolvedValue(applicants);
    readTalentPoolMembership.mockResolvedValue(new Set([workerId]));

    render(await JobApplicantsPanel({ jobId }));

    expect(applicantReview).toHaveBeenCalledTimes(1);
    expect(applicantReview.mock.calls[0][0]).toMatchObject({
      jobId,
      applicants,
      inTalentPool: [workerId],
    });
  });

  it("başvurular okunamadığında hata kartı çizer", async () => {
    // Yetkisiz çağıran şirket ilanında **400**, bireysel ilanda 404 alıyor;
    // ikisi de aynı ekrana düşmeli.
    readJobApplicants.mockRejectedValue(
      new ApiError({
        status: 400,
        errorCode: "JOB_APPLICATION_USER_NOT_CONTACT_OF_COMPANY_TO_VIEW_APPLICATIONS",
        errorCategory: "VALIDATION_FAILED",
        message: "",
      }),
    );
    readTalentPoolMembership.mockResolvedValue(new Set<string>());

    render(await JobApplicantsPanel({ jobId }));

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(applicantReview).not.toHaveBeenCalled();
  });
});
