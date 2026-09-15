import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  identityRevealVisibleMs,
  type IdentityRevealState,
  type WorkerIdentity,
} from "@/assignments/identity-reveal";

import { WorkerIdentityReveal } from "./worker-identity-reveal";

const identity: WorkerIdentity = {
  fullName: "Çağrı Yılmaz",
  tcIdentityNumber: "10000000146",
  birthDate: "1990-05-17",
  verifiedAt: "2026-09-01T10:15:30Z",
  verificationMethod: "DOCUMENT",
};

const revealButton = /Kimlik bilgilerini göster \(sigorta için\)/;

function doneAction(overrides: Partial<WorkerIdentity> = {}) {
  return vi.fn(async (): Promise<IdentityRevealState> => ({
    status: "done",
    identity: { ...identity, ...overrides },
  }));
}

function failingAction(errorCode: string, httpStatus: number) {
  return vi.fn(async (): Promise<IdentityRevealState> => ({ status: "error", errorCode, httpStatus }));
}

/** Tarayıcı panosunu taklit eder; `afterEach` geri alıyor. */
function stubClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  return writeText;
}

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
  // Action'ın sözü çözülsün ve geçiş bitsin.
  await act(async () => {});
}

describe("işçi kimliği görüntüleme bölümü", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    Reflect.deleteProperty(navigator, "clipboard");
  });

  it("düğmeye basınca alanları değil onay diyaloğunu açar; vazgeçince istek atmaz", async () => {
    const user = userEvent.setup();
    const action = doneAction();
    render(<WorkerIdentityReveal workerName="Ayşe Yılmaz" action={action} />);

    expect(screen.getByRole("heading", { name: "Çalışanın kimlik bilgileri" })).toBeVisible();
    expect(screen.queryByText("10000000146")).toBeNull();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();

    await user.click(screen.getByRole("button", { name: revealButton }));

    const dialog = screen.getByRole("dialog", { name: "Kimlik bilgilerini görüntüle" });
    expect(dialog).toHaveTextContent("Görüntülemeniz kayda geçer ve çalışana bildirilir");
    // Kayda geçen bir eylemde ilk odak güvenli tarafta: "Vazgeç".
    expect(screen.getByRole("button", { name: "Vazgeç" })).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Vazgeç" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(action).not.toHaveBeenCalled();
    expect(screen.queryByText("10000000146")).toBeNull();
    expect(screen.getByRole("button", { name: revealButton })).toHaveFocus();
  });

  it("onaylayınca action'ı çağırır ve alanları maskesiz, TCKN'yi kopyalanabilir çizer", async () => {
    const user = userEvent.setup();
    const writeText = stubClipboard();
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

    await user.click(screen.getByRole("button", { name: "Kopyala" }));
    expect(writeText).toHaveBeenCalledWith("10000000146");
    expect(await screen.findByRole("button", { name: "Kopyalandı" })).toBeVisible();
  });

  it("istek sürerken diyalog kapanmaz; yanıt gelince odak düğmeye döner ve canlı bölge sonucu okur", async () => {
    const user = userEvent.setup();
    let resolve: (state: IdentityRevealState) => void = () => {};
    const action = vi.fn(() => new Promise<IdentityRevealState>((done) => { resolve = done; }));
    render(<WorkerIdentityReveal workerName="Ayşe Yılmaz" action={action} />);

    await user.click(screen.getByRole("button", { name: revealButton }));
    await user.click(screen.getByRole("button", { name: "Görüntülemeyi onayla" }));

    // Uçuşta: diyalog açık, iki düğmesi de kapalı, Escape kapatmıyor.
    const dialog = screen.getByRole("dialog");
    expect(screen.getByRole("button", { name: "Kimlik bilgileri alınıyor" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Vazgeç" })).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(dialog).toBeInTheDocument();
    expect(document.activeElement).not.toBe(document.body);

    await act(async () => {
      resolve({ status: "done", identity });
    });

    expect(screen.queryByRole("dialog")).toBeNull();
    const trigger = screen.getByRole("button", { name: revealButton });
    expect(trigger).toBeEnabled();
    expect(trigger).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent("Kimlik bilgileri görüntülendi.");
    expect(screen.getByRole("status")).toHaveClass("visually-hidden");
  });

  it("boş gelen alanı maskeyle karıştırmaz: açık hâlde tire, maskede nokta", async () => {
    const user = userEvent.setup();
    render(
      <WorkerIdentityReveal
        workerName="Ayşe Yılmaz"
        action={doneAction({ birthDate: null, verifiedAt: null, verificationMethod: "UNKNOWN" })}
      />,
    );

    await user.click(screen.getByRole("button", { name: revealButton }));
    await user.click(screen.getByRole("button", { name: "Görüntülemeyi onayla" }));

    const facts = await screen.findByLabelText("Kimlik bilgileri");
    expect(facts).toHaveTextContent("Doğum tarihi—");
    expect(facts).toHaveTextContent("DoğrulamaDoğrulandı");
    expect(facts).not.toHaveTextContent("•");
  });

  it("60 saniye sonra alanları maskeler ve yanıtı durumdan düşürür; yeniden göster yeni istek atar, süre yeniden başlar", async () => {
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
    expect(document.body.textContent).not.toContain("10000000146");
    expect(document.body.textContent).not.toContain("Çağrı Yılmaz");
    expect(document.body.textContent).not.toContain("17 Mayıs 1990");
    const facts = screen.getByLabelText("Kimlik bilgileri");
    expect(facts).toHaveAttribute("data-masked", "true");
    expect(facts).toHaveTextContent("•••••••••••");
    expect(facts).not.toHaveTextContent("—");
    expect(screen.getByRole("status")).toHaveTextContent("Süre doldu; bilgiler ekrandan kaldırıldı.");
    expect(screen.getByRole("status")).not.toHaveClass("visually-hidden");
    expect(screen.queryByRole("button", { name: "Kopyala" })).toBeNull();

    await reveal(/Yeniden göster/);
    expect(screen.getByText("10000000146")).toBeVisible();
    expect(screen.getByLabelText("Kimlik bilgileri")).not.toHaveAttribute("data-masked");
    expect(action).toHaveBeenCalledTimes(2);

    await act(async () => {
      vi.advanceTimersByTime(identityRevealVisibleMs);
    });
    expect(document.body.textContent).not.toContain("10000000146");
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
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: revealButton })).toBeEnabled();
    expect(screen.getByRole("button", { name: revealButton })).toHaveFocus();
  });
});
