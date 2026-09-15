"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import { publicJobPath, publishedJobPath } from "@/lib/app-routes";
import { isUuid } from "@/lib/identifiers";
import { isJobLifecycleOperation, type JobLifecycleState } from "@/jobs/lifecycle";
import { ApiError } from "@/server/api/errors";
import { failureState, failureView, textField } from "@/server/form";
import { cancelJob, closeJob } from "@/server/jobs/jobs";
import { requireSessionForCurrentPath } from "@/server/session/guard";
import {
  readTransportPlan,
  readTransportPlanWrite,
  writeTransportPlan,
} from "@/server/transport/transport";
import type { TransportPlan } from "@/transport/contract";
import type { TransportPlanFormState } from "@/transport/editor-state";

/**
 * İlanın durum geçişleri: kapat ve iptal.
 *
 * Geçişin **mümkün olup olmadığına** burada karar verilmiyor. Kuralın tek
 * sahibi sunucu (`JobManager.closeJob` / `cancelJob`) ve iptalin canlı atama
 * koşulu istemciden zaten okunamıyor; ekranda gizlenen düğme bir kolaylık,
 * bu action ise yalnız isteği doğru uca taşıyor ve reddi `errorCode` olarak
 * geri veriyor.
 *
 * Ama **hangi geçişin var olduğuna** burada karar veriliyor: gövde
 * tarayıcıdan geliyor ve yalnız iki işlem adı tanınıyor. Tanınmayan bir ad
 * backend'e hiç sorulmaz.
 */
export async function jobLifecycleAction(
  jobId: string,
  _state: JobLifecycleState,
  formData: FormData,
): Promise<JobLifecycleState> {
  void _state;
  await requireSessionForCurrentPath();

  const operation = textField(formData, "operation");
  if (!isUuid(jobId) || !isJobLifecycleOperation(operation)) {
    return { status: "error", errorCode: "VALIDATION_FAILED", httpStatus: 400 };
  }

  try {
    if (operation === "close") {
      await closeJob(jobId);
    } else {
      await cancelJob(jobId);
    }
    revalidatePath(publishedJobPath(jobId));
    return { status: "done", operation };
  } catch (error) {
    unstable_rethrow(error);
    // Redlerin çoğu ilanın durumunun bu sırada değişmiş olmasından geliyor;
    // kullanıcı hatayı okurken ekranda bayat bir durum görmemeli.
    revalidatePath(publishedJobPath(jobId));
    return { status: "error", ...failureView(error) };
  }
}

/**
 * İlanın ulaşım planını yazar (`PUT /jobs/{jobId}/transport-plan`,
 * is-koala/koala-web#187).
 *
 * Gövde tarayıcıdan geliyor ve burada yeniden süzülüyor
 * (`readTransportPlanWrite`): tanınmayan alan, biçimsiz saat ya da adressiz
 * yeni durak backend'e hiç sorulmuyor. Kapasite ve yön kilidi kuralları
 * backend'de; 409 kodu olduğu gibi forma dönüyor. 404 ve 409'da plan
 * yeniden okunuyor: reddin nedeni çoğu zaman planın bu sırada başka bir
 * cihazdan değişmiş olması ve kullanıcı güncel plan üzerinde düzeltmeli.
 * Herkese açık ilan sayfası ISR'da (`revalidate = 300`); özet oradan da
 * okunduğu için o yol da tazeleniyor.
 */
export async function writeTransportPlanAction(
  jobId: string,
  _state: TransportPlanFormState,
  formData: FormData,
): Promise<TransportPlanFormState> {
  void _state;
  await requireSessionForCurrentPath();

  if (!isUuid(jobId)) {
    return { status: "error", errorCode: "VALIDATION_FAILED", httpStatus: 400 };
  }

  const read = readTransportPlanWrite(formData);
  if (read.status !== "ready") {
    return {
      status: "error",
      errorCode: "VALIDATION_FAILED",
      httpStatus: 400,
      fieldErrors: read.status === "invalid" ? read.fieldErrors : { shuttles: "Ulaşım planı okunamadı." },
    };
  }

  try {
    const plan = await writeTransportPlan(jobId, read.body);
    revalidatePath(publishedJobPath(jobId));
    revalidatePath(publicJobPath(jobId));
    return { status: "done", plan };
  } catch (error) {
    unstable_rethrow(error);
    const failure = failureState(error);
    const conflict =
      error instanceof ApiError && (error.status === 404 || error.status === 409);
    return conflict ? { ...failure, plan: await reloadPlan(jobId) } : failure;
  }
}

async function reloadPlan(jobId: string): Promise<TransportPlan | null> {
  try {
    return await readTransportPlan(jobId);
  } catch (error) {
    unstable_rethrow(error);
    return null;
  }
}
