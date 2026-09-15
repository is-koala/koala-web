import type { ErrorCatalog } from "@/lib/error-presentation";

import { serviceAreaNotice } from "./contract";

// Adres ağ geçidinin kodları `validation` ve `external` ailelerine düşüyor;
// aile metinleri ("Bilgileri kontrol et") burada yanlış olurdu, çünkü
// kullanıcının düzeltebileceği bir alan yok ya da yapılacak iş farklı.
export const addressErrors: ErrorCatalog = {
  ADDRESS_SEARCHCANDIDATE_OUTSIDESERVICEAREA: {
    title: "Bu adres hizmet alanımızın dışında",
    message: serviceAreaNotice,
    action: "none",
  },
  ADDRESS_SEARCHPROVIDER_UNAVAILABLE: {
    title: "Adres araması şu anda çalışmıyor",
    message: "Adres alanlarını elle doldurup devam edebilirsin.",
    action: "retry",
  },
  ADDRESS_CANDIDATETOKEN_INVALID: {
    title: "Adres onayının süresi doldu",
    message: "Adresi yeniden aratıp listeden seçmen gerekiyor.",
    action: "retry",
  },
  ADDRESS_SEARCHSESSION_INVALID: {
    title: "Aramayı yeniden başlatmamız gerekti",
    message: "Aynı adresi yeniden aratabilirsin; yazdıkların duruyor.",
    action: "retry",
  },
  ADDRESS_SEARCHCANDIDATE_INVALID: {
    title: "Aramayı yeniden başlatmamız gerekti",
    message: "Aynı adresi yeniden aratabilirsin; yazdıkların duruyor.",
    action: "retry",
  },
  ADDRESS_SEARCHQUERY_INVALID: {
    title: "Arama en az 3 karakter olmalı",
    message: "Sokak ya da mahalle adının birkaç harfini daha yaz.",
    action: "none",
  },
  ADDRESS_REVERSE_NORESULT: {
    title: "Bu konum için adres bulunamadı",
    message: "Konumu biraz oynatabilir ya da adres alanlarını elle doldurabilirsin.",
    action: "none",
  },
};
