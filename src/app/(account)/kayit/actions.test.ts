import { describe, expect, it, vi } from "vitest";

import { idleFormState } from "@/lib/form-state";
import { ApiError } from "@/server/api/errors";

import { startRegistrationAction } from "./actions";

const startRegistration = vi.hoisted(() => vi.fn());

vi.mock("@/server/auth/registration", () => ({ startRegistration }));

function submission(fields: Record<string, string>) {
  const formData = new FormData();
  for (const [name, value] of Object.entries(fields)) formData.set(name, value);
  return formData;
}

const applicant = {
  firstName: "Ada",
  lastName: "Yılmaz",
  email: "ada@example.test",
  role: "is-arayan",
};

describe("kayıt başlatma action'ı", () => {
  it("iş arayan seçimini işveren bayrağına çevirir", async () => {
    startRegistration.mockResolvedValueOnce(undefined);

    await expect(startRegistrationAction(idleFormState, submission(applicant))).resolves.toEqual({
      status: "done",
    });
    expect(startRegistration).toHaveBeenCalledWith({
      firstName: "Ada",
      lastName: "Yılmaz",
      email: "ada@example.test",
      isEmployer: false,
    });
  });

  it("işveren seçimini de taşır", async () => {
    startRegistration.mockResolvedValueOnce(undefined);

    await startRegistrationAction(idleFormState, submission({ ...applicant, role: "isveren" }));

    expect(startRegistration).toHaveBeenCalledWith(
      expect.objectContaining({ isEmployer: true }),
    );
  });

  it("alan doğrulama hatalarını ilgili alanların altına taşır", async () => {
    startRegistration.mockRejectedValueOnce(
      new ApiError({
        status: 400,
        errorCode: "VALIDATION_FAILED",
        errorCategory: "VALIDATION_FAILED",
        message: "Gonderdiginiz bilgilerde hata var.",
        details: [{ field: "email", message: "Geçerli bir e-posta adresi giriniz." }],
      }),
    );

    await expect(startRegistrationAction(idleFormState, submission(applicant))).resolves.toEqual({
      status: "error",
      errorCode: "VALIDATION_FAILED",
      httpStatus: 400,
      fieldErrors: { email: "Geçerli bir e-posta adresi giriniz." },
    });
  });

  it("hız sınırını koduyla forma taşır", async () => {
    startRegistration.mockRejectedValueOnce(
      new ApiError({
        status: 429,
        errorCode: "AUTH_TOO_MANY_REQUESTS",
        errorCategory: "RATE_LIMITED",
        message: "Cok fazla deneme.",
      }),
    );

    await expect(startRegistrationAction(idleFormState, submission(applicant))).resolves.toEqual({
      status: "error",
      errorCode: "AUTH_TOO_MANY_REQUESTS",
      httpStatus: 429,
      fieldErrors: undefined,
    });
  });
});
