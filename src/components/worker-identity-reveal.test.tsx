import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { identityRevealVisibleMs, type IdentityRevealState } from "@/assignments/identity-reveal";

import { WorkerIdentityReveal } from "./worker-identity-reveal";

const identity = {
  fullName: "Çağrı Yılmaz",
  tcIdentityNumber: "10000000146",
  birthDate: "1990-05-17",
  verifiedAt: "2026-09-01T10:15:30Z",
  verificationMethod: "DOCUMENT" as const,
};

const revealButton = /Kimlik bilgilerini göster \(sigorta için\)/;

function doneAction() {
  return vi.fn(async (): Promise<IdentityRevealState> => ({ status: "done", identity }));
}

function failingAction(errorCode: string, httpStatus: number) {
  return vi.fn(async (): Promise<IdentityRevealState> => ({ status: "error", errorCode, httpStatus }));
}

describe("işçi kimliği görüntüleme bölümü", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("düğmeye basınca alanları değil onay diyaloğunu açar; vazgeçince istek atmaz", async () => {
    const user = userEvent.setup();
    const action = doneAction();
    render(<WorkerIdentityReveal workerName="Ayşe Yılmaz" action={action} />);

    expect(screen.getByRole("heading", { name: "Çalışanın kimlik bilgileri" })).toBeVisible();
    expect(screen.queryByText("10000000146")).toBeNull();

    await user.click(screen.getByRole("button", { name: revealButton }));

    const dialog = screen.getByRole("dialog", { name: "Kimlik bilgilerini görüntüle" });
    expect(dialog).toHaveTextContent("Görüntülemeniz kayda geçer ve çalışana bildirilir");
    // Kayda geçen bir eylemde ilk odak güvenli tarafta: "Vazgeç".
    expect(screen.getByRole("button", { name: "Vazgeç" })).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Vazgeç" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(action).not.toHaveBeenCalled();
    expect(screen.queryByText("10000000146")).toBeNull();
  });

  it("onaylayınca action'ı çağırır ve alanları maskesiz, TCKN'yi kopyalanabilir çizer", async () => {
    const user = userEvent.setup();
    const action = doneAction();
    render(<WorkerIdentityReveal workerName="Ayşe Yılmaz" action={action} />);

    await user.click(screen.getByRole("button", { name: revealButton }));
    await user.click(screen.getByRole("button", { name: "Görüntülemeyi onayla" }));

    const facts = await screen.findByLabelText("Kimlik bilgileri");
    expect(action).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(facts).toHaveTextContent("Çağrı Yılmaz");
    expect(screen.getByTestId("worker-identity-number")).toHaveTextContent("10000000146");
    expect(facts).toHaveTextContent("17 Mayıs 1990");
    expect(facts).toHaveTextContent("Kimlik belgesi fotoğrafı · 1 Eyl 2026 13:15");
    expect(facts).not.toHaveAttribute("data-masked");

    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await user.click(screen.getByRole("button", { name: "Kopyala" }));
    expect(writeText).toHaveBeenCalledWith("10000000146");
    expect(await screen.findByRole("button", { name: "Kopyalandı" })).toBeVisible();
  });

  /*
   * Zamanlayıcı testleri `userEvent` yerine `fireEvent` kullanıyor: sahte
   * zamanlayıcı yalnız `setTimeout`/`clearTimeout`'u alıyor ki React'ın
   * mikro görevleri ve action'ın `await`'i gerçek kalsın; `findBy*` ise
   * `waitFor` içinde gerçek aralık bekliyor ve sahte saatle takılıyor.
   */
  async function reveal(name: RegExp) {
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Görüntülemeyi onayla" }));
    });
    // Action'ın sözü çözülsün ve durum işlensin.
    await act(async () => {});
  }

  it("60 saniye sonra alanları maskeler; yeniden göster yeni bir istek atar ve süre yeniden başlar", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const action = doneAction();
    render(<WorkerIdentityReveal workerName="Ayşe Yılmaz" action={action} />);

    await reveal(revealButton);
    expect(screen.getByText("10000000146")).toBeVisible();

    await act(async () => {
      vi.advanceTimersByTime(identityRevealVisibleMs - 1);
    });
    expect(screen.getByText("10000000146")).toBeVisible();

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByText("10000000146")).toBeNull();
    expect(screen.queryByText("Çağrı Yılmaz")).toBeNull();
    expect(screen.queryByText("17 Mayıs 1990")).toBeNull();
    expect(screen.getByLabelText("Kimlik bilgileri")).toHaveAttribute("data-masked", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Süre doldu; bilgiler ekrandan kaldırıldı.");
    expect(screen.queryByRole("button", { name: "Kopyala" })).toBeNull();

    await reveal(/Yeniden göster/);
    expect(screen.getByText("10000000146")).toBeVisible();
    expect(screen.getByLabelText("Kimlik bilgileri")).not.toHaveAttribute("data-masked");
    expect(action).toHaveBeenCalledTimes(2);

    await act(async () => {
      vi.advanceTimersByTime(identityRevealVisibleMs);
    });
    expect(screen.queryByText("10000000146")).toBeNull();
  });

  it("bileşen ekrandan kalkınca zamanlayıcıyı temizler", async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    const { unmount } = render(<WorkerIdentityReveal workerName="Ayşe Yılmaz" action={doneAction()} />);

    await reveal(revealButton);
    expect(screen.getByText("10000000146")).toBeVisible();
    const maskTimer = setTimeoutSpy.mock.results[
      setTimeoutSpy.mock.calls.findIndex(([, delay]) => delay === identityRevealVisibleMs)
    ]?.value;
    expect(maskTimer).toBeDefined();

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalledWith(maskTimer);
    expect(document.body.textContent).not.toContain("10000000146");
    vi.restoreAllMocks();
  });

  it.each([
    ["WORKER_IDENTITY_NOT_VERIFIED", 409, "Sigorta bildirimi için çalışanın kimlik doğrulamasını tamamlaması gerekiyor"],
    ["IDENTITY_REVEAL_TOO_MANY_REQUESTS", 429, "Saatlik kimlik görüntüleme sınırına ulaştınız"],
    ["JOB_ASSIGNMENT_NOT_FOUND", 404, "Atama bulunamadı veya erişim yetkiniz yok."],
    ["UNEXPECTED", 500, "Biraz sonra yeniden dene"],
  ])("%s reddini kendi cümlesiyle yazar", async (errorCode, httpStatus, sentence) => {
    const user = userEvent.setup();
    render(<WorkerIdentityReveal workerName="Ayşe Yılmaz" action={failingAction(errorCode, httpStatus)} />);

    await user.click(screen.getByRole("button", { name: revealButton }));
    await user.click(screen.getByRole("button", { name: "Görüntülemeyi onayla" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(sentence);
    expect(screen.queryByLabelText("Kimlik bilgileri")).toBeNull();
    expect(screen.getByRole("button", { name: revealButton })).toBeEnabled();
  });
});
