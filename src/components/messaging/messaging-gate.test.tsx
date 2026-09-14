import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { errorPresentation } from "@/lib/errors";

import { MessagingGate } from "./messaging-gate";

const assignmentId = "3b1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f6e";

function renderGate(
  availability: Parameters<typeof MessagingGate>[0]["availability"],
  party: "employer" | "worker" = "employer",
) {
  return render(
    <MessagingGate availability={availability} party={party} assignmentId={assignmentId}>
      <button type="button">Mesaj gönder</button>
    </MessagingGate>,
  );
}

describe("mesaj düğmesinin ödeme kapısı", () => {
  it("AVAILABLE iken düğmeyi olduğu gibi çizer, açıklama yazmaz", () => {
    renderGate({ available: true, reason: "AVAILABLE" });

    expect(screen.getByRole("button", { name: "Mesaj gönder" })).toBeVisible();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("link", { name: "Ödemeyi tamamla" })).toBeNull();
  });

  it("PAYMENT_REQUIRED iken işverene açıklama ve ödeme yolunu gösterir", () => {
    renderGate({ available: false, reason: "PAYMENT_REQUIRED" });

    expect(screen.queryByRole("button", { name: "Mesaj gönder" })).toBeNull();
    // Kapının cümlesi `MESSAGING_PAYMENT_REQUIRED` kataloğ metniyle aynı:
    // kullanıcı önden de, kapı bayatlayıp 403 yediğinde de aynı şeyi okur.
    expect(screen.getByRole("status")).toHaveTextContent(
      errorPresentation("MESSAGING_PAYMENT_REQUIRED", 403).message,
    );
    expect(screen.getByRole("link", { name: "Ödemeyi tamamla" })).toHaveAttribute(
      "href",
      `/isveren/atama/${assignmentId}/odeme`,
    );
  });

  it("PAYMENT_REQUIRED iken çalışana yalnız açıklama gösterir; ödeme yolu işverenin", () => {
    renderGate({ available: false, reason: "PAYMENT_REQUIRED" }, "worker");

    expect(screen.queryByRole("button", { name: "Mesaj gönder" })).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(/işveren ödemeyi tamamladığında açılır/);
    expect(screen.queryByRole("link", { name: "Ödemeyi tamamla" })).toBeNull();
  });

  it("CLOSED iken sohbetin kapandığını söyler ve ödeme yolu sunmaz", () => {
    renderGate({ available: false, reason: "CLOSED" });

    expect(screen.queryByRole("button", { name: "Mesaj gönder" })).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(/^Sohbet kapandı\./);
    expect(screen.queryByRole("link", { name: "Ödemeyi tamamla" })).toBeNull();
  });

  it("karar yoksa hiçbir şey çizmez", () => {
    // Alanı taşımayan eski bir yanıt: ne düğme ne açıklama. Düğme kullanıcıyı
    // 403'e yollar, açıklama ise yanlış bir sebep söylerdi.
    const { container } = renderGate(null);

    expect(container).toBeEmptyDOMElement();
  });
});
