import { redirect } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { redirectTo } from "../../../tests/support/navigation";

import { requireSession } from "./guard";

const store = vi.hoisted(() => {
  const values = new Map<string, string>();
  return {
    values,
    get: (name: string) => (values.has(name) ? { name, value: values.get(name)! } : undefined),
  };
});

vi.mock("next/headers", () => ({ cookies: () => Promise.resolve(store) }));
vi.mock("next/navigation", async () => ({
  redirect: (await import("../../../tests/support/navigation")).throwingRedirect(),
}));

describe("korumalı rota kapısı", () => {
  beforeEach(() => {
    store.values.clear();
    store.values.set("koala_did", "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e");
    vi.mocked(redirect).mockClear();
  });

  afterEach(() => vi.restoreAllMocks());

  it("oturum yoksa girişe yönlendirir", async () => {
    await expect(requireSession("/panel")).rejects.toThrow(redirectTo("/giris?next=%2Fpanel"));
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
