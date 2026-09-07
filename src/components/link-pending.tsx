"use client";

import { useLinkStatus } from "next/link";

/**
 * Bir `<Link>` gezinmesinin bekleme göstergesi.
 *
 * İlan listesinin yükleniyor durumu **burada** duruyor, bir `loading.tsx`
 * içinde değil, ve bu bir üslup tercihi değil. Next bir segmentin yanına
 * `loading.tsx` konduğunda `page.tsx`'i otomatik olarak bir `<Suspense>`
 * sınırına alıyor; o sınır kabuğu erken akıtıyor ve sayfanın asıl içeriği
 * belgeye `<div hidden>` içinde, sonradan bir satır içi script'in yerine
 * taşıdığı bir parça olarak giriyor. JavaScript kapalı bir tarayıcıda o taşıma
 * hiç olmuyor: ziyaretçi ilanları değil, sonsuza kadar iskeleti görüyor.
 * İlan listesinin varlık sebebi tam olarak bunun tersi — ilanlar ilk HTML'de,
 * script'siz görünür olmalı.
 *
 * Geriye gerçek bir bekleme anı kalıyor: dinamik bir rota `loading.tsx`
 * taşımadığında Next onu ön yüklemiyor, yani sayfalama bağlantısına tıklayan
 * kullanıcı sunucuyu bekliyor ve ekranda hiçbir şey değişmiyor. `useLinkStatus`
 * o boşluğu, sayfayı bir Suspense sınırına sokmadan dolduruyor.
 */
export function LinkPending() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span className="link-pending" aria-live="polite">
      Yükleniyor…
    </span>
  );
}
