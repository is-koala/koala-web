import { describe, expect, it } from "vitest";

import { createConcurrentTaskGate } from "./concurrency";

describe("eşzamanlı iş kapasitesi", () => {
  it("kapasite doluyken yeni işi başlatmaz ve tamamlanınca yeniden yer açar", async () => {
    let finish: () => void = () => undefined;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const gate = createConcurrentTaskGate(2);
    const first = gate.run(async () => pending);
    const second = gate.run(async () => pending);

    await expect(gate.run(async () => "üçüncü")).resolves.toEqual({ acquired: false });

    finish();
    await Promise.all([first, second]);
    await expect(gate.run(async () => "sonraki")).resolves.toEqual({
      acquired: true,
      value: "sonraki",
    });
  });

  it("iş hata verse de kapasiteyi finally ile serbest bırakır", async () => {
    const gate = createConcurrentTaskGate(1);

    await expect(gate.run(async () => {
      throw new Error("okuma başarısız");
    })).rejects.toThrow("okuma başarısız");

    await expect(gate.run(async () => "yeniden")).resolves.toEqual({
      acquired: true,
      value: "yeniden",
    });
  });
});
