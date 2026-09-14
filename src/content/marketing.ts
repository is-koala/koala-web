import { commissionRate } from "./pricing";

export type MarketingPage = {
  title: string;
  description: string;
  eyebrow: string;
  intro: string;
  sections: ReadonlyArray<{ title: string; body: string }>;
  /** Sayfa sonundaki çağrı; hedef her zaman sitenin gerçek bir rotası. */
  action: { label: string; href: string };
  /**
   * Asıl çağrının yanındaki ikincil bağlantılar. İş arayan sayfası web
   * akışına çağırıyor (kayıt → ilanlar, is-koala/koala-web#154); uygulama
   * mağazaları burada ek seçenek olarak duruyor, ana çağrı değil.
   */
  secondaryActions?: ReadonlyArray<{ label: string; href: string }>;
};

/**
 * Tanıtım sayfalarının metinleri.
 *
 * Kaynak: tasarımcının 13.09.2026 teslimi (`design/tanitim-sitesi-v2`, is-koala/koala-web#155).
 * Ton kuralı tasarım sisteminden geliyor: tanıtımda "sen", uygulamada "siz".
 * Ücret ve komisyon gibi ürün gerçekleri `pricing.ts`'ten okunur; mockup'taki
 * ücretler örnek ve sayfada "Örnek" etiketiyle durur.
 */
export const marketingContent = {
  "is-arayanlar": {
    title: "İş Arayanlar için Koala",
    description: "Yakınındaki günlük işleri keşfet, başvur ve süreci tek yerden takip et.",
    eyebrow: "İş arayanlar",
    intro: "Uygun olduğun zamanda çalışabileceğin kısa süreli işleri keşfet.",
    sections: [
      { title: "Yakınındaki ilanları gör", body: "İhtiyaçlarına ve konumuna uyan ilanları listede ya da haritada karşılaştır, sana uygun olana web'den başvur." },
      { title: "Adresin kontrollü paylaşılır", body: "Tam iş adresi ilan aşamasında gizli kalır; yalnız atanan İş Arayan ile paylaşılır." },
      { title: "Ücretini baştan bil", body: "Çalışan Ücreti ilan ayrıntısında görünür. Koala Hizmet Bedeli bu ücretten kesilmez." },
      { title: "Süreci panelinden takip et", body: "Başvurun, atanman, mesajların ve kazancın tarayıcındaki panelinde; uygulama istersen ek." },
    ],
    action: { label: "Ücretsiz kayıt ol", href: "/kayit" },
    secondaryActions: [
      { label: "İlanlara bak", href: "/is-ilanlari" },
      { label: "Uygulamayı indir", href: "/uygulamayi-ac" },
    ],
  },
  isverenler: {
    title: "İşverenler için Koala",
    description: "Kısa süreli iş ihtiyacını ilan et, başvuruları değerlendir ve Atama oluştur.",
    eyebrow: "İşverenler",
    intro: "İhtiyacını açıkça yaz, doğru İş Arayanlarla hızlıca buluş.",
    sections: [
      { title: "İlanını oluştur", body: "İşin zamanını, konumunu ve Çalışan Ücretini belirle." },
      { title: "Başvuruları değerlendir", body: "İlana gelen Başvuruları incele ve çalışacağın İş Arayanı seç." },
      { title: "Şeffaf fiyat", body: `Koala Hizmet Bedeli, Çalışan Ücretinin üstüne ${commissionRate} oranında eklenir; İşveren Toplamı yayımdan önce görünür.` },
    ],
    action: { label: "İlan vermeye başla", href: "/isveren" },
  },
  "nasil-calisir": {
    title: "Koala Nasıl Çalışır?",
    description: "İlan oluşturmadan Atamaya kadar Koala sürecini adım adım öğren.",
    eyebrow: "Adım adım",
    intro: "İşveren ilanını yayımlar, İş Arayan başvurur, seçim Atamaya dönüşür.",
    sections: [
      { title: "İlan yayımlanır", body: "İşin kapsamı, zamanı, yaklaşık konumu ve Çalışan Ücreti açıklanır." },
      { title: "Başvuru yapılır", body: "İş Arayan uygun gördüğü ilana Başvuru gönderir." },
      { title: "Atama tamamlanır", body: "İşveren seçim yaptığında tam adres yalnız atanan İş Arayan için açılır." },
    ],
    action: { label: "İlanlara bak", href: "/is-ilanlari" },
  },
  hakkimizda: {
    title: "Koala Hakkında",
    description: "Koala'nın günlük işlerde güvenli ve anlaşılır bir buluşma noktası kurma yaklaşımı.",
    eyebrow: "Hakkımızda",
    intro: "Koala, günlük ve kısa süreli işlerde doğru insanları bir araya getirir.",
    sections: [
      { title: "Net kurallar", body: "Ücret, hizmet bedeli ve adres görünürlüğü gibi kritik ayrıntıları sürecin doğru anında gösteririz." },
      { title: "İki taraf için", body: "Bireysel İşveren ve Şirket İşvereni ihtiyaçlarını, İş Arayan deneyimiyle aynı güven zemini üzerinde buluştururuz." },
    ],
    action: { label: "Bize yaz", href: "/iletisim" },
  },
} satisfies Record<string, MarketingPage>;

/**
 * Beş iş kategorisi. `code` backend `job_categories.code` değerleriyle aynı;
 * renkler tasarım sisteminin kategori paleti, pinler `public/brand/pins/`.
 */
export const jobCategories = [
  { code: "WAITER", label: "Garsonluk", pin: "/brand/pins/waiter.svg", color: "#FF5722" },
  { code: "BARISTA", label: "Barista", pin: "/brand/pins/barista.svg", color: "#795548" },
  { code: "PHOTOGRAPHY", label: "Fotoğrafçılık", pin: "/brand/pins/photography.svg", color: "#9C27B0" },
  { code: "PET_CARE", label: "Hayvan Bakımı", pin: "/brand/pins/pet_care.svg", color: "#4CAF50" },
  { code: "DESIGN", label: "Tasarım", pin: "/brand/pins/design.svg", color: "#2196F3" },
] as const;

export type JobCategoryCode = (typeof jobCategories)[number]["code"];

export type SampleJob = {
  category: JobCategoryCode;
  title: string;
  employer: string;
  district: string;
  hours: string;
  price: string;
  type: "Günlük" | "Tekrarlı";
  distance: string;
};

/**
 * Örnek ilanlar. Gerçek işveren adı yok, ücretler aralık; sayfada her kart
 * "Örnek" etiketi taşır. Gerçek ilanlar `/is-ilanlari`'nda.
 */
export const sampleJobs: readonly SampleJob[] = [
  { category: "BARISTA", title: "Hafta sonu barista", employer: "Bir kahveci", district: "Beşiktaş", hours: "09:00 - 17:00", price: "₺1000-1400", type: "Tekrarlı", distance: "0.6 km" },
  { category: "WAITER", title: "Hafta sonu garson", employer: "Bir kafe", district: "Kadıköy", hours: "11:00 - 19:00", price: "₺1200-1600", type: "Günlük", distance: "1.2 km" },
  { category: "PHOTOGRAPHY", title: "Etkinlik fotoğrafçısı", employer: "Bir stüdyo", district: "Şişli", hours: "18:00 - 22:00", price: "₺3000-4500", type: "Günlük", distance: "5.2 km" },
  { category: "PET_CARE", title: "Kedi bakıcısı", employer: "Bireysel işveren", district: "Kadıköy", hours: "2 gün · gündüz", price: "₺700-1000", type: "Tekrarlı", distance: "1.5 km" },
  { category: "DESIGN", title: "Sosyal medya görselleri", employer: "Bir stüdyo", district: "Kadıköy", hours: "Uzaktan · 1 gün", price: "₺2000-3000", type: "Günlük", distance: "1.0 km" },
];

export const homeContent = {
  hero: {
    badge: "Çok yakında · İstanbul'da başlıyoruz",
    title: ["Boş vaktini", "paraya çevir."],
    intro: "Koala, sana en yakın günlük iş ilanlarını haritaya döker. Pine dokun, koşulları oku, tek tıkla başvur.",
    primaryAction: { label: "Erken erişime katıl", href: "#erken-erisim" },
    secondaryAction: { label: "Uygulamayı dene", href: "#uygulama" },
    storeNote: "App Store ve Google Play'de çok yakında",
    map: {
      status: "Kadıköy çevresi · 5 açık ilan",
      hint: "Statik önizleme",
      applyLabel: "Başvur",
      applyHref: "/is-ilanlari",
    },
  },
  /** Kategori şeridi; ücretler örnek ve şerit dekoratif. */
  tickerLabel: "Örnek ücretler",
  ticker: [
    { category: "WAITER", price: "₺1500" },
    { category: "BARISTA", price: "₺1200" },
    { category: "PHOTOGRAPHY", price: "₺4000" },
    { category: "PET_CARE", price: "₺900" },
    { category: "DESIGN", price: "₺3000" },
  ] as ReadonlyArray<{ category: JobCategoryCode; price: string }>,
  categories: {
    eyebrow: "Ne işler var",
    title: "Beş kategori, günlük işler.",
    intro: "Aşağıdakiler gerçek ilan değil, bir kategoride ilanın nasıl göründüğünü anlatan örnek kartlar.",
    sampleLabel: "Örnek",
    disclaimer: "Örnek kartlar gerçek işveren ve ilan değildir; ücretler piyasadan derlenmiş aralıklardır.",
    action: { label: "Gerçek ilanlara bak", href: "/is-ilanlari" },
  },
  stats: [
    { value: "5", label: "iş kategorisi" },
    { value: "2", label: "iş tipi: günlük ve tekrarlı" },
    { value: "4", label: "YTÜ'lü kurucu" },
    { value: "İstanbul", label: "ilk şehrimiz" },
  ],
  about: {
    eyebrow: "Biz kimiz",
    title: ["Kampüste başladı,", "kampüs için büyüyor."],
    body: "YTÜ'lü 4 mühendislik öğrencisi olarak öğrencilerin günlük iş almasına ve çalışmasına yeni bir soluk ve güvence getirmek, süreçleri çok daha kolay ve güvenilir hâle getirmek amacıyla Koala'yı kurduk.",
    team: "Koala kurucu ekibi",
    school: "Yıldız Teknik Üniversitesi",
    action: { label: "Hakkımızda", href: "/hakkimizda" },
  },
  why: {
    eyebrow: "Neden Koala",
    title: "Günlük iş, tahmin işi olmasın.",
    intro: "İlanı açan kim, ücret ne, ne zaman ödenecek — hepsi baştan belli.",
    cards: [
      { icon: "shield", tone: "green", title: "Baştan belli koşullar", body: "Sigorta ve deneyim gerekliliği, saatler, kıyafet ve adres ilan detayında yazılı. Sürprizle işe gitmiyorsun." },
      { icon: "money", tone: "amber", title: "Takip edilebilir ödeme", body: "Mesaiyi uygulamadan başlat ve bitir. İşin hangi aşamada olduğunu \"Ödeme Bekleniyor\"a kadar İşlerim'de görürsün." },
      { icon: "calendar", tone: "blue", title: "Ders programına uyar", body: "Müsait olduğun gün ve saatleri profilinde tanımla; işler sana o aralıklara göre gelsin." },
      { icon: "star", tone: "yellow", title: "Karşılıklı güven", body: "İş bitince iki taraf da birbirini değerlendirir. Puanın, yorumların ve rozetlerin profilinde birikir." },
    ],
  },
  how: {
    eyebrow: "Nasıl çalışır",
    title: "Sabah gördün, akşam kazandın.",
    intro: "Bir salı gününün üç adımı — saatler örnek, akış gerçek.",
    steps: [
      { time: "09:40 · Salı", title: "Dersten çıktın, haritayı açtın.", body: "Yakınındaki ilanlar kategori pinleriyle haritada duruyor. Listeye geçip ücrete, mesafeye ve kategoriye göre eleyebilirsin.", chip: "Keşfet sekmesi", icon: "navigation", tone: "green", image: 1 },
      { time: "11:05 · Salı", title: "Koşulları okudun, başvurdun.", body: "Ücret, saatler, görevler, sigorta ve deneyim şartı ilan detayında yazılı. Başvurunun ardından işveren uygulama içinden yazıyor.", chip: "Başvurularım", icon: "file", tone: "purple", image: 2 },
      { time: "22:10 · Salı", title: "Mesaiyi bitirdin, kazancın göründü.", body: "Mesaini uygulamadan başlatıp bitiriyorsun; iş \"Ödeme Bekleniyor\" durumuna geçiyor. İki taraf birbirini değerlendiriyor, puanın profilinde kalıyor.", chip: "İşlerim", icon: "money", tone: "amber", image: 3 },
    ],
    action: { label: "Adım adım anlatım", href: "/nasil-calisir" },
  },
  app: {
    eyebrow: "Uygulamayı dene",
    title: "Buradan dokun, içini gez.",
    intro: "Çalışan uygulamasının beş ekranı. Soldan bir ekran seç, telefonda nasıl göründüğüne bak.",
    screens: [
      { id: "map", icon: "navigation", tone: "green", title: "Keşfet — harita", body: "Yakındaki ilanlar, kategori pinleriyle" },
      { id: "detail", icon: "file", tone: "purple", title: "İş detayı", body: "Ücret, görevler, koşullar ve konum" },
      { id: "jobs", icon: "briefcase", tone: "amber", title: "İşlerim", body: "Her iş, hangi aşamada olduğuyla" },
      { id: "chat", icon: "chat", tone: "blue", title: "Sohbetlerim", body: "İşverenle doğrudan mesajlaşma" },
      { id: "profile", icon: "user", tone: "yellow", title: "Profilim", body: "Özgeçmiş, rozetler ve tecrübe" },
    ],
  },
  campaign: {
    eyebrow: "Kampanya",
    title: ["Soruyu biz sormuyoruz,", "afiş soruyor."],
    body: "Kampüste asılan, akışta dönen afişlerimiz tek bir şey soruyor. Cevabın \"evet\"se uygulama çıktığında ilk sen dene.",
    action: { label: "Erken erişime katıl", href: "#erken-erisim" },
    posterAlt: "Koala afişi: Sen de böyle olmak istemez misin?",
  },
  sides: {
    eyebrow: "İki taraf",
    title: "Tek uygulama, iki taraf.",
    intro: "Anahtarı çevir, karşı taraftan nasıl göründüğünü gör.",
    worker: {
      label: "Çalışan",
      title: "Öğrenciysen: boş günün dolsun.",
      body: "Müsait olduğun aralıkları yaz, sana yakın ilanları haritada gör, koşulları okuduktan sonra başvur. Kazancın ve puanın profilinde birikir.",
      points: [
        { icon: "navigation", text: "Yakınındaki ilanları haritada keşfet" },
        { icon: "clock", text: "Mesaini uygulamadan başlat ve bitir" },
        { icon: "star", text: "Puan ve rozetlerle profilini büyüt" },
      ],
      action: { label: "Öğrenci olarak haber ver", href: "#erken-erisim" },
      link: { label: "İş arayanlar sayfası", href: "/is-arayanlar" },
    },
    employer: {
      label: "İşveren",
      title: "Yarın sabah için bir kişi mi lazım?",
      body: "Kafe, stüdyo, etkinlik ya da bireysel — İşveren Paneli'nden ilanını dakikalar içinde aç, başvuranları tek ekranda karşılaştır, işi onayla ve ödemeyi başlat.",
      points: [
        { icon: "plus", text: "Hazır şablonla ilan aç" },
        { icon: "users", text: "Başvuranların profilini ve puanını gör" },
        { icon: "chart", text: "Aktif ve geçmiş ilanları panelden izle" },
      ],
      action: { label: "İşveren olarak haber ver", href: "#erken-erisim" },
      link: { label: "İşverenler sayfası", href: "/isverenler" },
    },
  },
  testimonials: {
    eyebrow: "Öğrenci yorumları",
    title: "Erken deneyenler ne dedi?",
    quotes: [
      { text: "Dersler arası boşluğa barista vardiyası aldım. İlanı sabah gördüm, akşam çalışıyordum.", initials: "ZA", name: "Zeynep A.", meta: "Endüstri Müh. · 3. sınıf", color: "#3F7A3D" },
      { text: "Ücret ve saatler ilanda net yazıyor. Gidip \"aslında şöyleydi\" muhabbeti yaşamıyorsun.", initials: "MK", name: "Mert K.", meta: "Bilgisayar Müh. · 2. sınıf", color: "#3F7A3D" },
      { text: "Fotoğrafçılık işlerini buradan alıyorum, profilimdeki puanlar bir sonrakine kapı açıyor.", initials: "EY", name: "Elif Y.", meta: "Makine Müh. · 4. sınıf", color: "#9C27B0" },
      { text: "Kafemize hafta sonu için tek kişi arıyorduk; ilanı akşam açtım, sabah üç başvuru vardı.", initials: "BÖ", name: "Burak Ö.", meta: "Kafe işletmecisi · Beşiktaş", color: "#795548" },
    ],
  },
  faq: {
    eyebrow: "SSS",
    title: "Merak edilenler",
    action: { label: "Tüm sorular", href: "/sss" },
  },
  earlyAccess: {
    title: "Çıktığı gün haberin olsun.",
    body: "E-postanı bırak; Koala yayına girdiğinde ilk sen dene. Spam yok, sadece tek bir haber.",
    nameLabel: "Adın",
    emailLabel: "E-postan",
    emailPlaceholder: "ogrenci@ytu.edu.tr",
    submit: "Haber ver",
    pending: "Gönderiliyor…",
    doneTitle: "Listeye eklendin.",
    doneBody: "Koala yayına girdiğinde bu adrese tek bir haber göndereceğiz. Görüşmek üzere!",
    /**
     * Destek kutusuna düşen kaydın konusu ve gövdesi; ziyaretçi bunları
     * yazmıyor. Konu `supportContent.topics` içinden, mesaj sabit ki kutuda
     * erken erişim kayıtları tek satırla süzülsün.
     */
    submission: {
      topic: "diger",
      message: "Erken erişim listesi: uygulama yayına girdiğinde haber ver. (Tanıtım sitesi formu)",
    },
  },
} as const;

export const frequentlyAskedQuestions = [
  { question: "Koala kimler için?", answer: "İki taraf için: boş vaktinde günlük iş arayan öğrenciler ve bir günlük ya da tekrarlı işi için birine ihtiyaç duyan kafeler, stüdyolar, etkinlik ekipleri ve bireysel işverenler. İkisi de aynı uygulamada, ayrı deneyimlerde." },
  { question: "Hangi işler var?", answer: "Şimdilik beş kategori: Fotoğrafçılık, Garsonluk, Hayvan Bakımı, Tasarım ve Barista. Her ilan ya günlük (tek seferlik) ya da tekrarlı olarak açılır." },
  { question: "Hangi şehirde çalışıyor?", answer: "İstanbul. Hizmet alanımız şu an İstanbul sınırlarıyla tanımlı; yeni şehirler açıldığında uygulamadan duyuracağız." },
  { question: "Nasıl başvuruyorum?", answer: "İlanı haritada ya da listede bulup detayını açıyorsun; ücret, saatler, görevler ve koşulları okuduktan sonra \"Başvur\" diyorsun. Başvurunun hangi aşamada olduğunu İşlerim sekmesinden takip ediyorsun." },
  { question: "Ödeme nasıl işliyor?", answer: "İşe gittiğinde mesaini uygulamadan başlatıp bitiriyorsun. İş tamamlandığında ilan \"Ödeme Bekleniyor\" durumuna geçiyor ve kazancın İşlerim üzerinden görünür kalıyor." },
  { question: "Koala Hizmet Bedeli kimden kesilir?", answer: `Çalışan Ücretinden kesilmez; İşveren Toplamına ${commissionRate} oranında ayrıca eklenir ve ilan yayımlanmadan önce görünür.` },
  { question: "Tam iş adresini herkes görür mü?", answer: "Hayır. İlanda yaklaşık konum görünür; tam adres yalnız Atama yapılan İş Arayan ile paylaşılır." },
  { question: "Güvenlik tarafında ne var?", answer: "Kimlik doğrulama, iş bitiminde karşılıklı değerlendirme, profilde biriken puan ve rozetler; ayrıca her ilan ve kullanıcı için şikayet ve engelleme." },
] as const;

export const faqContent = {
  eyebrow: "Merak edilenler",
  title: "Sıkça Sorulan Sorular",
  intro: "Koala'ya başlamadan önce bilmen gerekenler.",
} as const;
