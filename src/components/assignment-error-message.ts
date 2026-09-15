import { assignmentNotFoundMessage } from "@/assignments/contract";
import { errorPresentation } from "@/lib/errors";

/**
 * Atama eylemlerinin ortak `errorCode` → cümle çözümü.
 *
 * Dört bölüm (tamamlama, sonuçlandırma, değerlendirme, kimlik görüntüleme)
 * aynı üç adımı atıyordu: önce bölümün kendi cümleleri, sonra
 * `JOB_ASSIGNMENT_NOT_FOUND` için ortak cümle (backend var/yok sızdırmıyor,
 * ekran da ayırt etmiyor — §2d2), en sonda kabuk kataloğu. Sıra önemli:
 * bölümün cümlesi kataloğun aile metnini eziyor, çünkü aile metni ("başka bir
 * duruma geçmiş olabilir") doğru ama ne yapılacağını söylemiyor.
 */
export function assignmentErrorMessage(
  errorCode: string,
  httpStatus: number,
  own: Readonly<Record<string, string>> = {},
): string {
  if (Object.hasOwn(own, errorCode)) return own[errorCode];
  if (errorCode === "JOB_ASSIGNMENT_NOT_FOUND") return assignmentNotFoundMessage;
  return errorPresentation(errorCode, httpStatus).message;
}
