"use client";

import { useEffect } from "react";

/**
 * Akıtılarak gelen bir bölümü adresteki parçaya kaydırır.
 *
 * Tarayıcı parçaya yalnız ilk HTML gelirken kaydırıyor; bir `Suspense`
 * sınırının arkasından sonradan gelen bölüm o an belgede olmadığı için
 * kaydırma boşa gidiyor. Bileşen bölümle birlikte bağlanır ve parça
 * kendisini gösteriyorsa bölümü görünüre getirir; başka parçada hiçbir şey
 * yapmaz.
 */
export function AnchorReveal({ id }: { id: string }) {
  useEffect(() => {
    if (window.location.hash !== `#${id}`) return;
    document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, [id]);

  return null;
}
