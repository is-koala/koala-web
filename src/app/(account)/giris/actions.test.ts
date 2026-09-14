import { describe, expect, it, vi } from "vitest";

import { idleFormState } from "@/lib/form-state";
import { ApiError } from "@/server/api/errors";

import { redirectTo } from "../../../../tests/support/navigation";

import { loginAction } from "./actions";

const signIn = vi.hoisted(() => vi.fn());
const viewerShell = vi.hoisted(() => vi.fn());

vi.mock("@/server/auth/login", () => ({ signIn }));
vi.mock("@/server/session/viewer", () => ({ viewerShell }));
vi.mock("next/navigation", async () => {
  const navigation = await import("../../../../tests/support/navigation");
  return {
    redirect: navigation.throwingRedirect(),
    unstable_rethrow: navigation.rethrowTestNavigationError,
  };
});

function submission(fields: Record<string, string>) {
  const formData = new FormData();
  for (const [name, value] of Object.entries(fields)) formData.set(name, value);
  return formData;
}

describe("giriş action'ı", () => {
  it("kimlik bilgilerini oturum katmanına verir", async () => {
    signIn.mockResolvedValueOnce(undefined);

    await loginAction(
      idleFormState,
      submission({ email: "aday@example.test", password: "parola-yer-tutucu", next: "/" }),
    ).catch(() => {});

    expect(signIn).toHaveBeenCalledWith({
      email: "aday@example.test",
      password: "parola-yer-tutucu",
    });
  });

  it("başarılı girişten sonra dönüş hedefine yönlendirir", async () => {
    signIn.mockResolvedValueOnce(undefined);

    await expect(
      loginAction(idleFormState, submission({ email: "a@b.test", password: "p", next: "/panel/islerim" })),
    ).rejects.toThrowError(new Error(redirectTo("/panel/islerim")));
  });

  it("dönüş hedefi varken rolü hiç okumaz", async () => {
    signIn.mockResolvedValueOnce(undefined);

    await loginAction(
      idleFormState,
      submission({ email: "a@b.test", password: "p", next: "/panel/islerim" }),
    ).catch(() => {});

    expect(viewerShell).not.toHaveBeenCalled();
  });

  it("site dışına çıkan hedefi yok sayıp kullanıcının kabuğuna yollar", async () => {
    signIn.mockResolvedValueOnce(undefined);
    viewerShell.mockResolvedValueOnce("employer");

    // Gizli alan tarayıcıdan geçiyor: sayfa doğrulamış olsa bile action
    // gelen değeri yeniden doğrulamak zorunda.
    await expect(
      loginAction(idleFormState, submission({ email: "a@b.test", password: "p", next: "//kotu.example" })),
    ).rejects.toThrowError(new Error(redirectTo("/isveren")));
  });

  it("hedefsiz girişte çalışanı panele, rolü okunamayanı ana sayfaya yollar", async () => {
    signIn.mockResolvedValue(undefined);
    viewerShell.mockResolvedValueOnce("worker");

    await expect(
      loginAction(idleFormState, submission({ email: "a@b.test", password: "p", next: "" })),
    ).rejects.toThrowError(new Error(redirectTo("/panel")));

    viewerShell.mockResolvedValueOnce(null);
    await expect(
      loginAction(idleFormState, submission({ email: "a@b.test", password: "p" })),
    ).rejects.toThrowError(new Error(redirectTo("/")));
  });

  it("backend hatasını koduyla forma taşır", async () => {
    signIn.mockRejectedValueOnce(
      new ApiError({
        status: 429,
        errorCode: "AUTH_TOO_MANY_REQUESTS",
        errorCategory: "RATE_LIMITED",
        message: "Cok fazla deneme.",
      }),
    );

    await expect(
      loginAction(idleFormState, submission({ email: "a@b.test", password: "p", next: "/" })),
    ).resolves.toEqual({ status: "error", errorCode: "AUTH_TOO_MANY_REQUESTS", httpStatus: 429 });
  });

  it("beklenmeyen arızayı nötr kodla bildirir ve yönlendirmez", async () => {
    signIn.mockRejectedValueOnce(new TypeError("ağ yok"));

    await expect(
      loginAction(idleFormState, submission({ email: "a@b.test", password: "p", next: "/" })),
    ).resolves.toEqual({ status: "error", errorCode: "UNEXPECTED", httpStatus: 500 });
  });
});
