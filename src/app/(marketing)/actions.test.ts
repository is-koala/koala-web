import { beforeEach, describe, expect, it, vi } from "vitest";

import { homeContent } from "@/content/marketing";
import { supportContent } from "@/content/support";
import { idleFormState } from "@/lib/form-state";

const submit = vi.hoisted(() => vi.fn());
const takeQuota = vi.hoisted(() => vi.fn());
const requestHeaders = vi.hoisted(() => new Headers({ "x-real-ip": "198.51.100.10" }));

vi.mock("@/server/support/contact", () => ({
  postSupportContact: submit,
}));
vi.mock("@/server/support/rate-limit", () => ({
  takeSupportQuota: takeQuota,
}));
vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(requestHeaders),
}));

import { submitEarlyAccessAction } from "./actions";

function submission(fields: Record<string, string>) {
  const formData = new FormData();
  for (const [name, value] of Object.entries(fields)) formData.set(name, value);
  return formData;
}

const valid = { name: "Ada", email: "ada@example.test", consent: "granted" };

describe("erken erişim formu action'ı", () => {
  beforeEach(() => {
    submit.mockReset();
    submit.mockResolvedValue(undefined);
    takeQuota.mockReset();
    takeQuota.mockReturnValue({ allowed: true });
  });

  it("kaydı sabit konu ve mesajla destek kutusuna düşürür", async () => {
    await expect(submitEarlyAccessAction(idleFormState, submission(valid))).resolves.toEqual({
      status: "done",
    });

    expect(takeQuota).toHaveBeenCalledWith("198.51.100.10");
    expect(submit).toHaveBeenCalledWith({
      topic: homeContent.earlyAccess.submission.topic,
      name: "Ada",
      email: "ada@example.test",
      message: homeContent.earlyAccess.submission.message,
      consent: true,
    });
  });

  it("sabit konu destek formunun konu listesinden", () => {
    // Backend konu dışı değeri reddeder; sabit değer listeden kayarsa her
    // erken erişim kaydı sessizce düşerdi.
    expect(supportContent.topics.map((topic) => topic.value)).toContain(
      homeContent.earlyAccess.submission.topic,
    );
  });

  it("KVKK onayı yoksa backend'e gitmez", async () => {
    const result = await submitEarlyAccessAction(
      idleFormState,
      submission({ name: "Ada", email: "ada@example.test" }),
    );

    expect(result.status).toBe("error");
    expect(submit).not.toHaveBeenCalled();
  });

  it("bal küpü doluysa backend'i çağırmaz", async () => {
    await expect(
      submitEarlyAccessAction(idleFormState, submission({ ...valid, website: "http://bot.test" })),
    ).resolves.toEqual({ status: "done" });
    expect(submit).not.toHaveBeenCalled();
  });

  it("hız sınırını forma taşır", async () => {
    takeQuota.mockReturnValue({ allowed: false });

    await expect(submitEarlyAccessAction(idleFormState, submission(valid))).resolves.toEqual({
      status: "error",
      errorCode: "TOO_MANY_REQUESTS",
      httpStatus: 429,
    });
    expect(submit).not.toHaveBeenCalled();
  });
});
