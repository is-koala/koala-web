import type { ErrorCatalog } from "@/lib/error-presentation";

import { identityChipPaUnavailableErrorCode } from "./handoff";

/**
 * Kimlik belgesi yükleme ekranının (`/kimlik-dogrula`) hata metinleri.
 *
 * Başvurunun kendi kimlik reddi (`APPLICANT_IDENTITY_NOT_VERIFIED`) burada
 * değil, `@/lib/public-errors` içinde: o kod ilan sayfasında görünüyor ve
 * ilan sayfasının paketi bu modülü taşımıyor.
 */
export const identityErrors: ErrorCatalog = {
  IDENTITY_DOCUMENTS_ALREADY_PENDING: {
    title: "Belgelerin zaten incelemede",
    message:
      "Gönderdiğin kimlik fotoğrafları hâlâ inceleniyor. Sonuçlanmadan yeni bir yükleme yapılamaz.",
    action: "none",
  },
  IDENTITY_DOCUMENTS_NOT_FOUND: {
    title: "Henüz belge göndermedin",
    message: "Dört kimlik fotoğrafını yükleyerek incelemeye gönderebilirsin.",
    action: "none",
  },
  IDENTITY_DOCUMENTS_REQUIRED: {
    title: "Kimlik fotoğrafları eksik",
    message: "Yüz, TCKK ön, TCKK arka ve TCKK yüzün altında fotoğraflarının dördünü de yüklemelisin.",
    action: "none",
  },
  [identityChipPaUnavailableErrorCode]: {
    title: "Tarayıcı çip okuyamaz",
    message:
      "Tarayıcı kimlik belgesinin çipini okuyamaz. Dört kimlik fotoğrafını yükleyerek incelemeye gönderebilirsin.",
    action: "none",
  },
};
