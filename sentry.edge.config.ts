import * as Sentry from "@sentry/nextjs";

import { sentryRuntimeOptions } from "@/monitoring/sentry";

Sentry.init(sentryRuntimeOptions());
