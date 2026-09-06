# Hosted payment deployment checklist

The backend owns the Iyzico callback and redirects the browser to the web route
`/payment/result`. The web app then reads both the employer assignment and its
payment attempts; callback query parameters are never treated as financial truth.

## Environment verification

- Set backend `FRONTEND_URL` to the canonical HTTPS web origin in staging and
  production. Do not include a path or trailing slash.
- Verify that `${FRONTEND_URL}/payment/result` reaches this Next.js application and
  is not rewritten to a localized route.
- Keep the web and backend deployments paired when changing the public origin.
- Confirm that checkout sessions return an HTTPS URL whose exact hostname is
  `sandbox-payment.iyzipay.com` in staging and `payment.iyzipay.com` in production.

## Sandbox acceptance run

These checks require Iyzico sandbox credentials and a callback-reachable staging
backend, so they cannot be completed by the repository test suite alone.

1. Complete a successful 3DS payment and verify that the assignment reads
   `HELD_IN_ESCROW` before the UI reports success.
2. Complete a failed 3DS payment and verify that the UI reports no charge and allows
   a new attempt when the assignment remains eligible.
3. Leave or cancel hosted checkout and verify that the UI never claims success.
4. Replay the same callback and verify that the attempt history has no duplicate or
   contradictory result.
5. Let the callback arrive after the browser return and verify bounded polling shows
   the waiting state before converging on the backend result.
