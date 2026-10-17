# Ask your ledger

Read-only questions about the authenticated account's active ledger. Supported metrics are total sales, equivalent-week sales comparisons, highest recorded sales days (including ties), counted cash shortages/overages, card share and cash expenses. Questions may be English or Nepali; answer language is selected independently. Suggestions populate the question without sending a request.

## Local preview

From the project root in PowerShell (Node 22.12+):

```powershell
npm.cmd ci
npm.cmd run dev
```

Open **http://127.0.0.1:5173**. For actual AI use, configure the ignored `.env.local` with the four Firebase Web settings from `.env.example`, `VITE_USE_FIREBASE_EMULATORS=false`, and these server settings:

```dotenv
OPENAI_API_KEY=your-server-only-key
OPENAI_MODEL=gpt-6-luna
AI_USE_LOCAL_STORE=true
STORE_TIMEZONE=America/New_York
```

Keep the key out of frontend variables, source control and chat. Restart Vite after changing environment values. Sign in to a configured cloud Firebase account with saved records, scroll to **Ask your ledger**, choose a suggestion or type a question, select the answer language and click **Ask**. Existing Firebase owner-only rules and authorized domains must already be configured as described in README. The dashboard filter does not constrain questions; the interpreted period is displayed with the answer.

Without cloud configuration, the app remains a fictional demo and Ask is disabled. For an emulator ledger preview, run `npm.cmd run emulators` in one terminal and `npm.cmd run dev:emulator` in another, then open the same URL. Emulator accounts intentionally cannot call real AI. `npm.cmd run build` and `npm.cmd run preview` serve the static production UI at **http://127.0.0.1:4173**; Vite preview does not serve the AI endpoints, so use `npm.cmd run dev` for local AI testing.

## Dates and evidence

There is no existing per-store timezone preference or profile field. The server-only IANA `STORE_TIMEZONE` therefore applies to this deployment. Its explicit fallback is **America/New_York**, independent of the browser or server OS timezone. Invalid timezone configuration fails closed. Multi-timezone stores need a future owner-controlled settings migration; this change does not alter Firestore rules or account profiles.

- “This week” means Monday through the current store-local date.
- “Last week” means the previous Monday through Sunday.
- A weekly comparison uses Monday through today's weekday in both weeks. Before Sunday it is labeled a partial-week comparison using equivalent elapsed weekdays.
- “This month” means the first Gregorian calendar date of the month through today.
- No period means all recorded history through today; coverage begins at the earliest saved date. Future-dated backup records are excluded. An empty ledger uses today as the empty coverage interval.
- The initial allowlist supports `all`, `this_week`, `last_week` and `this_month`. Other dates, periods, multiple questions or unclear requests return a limitation/clarification response rather than arbitrary query execution.

Evidence includes the interpreted metric and period, timezone, today, exact inclusive dates, recorded/calendar/missing-day counts, integer-cent-derived USD amounts, relevant tied dates, and cash-count differences. Money currently uses the existing USD formatter. Missing days are never assigned zero sales or estimated. Comparison figures describe recorded totals only; incomplete records do not establish a change in actual business sales. No percentage change is produced when the baseline is zero or either period has no records. Card share is undefined when recorded total sales are zero. Cash checks exclude blank `actual`, include entered zero, and show expected, counted and signed difference for every mismatch. Causes and profit are not inferred.

## Security and AI behavior

`POST /api/ask` accepts only `{question, language}`. Question length is capped at 500 Unicode characters, body size at 4096 bytes. It reuses Firebase JWT verification (signature, issuer, audience and time/identity claims) and the existing owner-scoped Firestore REST reader. UID comes exclusively from the verified token. Browser IDs, totals, arbitrary query objects and extra fields are rejected. Firestore reads project only financial fields and dates, exclude notes, and check the active-ledger revision before/after reading. No write operation exists in the feature. As with the summary endpoint, token verification does not check server-side token revocation.

The first bounded OpenAI Responses call classifies the question into an allowlisted metric/period object. The server validates this independently and performs every financial calculation in integer cents. The second call composes an explanation by arranging approved, localized sentence IDs derived from those calculations. Exact membership, uniqueness and completeness are validated before rendering. Free-form model prose is deliberately excluded so the explanation cannot invent figures, causes, profit claims or commands. Unsupported/ambiguous classifications do not trigger an explanation call. The interpretation itself is probabilistic; the UI exposes the interpreted query and dates for review. Real bilingual output/interpretation quality still requires verification.

Only the question enters the interpretation call; users should avoid including personal details. No saved notes, UID, email or raw daily ledger rows are sent to OpenAI. The explanation call receives only approved answer sentences and metric/language. Questions and ledger data are treated as data, not instructions. No model tools, code execution or arbitrary database queries are enabled. Calls use strict JSON schemas, `store:false`, 500 output tokens and 20-second timeouts. API/refusal/malformed/incomplete responses fail safely. Rendering uses `textContent`, and account, revision, question and language changes abort/discard stale answers. The server cache has no raw question in its keys.

The implementation follows the existing [OpenAI structured output integration](https://developers.openai.com/api/docs/guides/structured-outputs), with additional application validation.

## Cache and request budget

The summary store is reused. Local handlers with the same environment object share memory storage; production requires shared REST Redis (`KV_REST_API_URL`, `KV_REST_API_TOKEN`), including on Vercel. Local memory mode is development-only. No Redis configuration means production fails closed. The prepared Ask Vercel function timeout is 90 seconds to accommodate ledger reads plus two bounded model stages; nothing was deployed.

Across summaries and Ask: 300 authenticated requests/hour per user before ledger access, 2 uncached generations/minute and 20/day per user, 200/day per Redis deployment. An Ask generation is one allowance covering up to two model calls. The allowance is acquired before interpretation, including unsupported questions and failures. Duplicate in-flight questions share a lease. Cache reads still authenticate and read the current active ledger. Results expire after 24 hours and are keyed by hashed owner/question, answer language, ledger generation/revision, store-local date/timezone, model and prompt version. New day, language or revision gets a fresh answer. Cache keys contain no raw question; cached values contain the calculated answer/evidence, not saved notes. Existing shared-store error text may refer to “summary” limits.

## Verification

```powershell
npm.cmd test
npm.cmd run test:emulators
npm.cmd run build
```

`tests/ask.test.js` covers deterministic dates/timezones/coverage/calculations, zero baselines, empty records, counted zero, validation, owner/cache isolation, request budgets, bilingual fixtures, invalid/injected outputs, API failures and stale UI responses. `tests/browser/ask.spec.js` uses the real interface with mocked context/requests to test mobile sizing, keyboard submission, suggestions, Nepali selection, evidence, errors and empty states. Existing emulator tests exercise real Auth and Firestore rules/persistence/isolation; emulator AI is disabled. These tests do not verify a real cloud endpoint or model interpretation. No real OpenAI call was made for this feature. Production Firebase, Redis, model access and human English/Nepali review remain required before deployment.

Final local results: 30 unit/API tests plus retained ledger regressions passed; 2 emulator integration tests and 5 Chrome tests passed. The production build passed with the existing Firebase bundle-size warning. Mobile/desktop screenshots were inspected. An intermediate Google popup timeout was traced to optional CDN assets in the emulator widget; the test now blocks those assets and waits for initialization. No commit, push or deployment was performed.
