import { site } from "@/lib/site";

/**
 * Veri sorumlusu kimliği.
 *
 * Yasal metinler (`kvkk-aydinlatma`, gizlilik, kullanım koşulları) henüz
 * hukuk incelemesi bekleyen iskelet: tescilli ticaret unvanı ve tebligat
 * adresi orada yok. Bu yüzden burada da uydurulmuyor. Yayımlanan işletme
 * adı ve elektronik başvuru adresi, sitede ve OpenAPI iletişiminde zaten
 * duran `Koala` / `info@iskoala.com` değerleridir.
 */
export const controllerIdentity = {
  publicName: site.name,
  email: "info@iskoala.com",
  kvkkApplicationEmail: "info@iskoala.com",
  kvkkApplicationPath: "/iletisim",
  kvkkNoticePath: "/kvkk-aydinlatma",
  postalAddress: null,
  legalTitlePending:
    "Tescilli ticaret unvanı hukuk incelemesi sonrası bu sayfada yayımlanacak.",
  postalAddressPending:
    "Tebligat adresi hukuk incelemesi sonrası bu sayfada yayımlanacak.",
} as const;

export const supportContent = {
  eyebrow: "İletişim",
  title: "Birlikte çözelim.",
  intro:
    "Destek, KVKK başvurusu ve şikayetler bu formdan Koala destek kutusuna düşer. Kimlik belgesi, parola veya ödeme bilgisi yazma.",
  sentTitle: "Mesajın bize ulaştı",
  sentBody: "Destek ekibi başvurunu inceleyip kayıtlı e-posta adresinden dönecek.",
  topics: [
    { value: "destek", label: "Destek" },
    { value: "kvkk", label: "KVKK" },
    { value: "sikayet", label: "Şikayet" },
    { value: "diger", label: "Diğer" },
  ],
} as const;
