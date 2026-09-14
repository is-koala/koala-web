import Image from "next/image";
import type { ReactNode } from "react";

import type { JobCategoryCode } from "@/content/marketing";

import mapImage from "../../../public/brand/map-istanbul.webp";
import profilePhoto from "../../../public/brand/profil-ornek.png";
import wordmarkGreen from "../../../public/brand/wordmark-green.png";
import { CategoryPin } from "./category-pin";
import { Icon, type IconName } from "@/components/ui/icon";

/**
 * Çalışan uygulamasının beş ekranı, HTML/CSS ile yeniden çizilmiş.
 *
 * Kaynak: `KoalaAppScreen.dc.html` (Flutter ekranlarından türetilmiş
 * mockup, #155). Ekran görüntüsü kesiti yerine yeniden üretim seçildi:
 * eldeki `ekranlar.png` 924px genişliğinde ve telefon çerçevesine
 * büyütülünce bulanıyor. Metinler uygulama kaydında olduğu gibi "siz"
 * kipinde ve başlık düzeninde (İşlerim, Gitmeniz Gereken İşler).
 * Veriler örnek; hiçbir ekran backend'e gitmez.
 */
export type ScreenId = "map" | "detail" | "jobs" | "chat" | "profile";

const navItems: ReadonlyArray<{ id: ScreenId; icon: IconName; label: string }> = [
  { id: "map", icon: "navigation", label: "Keşfet" },
  { id: "jobs", icon: "briefcase", label: "İşlerim" },
  { id: "chat", icon: "chat", label: "Sohbetlerim" },
  { id: "profile", icon: "user", label: "Profilim" },
];

export function PhoneFrame({
  screen,
  children,
  label,
}: {
  screen: ScreenId;
  children: ReactNode;
  label: string;
}) {
  const showNav = screen !== "detail";
  return (
    <div className="ph-frame" role="img" aria-label={`Uygulama ekranı: ${label}`}>
      <div className="ph-status" aria-hidden="true">
        <span>9:41</span>
        <span className="ph-status-icons">
          <Icon name="signal" size={14} />
          <Icon name="wifi" size={14} />
          <Icon name="battery" size={16} />
        </span>
      </div>
      <div className="ph-screen">{children}</div>
      {showNav ? (
        <>
          <span className="ph-fade" aria-hidden="true" />
          <div className="ph-nav" aria-hidden="true">
            {navItems.map((item) => (
              <span key={item.id} className={`ph-nav-item${item.id === screen ? " is-active" : ""}`}>
                <Icon name={item.icon} size={22} />
              </span>
            ))}
          </div>
        </>
      ) : null}
      <span className="ph-home" aria-hidden="true" />
    </div>
  );
}

const mapPins: ReadonlyArray<{ code: JobCategoryCode; left: string; top: string }> = [
  { code: "BARISTA", left: "22%", top: "31%" },
  { code: "PHOTOGRAPHY", left: "63%", top: "22%" },
  { code: "WAITER", left: "40%", top: "47%" },
  { code: "PET_CARE", left: "78%", top: "63%" },
  { code: "DESIGN", left: "17%", top: "72%" },
];

export function MapScreen() {
  return (
    <div className="ph-map">
      <Image src={mapImage} alt="" fill sizes="300px" className="ph-map-image" />
      {mapPins.map((pin) => (
        <span key={pin.code} className="ph-map-pin" style={{ left: pin.left, top: pin.top }}>
          <CategoryPin code={pin.code} size={44} />
        </span>
      ))}
      <span className="ph-map-me" />
      <div className="ph-map-bar">
        <Image src={wordmarkGreen} alt="" height={22} width={Math.round((385 / 95) * 22)} style={{ height: 22, width: "auto" }} />
        <span className="ph-round-button">
          <Icon name="search" size={20} />
        </span>
      </div>
      <span className="ph-round-button ph-locate">
        <Icon name="pin" size={20} />
      </span>
    </div>
  );
}

export function DetailScreen() {
  return (
    <div className="ph-detail">
      <div className="ph-detail-backdrop">
        <Image src={mapImage} alt="" fill sizes="300px" className="ph-map-image" />
      </div>
      <div className="ph-sheet">
        <span className="ph-sheet-handle" />
        <p className="ph-sheet-category">
          <Icon name="chevronDown" size={16} />
          Fotoğrafçılık
        </p>
        <p className="ph-sheet-company">Studio Ada</p>
        <p className="ph-sheet-title">Etkinlik Fotoğrafçısı</p>
        <div className="ph-sheet-row">
          <span className="ph-tag">Günlük</span>
          <span className="ph-sheet-price">4.000₺</span>
        </div>
        <p className="ph-sheet-heading">Açıklama</p>
        <p className="ph-sheet-text">
          Kurumsal bir lansman etkinliğinde 4 saatlik çekim. Kendi ekipmanıyla gelen, ham dosyaları
          aynı gün teslim edebilecek bir fotoğrafçı arıyoruz.
        </p>
        <p className="ph-sheet-heading">Koşullar</p>
        <ul className="ph-sheet-list">
          <li>18:00 - 22:00 · Şişli</li>
          <li>Deneyim: en az 1 etkinlik</li>
          <li>Kıyafet: koyu renk</li>
        </ul>
        <span className="ph-cta">Başvur</span>
      </div>
    </div>
  );
}

type StatusRow = { title: string; company: string; date: string; price: string };

function StatusSection({
  title,
  icon,
  count,
  tone,
  rows,
}: {
  title: string;
  icon: IconName;
  count: number;
  tone: "green" | "amber" | "purple";
  rows: readonly StatusRow[];
}) {
  return (
    <div className={`ph-status-section ph-status-${tone}`}>
      <p className="ph-status-head">
        <Icon name={icon} size={18} />
        <span>{title}</span>
        <span className="ph-status-count">{count}</span>
      </p>
      {rows.map((row) => (
        <div key={row.title} className="ph-status-row">
          <span>
            <strong>{row.title}</strong>
            <small>{row.company}</small>
          </span>
          <span className="ph-status-right">
            <strong>{row.price}</strong>
            <small>{row.date}</small>
          </span>
        </div>
      ))}
    </div>
  );
}

export function JobsScreen() {
  return (
    <div className="ph-page">
      <p className="ph-page-title">İşlerim</p>
      <StatusSection
        title="Gitmeniz Gereken İşler"
        icon="navigation"
        count={2}
        tone="green"
        rows={[
          { title: "Hafta Sonu Barista", company: "Kahve Durağı Cafe", date: "7 Eylül · 09:00", price: "₺1.200" },
          { title: "Menü Fotoğrafçısı", company: "Norm Kahve", date: "9 Eylül · 13:00", price: "₺1.800" },
        ]}
      />
      <StatusSection
        title="Ödeme Bekleniyor"
        icon="money"
        count={1}
        tone="amber"
        rows={[{ title: "Garson", company: "Lezzet Durağı", date: "18 Ağustos", price: "₺1.500" }]}
      />
      <StatusSection
        title="Başvurularım"
        icon="file"
        count={2}
        tone="purple"
        rows={[
          { title: "Etkinlik Fotoğrafçısı", company: "Studio Ada", date: "Yanıt bekleniyor", price: "₺4.000" },
          { title: "Kedi Bakıcısı", company: "Merve K.", date: "Yanıt bekleniyor", price: "₺900" },
        ]}
      />
    </div>
  );
}

const chats = [
  { initials: "KD", name: "Kahve Durağı", text: "Yarın 09:00'da bekliyoruz, iyi günler.", time: "09:24", unread: 2 },
  { initials: "SA", name: "Studio Ada", text: "Çekim onaylandı, ekipman listesi ekte.", time: "Dün", unread: 0 },
  { initials: "MK", name: "Merve K.", text: "Kedim için mama saatlerini yazdım.", time: "Dün", unread: 0 },
  { initials: "LD", name: "Lezzet Durağı", text: "Ödeme hesabınıza geçti, teşekkürler.", time: "Pzt", unread: 1 },
  { initials: "NK", name: "Norm Kahve", text: "Menü çekimi için 13:00 uygun mu?", time: "Cum", unread: 0 },
] as const;

export function ChatScreen() {
  return (
    <div className="ph-page">
      <p className="ph-page-title">Sohbetlerim</p>
      <ul className="ph-chat-list">
        {chats.map((chat) => (
          <li key={chat.name} className="ph-chat-row">
            <span className="ph-chat-avatar">{chat.initials}</span>
            <span className="ph-chat-body">
              <strong>{chat.name}</strong>
              <small>{chat.text}</small>
            </span>
            <span className="ph-chat-meta">
              <small>{chat.time}</small>
              {chat.unread > 0 ? <span className="ph-chat-unread">{chat.unread}</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ProfileScreen() {
  return (
    <div className="ph-page">
      <p className="ph-page-title ph-page-title-actions">
        Profilim
        <span>
          <Icon name="building" size={20} />
          <Icon name="settings" size={20} />
        </span>
      </p>
      <div className="ph-profile-head">
        <Image src={profilePhoto} alt="" width={64} height={64} className="ph-profile-photo" style={{ width: 64, height: 64 }} />
        <span>
          <strong>Elif Yıldız</strong>
          <small>Barista · Fotoğrafçı</small>
          <small>Kadıköy/İstanbul</small>
        </span>
      </div>
      <p className="ph-profile-heading">Hakkımda</p>
      <p className="ph-sheet-text">
        {"Yıldız Teknik'te endüstri mühendisliği okuyorum. Hafta sonları barista, ara sıra etkinlik fotoğrafçısıyım."}
      </p>
      <div className="ph-cv">
        <Icon name="file" size={20} />
        <span>elif_yildiz_cv.pdf</span>
      </div>
      <p className="ph-profile-heading">Rozetler</p>
      <div className="ph-badges">
        <span className="ph-badge ph-badge-gold">Gezgin · Altın</span>
        <span className="ph-badge ph-badge-silver">Gezgin · Gümüş</span>
      </div>
    </div>
  );
}

export const screens: Record<ScreenId, () => ReactNode> = {
  map: MapScreen,
  detail: DetailScreen,
  jobs: JobsScreen,
  chat: ChatScreen,
  profile: ProfileScreen,
};
