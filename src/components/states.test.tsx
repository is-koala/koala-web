import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState, ErrorState, LoadingState } from "./states";

describe("ortak ekran durumları", () => {
  it("boş, hata ve yükleniyor durumlarını erişilebilir biçimde sunar", () => {
    const { rerender } = render(<LoadingState label="İlanlar yükleniyor" />);
    expect(screen.getByRole("status")).toHaveTextContent("İlanlar yükleniyor");

    rerender(<EmptyState kind="jobs" />);
    expect(screen.getByRole("status")).toHaveTextContent("Henüz ilan yok");

    rerender(<ErrorState errorCode="UNKNOWN" status={500} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Bir sorun oluştu");
  });
});
