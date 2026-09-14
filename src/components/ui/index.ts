/**
 * Koala tasarım sisteminin uygulama kabuğu bileşenleri (is-koala/koala-web#156).
 *
 * Hepsi durumsuz sunum bileşeni: durum okumaz, çerez açmaz, `use client`
 * taşımaz; bu yüzden sunucu sayfaları da istemci parçaları da (mesaj dizisi
 * `list-row`/`status-badge`, üst bar `icon`) aynı dosyalardan alır. Kabuk
 * altındaki sayfalar başlığı, kartı, rozeti, sekmeyi ve boş durumu buradan
 * alır; token'lar `globals.css`'te, sınıf kuralları `app-shell.css`'te.
 */
export { Card, PagePanel, type CardTone } from "./card";
export { EmptyStateCard } from "./empty-state";
export { MascotImage, type Mascot } from "./mascot";
export { Field, FieldGroup, fieldDescribedBy, fieldErrorId, fieldHintId } from "./field";
export { Icon, type IconName } from "./icon";
export { Avatar, FactList, ListRow, ListRows, type Fact } from "./list-row";
export { PageHeader, SectionHeader } from "./page-header";
export { StatCard, type StatAccent } from "./stat-card";
export {
  StatusBadge,
  applicationStatusTone,
  assignmentStatusTone,
  jobStatusTone,
  paymentStatusTone,
  paymentToneToStatusTone,
  payoutStatusTone,
  type StatusTone,
} from "./status-badge";
export { LinkTabs, type LinkTab } from "./tabs";
