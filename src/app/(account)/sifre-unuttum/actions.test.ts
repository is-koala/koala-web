import { describe, expect, it, vi } from "vitest";

import { idleFormState } from "@/lib/form-state";
import { ApiError } from "@/server/api/errors";

import { forgotPasswordAction } from "./actions";

const requestPasswordReset = vi.hoisted(() => vi.fn());

vi.mock("@/server/auth/password", () => ({ requestPasswordReset }));

function submission(email: string) {
  const formData = new FormData();
  formData.set("email", email);
  return formData;
}

describe("parola hatırlatma action'ı", () => {
  it("adresi backend'e verir ve tek bir onay döner", async () => {
    requestPasswordReset.mockResolvedValueOnce(undefined);

    await expect(forgotPasswordAction(idleFormState, submission("ada@example.test"))).resolves.toEqual(
      { status: "done" },
    );
    expect(requestPasswordReset).toHaveBeenCalledWith("ada@example.test");
  });

  it("kayıtlı olmayan adres için de aynı onayı döner", async () => {
    // Backend bilinmeyen adresi sessizce yutup 200 dönüyor; ekran da adresin
    // kayıtlı olup olmadığını ele vermemeli.
    requestPasswordReset.mockResolvedValueOnce(undefined);

    await expect(forgotPasswordAction(idleFormState, submission("yok@example.test"))).resolves.toEqual(
      { status: "done" },
    );
  });

  it("hız sınırını kullanıcıya bildirir", async () => {
    requestPasswordReset.mockRejectedValueOnce(
      new ApiError({
        status: 429,
        errorCode: "AUTH_TOO_MANY_REQUESTS",
        errorCategory: "RATE_LIMITED",
        message: "Cok fazla deneme.",
      }),
    );

    await expect(
      forgotPasswordAction(idleFormState, submission("ada@example.test")),
    ).resolves.toMatchObject({ status: "error", errorCode: "AUTH_TOO_MANY_REQUESTS" });
  });
});
