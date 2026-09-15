import { describe, expect, it } from "vitest";

import { addressErrors } from "@/address/errors";
import { disputeErrors } from "@/assignments/errors";
import { identityErrors } from "@/identity/errors";
import { jobManagementErrors } from "@/jobs/errors";
import { messagingErrors } from "@/messaging/errors";
import { paymentErrors } from "@/payments/errors";

import { accountErrors } from "./account-errors";
import { companyErrors } from "./company-errors";
import type { ErrorCatalog } from "./error-presentation";
import { errorPresentation } from "./errors";
import { galleryErrors } from "./gallery-errors";
import { publicErrorPresentation, publicErrors } from "./public-errors";

const shellCatalogs: Record<string, ErrorCatalog> = {
  identityErrors,
  jobManagementErrors,
  paymentErrors,
  disputeErrors,
  galleryErrors,
  companyErrors,
  messagingErrors,
  addressErrors,
  accountErrors,
};

describe("herkese açık hata kataloğu", () => {
  it("ilan sayfasının reddettiği başvuruyu kendi cümlesiyle karşılar", () => {
    // Bu kodlar `applyToJobAction`'dan geliyor ve ilan sayfası kabuğun tam
    // kataloğunu taşımıyor; burada olmasalardı aile metnine düşerlerdi.
    expect(publicErrorPresentation("APPLICANT_IDENTITY_NOT_VERIFIED", 400).title).toBe(
      "Kimliğini doğrulaman gerekiyor",
    );
    expect(publicErrorPresentation("JOB_APPLICATION_USER_ALREADY_APPLIED_TO_JOB", 400).title).toBe(
      "Bu ilana zaten başvurdun",
    );
    expect(publicErrorPresentation("TOKEN_EXPIRED", 401)).toEqual({
      title: "Oturumun sona erdi",
      message: "Devam etmek için yeniden giriş yap.",
      action: "login",
    });
  });

  it("ilan listesinin sıralama ve aralık 400'ünü kendi cümlesiyle karşılar", () => {
    expect(publicErrorPresentation("PAGE_SORT_FIELD_NOT_ALLOWED", 400)).toEqual({
      title: "Bu sıralama desteklenmiyor",
      message: "Listeyi sayfadaki sıralama seçeneklerinden biriyle yeniden açabilirsin.",
      action: "none",
    });
    // Ters Instant bean validation: özel kod yok, kategori adı VALIDATION_FAILED.
    expect(publicErrorPresentation("VALIDATION_FAILED", 400)).toEqual({
      title: "Bilgileri kontrol et",
      message: "Gönderdiğin bilgilerden bazıları geçerli değil.",
      action: "none",
    });
  });

  it("kabuk cümlelerini taşımaz ve onları aile metnine düşürür", () => {
    // Bilinçli takas: ödeme reddi herkese açık bir sayfada görünmez, ama
    // görünürse kullanıcı ham kodu değil ailesinin nötr Türkçesini okur.
    expect(publicErrorPresentation("PAYMENT_PROVIDER_UNAVAILABLE", 502)).toEqual({
      title: "Hizmete ulaşılamıyor",
      message: "Bağlı hizmet şu anda yanıt vermiyor. Biraz sonra yeniden dene.",
      action: "retry",
    });
    expect(publicErrorPresentation("NEW_INTERNAL_DETAIL", 500).title).toBe("Bir sorun oluştu");
  });

  it("kabuk kataloğu herkese açık cümleleri değiştirmeden içerir", () => {
    // İki katalog aynı kodda farklı cümle söyleseydi kullanıcı ilan sayfası
    // ile kabuk arasında iki ayrı Koala görürdü.
    for (const code of Object.keys(publicErrors)) {
      expect(errorPresentation(code, 400), code).toEqual(publicErrorPresentation(code, 400));
    }
  });

  it("alan katalogları birbirinin ve herkese açık kataloğun kodunu yeniden yazmaz", () => {
    // Yayılma sırasında sonraki katalog öncekini sessizce ezer; aynı kodun
    // iki dosyada durması bir gün ikisinden birinin görünmez kalması demek.
    const owners = new Map<string, string>();
    const duplicated: string[] = [];
    for (const [name, catalog] of [["publicErrors", publicErrors], ...Object.entries(shellCatalogs)] as const) {
      for (const code of Object.keys(catalog)) {
        const owner = owners.get(code);
        if (owner) duplicated.push(`${code}: ${owner} ve ${name}`);
        owners.set(code, name);
      }
    }

    expect(duplicated).toEqual([]);
  });
});
