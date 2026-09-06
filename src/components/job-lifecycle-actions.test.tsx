import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { JobLifecycleState } from "@/jobs/lifecycle";

import { JobLifecycleActions } from "./job-lifecycle-actions";

/** Gönderileni okuyabilmek için imzası gerçek action ile aynı taklit. */
function stubAction() {
  return vi.fn(async (state: JobLifecycleState, formData: FormData) => {
    void state;
    void formData;
    return { status: "idle" } as const;
  });
}

const idle = stubAction();

describe("ilan kapatma ve iptal eylemleri", () => {
  it("yayındaki ilanda iki eylemi de sunar ve farklarını yazar", () => {
    render(<JobLifecycleActions status="OPEN" action={idle} />);

    expect(screen.getByRole("button", { name: "İlanı kapat" })).toBeVisible();
    expect(screen.getByRole("button", { name: "İlanı iptal et" })).toBeVisible();
    // Kabul maddesi: kapat ile iptal arasındaki fark ekranda anlatılmalı.
    expect(screen.getByText(/aramalarda görünmez/)).toBeVisible();
    expect(screen.getByText(/geri alınamaz/)).toBeVisible();
  });

  it("kapalı ilanda kapatma düğmesini çizmez, nedenini yazar", () => {
    render(<JobLifecycleActions status="CLOSED" action={idle} />);

    expect(screen.queryByRole("button", { name: "İlanı kapat" })).toBeNull();
    expect(screen.getByText("Bu ilan zaten kapalı; yeniden kapatılamaz.")).toBeVisible();
    expect(screen.getByRole("button", { name: "İlanı iptal et" })).toBeVisible();
  });

  it("iptal edilmiş ilanda hiçbir eylemi düğme olarak göstermez", () => {
    render(<JobLifecycleActions status="CANCELLED" action={idle} />);

    expect(screen.queryByRole("button", { name: "İlanı kapat" })).toBeNull();
    expect(screen.queryByRole("button", { name: "İlanı iptal et" })).toBeNull();
    expect(screen.getByText("Bu ilan zaten iptal edildi.")).toBeVisible();
  });

  it("iptali onay istemeden göndermez", async () => {
    const action = stubAction();
    render(<JobLifecycleActions status="OPEN" action={action} />);

    await userEvent.click(screen.getByRole("button", { name: "İlanı iptal et" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("geri alınamaz");
    expect(action).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Vazgeç" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(action).not.toHaveBeenCalled();
  });

  it("onaylanan geçişi kendi işlem adıyla gönderir", async () => {
    const action = stubAction();
    render(<JobLifecycleActions status="OPEN" action={action} />);

    await userEvent.click(screen.getByRole("button", { name: "İlanı kapat" }));
    await userEvent.click(screen.getByRole("button", { name: "Kapatmayı onayla" }));

    expect(action).toHaveBeenCalled();
    const submitted = action.mock.calls[0][1];
    expect(submitted.get("operation")).toBe("close");
  });

  it("canlı atama reddinde kullanıcıyı atamanın kendi akışına yollar", () => {
    render(
      <JobLifecycleActions
        status="OPEN"
        action={idle}
        initialState={{ status: "error", errorCode: "JOB_HAS_LIVE_ASSIGNMENT", httpStatus: 409 }}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("devam eden bir atama");
    expect(screen.getByRole("link", { name: "Atamalarına git" })).toHaveAttribute(
      "href",
      "/isveren/atamalar",
    );
  });

  it("bilinmeyen bir kodda ham metin uydurmaz, nötr Türkçe yedeğe düşer", () => {
    render(
      <JobLifecycleActions
        status="OPEN"
        action={idle}
        initialState={{ status: "error", errorCode: "UNEXPECTED", httpStatus: 500 }}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "İşlemi şu anda tamamlayamadık. Biraz sonra yeniden dene.",
    );
  });

  it("tamamlanan geçişi kullanıcıya adıyla bildirir", () => {
    render(
      <JobLifecycleActions
        status="CANCELLED"
        action={idle}
        initialState={{ status: "done", operation: "cancel" }}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("İlan iptal edildi.");
  });
});
