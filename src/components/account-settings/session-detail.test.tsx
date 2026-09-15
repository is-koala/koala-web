import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { FormState } from "@/lib/form-state";
import type { SessionDetail } from "@/lib/session-detail";

import { SessionDetailScreen } from "./session-detail";

const detail: SessionDetail = {
  id: "4ace3ee5-f9fd-420c-8926-b35f2b82915a",
  deviceId: "30c46a8e-3e1b-4c35-b616-550171243a8b",
  deviceType: "IOS",
  deviceName: "iPhone 14 Pro Max · iOS 18.1 · Koala 1.1.0",
  deviceCustomName: null,
  ipAddress: null,
  location: null,
  createdAt: null,
  lastAccessedAt: null,
  refreshExpiresAt: null,
  current: false,
  logins: 0,
  loginHistory: [],
};

const idle: FormState = { status: "idle" };

type RenameAction = (state: FormState, formData: FormData) => Promise<FormState>;

function renderScreen(renameAction: RenameAction) {
  const revokeAction = vi.fn(async () => idle);
  render(
    <SessionDetailScreen
      shell="worker"
      detail={detail}
      renameAction={renameAction}
      revokeAction={revokeAction}
    />,
  );
}

describe("cihaz adlandırma formu", () => {
  it("hata dönüşünde yazılan adı alanda tutar", async () => {
    // React 19 `<form action>` gönderim bitince formu koşulsuz sıfırlıyor;
    // 404'te alan boşalıyordu (ölçüldü). Form `onSubmit` + `startTransition`
    // ile gönderiliyor ve ad durumda duruyor — bu test o kalıbı pinliyor.
    const renameAction = vi.fn<RenameAction>(async () => ({
      status: "error",
      errorCode: "DEVICE_NOT_FOUND",
      httpStatus: 404,
    }));
    renderScreen(renameAction);
    const user = userEvent.setup();

    const field = screen.getByRole("textbox", { name: "Cihaz adı" });
    await user.type(field, "Evdeki iPad");
    await user.click(screen.getByRole("button", { name: "Cihazı adlandır" }));

    expect(await screen.findByRole("alert")).toBeVisible();
    expect(field).toHaveValue("Evdeki iPad");
    const sent = renameAction.mock.calls[0]![1];
    expect(sent.get("name")).toBe("Evdeki iPad");
    expect(sent.get("deviceId")).toBe(detail.deviceId);
    expect(sent.get("sessionId")).toBe(detail.id);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("başarıda onayı yazar ve yeni adı başlıkta gösterir", async () => {
    const renameAction = vi.fn(async (): Promise<FormState> => ({ status: "done" }));
    renderScreen(renameAction);
    const user = userEvent.setup();

    await user.type(screen.getByRole("textbox", { name: "Cihaz adı" }), "  Evdeki iPad  ");
    await user.click(screen.getByRole("button", { name: "Cihazı adlandır" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Cihaz adı güncellendi.");
    expect(screen.getByRole("heading", { name: "Evdeki iPad" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: /iPhone 14 Pro Max/ })).toBeNull();
    expect(screen.getByRole("textbox", { name: "Cihaz adı" })).toHaveValue("  Evdeki iPad  ");
  });

  it("alan hatasını alanın altına yazar", async () => {
    const renameAction = vi.fn(async (): Promise<FormState> => ({
      status: "error",
      errorCode: "VALIDATION_FAILED",
      httpStatus: 400,
      fieldErrors: { name: "Cihaz adı en fazla 60 karakter olabilir." },
    }));
    renderScreen(renameAction);
    const user = userEvent.setup();

    await user.type(screen.getByRole("textbox", { name: "Cihaz adı" }), "uzun ad");
    await user.click(screen.getByRole("button", { name: "Cihazı adlandır" }));

    expect(await screen.findByText("Cihaz adı en fazla 60 karakter olabilir.")).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Cihaz adı" })).toHaveAttribute("aria-invalid", "true");
  });
});
