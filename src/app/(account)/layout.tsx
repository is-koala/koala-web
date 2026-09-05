import Link from "next/link";
import { site } from "@/lib/site";

/**
 * Hesap akışlarında gezinme menüsü yok: kullanıcı e-postadan gelip tek bir
 * işi bitiriyor, dikkatini dağıtacak bağlantı konmuyor.
 */
export default function AccountLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <Link href="/" className="mb-8 text-lg font-semibold">
        {site.name}
      </Link>
      <main className="w-full max-w-md">{children}</main>
    </div>
  );
}
