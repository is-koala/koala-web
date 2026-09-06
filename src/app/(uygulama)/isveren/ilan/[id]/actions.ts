"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import { publishedJobPath } from "@/lib/app-routes";
import { isUuid } from "@/lib/identifiers";
import { isJobLifecycleOperation, type JobLifecycleState } from "@/jobs/lifecycle";
import { failureView, textField } from "@/server/form";
import { cancelJob, closeJob } from "@/server/jobs/jobs";
import { requireSessionForCurrentPath } from "@/server/session/guard";

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
