import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ReviewActionState } from "@/assignments/review";

import { AssignmentReviewSection } from "./assignment-review";

describe("işçiyi değerlendirme bölümü", () => {
  it("beş yıldızı adlandırılmış radyo grubu olarak, yorumu backend sınırıyla çizer", () => {
    render(<AssignmentReviewSection workerName="Ayşe Yılmaz" action={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "İşçiyi değerlendir" })).toBeVisible();
    const group = screen.getByRole("group", { name: "Puan" });
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(5);
    expect(radios.map((radio) => radio.getAttribute("value"))).toEqual(["1", "2", "3", "4", "5"]);
    expect(screen.getByRole("radio", { name: "4 yıldız" })).toBeRequired();
    expect(group).toContainElement(radios[0]);
    expect(screen.getByLabelText("Yorum (isteğe bağlı)")).toHaveAttribute("maxlength", "2000");
    expect(screen.getByText("Ayşe Yılmaz ile çalışmanız nasıldı?", { exact: false })).toBeVisible();
    expect(screen.getByRole("button", { name: "Değerlendirmeyi gönder" })).toBeEnabled();
  });

  it("seçilen puana kadar olan yıldızları doldurur ve puanı okunur yazar", async () => {
    const user = userEvent.setup();
    render(<AssignmentReviewSection workerName="Ayşe Yılmaz" action={vi.fn()} />);

    await user.click(screen.getByRole("radio", { name: "3 yıldız" }));

    expect(screen.getByRole("radio", { name: "3 yıldız" })).toBeChecked();
    expect(screen.getByText("3 / 5")).toBeVisible();
    const filled = document.querySelectorAll('.rating-star label[data-filled="true"]');
    expect(filled).toHaveLength(3);
  });

  it("gönderimde puan ve yorumu action'a geçirir; başarıda formu kapatıp değerlendirmeyi yazar", async () => {
    const user = userEvent.setup();
    const action = vi.fn(async (_state: ReviewActionState, form: FormData): Promise<ReviewActionState> => ({
      status: "done",
      review: {
        rating: Number(form.get("rating")),
        comment: String(form.get("comment")),
      },
    }));
    render(<AssignmentReviewSection workerName="Ayşe Yılmaz" action={action} />);

    await user.click(screen.getByRole("radio", { name: "4 yıldız" }));
    await user.type(screen.getByLabelText("Yorum (isteğe bağlı)"), "Dakikti");
    await user.click(screen.getByRole("button", { name: "Değerlendirmeyi gönder" }));

    const summary = await screen.findByTestId("assignment-review-summary");
    expect(summary).toHaveTextContent("Değerlendirmeniz: ★4 · Dakikti");
    expect(summary).toHaveAttribute("role", "status");
    expect(screen.queryByRole("button", { name: "Değerlendirmeyi gönder" })).toBeNull();
    expect(screen.queryByRole("radio")).toBeNull();
    const [, form] = action.mock.calls[0];
    expect(form.get("rating")).toBe("4");
    expect(form.get("comment")).toBe("Dakikti");
  });

  it("yorumsuz değerlendirmede yalnız puanı yazar", async () => {
    const user = userEvent.setup();
    const action = vi.fn(async (): Promise<ReviewActionState> => ({
      status: "done",
      review: { rating: 5, comment: null },
    }));
    render(<AssignmentReviewSection workerName="Ayşe Yılmaz" action={action} />);

    await user.click(screen.getByRole("radio", { name: "5 yıldız" }));
    await user.click(screen.getByRole("button", { name: "Değerlendirmeyi gönder" }));

    expect(await screen.findByTestId("assignment-review-summary")).toHaveTextContent(/Değerlendirmeniz: ★5$/);
  });

  it("409 'zaten değerlendirilmiş' cevabında form yerine mevcut değerlendirme notunu gösterir", async () => {
    const user = userEvent.setup();
    const action = vi.fn(async (): Promise<ReviewActionState> => ({ status: "reviewed" }));
    render(<AssignmentReviewSection workerName="Ayşe Yılmaz" action={action} />);

    await user.click(screen.getByRole("radio", { name: "2 yıldız" }));
    await user.click(screen.getByRole("button", { name: "Değerlendirmeyi gönder" }));

    const existing = await screen.findByTestId("assignment-review-existing");
    expect(existing).toHaveTextContent("Bu atamayı daha önce değerlendirdiniz.");
    expect(screen.queryByRole("button", { name: "Değerlendirmeyi gönder" })).toBeNull();
  });

  it("backend reddini hata kodundan Türkçe metne çevirir ve formu açık tutar", async () => {
    const user = userEvent.setup();
    const action = vi.fn(async (): Promise<ReviewActionState> => ({
      status: "error",
      errorCode: "REVIEW_WORK_NOT_COMPLETED",
      httpStatus: 409,
    }));
    render(<AssignmentReviewSection workerName="Ayşe Yılmaz" action={action} />);

    await user.click(screen.getByRole("radio", { name: "1 yıldız" }));
    await user.click(screen.getByRole("button", { name: "Değerlendirmeyi gönder" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/Atama tamamlanmadan değerlendirme yapılamaz/);
    expect(screen.getByRole("button", { name: "Değerlendirmeyi gönder" })).toBeEnabled();
  });

  it("hata sonrası yorum ve yıldız seçimi durur; ikinci gönderim aynı değerlerle gider", async () => {
    // React 19 `<form action>` başarısız gönderimde de formu sıfırlıyordu:
    // yorum siliniyor, radyonun DOM işareti kalkıyor ve `required` ikinci
    // gönderimi durduruyordu. İki gönderim de aynı değerleri taşımalı.
    const user = userEvent.setup();
    const action = vi.fn()
      .mockResolvedValueOnce({ status: "error", errorCode: "SOMETHING_NEW", httpStatus: 500 } satisfies ReviewActionState)
      .mockResolvedValueOnce({ status: "done", review: { rating: 4, comment: "Dakikti" } } satisfies ReviewActionState);
    render(<AssignmentReviewSection workerName="Ayşe Yılmaz" action={action} />);

    await user.click(screen.getByRole("radio", { name: "4 yıldız" }));
    await user.type(screen.getByLabelText("Yorum (isteğe bağlı)"), "Dakikti");
    await user.click(screen.getByRole("button", { name: "Değerlendirmeyi gönder" }));

    expect(await screen.findByRole("alert")).toBeVisible();
    const radio = screen.getByRole("radio", { name: "4 yıldız" });
    expect(radio).toBeChecked();
    expect((radio as HTMLInputElement).checked).toBe(true);
    expect(screen.getByLabelText("Yorum (isteğe bağlı)")).toHaveValue("Dakikti");
    expect(screen.getByText("4 / 5")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Değerlendirmeyi gönder" }));

    expect(await screen.findByTestId("assignment-review-summary")).toHaveTextContent("Değerlendirmeniz: ★4 · Dakikti");
    expect(action).toHaveBeenCalledTimes(2);
    for (const [, form] of action.mock.calls as [unknown, FormData][]) {
      expect(form.get("rating")).toBe("4");
      expect(form.get("comment")).toBe("Dakikti");
    }
  });

  it("bilinmeyen kodda nötr yedeği yazar", async () => {
    const user = userEvent.setup();
    const action = vi.fn(async (): Promise<ReviewActionState> => ({
      status: "error",
      errorCode: "SOMETHING_NEW",
      httpStatus: 500,
    }));
    render(<AssignmentReviewSection workerName="Ayşe Yılmaz" action={action} />);

    await user.click(screen.getByRole("radio", { name: "1 yıldız" }));
    await user.click(screen.getByRole("button", { name: "Değerlendirmeyi gönder" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("İşlemi şu anda tamamlayamadık.");
  });
});
