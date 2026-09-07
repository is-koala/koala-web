"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";

import {
  isTalentPoolOperation,
  type ApplicantDossierState,
  type ConversationState,
  type TalentPoolState,
} from "@/applications/employer-review";
import { isUuid } from "@/lib/identifiers";
import {
  openApplicantConversation,
  readApplicantDossier,
  readTalentPoolMembership,
  removeFromTalentPool,
  saveToTalentPool,
} from "@/server/applications/employer-review";
import { failureView, textField } from "@/server/form";
import { requireSessionForCurrentPath } from "@/server/session/guard";

/** Havuz listesinin adresi; eylem onu tazelemek zorunda. */
const talentPoolPath = "/isveren/yetenek-havuzu";

/**
 * Aday paneli.
 *
 * Panel bir alt rota değil, bu yüzden veri bir action ile geliyor: liste
 * sunucudan bir kez indi ve tek bir adaya bakmak için 500 kaydın yeniden
 * indirilmesi gerekmiyor.
 *
 * Kimlik durumun içinde geri taşınıyor — liste tek bir `useActionState`
 * paylaşıyor ve panelin hangi kartın altına çizileceği başka türlü okunamaz.
 */
export async function applicantDossierAction(
  _state: ApplicantDossierState,
  formData: FormData,
): Promise<ApplicantDossierState> {
  void _state;
  await requireSessionForCurrentPath();

  const userId = textField(formData, "userId");
  if (!isUuid(userId)) {
    return { status: "error", userId: "", errorCode: "VALIDATION_FAILED", httpStatus: 400 };
  }

  try {
    return { status: "done", userId, dossier: await readApplicantDossier(userId) };
  } catch (error) {
    unstable_rethrow(error);
    return { status: "error", userId, ...failureView(error) };
  }
}

/**
 * Yetenek havuzuna ekleme ve çıkarma.
 *
 * Yanıt güncel kimlik kümesini taşıyor: rozet ilk sunucu okumasında donsaydı
 * kullanıcı eklediği adayı sayfayı yenilemeden havuzda göremezdi. Redde de
 * bilinen küme korunuyor — geçici bir hata yüzünden bütün rozetleri kaybetmek
 * ekranı gerçekten yanlış gösterirdi.
 */
export async function applicantTalentPoolAction(
  state: TalentPoolState,
  formData: FormData,
): Promise<TalentPoolState> {
  await requireSessionForCurrentPath();

  const workerId = textField(formData, "workerId");
  const operation = textField(formData, "operation");
  if (!isUuid(workerId) || !isTalentPoolOperation(operation)) {
    return { status: "error", errorCode: "VALIDATION_FAILED", httpStatus: 400, ...known(state) };
  }

  try {
    if (operation === "add") {
      await saveToTalentPool(workerId, textField(formData, "note"));
    } else {
      await removeFromTalentPool(workerId);
    }
    revalidatePath(talentPoolPath);
    return { status: "done", workerIds: [...(await readTalentPoolMembership())] };
  } catch (error) {
    unstable_rethrow(error);
    return { status: "error", ...failureView(error), ...known(state) };
  }
}

/**
 * Aday ile konuşma başlatma.
 *
 * Faz 2'nin payına yalnız ucu çağırmak ve mesaj kabuğuna bırakmak düşüyor;
 * konuşmanın kendisi mesajlaşma ekranında. Uç var olan konuşmayı da aynı
 * yanıtla döndürdüğü için ikinci tıklama yeni kayıt açmıyor.
 */
export async function applicantConversationAction(
  _state: ConversationState,
  formData: FormData,
): Promise<ConversationState> {
  void _state;
  await requireSessionForCurrentPath();

  const jobId = textField(formData, "jobId");
  const workerId = textField(formData, "workerId");
  if (!isUuid(jobId) || !isUuid(workerId)) {
    return { status: "error", errorCode: "VALIDATION_FAILED", httpStatus: 400 };
  }

  let conversationId: string;
  try {
    conversationId = await openApplicantConversation(jobId, workerId);
  } catch (error) {
    unstable_rethrow(error);
    return { status: "error", ...failureView(error) };
  }

  // `redirect()` bir istisna atarak çalışıyor; `try` bloğunun dışında kalması
  // gerekiyor, yoksa yönlendirme bir backend hatası gibi yakalanırdı.
  redirect(`/isveren/mesajlar/${encodeURIComponent(conversationId)}`);
}

/** Redde önceki başarılı kümeyi taşımak; hiç okunmamışsa alan hiç yazılmaz. */
function known(state: TalentPoolState): { workerIds?: readonly string[] } {
  if (state.status === "done") return { workerIds: state.workerIds };
  if (state.status === "error" && state.workerIds) return { workerIds: state.workerIds };
  return {};
}
