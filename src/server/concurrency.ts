import "server-only";

export type ConcurrentTaskResult<Value> =
  | { readonly acquired: false }
  | { readonly acquired: true; readonly value: Value };

/**
 * Kuyruk oluşturmadan süreç-içi eşzamanlı kaynak kullanımını sınırlar.
 * Bekleyen bağlantıları biriktirmek yerine çağıran hızlı bir yeniden-dene yanıtı verebilir.
 */
export function createConcurrentTaskGate(maxConcurrent: number) {
  if (!Number.isSafeInteger(maxConcurrent) || maxConcurrent < 1) {
    throw new Error("Eşzamanlı iş sınırı pozitif bir tam sayı olmalı.");
  }

  let active = 0;

  return {
    async run<Value>(task: () => Promise<Value>): Promise<ConcurrentTaskResult<Value>> {
      if (active >= maxConcurrent) return { acquired: false };

      active += 1;
      try {
        return { acquired: true, value: await task() };
      } finally {
        active -= 1;
      }
    },
  };
}
