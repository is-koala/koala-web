import { describe, expect, it } from "vitest";
import { backendErrorFamilies } from "./backend-error-codes";
import { errorPresentation, errorRecoveryAction, gateNotice } from "./errors";
import { gateModes, type GateId } from "./gates";
import { appShells } from "./app-routes";
import { privateRoutes } from "./private-routes";

describe("API hata sunumu", () => {
  it.each(["constructor", "__proto__", "javascript:alert(1)", null, {}, []])(
    "%j eylemini tanımadığında kapalı kalır",
    (action) => {
      expect(errorRecoveryAction(action)).toBeNull();
    },
  );

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

  it("hesap silme duplicate kodunu yeni bir işlem önerisine çevirmeden açıklar", () => {
    expect(errorPresentation("LEGAL_DELETION_ALREADY_REQUESTED", 409)).toEqual({
      title: "Silme talebin zaten var",
      message: "Bekleyen talebinin güncel durumunu görmek için sayfayı yenileyebilirsin.",
      action: "retry",
    });
  });

  it("mesaj şikâyeti idempotency çakışmasını kalıcı ve eylemsiz açıklar", () => {
    expect(errorPresentation("REPORT_IDEMPOTENCY_CONFLICT", 409)).toEqual({
      title: "Bu mesaj için farklı bir şikâyetin var",
      message:
        "Bu mesajı daha önce farklı bilgilerle şikâyet ettin. Mevcut şikâyetin değiştirilemez; moderasyon ekibi onu inceleyecek.",
      action: "none",
    });
  });

  it("mesajlaşmanın ödeme kapısını yetki reddi gibi değil, işverenin adımıyla anlatır", () => {
    // 403 ama `forbidden` ailesi değil: "Bu işlem için yetkin yok" yanlış bir
    // sebep söylerdi. Cümle backend kataloğununki (is-koala/koala-backend#257)
    // ve `MessagingGate` aynı cümleyi önden gösteriyor.
    expect(errorPresentation("MESSAGING_PAYMENT_REQUIRED", 403)).toEqual({
      title: "Mesajlaşma henüz açılmadı",
      message: "Mesajlaşma, işveren ödemeyi tamamladığında açılır.",
      action: "none",
    });
  });

  it("kapanmış mesajlaşma penceresini yeniden deneme önermeden anlatır", () => {
    const presentation = errorPresentation("MESSAGING_WINDOW_CLOSED", 409);

    expect(presentation.title).toBe("Sohbet kapandı");
    expect(presentation.message).toMatch(/yedi gün/);
    expect(presentation.action).toBe("none");
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
    expect(errorPresentation("PAYMENT_ATTEMPT_IN_PROGRESS", 409)).toEqual({
      title: "Ödeme sonucu bekleniyor",
      message: "Devam eden ödeme denemesi kesinleşmeden yeni bir ödeme başlatılamaz.",
      action: "none",
    });
  });

  it("açık uyuşmazlığın para hareketlerini neden durdurduğunu açıklar", () => {
    expect(errorPresentation("DISPUTE_BLOCKS_RELEASE", 409)).toEqual({
      title: "Uyuşmazlık sonuçlanmayı bekliyor",
      message:
        "Açık uyuşmazlık sonuçlanana kadar atama iptal edilemez; emanetteki para iade edilmez veya işçiye aktarılmaz.",
      action: "none",
    });
  });

  it("kanıt hatalarını dosyaya uygun çözüm ve eylemle anlatır", () => {
    expect(backendErrorFamilies.DISPUTE_EVIDENCE_EMPTY).toBe("validation");
    expect(backendErrorFamilies.DISPUTE_EVIDENCE_TOO_LARGE).toBe("validation");
    expect(backendErrorFamilies.DISPUTE_EVIDENCE_LIMIT_REACHED).toBe("conflict");
    expect(backendErrorFamilies.DISPUTE_EVIDENCE_DISPUTE_CLOSED).toBe("conflict");
    expect(backendErrorFamilies.DISPUTE_EVIDENCE_NOT_FOUND).toBe("notFound");
    expect(backendErrorFamilies.DISPUTE_EVIDENCE_UPLOAD_FAILED).toBe("validation");
    expect(errorPresentation("DISPUTE_EVIDENCE_EMPTY", 400)).toEqual({
      title: "Kanıt dosyası boş",
      message: "Boş bir dosya yüklenemez. İçeriği olan bir dosya seçip yeniden dene.",
      action: "none",
    });
    expect(errorPresentation("DISPUTE_EVIDENCE_TOO_LARGE", 400)).toEqual({
      title: "Kanıt dosyası çok büyük",
      message: "Kanıt dosyası 10 MB sınırını aşıyor. Daha küçük bir dosya seçip yeniden dene.",
      action: "none",
    });
    expect(errorPresentation("DISPUTE_EVIDENCE_LIMIT_REACHED", 409)).toEqual({
      title: "Kanıt sınırına ulaşıldı",
      message: "Bu uyuşmazlığa en fazla 5 kanıt dosyası eklenebilir; yeni dosya yükleyemezsin.",
      action: "none",
    });
    expect(errorPresentation("DISPUTE_EVIDENCE_DISPUTE_CLOSED", 409)).toEqual({
      title: "Uyuşmazlık sonuçlandı",
      message: "Sonuçlanmış uyuşmazlığa yeni kanıt eklenemez. Güncel kararı sayfada görebilirsin.",
      action: "none",
    });
    expect(errorPresentation("DISPUTE_EVIDENCE_UPLOAD_FAILED", 400)).toEqual({
      title: "Kanıt yüklenemedi",
      message: "Kanıt dosyasını şu anda yükleyemedik. Biraz sonra yeniden dene.",
      action: "retry",
    });
    expect(errorPresentation("DISPUTE_EVIDENCE_NOT_FOUND", 404)).toEqual({
      title: "Kanıt dosyası bulunamadı",
      message: "Dosya kaldırılmış veya liste bu sırada değişmiş olabilir. Sayfayı yenileyip yeniden dene.",
      action: "retry",
    });
    expect(errorPresentation("STORAGE_UNSUPPORTED_TYPE", 400)).toEqual({
      title: "Dosya biçimi desteklenmiyor",
      message: "PDF, PNG, JPG veya WEBP biçiminde geçerli bir dosya seçip yeniden dene.",
      action: "none",
    });
    expect(errorPresentation("IMAGE_EMPTY_ERROR", 400)).toEqual({
      title: "Görsel boş",
      message: "Boş bir dosya yüklenemez. İçeriği olan bir görsel seçip yeniden dene.",
      action: "none",
    });
    expect(errorPresentation("IMAGE_SIZE_ERROR", 400)).toEqual({
      title: "Görsel çok büyük",
      message: "Görsel 10 MB sınırını aşıyor. Daha küçük bir dosya seçip yeniden dene.",
      action: "none",
    });
    expect(errorPresentation("IMAGE_UPLOAD_ERROR", 400)).toEqual({
      title: "Görsel yüklenemedi",
      message: "Görseli şu anda yükleyemedik. Biraz sonra yeniden dene.",
      action: "retry",
    });
    expect(errorPresentation("GALLERY_LIMIT_EXCEEDED", 409)).toEqual({
      title: "Galeri kotası doldu",
      message:
        "Yeni görsel eklemek için önce mevcutlardan birini kaldırman gerekiyor.",
      action: "none",
    });
    expect(errorPresentation("GALLERY_LIMIT_EXCEEDED", 409).message).not.toMatch(/\b10\b/);
    expect(backendErrorFamilies.IMAGE_EMPTY_ERROR).toBe("validation");
    expect(backendErrorFamilies.IMAGE_SIZE_ERROR).toBe("validation");
    expect(errorPresentation("STORAGE_DOWNLOAD_FAILED", 502)).toEqual({
      title: "Kanıt indirilemedi",
      message: "Kanıt dosyasını şu anda indiremedik. Biraz sonra yeniden dene.",
      action: "retry",
    });
  });
});

describe("şirket yetkilisi hataları", () => {
  it("son yöneticiyi çıkarma reddini ne yapılacağını söyleyerek anlatır", () => {
    // Aile metni ("Bu kayıt başka bir duruma geçmiş olabilir") burada
    // yanlış: kayıt değişmedi, kural gereği bu çıkarma hiç yapılamaz ve
    // kullanıcının atacağı somut bir adım var.
    expect(errorPresentation("COMPANY_LAST_ADMIN_CANNOT_BE_REMOVED", 409)).toEqual({
      title: "Son yöneticiyi çıkaramazsın",
      message:
        "Şirkette en az bir yönetici kalmalı. Önce başka birini yönetici olarak davet et, sonra bu kişiyi çıkarabilirsin.",
      action: "none",
    });
  });

  it("şirket 404'ünü iki nedeni ayırmadan anlatır", () => {
    // Sözleşme bunu bilerek ayırt edilemez bırakıyor: `requireCompanyAdmin`
    // ve `removeContact`'in "bu kişi yetkili değil" dalı aynı kodu taşıyor,
    // ve üyesi olunmayan şirket ile var olmayan şirket bayt bayt aynı yanıtı
    // veriyor (is-koala/koala-backend#85). Metin bir nedeni seçseydi
    // sözleşmenin kapattığı bilgiyi ekranda geri açardı.
    const presentation = errorPresentation("USER_NOT_ASSOCIATED_WITH_COMPANY", 404);

    expect(presentation).toEqual({
      title: "Bu işlemi yapamıyoruz",
      message:
        "Şirket bulunamadı, yöneticisi olmayabilirsin ya da çıkarmak istediğin kişi artık yetkili değil. Sayfayı yenileyip listeyi kontrol et.",
      action: "retry",
    });
  });

  it("aynı kodu farklı HTTP durumunda da aynı metinle karşılar", () => {
    // Dallanma `errorCode` ile yapılıyor, durum koduyla değil: uç düzeltmeden
    // önce 403 döndürüyordu ve duruma bakan bir metin, eski bir dağıtımda
    // sessizce başka bir şey söylerdi.
    expect(errorPresentation("USER_NOT_ASSOCIATED_WITH_COMPANY", 403)).toEqual(
      errorPresentation("USER_NOT_ASSOCIATED_WITH_COMPANY", 404),
    );
  });

  it("davet 404'ünü backend'in belgelediği cümleyle karşılar", () => {
    // Aynı cümle Swagger'da ve `company.contact.invitation.not.found`
    // metninde yazılı; "yok" ile "senin değil" tek bir ekranda buluşuyor.
    expect(errorPresentation("COMPANY_CONTACT_INVITATION_NOT_FOUND", 404)).toEqual({
      title: "Davet bulunamadı",
      message: "Davet bulunamadı ya da size ait değil.",
      action: "home",
    });
  });

  it("şirket kurmanın kimlik reddini doğrulama yoluna bağlar", () => {
    // `CompanyManager.java:103-105` bunu 400 ile döndürüyor ve aile metni
    // "Bilgileri kontrol et" olurdu: formda düzeltilecek bir alan yok,
    // yapılacak iş kimlik doğrulamak.
    const presentation = errorPresentation("USER_MUST_VERIFY_IDENTITY", 400);

    expect(presentation.title).toBe("Kimliğini doğrulaman gerekiyor");
    expect(presentation.message).toContain("Dört kimlik fotoğrafını");
    expect(presentation.action).toBe("none");
  });

  it("tanınmayan şirket türünü alan seçimine bağlar", () => {
    // `CompanyManager.java:94-97` enum'a çeviremediği değeri 400 ile
    // reddediyor; kullanıcının yapacağı iş listeden yeniden seçmek.
    expect(errorPresentation("COMPANY_TYPE_INVALID", 400)).toEqual({
      title: "Şirket türü tanınmadı",
      message: "Listedeki şirket türlerinden birini seçip yeniden dene.",
      action: "none",
    });
  });

  it("başkasına ait daveti sahiplik cümlesiyle karşılar", () => {
    // `CompanyContactInvitationManager.java:93-95` `ForbiddenException` → 403
    // atıyor; aile metni ("Farklı bir hesapla giriş yapabilirsin") kullanıcıyı
    // olmayan bir hesabı aramaya gönderirdi.
    expect(errorPresentation("USER_NOT_ASSOCIATED_WITH_INVITATION", 403)).toEqual({
      title: "Bu davet sana ait değil",
      message:
        "Davet başka bir hesaba gönderilmiş. Daveti bekliyorsan davet edildiğin hesapla giriş yapman gerekiyor.",
      action: "none",
    });
  });

  it("ikinci kez cevaplanan daveti kendi cümlesiyle karşılar", () => {
    // Aile metni ("Bu kayıt başka bir duruma geçmiş olabilir. Sayfayı
    // yenileyip yeniden dene") burada yanlış olurdu: yenilemek işe yaramaz,
    // davet kalıcı olarak cevaplanmış ve geri alınamıyor.
    expect(errorPresentation("INVITATION_ALREADY_ANSWERED", 409)).toEqual({
      title: "Bu davet daha önce cevaplanmış",
      message:
        "Davet bir kez cevaplanıyor ve kararı geri almanın bir yolu yok. Güncel durumu sayfayı yenileyerek görebilirsin.",
      action: "retry",
    });
  });
});

describe("davet sözleşmesinin hata aileleri", () => {
  it("üyelik reddini artık 404 ailesinde tutar", () => {
    // Uç düzeltmeden önce `ForbiddenException` ile 403 dönüyordu; şimdi
    // `ResourceNotFoundException`. Aile "forbidden" kalsaydı, metni yazılı
    // olmayan bir kardeş uç kullanıcıyı "farklı bir hesapla giriş yap"
    // diye yanlış yere gönderirdi.
    expect(backendErrorFamilies.USER_NOT_ASSOCIATED_WITH_COMPANY).toBe("notFound");
  });

  it("başkasına ait davetin reddini forbidden ailesinde tutar", () => {
    // `answerToInvitation` bunu `ForbiddenException` ile atıyor (403), ama
    // Swagger 404 diye belgeliyor. Kod haritada hiç yoksa `errorPresentation`
    // durum koduna düşer ve belgeye göre yazılmış bir 404 sessizce "Aradığın
    // içerik bulunamadı" derdi.
    expect(backendErrorFamilies.USER_NOT_ASSOCIATED_WITH_INVITATION).toBe("forbidden");
  });

  it("zaten yetkili ve zaten bekleyen davet çakışmalarını çakışma ailesine koyar", () => {
    // İkisi de `ConflictException` → 409. `USER_ALREADY_A_CONTACT` önceden
    // `ValidationException` idi ve "Bilgileri kontrol et" derdi; düzeltilecek
    // bir alan yok, kişi gerçekten zaten yetkili.
    expect(backendErrorFamilies.USER_ALREADY_A_CONTACT).toBe("conflict");
    expect(backendErrorFamilies.COMPANY_CONTACT_INVITATION_ALREADY_PENDING).toBe("conflict");
  });
});

describe("kapı metinleri", () => {
  it("kimlik kapısını nedeniyle ve gidilecek yolla anlatır", () => {
    // Aile metni ("Bilgileri kontrol et") burada yanlış olurdu: düzeltilecek
    // bir form alanı yok, yapılacak iş kimlik doğrulamak.
    const notice = gateNotice("identityVerification");

    expect(notice.title).toBe("Kimliğini doğrulaman gerekiyor");
    expect(notice.remedy?.href).toBe("/kimlik-dogrula");
  });

  it("tarayıcının çip PA üretemediğini belge yüklemeye yönlendirir", () => {
    expect(errorPresentation("IDENTITY_CHIP_PA_NOT_AVAILABLE_ON_WEB", 501)).toEqual({
      title: "Tarayıcı çip okuyamaz",
      message:
        "Tarayıcı kimlik belgesinin çipini okuyamaz. Dört kimlik fotoğrafını yükleyerek incelemeye gönderebilirsin.",
      action: "none",
    });
  });

  it("henüz belge gönderilmemiş incelemeyi yükleme çağrısına çevirir", () => {
    expect(errorPresentation("IDENTITY_DOCUMENTS_NOT_FOUND", 404)).toEqual({
      title: "Henüz belge göndermedin",
      message: "Dört kimlik fotoğrafını yükleyerek incelemeye gönderebilirsin.",
      action: "none",
    });
  });

  it("bireysel fatura adresi kapısını web kayıt ekranına yollar", () => {
    const notice = gateNotice("individualBillingAddress");

    expect(notice.remedy).toEqual({
      href: "/isveren/adres",
      label: "Fatura adresini ekle",
    });
  });

  it("şirket fatura adresi kapısını web'deki şirket bölümüne yollar", () => {
    // Düzenleme web'de (is-koala/koala-web#172): bağlantı artık uygulamayı
    // açmıyor, metin de "uygulamadan" ya da "destekle" demiyor. Kapı şirket
    // kimliğini bilmediği için hedef bölüm girişi; tek şirketli kullanıcıyı
    // giriş profile bırakıyor.
    const notice = gateNotice("companyBillingAddress");

    expect(notice.remedy).toEqual({
      href: "/isveren/sirket?bolum=sirket-adresi",
      label: "Şirket adresini düzenle",
    });
    expect(notice.message).not.toMatch(/uygulama/i);
    expect(notice.message).not.toMatch(/destek/i);
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

  it("ilan geçişlerinin üç çakışmasını çakışma aile metnine düşürmez", () => {
    // Üçü de `conflict` ailesinde ve aile metni ("Bu kayıt başka bir duruma
    // geçmiş olabilir") burada kullanıcıyı yanıltırdı: iki durumda kayıt
    // gerçekten başka bir duruma geçmiş, üçüncüsünde ise ilan olduğu yerde
    // duruyor ve engel başka bir kayıtta.
    expect(errorPresentation("JOB_NOT_OPEN", 409).title).toBe("Bu ilan artık yayında değil");
    expect(errorPresentation("JOB_NOT_CANCELLABLE", 409).title).toBe("Bu ilan iptal edilemiyor");

    const live = errorPresentation("JOB_HAS_LIVE_ASSIGNMENT", 409);
    expect(live.title).toBe("İlanda devam eden bir atama var");
    // Kabul maddesi: kullanıcı "atamanın kendi iptal akışı" yönüne gitmeli.
    expect(live.message).toContain("atamayı kendi iptal akışından");
  });

  it("kapının gösterdiği yol gerçekten var olan bir rota", () => {
    // Var olmayan bir adrese yollayan kapı, kapı olmamasından kötü: kullanıcı
    // eksiğini öğrenip 404'e düşer. Kabuk bölümleri `private-routes.ts`'te
    // tek tek değil ağaç olarak duruyor; onlar için kayıt `app-routes.ts` ve
    // yalnız `ready` bölüm sayılır — "henüz açılmadı" ekranına yollamak da
    // 404'e yollamak kadar boş.
    // Sorgu rotanın parçası değil; bölüm girişine "hangi bölüm" sorgusuyla
    // gitmek geçerli.
    const known = new Set<string>([
      ...privateRoutes,
      ...Object.values(appShells).flatMap((shell) =>
        shell.sections.filter((section) => section.status === "ready").map((section) => section.href),
      ),
    ]);

    for (const gate of Object.keys(gateModes) as GateId[]) {
      const remedy = gateNotice(gate).remedy;
      if (remedy === null) continue;
      expect(known.has(remedy.href.split("?")[0]), `${gate} → ${remedy.href}`).toBe(true);
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
