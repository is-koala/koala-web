import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AssignmentResolution } from "@/assignments/resolution";

import { AssignmentResolutionPanel } from "./assignment-resolution";

const empty: AssignmentResolution = {
  cancellationPreview: null,
  cancellation: null,
  disputes: [],
};

describe("atama iptal, iade ve uyuşmazlık görünümü", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("boş durumu açıkça gösterir", () => {
    render(<AssignmentResolutionPanel resolution={empty} currency="TRY" />);

    expect(screen.getByRole("heading", { name: "Henüz iptal veya uyuşmazlık kaydı yok" })).toBeVisible();
  });

  it("talep edilen iadeyi Türkçe yaşam döngüsüyle gösterir", () => {
    render(<AssignmentResolutionPanel currency="TRY" resolution={{
      ...empty,
      cancellation: {
        id: "cancellation-1",
        cancelledByParty: "EMPLOYER",
        reason: "Plan değişti",
        feeRate: "0.075",
        feeAmount: "75.00",
        refundAmount: "925.00",
        noticeMinutes: 60,
        cancelledAt: "2026-09-06T10:00:00Z",
        refundStatus: "PENDING",
        refundCompletedAt: null,
      },
    }} />);

    expect(screen.getByText("İade talep edildi")).toBeVisible();
    expect(screen.getByText("925,00 ₺")).toBeVisible();
    expect(screen.getByText("Plan değişti")).toBeVisible();
    // Tarih metni `@/lib/dates` ile paylaşılıyor: üç ekranın da aynı anı aynı
    // yazması, biçimin tek yerden geldiğinin ekrandaki kanıtı.
    expect(screen.getByText("6 Eyl 2026 13:00")).toBeVisible();
  });

  it("sağlayıcıya gönderilmiş iadeyi işleniyor diye gösterir", () => {
    render(<AssignmentResolutionPanel currency="TRY" resolution={{
      ...empty,
      cancellation: {
        id: "cancellation-1",
        cancelledByParty: "EMPLOYER",
        reason: "Plan değişti",
        feeRate: "0",
        feeAmount: "0.00",
        refundAmount: "925.00",
        noticeMinutes: 60,
        cancelledAt: "2026-09-06T10:00:00Z",
        refundStatus: "PROCESSING",
        refundCompletedAt: null,
      },
    }} />);

    expect(screen.getByText("İade işleniyor")).toBeVisible();
  });

  it("sıfır tutarlı iptali iade talebi gibi sunmaz", () => {
    render(<AssignmentResolutionPanel currency="TRY" resolution={{
      ...empty,
      cancellation: {
        id: "cancellation-2",
        cancelledByParty: "EMPLOYER",
        reason: "Ödeme alınmadı",
        feeRate: "0",
        feeAmount: "0.00",
        refundAmount: "0.00",
        noticeMinutes: 60,
        cancelledAt: "2026-09-06T10:00:00Z",
        refundStatus: null,
        refundCompletedAt: null,
      },
    }} />);

    expect(screen.getByText("İade gerekmiyor")).toBeVisible();
    expect(screen.queryByText("İade talebi alındı")).toBeNull();
    expect(screen.queryByText("İade tamamlanma")).toBeNull();
    expect(screen.queryByText("Henüz tamamlanmadı")).toBeNull();
  });

  it("pozitif iadeli eski kaydın null durumunu kesin talep gibi sunmaz", () => {
    render(<AssignmentResolutionPanel currency="TRY" resolution={{
      ...empty,
      cancellation: {
        id: "cancellation-migrated",
        cancelledByParty: "EMPLOYER",
        reason: "Eski kayıt",
        feeRate: "0",
        feeAmount: "0.00",
        refundAmount: "925.00",
        noticeMinutes: 60,
        cancelledAt: "2026-09-06T10:00:00Z",
        refundStatus: null,
        refundCompletedAt: null,
      },
    }} />);

    expect(screen.getByText("İade durumu bekleniyor")).toBeVisible();
    expect(screen.queryByText("İade talebi alındı")).toBeNull();
  });

  it("açık uyuşmazlıkta emanetin donduğunu ve sonuçlanan kararı gösterir", () => {
    render(<AssignmentResolutionPanel currency="TRY" resolution={{
      ...empty,
      disputes: [
        {
          id: "open",
          status: "UNDER_REVIEW",
          reason: "Süre yanlış",
          resolution: null,
          resolutionNote: null,
          createdAt: "2026-09-06T10:00:00Z",
          resolvedAt: null,
          evidence: {
            status: "ready",
            items: [{
              id: "evidence-1",
              disputeId: "open",
              uploadedByName: "Ayşe Yılmaz",
              fileName: "vardiya.png",
              contentType: "image/png",
              fileSize: 1536,
              createdAt: "2026-09-06T10:05:00Z",
            }],
          },
        },
        {
          id: "resolved",
          status: "RESOLVED",
          reason: "Eksik ödeme",
          resolution: "REFUND_EMPLOYER",
          resolutionNote: "İşverene iade edildi.",
          createdAt: "2026-09-05T10:00:00Z",
          resolvedAt: "2026-09-06T12:00:00Z",
          evidence: { status: "ready", items: [] },
        },
      ],
    }} />);

    expect(screen.getByText(/emanetteki para donduruldu/i)).toBeVisible();
    expect(screen.getByText("İşverene iade")).toBeVisible();
    expect(screen.getByText("İşverene iade edildi.")).toBeVisible();
    expect(screen.getByRole("button", { name: "vardiya.png dosyasını indir" })).toBeVisible();
    expect(screen.getByText("Ayşe Yılmaz · PNG görseli · 1,5 KB")).toBeVisible();
    expect(screen.getByText("6 Eyl 2026 13:05")).toBeVisible();
  });

  it("tanınmayan uyuşmazlık durumunda emanet kapısını fail-closed anlatır", () => {
    render(<AssignmentResolutionPanel currency="TRY" resolution={{
      ...empty,
      disputes: [{
        id: "future-status",
        status: "UNKNOWN",
        reason: "Durum sağlayıcıdan doğrulanıyor",
        resolution: null,
        resolutionNote: null,
        createdAt: "2026-09-06T10:00:00Z",
        resolvedAt: null,
        evidence: { status: "ready", items: [] },
      }],
    }} />);

    expect(screen.getByText(/emanetteki para donduruldu/i)).toBeVisible();
    expect(screen.getByText("Durum bekleniyor")).toBeVisible();
  });

  it("kanıt listesi okunamazsa uyuşmazlığı koruyup yeniden deneme sunar", () => {
    render(<AssignmentResolutionPanel currency="TRY" resolution={{
      ...empty,
      disputes: [{
        id: "open",
        status: "OPEN",
        reason: "Süre yanlış",
        resolution: null,
        resolutionNote: null,
        createdAt: "2026-09-06T10:00:00Z",
        resolvedAt: null,
        evidence: { status: "error", errorCode: "UPSTREAM_FAILED", httpStatus: 503 },
      }],
    }} />);

    expect(screen.getByText("Süre yanlış")).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent("İşlemi şu anda tamamlayamadık");
    expect(screen.getByRole("alert")).toHaveTextContent("Uyuşmazlık kaydı görünmeye devam ediyor");
    expect(screen.getByRole("button", { name: "Kanıtları yeniden yükle" })).toBeVisible();
  });

  it("bilinen kanıt listeleme hatasını kendi eyleme dönük metniyle gösterir", () => {
    render(<AssignmentResolutionPanel currency="TRY" resolution={{
      ...empty,
      disputes: [{
        id: "open",
        status: "OPEN",
        reason: "Süre yanlış",
        resolution: null,
        resolutionNote: null,
        createdAt: "2026-09-06T10:00:00Z",
        resolvedAt: null,
        evidence: {
          status: "error",
          errorCode: "DISPUTE_EVIDENCE_NOT_FOUND",
          httpStatus: 404,
        },
      }],
    }} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Dosya kaldırılmış veya liste bu sırada değişmiş olabilir");
    expect(screen.getByRole("button", { name: "Kanıtları yeniden yükle" })).toBeVisible();
  });

  it("kanıt indirme hatasını ham JSON sayfası yerine görünüm içinde Türkçe gösterir", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      errorCode: "STORAGE_DOWNLOAD_FAILED",
      httpStatus: 502,
    }), {
      status: 502,
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    render(<AssignmentResolutionPanel currency="TRY" resolution={{
      ...empty,
      disputes: [{
        id: "open",
        status: "OPEN",
        reason: "Süre yanlış",
        resolution: null,
        resolutionNote: null,
        createdAt: "2026-09-06T10:00:00Z",
        resolvedAt: null,
        evidence: {
          status: "ready",
          items: [{
            id: "evidence-1",
            disputeId: "open",
            uploadedByName: "Ayşe Yılmaz",
            fileName: "vardiya.png",
            contentType: "image/png",
            fileSize: 2048,
            createdAt: "2026-09-06T10:05:00Z",
          }],
        },
      }],
    }} />);

    await user.click(screen.getByRole("button", { name: "vardiya.png dosyasını indir" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/disputes/open/evidence/evidence-1/download",
      expect.objectContaining({ cache: "no-store", redirect: "manual" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Kanıt dosyasını şu anda indiremedik. Biraz sonra yeniden dene.",
    );
    expect(screen.getByRole("alert")).toHaveClass("form-warning");
  });

  it("başarılı kanıt yanıtını sayfadan ayrılmadan dosya olarak indirir", async () => {
    const user = userEvent.setup();
    const evidenceBlob = new Blob(["kanıt"], { type: "image/png" });
    const fetchMock = vi.fn().mockResolvedValue(new Response(evidenceBlob, { status: 200 }));
    const createObjectUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:koala-evidence");
    const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    let clickedDownload = "";
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clickedDownload = this.download;
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AssignmentResolutionPanel currency="TRY" resolution={{
      ...empty,
      disputes: [{
        id: "open",
        status: "OPEN",
        reason: "Süre yanlış",
        resolution: null,
        resolutionNote: null,
        createdAt: "2026-09-06T10:00:00Z",
        resolvedAt: null,
        evidence: {
          status: "ready",
          items: [{
            id: "evidence-1",
            disputeId: "open",
            uploadedByName: "Ayşe Yılmaz",
            fileName: "../\u202Egnp.exe/kanıt.png",
            contentType: "image/png",
            fileSize: 2048,
            createdAt: "2026-09-06T10:05:00Z",
          }],
        },
      }],
    }} />);

    await user.click(screen.getByRole("button", { name: "_gnp.exe_kanıt.png dosyasını indir" }));

    await waitFor(() => expect(anchorClick).toHaveBeenCalledOnce());
    expect(createObjectUrl).toHaveBeenCalledWith(expect.any(Blob));
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:koala-evidence");
    expect(clickedDownload).toBe("_gnp.exe_kanıt.png");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
