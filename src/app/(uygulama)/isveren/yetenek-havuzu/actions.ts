"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import type { TalentPoolRemovalState } from "@/applications/employer-review";
import { talentPoolPath } from "@/lib/app-routes";
import { isUuid } from "@/lib/identifiers";
import { removeFromTalentPool } from "@/server/applications/employer-review";
import { failureView, textField } from "@/server/form";
import { requireSessionForCurrentPath } from "@/server/session/guard";

/**
 * Havuzdan çıkarma.
 *
 * Uç havuzda olmayan bir kaydı sessizce kabul ediyor
 * (`TalentPoolManager.remove`), bu yüzden iki sekmeden aynı adayı çıkarmak
 * hata üretmez; ekran her iki durumda da güncel listeyi gösterir.
 */
export async function removeTalentPoolEntryAction(
  _state: TalentPoolRemovalState,
  formData: FormData,
): Promise<TalentPoolRemovalState> {
  void _state;
  await requireSessionForCurrentPath();

  const workerId = textField(formData, "workerId");
  if (!isUuid(workerId)) {
    return { status: "error", errorCode: "VALIDATION_FAILED", httpStatus: 400 };
  }

  try {
    await removeFromTalentPool(workerId);
    revalidatePath(talentPoolPath);
    return { status: "done" };
  } catch (error) {
    unstable_rethrow(error);
    return { status: "error", ...failureView(error) };
  }
}
