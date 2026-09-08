"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";

import {
  isApplicationDecision,
  isTalentPoolOperation,
  type ApplicantDossierState,
  type ApplicationDecisionState,
  type ConversationState,
  type TalentPoolState,
} from "@/applications/employer-review";
import { jobApplicantsPath, talentPoolPath } from "@/lib/app-routes";
import { isUuid } from "@/lib/identifiers";
import {
  openApplicantConversation,
  readApplicantDossier,
  readTalentPoolMembership,
  removeFromTalentPool,
  respondToApplication,
  saveToTalentPool,
} from "@/server/applications/employer-review";
import { failureView, textField } from "@/server/form";
import { requireSessionForCurrentPath } from "@/server/session/guard";

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
 * Başvurunun kabul ya da reddi.
 *
 * Ekranın tek geri alınamaz eylemi. Kabul bir atama kuruyor, ilanın
 * kontenjanından bir yer tüketiyor ve ADR-0003 uyarınca tam iş adresini
 * çalışana açıyor; sunucu ikinci bir karara `JOB_APPLICATION_ALREADY_RESPONDED`
 * (409) ile karşılık veriyor. Kart bu yüzden kararı **kendi durumunda**
 * kilitliyor ve eylem sunucudan gelen kimliği geri taşıyor.
 *
 * Yetki denetimi burada tekrar edilmiyor ve edilmemeli: backend yetkisiz
 * çağırana başvurunun varlığını sızdırmadan 404 veriyor
 * (`assertCurrentUserIsEmployerOf`). İstemcide bir kopya kural yazmak, iki
 * tarafın ayrışabileceği ikinci bir doğruluk kaynağı olurdu.
 */
export async function applicantDecisionAction(
  _state: ApplicationDecisionState,
  formData: FormData,
): Promise<ApplicationDecisionState> {
  void _state;
  await requireSessionForCurrentPath();

  const applicationId = textField(formData, "applicationId");
  const jobId = textField(formData, "jobId");
  const decision = textField(formData, "decision");
  const rejectionReason = textField(formData, "rejectionReason");

  if (!isUuid(applicationId) || !isUuid(jobId) || !isApplicationDecision(decision)) {
    return {
      status: "error",
      applicationId: isUuid(applicationId) ? applicationId : "",
      errorCode: "VALIDATION_FAILED",
      httpStatus: 400,
    };
  }

  // Gerekçe sözleşmede isteğe bağlı (`AnswerApplicationDto` üzerinde `@Size`
  // bile yok) ama #80 onu zorunlu tutuyor: adayın okuyacağı tek açıklama bu ve
  // boş bırakılan alan sunucuda `null` olarak kalıcılaşırdı.
  if (decision === "REJECTED" && rejectionReason.trim() === "") {
    return {
      status: "error",
      applicationId,
      errorCode: "DECISION_REASON_REQUIRED",
      httpStatus: 400,
    };
  }

  try {
    const outcome = await respondToApplication({ applicationId, decision, rejectionReason });
    // Liste sunucudan iniyor: tazelenmezse aynı kart bir sonraki gezinmede
    // yine `APPLIED` görünürdü.
    revalidatePath(jobApplicantsPath(jobId));
    return { status: "done", applicationId, outcome };
  } catch (error) {
    unstable_rethrow(error);
    return { status: "error", applicationId, ...failureView(error) };
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
