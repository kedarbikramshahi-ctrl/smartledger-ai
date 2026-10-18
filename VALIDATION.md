# Local validation — October 13, 2026

## Reconciliation wording follow-up — October 18, 2026

- All 51 unit/API tests plus retained ledger regressions pass. Five new focused tests cover the exact “short by $14 / balanced” sentence in English (and Nepali statuses), overages, absent counts versus Balanced, entered zero, missing ledger records, and 0/1/2 shortage day grammar. Assertions preserve expected cash, count coverage and separate shortage totals.
- Production build passes with the existing bundle-size warning. This wording-only follow-up did not rerun browser tests; the three presentation browser tests below passed in the preceding presentation change.
- `server/comparison.js` and `src/ledger.js` remain unchanged. Context, authentication, request limits and financial calculations are preserved; cache presentation version is 4. No real OpenAI call, commit, push or deployment was performed.

## Comparison answer presentation — October 18, 2026

- `npm.cmd test`: all 46 unit/API tests and retained simulated-DOM ledger regressions pass. New checks cover the exact $196 / 11.91% example, dates rather than A/B, reversed/cross-year periods, conditional missing-record warnings, mandatory result-first ordering, complete/partial-week coverage and unchanged facts.
- `node node_modules/@playwright/test/cli.js test tests/browser/ask.spec.js tests/browser/comparison.spec.js`: all 3 focused Chrome tests pass. Tests verify collapsed Evidence, Enter-key expansion, preserved coverage, one answer node, no answer-paragraph duplication inside Evidence, repeated/cached responses, conditional warnings and existing bilingual/account-change behavior. Backend/model responses are mocked.
- `npm.cmd run build`: passes; the existing bundle-size warning remains (about 592 kB minified). Mobile collapsed-answer and desktop expanded-Evidence screenshots were inspected.
- Financial calculation modules `server/comparison.js` and `src/ledger.js` have no diff. The weekly presenter adapts existing facts without recalculating totals or percentages.
- Root cause: the evidence formatter copied the same comparison sentences used to create the API answer. Conclusions and detailed evidence now have separate formatters. Related reconciliation fields share a single evidence group.
- Full emulator invocation stalled before tests and was stopped; npm exec also stalled before launching Playwright. The installed Playwright CLI ran the three focused mocked-backend tests directly. Auth/Firestore integration was not reverified in this presentation-only run.
- No real OpenAI call, commit, push or deployment was performed. Earlier validation below remains historical.

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

Standalone/context regression verification (2026-10-18): npm test passed 57 unit/API tests plus the retained ledger DOM regressions. The October 14/15 comparison followed by October 10 reconciliation returns the exact uncounted/$342 fixture answer. AI interpretation and explanation were mocked; no real OpenAI call was verified. Production build passed with the existing >500 kB chunk warning.
Focused browser verification: 3/3 Ask/comparison Playwright tests passed (mobile/keyboard, bilingual follow-ups, account switching, collapsed evidence). git diff --check passed. The new standalone context-switch regression runs against the DOM fixture in npm test. No real OpenAI call, commit, push or deployment was performed.

Date-only topic follow-ups (2026-10-18): npm test passed 60 unit/API tests plus retained ledger DOM regressions, including the full four-question UI/API sequence and entered actual zero. Topic references reject browser-supplied field objects, are owner isolated, and expire. Three focused Ask/comparison Playwright tests passed. Production build passed with the existing >500 kB bundle warning. AI interpretation/explanation tests were mocked; no live OpenAI call was verified. No commit, push or deployment.

Ask rate-limit diagnostics (2026-10-18): 67 unit/API tests plus retained ledger DOM regressions passed; 3 focused Ask/comparison Chrome tests passed; production build passed with the existing >500 kB warning. Added tests for the 2/minute, 20/user UTC day, 200/deployment UTC day, 300/hour read and duplicate-lease limits; exact bucket/lease resets; simultaneous caps; shared summary/Ask accounting; safe HTTP 429 metadata/Retry-After; and UI display without automatic retries. Redis HTTP/Lua return protocol was mocked, not executed against a live Redis deployment. No production counters, logs or credentials were inspected; the original generic error cannot uniquely establish its blocked cap. No real OpenAI call, commit, push or deployment was performed. Limits and counters were not disabled, increased or cleared.

User-approved quota adjustment: 67 unit/API tests and retained ledger DOM regressions pass with 3 uncached generations/minute and 25/UTC day per user. Regression tests prove the third succeeds and fourth is blocked, 25 daily allowances are permitted before rejection, reset metadata is unchanged, and Redis receives [25,200,3]. Deployment 200/day and reads 300/hour remain tested unchanged. Redis tests are mocked; no live quota changes, counter resets, commit, push or deployment performed.
