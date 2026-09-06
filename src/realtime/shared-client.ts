"use client";

import { createRealtimeClient, type RealtimeClient } from "./client";

let shared: RealtimeClient | null = null;
const leases = new WeakMap<RealtimeClient, number>();

export function sharedRealtimeClient(): RealtimeClient {
  shared ??= createRealtimeClient();
  return shared;
}

/** Birden çok yüzey aynı soketi paylaşır; son yüzey ayrılınca bağlantı kapanır. */
export function retainRealtimeClient(client: RealtimeClient): () => void {
  const count = leases.get(client) ?? 0;
  leases.set(client, count + 1);
  if (count === 0) client.start();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const next = Math.max(0, (leases.get(client) ?? 1) - 1);
    if (next === 0) {
      leases.delete(client);
      client.stop();
    } else {
      leases.set(client, next);
    }
  };
}
