import { describe, expect, it } from "vitest";

import { jobDetailDto } from "../../../tests/support/job-detail";

import { toJobDetail, toPricing } from "./job-detail-dto";

/**
 * İki sunucu sürümü aynı çeviriciden geçiyor (is-koala/koala-web#181).
 *
 * Eski sunucu herkese tam dökümü gönderiyordu; 0.9.27 herkese açık ve işçi
 * görünümünde ücret alanlarını null bırakıyor (is-koala/koala-backend#304).
 * Eski kural üç tutarı da zorunlu sayıyor ve yeni yanıtta kazancı da
 * düşürüyordu: ilan sayfası "Kazanç bilgisi paylaşılmadı" yazardı.
 */
describe("ilan fiyat anlık görüntüsünün çevirisi", () => {
  it("eski sunucunun tam dökümünü olduğu gibi taşır", () => {
    const job = toJobDetail(jobDetailDto());

    expect(job.pricing).toEqual({
      pricingVersion: "2026-09",
      currency: "TRY",
      workerPayout: "1250.00",
      serviceFeeRate: "0.20",
      serviceFeeAmount: "250.00",
      employerTotal: "1500.00",
    });
  });

  it("ücret alanları null gelen herkese açık görünümde kazancı korur", () => {
    const job = toJobDetail(
      jobDetailDto({
        pricing: {
          pricingVersion: "2026-09",
          currency: "TRY",
          workerPayout: "1250.00",
          serviceFeeRate: null,
          serviceFeeAmount: null,
          employerTotal: null,
        },
      }),
    );

    expect(job.pricing).toEqual({
      pricingVersion: "2026-09",
      currency: "TRY",
      workerPayout: "1250.00",
      serviceFeeRate: null,
      serviceFeeAmount: null,
      employerTotal: null,
    });
  });

  it("kazanç ya da para birimi yoksa anlık görüntüyü hiç kurmaz", () => {
    expect(toPricing({ currency: "TRY", workerPayout: null, employerTotal: "1500.00" })).toBeNull();
    expect(toPricing({ currency: " ", workerPayout: "1250.00" })).toBeNull();
    expect(toPricing(null)).toBeNull();
  });

  it("yarım dökümü tamamen düşürür: hizmet bedeli ile işveren toplamı birlikte gelir", () => {
    const pricing = toPricing({
      pricingVersion: "2026-09",
      currency: "TRY",
      workerPayout: "1250.00",
      serviceFeeRate: "0.20",
      serviceFeeAmount: "250.00",
      employerTotal: null,
    });

    expect(pricing).toEqual({
      pricingVersion: "2026-09",
      currency: "TRY",
      workerPayout: "1250.00",
      serviceFeeRate: null,
      serviceFeeAmount: null,
      employerTotal: null,
    });
  });
});
