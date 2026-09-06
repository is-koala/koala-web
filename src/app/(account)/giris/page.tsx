import type { Metadata } from "next";
import Link from "next/link";

import { LoginForm } from "@/components/login-form";
import { returnDestination } from "@/server/session/login-redirect";

import { loginAction } from "./actions";

export const metadata: Metadata = {
  title: "Giriş Yap",
  robots: { index: false, follow: false },
};

/**
 * Sayfa bilerek `(account)` altında: o yerleşim gezinme menüsü çizmiyor
 * (`(account)/layout.tsx`) ve giriş de tek bir işi bitiren bir akış — menü
 * kullanıcıyı formdan uzaklaştırırdı. Kabuğun "Ana sayfaya dön" bağlantısı
 * çıkışı zaten veriyor.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  // Tekrarlanan parametre dizi olarak gelir; hangisinin kastedildiği belli
  // olmadığı için hedef sayılmaz ve ana sayfaya düşer.
  const destination = returnDestination(typeof next === "string" ? next : undefined);

  return (
    <section className="account-card">
      <p className="eyebrow">Koala hesabın</p>
      <h1>Giriş yap</h1>
      <p className="lede">E-posta adresin ve parolanla devam et.</p>
      <LoginForm destination={destination} action={loginAction} />
      <p className="trust-note">
        <Link className="text-link" href="/sifre-unuttum">Parolamı unuttum</Link>
        {" · "}
        Hesabın yok mu? <Link className="text-link" href="/kayit">Kayıt ol</Link>
      </p>
    </section>
  );
}
