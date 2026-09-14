import { describe, expect, it } from "vitest";

import { loginRedirect, postLoginDestination, returnDestination } from "./login-redirect";

describe("giriş dönüş hedefi", () => {
  it("kullanıcıyı geri döneceği adresle birlikte girişe yollar", () => {
    expect(loginRedirect("/panel/islerim")).toBe("/giris?next=%2Fpanel%2Fislerim");
  });

  it("sorgu dizgesini de dönüş hedefinde taşır", () => {
    expect(loginRedirect("/panel/islerim?filtre=acik")).toBe(
      "/giris?next=%2Fpanel%2Fislerim%3Ffiltre%3Dacik",
    );
  });

  it.each([
    "",
    "//kotu.example",
    "https://kotu.example",
    "/\\kotu.example",
    "panel",
    // Tarayıcı URL çözerken sekme ve satır sonlarını atar: "/<TAB>/kotu"
    // adresi https://kotu.example/ olarak açılır.
    "/\t/kotu.example",
    "/\n/kotu.example",
    "/\r/kotu.example",
  ])("%j adresini dönüş hedefi saymaz", (candidate) => {
    expect(loginRedirect(candidate)).toBe("/giris");
  });
});

describe("dönüş hedefinin çözülmesi", () => {
  it("site içi göreli yolu hedef olarak kabul eder", () => {
    expect(returnDestination("/panel/islerim?filtre=acik")).toBe("/panel/islerim?filtre=acik");
  });

  it.each([
    undefined,
    "",
    "//kotu.example",
    "https://kotu.example",
    "javascript:alert(1)",
    "/\\kotu.example",
    "panel",
    "/\t/kotu.example",
  ])("%j değerini hedef saymaz", (candidate) => {
    expect(returnDestination(candidate)).toBeNull();
  });
});

describe("giriş sonrası hedef", () => {
  it("dönülecek sayfa varsa rolü beklemeden oraya döner", () => {
    expect(postLoginDestination("/is-ilanlari/abc", "employer")).toBe("/is-ilanlari/abc");
  });

  it("dönülecek sayfa yoksa kullanıcının kabuğuna yollar", () => {
    expect(postLoginDestination(undefined, "worker")).toBe("/panel");
    expect(postLoginDestination("", "employer")).toBe("/isveren");
  });

  it("rol okunamadıysa kabuk tahmin etmez, ana sayfaya düşer", () => {
    expect(postLoginDestination("//kotu.example", null)).toBe("/");
  });
});
