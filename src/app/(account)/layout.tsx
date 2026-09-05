import Link from "next/link";
import { Wordmark } from "@/brand/Wordmark";

/**
 * Hesap akışlarında gezinme menüsü yok: kullanıcı e-postadan gelip tek bir
 * işi bitiriyor, dikkatini dağıtacak bağlantı konmuyor.
 */
export default function AccountLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="account-shell">
      <Wordmark />
      <main>{children}</main>
      <Link href="/" className="text-link">Ana sayfaya dön</Link>
    </div>
  );
}
