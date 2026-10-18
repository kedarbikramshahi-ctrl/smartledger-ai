# Local validation — October 13, 2026

## Everyday custom comparisons — October 18, 2026

- `npm.cmd test`: all 42 unit/API tests pass (12 custom comparison, 19 Ask, 8 summary, 3 ledger tests), plus the retained simulated-DOM ledger regression suite. Final tests include unavailable payment mix, missing versus zero counts and follow-up periods for empty comparisons.
- Firebase emulator integration: 2 tests pass against real local Auth/Firestore, including two-user isolation and record validation/persistence.
- Chrome/Playwright: all 6 browser tests pass, including the new custom comparison UI test for mobile/desktop evidence, multiple fields, Nepali follow-up submission, owner changes and Forget comparison. Browser model requests and signed-in custom context are mocked; they do not verify a real cloud session or model interpretation.
- `npm.cmd run build`: passes; existing Firebase bundle-size warning remains (about 591 kB minified / 178 kB gzip). No dependency changes.
- Desktop and 390px mobile comparison screenshots were visually inspected. Notes still use the existing escaped-text renderer; comparison facts, model inputs and context exclude stored notes.
- Custom tests validate natural English/Nepali fixture outputs through the strict query protocol, exact date pairs, multiple fields, balance snapshots versus flow sums, counted-date evidence, zero baselines, missing records/counts, separate shortage/overage amounts, broad differences, expiring owner-bound references, session clearing and existing rate limits. Mocked fixtures prove calculation/protocol behavior, not actual language interpretation quality.
- The initial emulator launcher stalled before startup and was stopped. A successful isolated run used `$env:XDG_CONFIG_HOME = Join-Path (Get-Location) '.tools/firebase-test-config'; npm.cmd run test:emulators` outside the Windows sandbox. The ignored config location avoids depending on saved Firebase credentials.
- The last missing-value/empty-context refinements were verified by the final unit/API suite and production build; the full browser/emulator run preceded those refinements. No real OpenAI call, live Firebase/Redis verification, commit, push or deployment was performed.

Preview and limitations are documented in `docs/ask-your-ledger.md`. Earlier validation entries are historical.

## Ask your ledger — October 17, 2026

- `npm.cmd test`: retained simulated-DOM ledger regressions and all 30 unit/API tests pass (19 Ask tests, 8 summary tests, 3 ledger unit tests), including Nepali UTF-8 split across request chunks.
- `npm.cmd run test:emulators`: 2 real Auth/Firestore emulator integration tests and 5 Chrome browser tests pass, including the new mobile/keyboard Ask UI test with mocked requests.
- Intermediate reruns hit a Google emulator popup timeout: optional CDN scripts delayed attaching click handlers. The existing Google test now blocks those optional assets and waits for DOM initialization. Its final rerun passed in 1.9 seconds; application authentication code was unchanged.
- `npm.cmd run build`: production build passes; the Firebase bundle still exceeds Vite's 500 kB warning threshold.
- Desktop and 390px mobile screenshots of the Ask section were visually inspected. Question input, suggestions, language selection, answer and evidence fit within the panel. Evidence now uses readable labels rather than internal query identifiers.
- Ask tests cover signed JWT rejection/ownership, cache isolation and invalidation, shared limits/leases, timezone/DST/week/year boundaries, incomplete coverage, cash counted as zero, ties, zero denominators, empty ledgers, bilingual fixtures, invalid/injected model output, upstream failures and stale UI replies. Existing tests cover Firestore owner-only projection, deny rules and record functionality.
- AI classification and explanation use mocked OpenAI responses. Browser Ask tests use mocked signed-in context and responses; they do not verify cloud authentication or a live endpoint. No real OpenAI call, live Firebase endpoint check, production Redis validation or human bilingual model review was performed. No commit, push or deployment.
- Build and emulator runs required execution outside the Windows sandbox: esbuild could not traverse a parent directory and Firebase CLI could not read its local configstore. Both checks passed with that access.

See `docs/ask-your-ledger.md` for exact preview commands, required server configuration, supported periods and limitations. The earlier validation below remains historical.

Firebase Web configuration is present and the standard auth domain matches the configured project (values were not displayed). The user reports successful live Google sign-in and manual email/password account creation. Cloud ledger persistence and two-user isolation have not been independently verified. No live Firebase security rules were changed by the agent. Publication was authorized separately after local preview.

Verified locally:

- `npm.cmd test`: retained ledger regression suite passes against the split modules; all three additional unit tests pass.
- `npm.cmd run test:emulators`: both Firestore/Auth emulator integration tests and all four Chrome browser tests pass, including Google popup sign-in and reload/sign-out. Tests use an isolated demo project and separate ports from the user's preview.
- `npm.cmd run build`: Vite successfully produces `dist` for Vercel.
- `npm.cmd audit --omit=dev`: zero production dependency vulnerabilities after the gRPC dependency override. Eleven development-tool findings remain (7 high, 4 moderate) in Firebase CLI dependencies.
- Desktop and 390px mobile screenshots were visually inspected. The ledger and chart scroll inside their panels without making the page overflow horizontally.
- `index (1).html` remains byte-identical to its preserved original. The complete pre-migration working app is saved as `originals/index-pre-firebase.html`.

Coverage includes cash/card separation, exact integer-cent input, Balanced/Short/Over/Not counted and zero counts, singular/plural summary wording, date-range totals/chart/summary/CSV, full JSON backups, older-backup restore, escaped notes, CSV quoting, calendar/leap-year validation, Unicode notes boundaries, separate registration/sign-in forms, password confirmation, registration remaining signed out until explicit sign-in, Google popup sign-in, wrong-password errors, persistence after reload/re-authentication, empty new accounts, cross-user and signed-out read/write/delete denials, explicit local import preview/cancel/confirmation, retained local copies, duplicate skipping, stale import/restore rejection and a 401-record restore spanning two upload batches.

Vite reports a bundle-size warning for the Firebase SDK bundle (about 570 kB minified / 171 kB gzip). It does not prevent the build. Prior/incomplete Firestore ledger generations are retained privately and need an explicitly authorized cleanup process if storage growth becomes significant.

Before publication, follow the checklist and cloud configuration steps in `README.md`. Emulator success does not establish that the real Firebase project, production security rules or Vercel environment settings work.
