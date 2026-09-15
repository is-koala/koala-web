import { parseTransportPlanField, serializeTransportPlanDraft, type TransportPlanDraft } from "./plan-form";

/**
 * Sihirbazdan ilan sayfasına taşınan ulaşım taslağı (is-koala/koala-web#187).
 *
 * İlan yaratıldı ama plan yazılamadıysa sunucu action'ı yalnız yönlendirebiliyor
 * (`?ulasim=kaydedilemedi`); kullanıcının yazdıkları o yönlendirmede
 * kaybolurdu. Form gönderimden **önce** taslağı sekmeye özgü `sessionStorage`'a
 * bırakıyor, ilan sayfasındaki düzenleyici okuyup siliyor. Durak adresleri
 * taşınmıyor: adres formu gövdesini tek kullanımlık aday kanıtıyla kuruyor ve
 * kayıt düşmüşse kanıt zaten yanmış olabilir; durak "adres bekliyor" açılır.
 *
 * Depolama kapalı ya da dolu olabilir; taşıma kaybı formu durdurmamalı.
 */
const storageKey = "koala.ilan.ulasim.v1";

export function storeTransportDraftForHandoff(draft: TransportPlanDraft): void {
  try {
    window.sessionStorage.setItem(storageKey, serializeTransportPlanDraft(draft));
  } catch {
    // Depolama yoksa taşınacak bir şey de yok; kayıt düşerse kullanıcı yeniden girer.
  }
}

/** Taşınan taslağı okur ve tek seferlik olduğu için hemen siler. */
export function takeTransportDraftHandoff(): TransportPlanDraft | null {
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    window.sessionStorage.removeItem(storageKey);
    return raw ? parseTransportPlanField(raw) : null;
  } catch {
    return null;
  }
}

export function clearTransportDraftHandoff(): void {
  try {
    window.sessionStorage.removeItem(storageKey);
  } catch {
    // Silinecek bir şey yok.
  }
}
