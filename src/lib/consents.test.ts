import { describe, expect, it } from "vitest";

import type { AgreementType } from "@/content/legal/registry";

import {
  agreementLink,
  agreementTitle,
  consentDecisions,
  missingMandatoryConsents,
  type Agreement,
} from "./consents";

function agreement(overrides: Partial<Agreement> & Pick<Agreement, "id" | "type">): Agreement {
  return { version: "1.0", mandatory: false, contentUrl: null, ...overrides };
}

const terms = agreement({ id: "a1", type: "TERMS_OF_SERVICE", mandatory: true });
const privacy = agreement({ id: "a2", type: "PRIVACY_POLICY", mandatory: true });
const marketing = agreement({ id: "a3", type: "COMMERCIAL_MESSAGE" });

describe("sözleşme onayları", () => {
  it("reddedilen isteğe bağlı sözleşmeyi de granted: false ile taşır", () => {
    // Backend "sormadık" ile "sorduk reddetti" ayrımını tutuyor; eksik
    // gönderilen bir karar denetimde ilk durum sayılır.
    expect(consentDecisions([terms, privacy, marketing], ["a1", "a2"])).toEqual([
      { agreementVersionId: "a1", granted: true },
      { agreementVersionId: "a2", granted: true },
      { agreementVersionId: "a3", granted: false },
    ]);
  });

  it("işaretlenmemiş zorunlu sözleşmeleri sayar", () => {
    expect(missingMandatoryConsents([terms, privacy, marketing], ["a1"])).toEqual([privacy]);
  });

  it("zorunluların hepsi işaretliyse engel kalmaz", () => {
    expect(missingMandatoryConsents([terms, privacy, marketing], ["a1", "a2"])).toEqual([]);
  });

  it("bağlantıyı sitenin kendi yasal sayfasından kurar", () => {
    // `contentUrl` backend'de boş ya da yanlış olabilir; yerel karşılık varsa
    // ona güvenilmez.
    expect(agreementLink(agreement({ id: "a1", type: "TERMS_OF_SERVICE", contentUrl: "https://kotu.example" })))
      .toBe("/kullanim-kosullari/v/1.0");
    expect(agreementLink(agreement({ id: "a3", type: "COMMERCIAL_MESSAGE" })))
      .toBe("/kvkk-aydinlatma/v/1.0#ticari-ileti");
  });

  it("backend sürümü yereldekinden farklıysa yerel metne bağlamaz", () => {
    // Kullanıcı onayladığı metni okumalı: v2'yi onaylarken v1.0 sayfasını
    // göstermek rıza kaydıyla gösterilen metni ayrıştırırdı.
    const rolled = agreement({
      id: "a1",
      type: "TERMS_OF_SERVICE",
      version: "2.0",
      contentUrl: "https://iskoala.com/kullanim-kosullari-v2",
    });

    expect(agreementLink(rolled)).toBe("https://iskoala.com/kullanim-kosullari-v2");
    expect(agreementLink({ ...rolled, contentUrl: null })).toBeNull();
  });

  it("onay kutusundaki adı yasal kayıt defterinden alır", () => {
    expect(agreementTitle(terms)).toBe("Kullanım Koşulları");
    expect(agreementTitle(marketing)).toBe("Ticari İleti İzni");
    expect(agreementTitle(agreement({ id: "a9", type: "FUTURE_AGREEMENT" as AgreementType })))
      .toBe("Sözleşme");
  });

  it("yerel karşılığı olmayan tür için contentUrl'e düşer", () => {
    const unknownType = agreement({
      id: "a9",
      type: "FUTURE_AGREEMENT" as AgreementType,
      contentUrl: "https://iskoala.com/yeni-sozlesme",
    });

    expect(agreementLink(unknownType)).toBe("https://iskoala.com/yeni-sozlesme");
  });

  it("yerel karşılığı da adresi de olmayan türe bağlantı vermez", () => {
    expect(agreementLink(agreement({ id: "a9", type: "FUTURE_AGREEMENT" as AgreementType }))).toBeNull();
  });
});
