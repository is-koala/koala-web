import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";

import type {
  AccountDeletionAction,
  AccountDeletionActionState,
} from "@/app/(uygulama)/hesap-actions";

import { AccountDeletionSettings } from "./account-deletion-settings";

const refresh = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

beforeEach(() => {
  refresh.mockClear();
});

it("geri alınamaz talebi açık onaydan sonra gönderir ve bekleme durumunu gösterir", async () => {
  const action = vi.fn<AccountDeletionAction>(
    async (): Promise<AccountDeletionActionState> => ({
      status: "done",
      outcome: "created",
      deletion: {
        status: "REQUESTED",
        requestedAt: "2026-09-09T09:30:00Z",
        processedAt: null,
        blockedReason: null,
      },
    }),
  );
  const user = userEvent.setup();
  render(<AccountDeletionSettings initialStatus={{ kind: "not-requested" }} action={action} />);

  const region = screen.getByRole("region", { name: "Hesap silme" });
  expect(region).toHaveTextContent("geri alınamaz");
  expect(region).toHaveTextContent("bekleme süresi");
  expect(within(region).getByRole("link", { name: "Destekten yardım al" })).toHaveAttribute(
    "href",
    "/iletisim",
  );

  await user.type(within(region).getByLabelText("Silme nedeni (isteğe bağlı)"), "Artık kullanmıyorum");
  await user.click(within(region).getByRole("button", { name: "Silme talebi oluştur" }));
  expect(action).not.toHaveBeenCalled();

  await user.click(
    within(region).getByRole("checkbox", {
      name: /hesabım işlendiğinde bu işlemin geri alınamayacağını anlıyorum/i,
    }),
  );
  await user.click(within(region).getByRole("button", { name: "Silme talebi oluştur" }));

  expect(action).toHaveBeenCalledOnce();
  const submitted = action.mock.calls[0]?.[1];
  expect(submitted.get("confirmation")).toBe("account-deletion-irrevocable");
  expect(submitted.get("reason")).toBe("Artık kullanmıyorum");
  expect(await within(region).findByRole("status")).toHaveTextContent("Talebin alındı");
  expect(region).toHaveTextContent("Oturumun bu sırada açık kalır");
});

it("reddedilen talebin sonucunu gösterir ve backend'in izin verdiği yeni talep yolunu açık bırakır", () => {
  const action = vi.fn(async (state: AccountDeletionActionState) => state);
  render(
    <AccountDeletionSettings
      initialStatus={{
        kind: "request",
        deletion: {
          status: "REJECTED",
          requestedAt: "2026-09-01T08:00:00Z",
          processedAt: "2026-09-03T10:00:00Z",
          blockedReason: "Kimlik doğrulaması için destekle görüş.",
        },
      }}
      action={action}
    />,
  );

  const region = screen.getByRole("region", { name: "Hesap silme" });
  expect(region).toHaveTextContent("Talebin sonuçlandırılamadı");
  expect(region).toHaveTextContent("Kimlik doğrulaması için destekle görüş.");
  expect(within(region).getByRole("button", { name: "Yeni silme talebi oluştur" })).toBeVisible();
});

it("durum okuma hatasını güvenli metin ve kullanıcı tarafından paylaşılabilir destek koduyla gösterir", () => {
  const action = vi.fn(async (state: AccountDeletionActionState) => state);
  render(
    <AccountDeletionSettings
      initialStatus={{
        kind: "error",
        errorCode: "UPSTREAM_UNAVAILABLE",
        httpStatus: 503,
        requestId: "8847a941-da0e-45f3-868e-b262896243e4",
      }}
      action={action}
    />,
  );

  const region = screen.getByRole("region", { name: "Hesap silme" });
  expect(within(region).getByRole("alert")).toHaveTextContent("Bir sorun oluştu");
  expect(region).toHaveTextContent("Destek kodu: 8847a941-da0e-45f3-868e-b262896243e4");
  expect(within(region).queryByRole("button", { name: /silme talebi oluştur/i })).toBeNull();
});

it("geçici durum okuma hatasını panel içinde yeniden yüklemeyi deneyebilir", async () => {
  const action = vi.fn(async (state: AccountDeletionActionState) => state);
  const user = userEvent.setup();
  render(
    <AccountDeletionSettings
      initialStatus={{
        kind: "error",
        errorCode: "UPSTREAM_UNAVAILABLE",
        httpStatus: 503,
        requestId: null,
      }}
      action={action}
    />,
  );

  const region = screen.getByRole("region", { name: "Hesap silme" });
  await user.click(within(region).getByRole("button", { name: "Yeniden dene" }));

  expect(refresh).toHaveBeenCalledOnce();
  expect(action).not.toHaveBeenCalled();
});

it.each([
  ["ANONYMIZED", "Hesabın anonimleştirildi", "Tamamlanma tarihi"],
  ["FUTURE_STATUS", "Talep durumu doğrulanamadı", "Yeni talep oluşturmadan"],
] as const)("%s durumunu fail-closed sonuç ekranıyla gösterir", (status, heading, detail) => {
  const action = vi.fn(async (state: AccountDeletionActionState) => state);
  render(
    <AccountDeletionSettings
      initialStatus={{
        kind: "request",
        deletion: {
          status,
          requestedAt: "2026-09-01T08:00:00Z",
          processedAt: "2026-09-03T10:00:00Z",
          blockedReason: null,
        },
      }}
      action={action}
    />,
  );

  const region = screen.getByRole("region", { name: "Hesap silme" });
  expect(region).toHaveTextContent(heading);
  expect(region).toHaveTextContent(detail);
  expect(within(region).queryByRole("button", { name: /silme talebi oluştur/i })).toBeNull();
});

it("action hatasında duplicate kodunu ve destek kimliğini ham metinsiz gösterir", async () => {
  const action = vi.fn(async (): Promise<AccountDeletionActionState> => ({
    status: "error",
    errorCode: "LEGAL_DELETION_ALREADY_REQUESTED",
    httpStatus: 409,
    requestId: "993e6b6d-a7ec-4a58-82e0-2f3a1fd21ef9",
  }));
  const user = userEvent.setup();
  render(<AccountDeletionSettings initialStatus={{ kind: "not-requested" }} action={action} />);

  const region = screen.getByRole("region", { name: "Hesap silme" });
  await user.click(within(region).getByRole("checkbox"));
  await user.click(within(region).getByRole("button", { name: "Silme talebi oluştur" }));

  expect(await within(region).findByRole("alert")).toHaveTextContent("Silme talebin zaten var");
  expect(region).toHaveTextContent("Destek kodu: 993e6b6d-a7ec-4a58-82e0-2f3a1fd21ef9");
});

it("sunucu onay reddini onay kutusuna erişilebilir hata olarak bağlar", async () => {
  const action = vi.fn<AccountDeletionAction>().mockResolvedValue({
    status: "error",
    errorCode: "VALIDATION_FAILED",
    httpStatus: 400,
    fieldErrors: { confirmation: "Geri alınamaz etkiyi onaylamalısın." },
  });
  const user = userEvent.setup();
  render(<AccountDeletionSettings initialStatus={{ kind: "not-requested" }} action={action} />);

  const region = screen.getByRole("region", { name: "Hesap silme" });
  const confirmation = within(region).getByRole("checkbox");
  await user.click(confirmation);
  await user.click(within(region).getByRole("button", { name: "Silme talebi oluştur" }));

  expect(confirmation).toHaveAttribute("aria-invalid", "true");
  const errorId = confirmation.getAttribute("aria-describedby");
  expect(errorId).toBeTruthy();
  expect(document.getElementById(errorId!)).toHaveTextContent(
    "Geri alınamaz etkiyi onaylamalısın.",
  );

  const field = confirmation.parentElement;
  const error = document.getElementById(errorId!);
  expect(field).toHaveClass("checkbox-field-with-error");
  expect(Array.from(field!.children)).toEqual([
    confirmation,
    within(region).getByText(/hesabım işlendiğinde bu işlemin geri alınamayacağını/i),
    error,
  ]);

  // JSDOM kutu ölçüsü üretmez; grid sözleşmesi, hata metninin telefon
  // genişliğinde üçüncü bir flex sütununa dönüşmemesini yine de doğrular.
  const style = document.createElement("style");
  style.textContent = readFileSync(resolve("src/app/globals.css"), "utf8");
  document.head.append(style);
  expect(getComputedStyle(field!).display).toBe("grid");
  expect(getComputedStyle(error!).gridColumn).toBe("2");
  style.remove();
});
