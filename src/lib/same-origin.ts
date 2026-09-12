/** Çerezli mutation isteklerini yalnız tarayıcının aynı origin'inden kabul eder. */
export function isSameOriginRequest(request: Pick<Request, "headers" | "url">): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  const host = request.headers.get("host") ?? new URL(request.url).host;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
