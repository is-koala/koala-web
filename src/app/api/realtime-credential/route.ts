import { issueRealtimeBootstrap } from "@/server/realtime/credential";

export const dynamic = "force-dynamic";

/** Ana oturum çerezini scoped STOMP kimliğine çeviren aynı-origin BFF ucu. */
export async function POST() {
  try {
    const bootstrap = await issueRealtimeBootstrap();
    return noStoreJson(bootstrap);
  } catch {
    // Backend mesajı ve exception gövdesi scoped kimliği taşıyabilir; BFF
    // bunları ne istemciye ne de loga yansıtır. Mesajlaşma REST ile sürer.
    return noStoreJson({ error: "realtime_unavailable" }, 503);
  }
}

function noStoreJson(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
