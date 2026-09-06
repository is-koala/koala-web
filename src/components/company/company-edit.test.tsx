import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { editableCompanyFields } from "@/lib/company";
import type { FormState } from "@/lib/form-state";
import type { Company } from "@/server/company/company";

import { CompanyEditForm } from "./company-edit-form";
import { CompanyLogoForms } from "./company-logo-forms";

const company: Company = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  name: "Koala Temizlik",
  email: "bilgi@koala.test",
  logoUrl: "https://cdn.koala.test/logo.png",
  phoneNumber: "05001112233",
  website: "https://koala.test",
  description: "Kurumsal temizlik hizmetleri.",
  taxNumber: "1234567890",
  type: "LIMITED",
  address: null,
  contacts: [],
  followerCount: 0,
  approved: true,
};

const idle = async (): Promise<FormState> => ({ status: "idle" });

describe("şirket düzenleme formu", () => {
  afterEach(cleanup);

  it("yalnız güncelleme ucunun taşıdığı beş alanı yazılabilir sunar", () => {
    // `UpdateCompanyRequestDto` yalnız bu beşini taşıyor. Formda altıncı bir
    // alan olsaydı kullanıcı onu düzenler, backend sessizce yok sayar ve
    // ekran değişmemiş bir değeri değişmiş gibi gösterirdi.
    render(<CompanyEditForm company={company} action={idle} />);

    const editable = screen
      .getByRole("form", { name: "Şirket bilgileri" })
      .querySelectorAll("input[name], textarea[name], select[name]");

    expect([...editable].map((field) => field.getAttribute("name"))).toEqual([
      ...editableCompanyFields,
    ]);
  });

  it("alanları kayıtlı değerlerle doldurur", () => {
    render(<CompanyEditForm company={company} action={idle} />);

    expect(screen.getByLabelText("Şirket adı")).toHaveValue("Koala Temizlik");
    expect(screen.getByLabelText("Web sitesi (isteğe bağlı)")).toHaveValue("https://koala.test");
  });

  it("eksik zorunlu alanda backend'e hiç çıkmaz", async () => {
    const action = vi.fn(idle);
    const user = userEvent.setup();
    render(<CompanyEditForm company={{ ...company, name: "" }} action={action} />);

    await user.click(screen.getByRole("button", { name: "Değişiklikleri kaydet" }));

    expect(action).not.toHaveBeenCalled();
    expect(await screen.findByText("Şirket adı zorunlu.")).toBeInTheDocument();
  });

  it("yetkisizlik 404'ünü kendi metniyle gösterir", async () => {
    // `requireCompanyAdmin` yetkisiz çağrıya 404 dönüyor; "böyle bir şirket
    // yok" demek yanıltıcı olurdu.
    const user = userEvent.setup();
    render(
      <CompanyEditForm
        company={company}
        action={async () => ({
          status: "error",
          errorCode: "USER_NOT_ASSOCIATED_WITH_COMPANY",
          httpStatus: 404,
        })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Değişiklikleri kaydet" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Bu işlemi yapamıyoruz");
  });
});

describe("şirket logosu eylemleri", () => {
  afterEach(cleanup);

  it("logoyu kaydetme formundan ayrı, kendi eylemine bağlar", () => {
    // `PUT /companies/{id}/logo` ayrı bir uç: logoyu beş alanlık kaydetmeye
    // bağlamak, hiçbir alanı değiştirmeden logo değiştiren kullanıcıya
    // gereksiz bir güncelleme yaptırırdı.
    render(<CompanyLogoForms company={company} replaceAction={idle} removeAction={idle} />);

    expect(screen.getByRole("button", { name: "Logoyu yükle" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Logoyu kaldır" })).toBeInTheDocument();
  });

  it("logosu olmayan şirkette kaldırma eylemini hiç çizmez", () => {
    // Kaldırılacak bir şey yokken düğme, hiçbir şeyi değiştirmeyen bir istek
    // üretirdi.
    render(
      <CompanyLogoForms company={{ ...company, logoUrl: null }} replaceAction={idle} removeAction={idle} />,
    );

    expect(screen.queryByRole("button", { name: "Logoyu kaldır" })).not.toBeInTheDocument();
  });

  it("dosya alanını backend'in okuduğu uzantılarla sınırlar", () => {
    // `UploadValidator` desteklenen türü dosya adının uzantısından okuyor.
    render(<CompanyLogoForms company={company} replaceAction={idle} removeAction={idle} />);

    expect(screen.getByLabelText("Yeni logo")).toHaveAttribute(
      "accept",
      ".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp",
    );
  });
});
