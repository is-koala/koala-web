import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loginRedirect, requireSession } from "./guard";

const store = vi.hoisted(() => {
  const values = new Map<string, string>();
  return {
    values,
    get: (name: string) => (values.has(name) ? { name, value: values.get(name)! } : undefined),
  };
});

const redirect = vi.hoisted(() =>
  vi.fn((target: string) => {
    throw new Error(`REDIRECT:${target}`);
  }),
);

vi.mock("next/headers", () => ({ cookies: () => Promise.resolve(store) }));
vi.mock("next/navigation", () => ({ redirect }));

describe("korumalı rota kapısı", () => {
  beforeEach(() => {
    store.values.clear();
    store.values.set("koala_did", "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e");
    redirect.mockClear();
  });

  afterEach(() => vi.restoreAllMocks());

  it("kullanıcıyı geri döneceği adresle birlikte girişe yollar", () => {
    expect(loginRedirect("/panel/islerim")).toBe("/giris?next=%2Fpanel%2Fislerim");
  });

  it.each([
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

  it("oturum yoksa girişe yönlendirir", async () => {
    await expect(requireSession("/panel")).rejects.toThrow("REDIRECT:/giris?next=%2Fpanel");
    expect(redirect).toHaveBeenCalledWith("/giris?next=%2Fpanel");
  });

  it("oturum varsa sayfayı sürdürür", async () => {
    store.values.set("koala_rt", "refresh-placeholder");
    store.values.set("koala_at", "access-placeholder");

    await expect(requireSession("/panel")).resolves.toMatchObject({
      accessToken: "access-placeholder",
    });
    expect(redirect).not.toHaveBeenCalled();
  });
});
