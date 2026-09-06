import { describe, expect, it } from "vitest";

import { isStrongPassword, minPasswordLength, passwordPattern } from "./password";

describe("parola kuralı", () => {
  it("kuralı karşılayan parolayı kabul eder", () => {
    expect(isStrongPassword("Koala2026")).toBe(true);
  });

  it.each([
    ["sekiz karakterden kısa", "Koala26"],
    ["büyük harfsiz", "koala2026"],
    ["küçük harfsiz", "KOALA2026"],
    ["rakamsız", "KoalaKoala"],
    ["boş", ""],
  ])("%s parolayı reddeder", (_reason, candidate) => {
    expect(isStrongPassword(candidate)).toBe(false);
  });

  it("backend ile aynı alt sınırı ve deseni açar", () => {
    // `ResetPasswordDto` @Size(min = 8) + @Pattern; istemci kuralı gevşetirse
    // kullanıcı formu geçer ama backend reddeder.
    expect(minPasswordLength).toBe(8);
    expect(new RegExp(`^${passwordPattern}$`).test("Koala2026")).toBe(true);
  });
});
