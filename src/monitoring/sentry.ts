import type { Breadcrumb, ErrorEvent, Log } from "@sentry/nextjs";

export function scrubSentryEvent(event: ErrorEvent): ErrorEvent {
  event.message = undefined;
  event.user = undefined;
  event.extra = undefined;
  event.contexts = undefined;
  event.tags = undefined;
  event.logentry = undefined;

  if (event.request) {
    event.request = {
      method: event.request.method,
      url: withoutQuery(event.request.url),
    };
  }

  if (event.exception?.values) {
    event.exception.values = event.exception.values.map((exception) => ({
      type: exception.type,
      value: "Hata ayrıntısı filtrelendi",
      mechanism: exception.mechanism,
      stacktrace: exception.stacktrace,
    }));
  }

  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map(scrubBreadcrumb);
  }

  return event;
}

export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  return {
    category: breadcrumb.category,
    level: breadcrumb.level,
    timestamp: breadcrumb.timestamp,
    type: breadcrumb.type,
  };
}

export function scrubSentryLog(log: Log): Log | null {
  if (log.message !== "koala_handoff_metric") return null;
  const event = log.attributes?.event;
  const platform = log.attributes?.platform;
  if (typeof event !== "string" || typeof platform !== "string") return null;
  return {
    level: "info",
    message: "koala_handoff_metric",
    attributes: { event, platform },
  };
}

export function sentryRuntimeOptions() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
  return {
    dsn,
    enabled: Boolean(dsn),
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT?.trim() || "development",
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE?.trim() || undefined,
    sendDefaultPii: false,
    attachStacktrace: true,
    tracesSampleRate: 0,
    enableLogs: Boolean(dsn),
    beforeSend: scrubSentryEvent,
    beforeBreadcrumb: scrubBreadcrumb,
    beforeSendLog: scrubSentryLog,
  };
}

function withoutQuery(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return undefined;
  }
}
