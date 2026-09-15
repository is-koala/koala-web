import type { ActionFor } from "@/lib/form-state";

import type { TransportPlan } from "./contract";

/**
 * İşverenin plan düzenleyicisi ile sunucu action'ının paylaştığı durum.
 *
 * `FormState`'ten ayrı, çünkü bitişte **kaydedilen plan** geri geliyor: form
 * ondan yeniden kuruluyor ki yeni açılan servis/durak kimliklerini alsın ve
 * ikinci kayıt onları yerinde güncellesin (kimliksiz gönderim yeni kayıt
 * açar ve eskisini koltuklarıyla siler). 404 ve 409'da da güncel plan
 * taşınıyor: reddin nedeni çoğu zaman planın bu sırada değişmiş olması.
 */
export type TransportPlanFormState =
  | { status: "idle" }
  | { status: "done"; plan: TransportPlan }
  | {
      status: "error";
      errorCode: string;
      httpStatus: number;
      fieldErrors?: Readonly<Record<string, string>>;
      /** Redden sonra sunucudan yeniden okunan plan; okunamadıysa `undefined`. */
      plan?: TransportPlan | null;
    };

export const idleTransportPlanFormState: TransportPlanFormState = { status: "idle" };

export type TransportPlanFormAction = ActionFor<TransportPlanFormState>;
