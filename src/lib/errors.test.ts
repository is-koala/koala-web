import { describe, expect, it } from "vitest";
import { backendErrorFamilies } from "./backend-error-codes";
import { errorPresentation, gateNotice } from "./errors";
import { gateModes, type GateId } from "./gates";
import { privateRoutes } from "./private-routes";

describe("API hata sunumu", () => {
  it("oturum hatasını yeniden giriş eylemine dönüştürür", () => {
    expect(errorPresentation("TOKEN_EXPIRED", 401)).toEqual({
      title: "Oturumun sona erdi",
      message: "Devam etmek için yeniden giriş yap.",
      action: "login",
    });
  });

  it("backend mesaj anahtarından gelen birleşik NOTFOUND kodunu tanır", () => {
    expect(errorPresentation("LOCATION_CITY_NOTFOUND_ID", 404)).toEqual({
      title: "İçerik bulunamadı",
      message: "Aradığın kayıt artık mevcut olmayabilir.",
      action: "home",
    });
  });

  it("backend hız sınırı kodunu yeniden deneme eylemine dönüştürür", () => {
    expect(errorPresentation("AUTH_TOO_MANY_REQUESTS", 429)).toEqual({
      title: "Çok fazla deneme yaptın",
      message: "Kısa bir süre bekleyip yeniden dene.",
      action: "retry",
    });
  });

  it("web cihaz kimliği eksikliğini nötr yedeğe düşürmez", () => {
    // Kod haritada yoksa geliştirici hatası kullanıcıya "Bir sorun oluştu"
    // diye görünür ve nedeni hiçbir yerde yazmaz.
    expect(errorPresentation("AUTH_WEB_DEVICE_ID_REQUIRED", 400)).toEqual({
      title: "Bilgileri kontrol et",
      message: "Gönderdiğin bilgilerden bazıları geçerli değil.",
      action: "none",
    });
  });

  it("alan doğrulaması başarısız olduğunda kontrol mesajı gösterir", () => {
    // `GlobalExceptionHandler` alan hatalarına özel kod üretmiyor: kod null
    // geçilince `ErrorResult` onu kategori adına, yani VALIDATION_FAILED'e
    // düşürüyor. Haritada olmazsa form nötr "Bir sorun oluştu" gösterirdi.
    expect(errorPresentation("VALIDATION_FAILED", 400)).toEqual({
      title: "Bilgileri kontrol et",
      message: "Gönderdiğin bilgilerden bazıları geçerli değil.",
      action: "none",
    });
  });

  it("hizmet alanı dışı adresi 'bilgileri kontrol et' yerine nedeniyle anlatır", () => {
    // Kod `validation` ailesine düşseydi kullanıcı hangi bilgiyi
    // düzelteceğini bilemezdi; sınırın dışında düzeltilecek bir alan yok.
    expect(errorPresentation("ADDRESS_SEARCHCANDIDATE_OUTSIDESERVICEAREA", 400)).toEqual({
      title: "Bu adres hizmet alanımızın dışında",
      message: "Koala şu anda yalnızca İstanbul'da hizmet veriyor.",
      action: "none",
    });
  });

  it("adres sağlayıcısı düştüğünde elle devam yolunu gösterir", () => {
    expect(errorPresentation("ADDRESS_SEARCHPROVIDER_UNAVAILABLE", 502)).toEqual({
      title: "Adres araması şu anda çalışmıyor",
      message: "Adres alanlarını elle doldurup devam edebilirsin.",
      action: "retry",
    });
  });

  it("tüketilmiş aday kanıtını yeniden aramaya yönlendirir", () => {
    expect(errorPresentation("ADDRESS_CANDIDATETOKEN_INVALID", 400)).toEqual({
      title: "Adres onayının süresi doldu",
      message: "Adresi yeniden aratıp listeden seçmen gerekiyor.",
      action: "retry",
    });
  });

  it("bilinmeyen backend mesajını kullanıcıya göstermez", () => {
    expect(errorPresentation("NEW_INTERNAL_DETAIL", 500)).toEqual({
      title: "Bir sorun oluştu",
      message: "İşlemi şu anda tamamlayamadık. Biraz sonra yeniden dene.",
      action: "retry",
    });
  });

  it("ödeme reddini backend mesajına ihtiyaç duymadan kullanıcı eylemine çevirir", () => {
    expect(errorPresentation("JOB_ASSIGNMENT_ADDRESS_NOT_PROVIDED_FOR_EMPLOYER", 400)).toEqual({
      title: "Fatura adresi eksik",
      message: "Ödeme alınmadı. Fatura adresini tamamladıktan sonra yeniden deneyebilirsin.",
      action: "none",
    });
    expect(errorPresentation("PAYMENT_PROVIDER_UNAVAILABLE", 502)).toEqual({
      title: "Ödeme sağlayıcısına ulaşılamadı",
      message: "Kartından ödeme alınmadı. Biraz sonra yeniden deneyebilirsin.",
      action: "retry",
    });
    expect(errorPresentation("PAYMENT_PAGE_URL_REJECTED", 502).title).toBe(
      "Güvenli ödeme sayfası açılamadı",
    );
  });
});

describe("kapı metinleri", () => {
  it("kimlik kapısını nedeniyle ve gidilecek yolla anlatır", () => {
    // Aile metni ("Bilgileri kontrol et") burada yanlış olurdu: düzeltilecek
    // bir form alanı yok, yapılacak iş kimlik doğrulamak.
    const notice = gateNotice("identityVerification");

    expect(notice.title).toBe("Kimliğini doğrulaman gerekiyor");
    expect(notice.remedy?.href).toBe("/uygulamayi-ac");
  });

  it("iki fatura adresi kapısını farklı metinlerle anlatır", () => {
    // Ödeme, şirket ilanında **şirketin** adresini okuyor
    // (`JobAssignmentManager.java:316-326`), kullanıcınınkini değil; tek metin
    // iki durumu da yanlış anlatır.
    const individual = gateNotice("individualBillingAddress");
    const company = gateNotice("companyBillingAddress");

    expect(individual.message).not.toBe(company.message);
    expect(individual.title).not.toBe(company.title);
  });

  it("her kapı önlediği backend kodunu yazılı taşır", () => {
    // Kapı ile arkasındaki reddin eşleşmesi yazılı olmazsa, backend koşulu
    // değiştiğinde kapının bayatladığını kimse fark etmez.
    expect(gateNotice("employerRole").errorCodes).toEqual(["JOB_USER_IS_NOT_EMPLOYER"]);
    expect(gateNotice("identityNumber").errorCodes).toEqual([
      "JOB_ASSIGNMENT_EMPLOYER_IDENTITY_NOT_VERIFIED",
    ]);
  });

  it("şirket onayı kapısının backend'de karşılığı olmadığını yazılı tutar", () => {
    // `company.isApproved()` iş mantığında hiç okunmuyor: bu kapı bir ürün
    // kuralı, güvenlik sınırı değil. Boş liste onu söylemenin tek yolu.
    expect(gateNotice("companyApproval").errorCodes).toEqual([]);
  });
});

describe("kapı sözlüğünün bütünlüğü", () => {
  it("her kapının bildirdiği kod backend haritasında gerçekten var", () => {
    // Elle yazılmış bir kod, backend sabiti yeniden adlandırıldığında sessizce
    // bayatlar; harita bunu yakalayan tek yer.
    const unknown = (Object.keys(gateModes) as GateId[]).flatMap((gate) =>
      gateNotice(gate).errorCodes.filter((code) => backendErrorFamilies[code] === undefined),
    );

    expect(unknown).toEqual([]);
  });

  it("bireysel ilanın üç reddini adıyla, aile metnine düşmeden karşılar", () => {
    // Üçü de aile metniyle ("Bilgileri kontrol et", "Bu işlem için yetkin
    // yok") anlaşılmaz kalırdı: kullanıcının yapması gereken şey her birinde
    // farklı ve hiçbiri "bilgileri kontrol etmek" değil.
    expect(errorPresentation("JOB_INDIVIDUAL_JOB_CANNOT_REQUIRE_INSURANCE", 400).title).toBe(
      "Bu kategori bireysel ilanla açılamıyor",
    );
    expect(errorPresentation("JOB_INDIVIDUAL_EMPLOYER_IDENTITY_NOT_VERIFIED", 400).title).toBe(
      "Kimliğini doğrulaman gerekiyor",
    );
    expect(errorPresentation("JOB_USER_IS_NOT_EMPLOYER", 403).title).toBe(
      "Bu hesap işveren hesabı değil",
    );
  });

  it("kapının gösterdiği yol gerçekten var olan bir rota", () => {
    // Var olmayan bir adrese yollayan kapı, kapı olmamasından kötü: kullanıcı
    // eksiğini öğrenip 404'e düşer.
    const known = new Set<string>(privateRoutes);

    for (const gate of Object.keys(gateModes) as GateId[]) {
      const remedy = gateNotice(gate).remedy;
      if (remedy === null) continue;
      expect(known.has(remedy.href), `${gate} → ${remedy.href}`).toBe(true);
    }
  });

  it("her kapı Türkçe başlık ve gerekçe taşır", () => {
    for (const gate of Object.keys(gateModes) as GateId[]) {
      const notice = gateNotice(gate);
      expect(notice.title.trim().length, gate).toBeGreaterThan(0);
      expect(notice.message.trim().length, gate).toBeGreaterThan(0);
    }
  });
});
