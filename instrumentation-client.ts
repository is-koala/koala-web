import * as Sentry from "@sentry/nextjs";

import { sentryRuntimeOptions } from "@/monitoring/sentry";

Sentry.init(sentryRuntimeOptions());

// Harita UI'si bu sözleşmeye bağlı değildir. Değerin client derleyicisine
// gerçekten ulaştığını Docker smoke'un `.next/static` çıktısında ölçebilmesi
// için client entry'de görünür kalır.
export const googleMapsJavaScriptKeyBuildContract =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_JS_KEY ?? "";

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
