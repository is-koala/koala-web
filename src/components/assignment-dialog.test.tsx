import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { AssignmentDialog } from "./assignment-dialog";

function renderDialog({
  pending = false,
  blockedReason = null,
}: {
  pending?: boolean;
  blockedReason?: string | null;
} = {}) {
  render(
    <AssignmentDialog
      titleId="assignment-dialog-title"
      title="Başvuruyu kabul et"
      subject="Ayşe Yılmaz"
      facts={[]}
      fields={null}
      confirmLabel="Kabulü onayla"
      pendingLabel="Karar gönderiliyor"
      pending={pending}
      blockedReason={blockedReason}
      formAction={vi.fn()}
      onClose={vi.fn()}
    />,
  );
}

it("önkoşul nedeniyle kapalı onayı kalıcı olarak işaretler", () => {
  renderDialog({ blockedReason: "İlanın kontenjanı doldu." });

  const confirm = screen.getByRole("button", { name: "Kabulü onayla" });
  expect(confirm).toBeDisabled();
  expect(confirm).toHaveAttribute(
    "data-disabled-kind",
    "permanent",
  );
});

it("yalnız istek sürerken kapanan diyalog düğmelerini kalıcı işaretlemez", () => {
  renderDialog({ pending: true });

  const confirm = screen.getByRole("button", { name: "Karar gönderiliyor" });
  const cancel = screen.getByRole("button", { name: "Vazgeç" });
  expect(confirm).toBeDisabled();
  expect(cancel).toBeDisabled();
  expect(confirm).not.toHaveAttribute("data-disabled-kind");
  expect(cancel).not.toHaveAttribute("data-disabled-kind");
});
