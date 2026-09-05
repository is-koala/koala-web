import { commissionRate } from "./pricing";

export type MarketingPage = {
  title: string;
  description: string;
  eyebrow: string;
  intro: string;
  sections: ReadonlyArray<{ title: string; body: string }>;
};

export const marketingContent = {
  "is-arayanlar": {
    title: "İş Arayanlar için Koala",
    description: "Yakınındaki günlük işleri keşfet, başvur ve süreci tek yerden takip et.",
    eyebrow: "İş arayanlar",
    intro: "Uygun olduğun zamanda çalışabileceğin kısa süreli işleri keşfet.",
    sections: [
      { title: "Yakınındaki ilanları gör", body: "İhtiyaçlarına ve konumuna uyan ilanları karşılaştır, sana uygun olana başvur." },
      { title: "Adresin kontrollü paylaşılır", body: "Tam iş adresi ilan aşamasında gizli kalır; yalnız atanan İş Arayan ile paylaşılır." },
      { title: "Ücretini baştan bil", body: "Çalışan Ücreti ilan ayrıntısında görünür. Koala Hizmet Bedeli bu ücretten kesilmez." },
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
  },
  "nasil-calisir": {
    title: "Koala Nasıl Çalışır?",
    description: "İlan oluşturmadan Atamaya kadar Koala sürecini adım adım öğren.",
    eyebrow: "Adım adım",
    intro: "İşveren ilanını yayımlar, İş Arayan başvurur, seçim Atamaya dönüşür.",
    sections: [
      { title: "1. İlan yayımlanır", body: "İşin kapsamı, zamanı, yaklaşık konumu ve Çalışan Ücreti açıklanır." },
      { title: "2. Başvuru yapılır", body: "İş Arayan uygun gördüğü ilana Başvuru gönderir." },
      { title: "3. Atama tamamlanır", body: "İşveren seçim yaptığında tam adres yalnız atanan İş Arayan için açılır." },
    ],
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
  },
} satisfies Record<string, MarketingPage>;

export const frequentlyAskedQuestions = [
  { question: "Koala kimler için?", answer: "Günlük veya kısa süreli iş arayanlarla bu işler için destek arayan İşverenler için." },
  { question: "Tam iş adresini herkes görür mü?", answer: "Hayır. Tam adres yalnız Atama yapılan İş Arayan ile paylaşılır." },
  { question: "Koala Hizmet Bedeli kimden kesilir?", answer: "Çalışan Ücretinden kesilmez; İşveren Toplamına ayrıca eklenir." },
] as const;

export const homeContent = {
  eyebrow: "Günlük işler. Gerçek insanlar.",
  title: ["Bugünün işini", "bugün bul."],
  intro: "Koala, kısa süreli iş ihtiyacını güvenli ve açık bir süreçte doğru insanla buluşturur.",
  workerAction: "İş arıyorum",
  employerAction: "İşverenim",
  proofs: ["Net ücret", "Kontrollü adres", "Hızlı Başvuru"],
  manifestoEyebrow: "Koala yaklaşımı",
  manifesto: "İş bulmak da, destek bulmak da yorucu olmamalı.",
} as const;

export const contactContent = {
  eyebrow: "İletişim",
  title: "Birlikte çözelim.",
  intro: "Soru ve görüşlerin için bize e-posta gönder.",
  email: "info@iskoala.com",
} as const;

export const faqContent = {
  eyebrow: "Merak edilenler",
  title: "Sıkça Sorulan Sorular",
  intro: "Koala'ya başlamadan önce bilmen gerekenler.",
} as const;
