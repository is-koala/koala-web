"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { appShells, companyProfilePath } from "@/lib/app-routes";
import type { FormState } from "@/lib/form-state";
import { isUuid } from "@/lib/identifiers";
import { answerInvitation } from "@/server/company/invitations";
import { failureState, textField, validationState } from "@/server/form";
import { requireSessionForCurrentPath } from "@/server/session/guard";

/**
 * Daveti cevaplar.
 *
 * Kabul ve ret **aynı uca** gidiyor; ayıran şey gövdedeki `accepted` ve o
 * bayrak formdan açıkça geliyor. Eksik ya da tanınmayan bir değeri `false`
 * saymak, kullanıcının kabul etmek isterken sessizce reddetmesine yol
 * açabilirdi — ve karar geri alınamıyor.
 *
 * Sahiplik burada denetlenmiyor: uç kendi kapısını taşıyor
 * (`CompanyContactInvitationManager.java:93-95`, 403) ve reddi
 * `USER_NOT_ASSOCIATED_WITH_INVITATION` koduyla geliyor. Ekran aksiyonları
 * zaten çizmiyor; buradaki karşılama, iki sekmede açık bir sayfa ya da geri
 * düğmesi için.
 */
export async function answerInvitationAction(
  invitationId: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  void _state;

  await requireSessionForCurrentPath();

  // Kimlik adres çubuğundan geliyor; sayfa da aynı denetimi yapıyor ama
  // action sayfadan bağımsız çağrılabilir.
  if (!isUuid(invitationId)) {
    return validationState({ record: "Davet bağlantısı geçerli değil." });
  }

  const answer = textField(formData, "accepted");
  if (answer !== "true" && answer !== "false") {
    return validationState({ accepted: "Kararını iki düğmeden biriyle bildir." });
  }
  const accepted = answer === "true";

  let answered;
  try {
    answered = await answerInvitation(invitationId, accepted);
  } catch (error) {
    return failureState(error);
  }

  if (!accepted) {
    // Ret sayfayı değiştirmiyor: nötr kapanış ekranı formun yerine geçiyor
    // ve hesapta hiçbir şeyin değişmediğini yazıyor.
    return { status: "done" };
  }

  /*
   * Kabul `GET /users/me` yanıtını değiştiriyor: yeni üyelik `companies[]`
   * listesine giriyor. Kabuğun önbelleklediği kullanıcı verisi tazelenmezse
   * `/isveren/sirket` kullanıcıya boş görünür — yani kabul ettiği şirket
   * yokmuş gibi.
   */
  revalidatePath(appShells.employer.root, "layout");

  redirect(
    answered.company.id ? companyProfilePath(answered.company.id) : appShells.employer.root,
  );
}
