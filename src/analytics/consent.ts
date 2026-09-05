export const analyticsConsentVersion = "1.1";
export const consentStorageKey = "koala.analytics-consent";
export const consentChangedEvent = "koala:analytics-consent-changed";

export type AnalyticsConsent = {
  version: string;
  analytics: boolean;
  decidedAt: string;
};

export function serializeConsent(analytics: boolean, decidedAt = new Date()): string {
  return JSON.stringify({
    version: analyticsConsentVersion,
    analytics,
    decidedAt: decidedAt.toISOString(),
  } satisfies AnalyticsConsent);
}

export function parseConsent(value: string | null): AnalyticsConsent | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("version" in parsed) ||
      !("analytics" in parsed) ||
      !("decidedAt" in parsed) ||
      parsed.version !== analyticsConsentVersion ||
      typeof parsed.analytics !== "boolean" ||
      typeof parsed.decidedAt !== "string"
    ) {
      return null;
    }
    return parsed as AnalyticsConsent;
  } catch {
    return null;
  }
}

export function readConsent(): AnalyticsConsent | null {
  return parseConsent(window.localStorage.getItem(consentStorageKey));
}

export function writeConsent(analytics: boolean): AnalyticsConsent {
  const serialized = serializeConsent(analytics);
  window.localStorage.setItem(consentStorageKey, serialized);
  const consent = parseConsent(serialized) as AnalyticsConsent;
  window.dispatchEvent(new CustomEvent(consentChangedEvent, { detail: consent }));
  return consent;
}
