import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { CompanyContact, CompanyInvitation } from "@/lib/company-contacts";
import { idleFormState, type FormState } from "@/lib/form-state";

import { CompanyContactsPageView, type CompanyContactsData } from "./company-contacts-page";

const admin: CompanyContact = {
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  user: {
    id: "11111111-1111-4111-8111-111111111111",
    firstName: "Ayşe",
    lastName: "Yıldız",
    username: "ayse",
    profilePictureUrl: null,
  },
  role: "ADMIN",
};

const secondAdmin: CompanyContact = {
  id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  user: {
    id: "22222222-2222-4222-8222-222222222222",
    firstName: "Efe",
    lastName: "Demir",
    username: "efe",
    profilePictureUrl: null,
  },
  role: "ADMIN",
};

const staff: CompanyContact = {
  id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  user: {
    id: "33333333-3333-4333-8333-333333333333",
    firstName: "Deniz",
    lastName: "Ak",
    username: "deniz",
    profilePictureUrl: null,
  },
  role: "STAFF",
};

const invitation: CompanyInvitation = {
  id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
  invitedBy: admin.user,
  invitedUser: {
    id: "44444444-4444-4444-8444-444444444444",
    firstName: "Mert",
    lastName: "Kaya",
    username: "mert",
    profilePictureUrl: null,
  },
  role: "STAFF",
  status: "PENDING",
  invitedAt: "2026-09-01T09:00:00.000Z",
  answeredAt: null,
};

const noopAction = () => async (): Promise<FormState> => idleFormState;

function view(overrides: {
  viewerRole?: string;
  contacts?: CompanyContactsData<readonly CompanyContact[]>;
  invitations?: CompanyContactsData<readonly CompanyInvitation[]> | null;
} = {}) {
  return (
    <CompanyContactsPageView
      companyName="Koala Kafe"
      viewerRole={overrides.viewerRole ?? "ADMIN"}
      contacts={overrides.contacts ?? { status: "ready", data: [admin, secondAdmin, staff] }}
      invitations={
        overrides.invitations === undefined
          ? { status: "ready", data: [invitation] }
          : overrides.invitations
      }
      removeAction={noopAction}
    />
  );
}

describe("şirket yetkilileri ekranı", () => {
  it("yetkilileri adları ve rol rozetleriyle listeler", () => {
    render(view());

    const list = screen.getByRole("list", { name: "Şirket yetkilileri" });
    expect(within(list).getByText("Ayşe Yıldız")).toBeInTheDocument();
    expect(within(list).getAllByText("Yönetici")).toHaveLength(2);
    expect(within(list).getByText("İlan yetkilisi")).toBeInTheDocument();
  });

  it("yöneticiye her satır için çıkarma eylemini verir", () => {
    render(view({ viewerRole: "ADMIN" }));

    expect(screen.getAllByRole("button", { name: /Yetkiliyi çıkar/ })).toHaveLength(3);
  });

  it("STAFF yetkilisine listeyi gösterir, çıkarma eylemini göstermez", () => {
    // `CompanyManager.requireCompanyAdmin` çıkarmanın ilk satırı: STAFF'a
    // düğme çizmek, tıklandığında 404'e düşen bir eylem sunmak olurdu.
    render(view({ viewerRole: "STAFF", invitations: null }));

    expect(screen.getByText("Ayşe Yıldız")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Yetkiliyi çıkar/ })).not.toBeInTheDocument();
  });

  it("STAFF yetkilisine neden eylem göremediğini yazar", () => {
    // Düğmeyi gerekçesiz gizlemek "neden yapamıyorum" sorusunu cevapsız
    // bırakır; rol kullanıcının kendi üyelik kaydından okunuyor, yani bunu
    // söylemek hiçbir şey sızdırmıyor.
    render(view({ viewerRole: "STAFF", invitations: null }));

    expect(
      screen.getByText(/Yetkili davet etmeyi ve çıkarmayı yalnız şirket yöneticileri yapabilir/),
    ).toBeInTheDocument();
  });
});

describe("son yönetici", () => {
  it("tek yönetici kaldığında o satırın çıkarma eylemini kapatır ve nedenini yazar", () => {
    // Backend aynı kuralı 409 ile uyguluyor; liste zaten ekranda olduğu için
    // kullanıcıyı onay adımından geçirip reddettirmeye gerek yok.
    render(view({ contacts: { status: "ready", data: [admin, staff] } }));

    const rows = screen.getAllByRole("listitem");
    const adminRow = rows.find((row) => within(row).queryByText("Ayşe Yıldız"))!;
    const staffRow = rows.find((row) => within(row).queryByText("Deniz Ak"))!;

    expect(within(adminRow).getByRole("button", { name: "Yetkiliyi çıkar" })).toBeDisabled();
    expect(within(adminRow).getByText(/en az bir yönetici kalmalı/i)).toBeInTheDocument();
    expect(within(staffRow).getByRole("button", { name: "Yetkiliyi çıkar" })).toBeEnabled();
  });

  it("ikinci yönetici varken her iki yöneticiyi de çıkarılabilir bırakır", () => {
    render(view({ contacts: { status: "ready", data: [admin, secondAdmin] } }));

    for (const button of screen.getAllByRole("button", { name: "Yetkiliyi çıkar" })) {
      expect(button).toBeEnabled();
    }
  });
});

describe("bekleyen davetler bölümü", () => {
  it("yöneticiye bekleyen daveti davet edilen kişi ve rolüyle gösterir", () => {
    render(view());

    const list = screen.getByRole("list", { name: "Bekleyen davetler" });
    expect(within(list).getByText("Mert Kaya")).toBeInTheDocument();
    expect(within(list).getByText("İlan yetkilisi olarak davet edildi")).toBeInTheDocument();
  });

  it("kabul edilene kadar listede görünmeyeceğini yazar", () => {
    // Davet gönderildikten sonra kişiyi yetkili listesinde aramak, teslim
    // edilmemiş bir davet gibi okunurdu.
    render(view());

    expect(screen.getByText(/kabul edene kadar yetkili listesinde görünmez/)).toBeInTheDocument();
  });

  it("cevaplanmış davetleri bekleyen saymaz ve boş durumu çizer", () => {
    // Uç bütün davetleri döndürüyor; kabul edilmiş bir davet "bekliyor"
    // diye görünürse yöneticiye karşılığı olmayan bir iş kalır.
    render(view({ invitations: { status: "ready", data: [{ ...invitation, status: "ACCEPTED" }] } }));

    expect(screen.getByText("Bekleyen davet yok")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Bekleyen davetler" })).not.toBeInTheDocument();
  });

  it("davet listesi okunamadığında boş liste gibi davranmaz", () => {
    render(view({ invitations: { status: "error", errorCode: "UNEXPECTED", httpStatus: 500 } }));

    expect(screen.queryByText("Bekleyen davet yok")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Bir sorun oluştu");
  });

  it("davet gönderme formunun neden açık olmadığını yazar", () => {
    // Form bilerek yok: uç üçüncü bir kişinin T.C. kimlik numarasını istiyor
    // ve bunu işverenden toplamak ürün/KVKK kararı (is-koala/koala-web#30).
    render(view());

    expect(screen.getByText(/Davet gönderme web'de henüz açık değil/)).toBeInTheDocument();
  });
});

describe("yetkili listesi okunamadığında", () => {
  it("ham backend metni yerine koda bağlı Türkçe metni gösterir", () => {
    render(
      view({
        contacts: {
          status: "error",
          errorCode: "USER_NOT_ASSOCIATED_WITH_COMPANY",
          httpStatus: 404,
        },
      }),
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Bu işlemi yapamıyoruz");
    expect(alert).toHaveTextContent(/Şirket bulunamadı, yöneticisi olmayabilirsin/);
  });
});
