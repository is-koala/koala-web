import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
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

  it.each([
    ["TOKEN_EXPIRED", 401, "Giriş yap", "/giris"],
    ["ACCESS_DENIED", 403, "Ana sayfaya dön", "/"],
  ])("%s hatasının güvenli site içi bağlantısını gösterir", (errorCode, status, label, href) => {
    render(<ErrorState errorCode={errorCode} status={status} />);

    expect(screen.getByRole("link", { name: label })).toHaveAttribute("href", href);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("yeniden deneme callback'i yokken çalışmayan bir eylem göstermez", () => {
    render(<ErrorState errorCode="TOO_MANY_REQUESTS" status={429} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("yeniden deneme eylemini doğal klavye sırasından tam bir kez çağırır", async () => {
    const retry = vi.fn();
    const user = userEvent.setup();
    render(<ErrorState errorCode="TOO_MANY_REQUESTS" status={429} onRetry={retry} />);

    const button = screen.getByRole("button", { name: "Yeniden dene" });
    expect(button).toHaveAttribute("type", "button");
    expect(retry).not.toHaveBeenCalled();

    await user.tab();
    expect(button).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(retry).toHaveBeenCalledTimes(1);
    await user.keyboard(" ");
    expect(retry).toHaveBeenCalledTimes(2);
  });

  it("bağlantı ve eylemsiz hata türlerinde verilen callback'i kullanmaz", async () => {
    const retry = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <ErrorState errorCode="TOKEN_EXPIRED" status={401} onRetry={retry} />,
    );

    const link = screen.getByRole("link", { name: "Giriş yap" });
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    await user.tab();
    expect(link).toHaveFocus();
    expect(retry).not.toHaveBeenCalled();

    rerender(<ErrorState errorCode="INVALID_CREDENTIALS" status={401} onRetry={retry} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(retry).not.toHaveBeenCalled();
  });
});
