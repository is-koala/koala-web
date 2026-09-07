/**
 * İlanın kaç kişilik olduğu ve kaçının işe alındığı.
 *
 * `JobDetailDto` iki alan taşıyor: `headcount` (null ise sınırsız) ve
 * `hiredCount`. İkincisi saklanmıyor, her okumada sayılıyor
 * (`JobManager.java:293-299`).
 */

export type HeadcountStatus = {
  /** `null` ise ilan sınırsız kişilik. */
  readonly headcount: number | null;
  readonly hiredCount: number;
  /** Sınırsız ilanda `null`; hiç eksiye düşmez. */
  readonly remaining: number | null;
  readonly full: boolean;
  readonly summary: string;
  /**
   * Kalan sayının kesin olmadığı durumun yazılı hâli; kesin olduğunda `null`.
   *
   * İki küme ayrışıyor: `hiredCount` yalnız {CONFIRMED, IN_PROGRESS,
   * COMPLETED} sayıyor (`JobManager.java:278-280`), kabul kapısı ise
   * `PENDING_CONFIRMATION` teklifleri de yer kaplıyor sayıyor
   * (`JobAssignmentManager.java:71-73`). Yani "1 kişilik yer kaldı" yazan bir
   * ilan, bekleyen bir teklif varken kabulü 409 ile reddedebiliyor. Ekran
   * sayıyı gizlemiyor ama neye baktığını da söylüyor.
   */
  readonly caveat: string | null;
};

const pendingOfferCaveat =
  "Kalan kontenjan yalnız onaylanmış atamaları sayar; işçinin cevabını bekleyen teklifler de yer kaplıyor.";

export function jobHeadcount(input: {
  headcount: number | null;
  hiredCount: number;
}): HeadcountStatus {
  const hiredCount = Math.max(0, input.hiredCount);

  if (input.headcount === null) {
    return {
      headcount: null,
      hiredCount,
      remaining: null,
      full: false,
      summary: `${hiredCount} kişi işe alındı`,
      caveat: null,
    };
  }

  const remaining = Math.max(0, input.headcount - hiredCount);
  return {
    headcount: input.headcount,
    hiredCount,
    remaining,
    full: remaining === 0,
    summary:
      remaining === 0
        ? `${hiredCount} / ${input.headcount} kişi işe alındı — kontenjan doldu`
        : `${hiredCount} / ${input.headcount} kişi işe alındı — ${remaining} kişilik yer kaldı`,
    caveat: remaining === 0 ? null : pendingOfferCaveat,
  };
}
