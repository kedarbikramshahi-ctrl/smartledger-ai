# Ask your ledger

Read-only questions about the authenticated account's active ledger. Supported metrics are total sales, equivalent-week sales comparisons, highest recorded sales days (including ties), counted cash shortages/overages, card share and cash expenses. Questions may be English or Nepali; answer language is selected independently. Suggestions populate the question without sending a request.

Custom comparisons use this same section and `/api/ask`, with two dates or inclusive date ranges and one or more numeric ledger fields. Examples:

- “Hey, compare October 12 with October 13. Which day had more cash sales, and by how much?”
- “Compare October 5–11 with October 12–18. How did card sales and expenses change?”
- “अक्टोबर ५–११ र अक्टोबर १२–१८ को कार्ड बिक्री र नगद खर्च तुलना गर।”
- Follow-ups: “What about card sales?”, “Compare withdrawals between those two weeks”, “ती हप्तामा कुनमा नगद कमी बढी थियो?”, or “What was different about those weeks?”

The main answer leads with the date-based conclusion, for example: “October 12 had $196 more in sales than October 13. Sales decreased by 11.91%, from $1,646 to $1,450.” Main answers and follow-up context use dates instead of A/B labels. Every requested field is displayed. Restate both periods/fields to correct an interpretation, or click **Forget comparison** to start afresh. This is a comparison extension, not a general chatbot.

Detailed calculations appear once in a native **Evidence** disclosure, collapsed by default and operable by keyboard. It contains exact ISO dates, coverage counts (including complete periods), aggregation/snapshot details, signed changes and counted-date records. Opening Evidence does not repeat the natural answer paragraph. A/B notation, where used in Evidence, follows the first and second requested ranges and preserves **second minus first** calculations. New questions, language/account changes, failures and sign-out clear/collapse old evidence. The incomplete-record warning appears in the main answer only if at least one selected period has missing records; it is omitted for complete data. Existing weekly comparisons use the same presentation without recalculating their facts.

For two single dates, reconciliation answers state each date's actual status, e.g. “October 12 was short by $14. October 13 was balanced.” Balanced requires an entered actual cash count matching expected cash; missing counts say Not counted, and a missing ledger record is identified separately. Entered zero is a real count and may be balanced, short or over depending on expected cash. Longer periods use “0 shortage days”, “1 shortage day” and “2 shortage days”, while separate shortage/overage amounts and full coverage remain in Evidence.

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
- Simple single-period queries retain `all`, `this_week`, `last_week` and `this_month`. Custom comparisons accept exactly two validated Gregorian date ranges through today, with multiple requested fields in one comparison. Relative weekly comparisons use server-supplied equivalent elapsed weekdays; explicit custom ranges are preserved exactly.
- A month/day without a year uses the current store-local year, disclosed in the help text and full ISO evidence dates. Ambiguous numeric dates, calendars or unclear periods prompt clarification. Bikram Sambat conversion is not implemented. Review the interpreted dates; model interpretation is probabilistic.

Evidence includes the interpreted metric and period, timezone, today, exact inclusive dates, recorded/calendar/missing-day counts, integer-cent-derived USD amounts, relevant tied dates, and cash-count differences. Money currently uses the existing USD formatter. Missing days are never assigned zero sales or estimated. Comparison figures describe recorded totals only; incomplete records do not establish a change in actual business sales. No percentage change is produced when the baseline is zero or either period has no records. Card share is undefined when recorded total sales are zero. Cash checks exclude blank `actual`, include entered zero, and show expected, counted and signed difference for every mismatch. Causes and profit are not inferred.

## Custom comparison aggregation

| Field | Calculation and evidence |
|---|---|
| Cash sales, card sales, total sales, cash expenses, withdrawals | Sum recorded flows in each requested range; list recorded dates, B−A and percentage change when A is nonzero. |
| Opening cash | First recorded day's opening balance and exact snapshot date; never a sum of balances. |
| Expected closing cash | Latest recorded day's `opening + cash − expenses − withdrawals` and snapshot date; card sales excluded. |
| Actual cash counted | Latest **counted** snapshot and date, with every counted date/value in the evidence; counts absent on later days remain absent, and entered zero is valid. No sum of available cash. |
| Cash difference and reconciliation statuses | Per-counted-date expected/actual/difference and Short/Over/Balanced, counted/uncounted coverage, shortage days, overage days, balanced days, total shortage magnitude and total overage magnitude **separately**. Compare shortage/overage day counts and amounts without netting. |
| Payment mix | Card/total sales ratio in each period and change in percentage points; undefined at zero sales. |

Balance comparisons show dated snapshot differences without percentage changes. No-record flow values are unavailable, not zero; absent counts cannot establish that no shortages occurred. Different-length or overlapping periods are labeled. Broad “What was different?” questions cover total/cash/card sales, expenses, card mix and reconciliation, with missing-data limits and no causal claims. Profit, inventory, individual transactions and notes analysis are absent from this ledger model and receive a short limitation response. Existing notes continue to render as escaped text; they are never analyzed or supplied to AI.

A successfully interpreted and answered comparison establishes the last confirmed periods/fields for follow-ups, including a valid comparison with no matching records. The browser keeps only an opaque reference in memory, clears it on sign-out/account change, and never stores it in localStorage. Server references contain only validated periods/field names/timezone under a hashed-owner key in the shared cache (24-hour maximum lifetime); they contain no totals, notes or conversation history. Another account cannot resolve the reference. Expired/invalid references ask the user to restate periods and clear the UI reference. Reloading the page starts a fresh UI context. Ledger edits retain the chosen comparison but require fresh calculations against the latest revision. Failed, ambiguous or stale responses do not replace visible confirmed context.

## Security and AI behavior

`POST /api/ask` accepts only `{question, language, comparisonContext?}`; the optional reference must be an opaque UUID, never a browser-supplied query or totals. Question length is capped at 500 Unicode characters, body size at 4096 bytes. It reuses Firebase JWT verification (signature, issuer, audience and time/identity claims) and the existing owner-scoped Firestore REST reader. UID comes exclusively from the verified token. Browser IDs, totals, arbitrary query objects and extra fields are rejected. Firestore reads project only financial fields and dates, exclude notes, and check the active-ledger revision before/after reading. No ledger write operation exists in the feature. As with the summary endpoint, token verification does not check server-side token revocation.

The first bounded OpenAI Responses call classifies the question into a strictly validated legacy metric/period or custom comparison with exactly two ranges, allowlisted fields, a context flag and a fixed clarification-reason code. All unused fields must be empty; unknown keys, fields, aggregation options, impossible dates, arbitrary code and database queries are rejected. The server alone resolves confirmed context and performs every financial calculation in integer cents. The second call composes an explanation by arranging approved, localized sentence IDs derived from those calculations. Exact membership, uniqueness and completeness are validated before rendering. Free-form model prose is deliberately excluded so the explanation cannot invent figures, causes, profit claims or commands. Unsupported/ambiguous classifications do not trigger an explanation call. The interpretation itself is probabilistic; the UI exposes the interpreted query and dates for review. Real bilingual output/interpretation quality still requires verification.

The question, store-local calendar/relative ranges and optional confirmed periods/field names enter the interpretation call; users should avoid including personal details. No saved notes, UID, email, reference tokens or raw daily ledger rows are sent to OpenAI. The explanation call receives only approved answer sentences and metric/language. Questions and ledger data are treated as data, not instructions. No model tools, code execution or arbitrary database queries are enabled. Calls use strict JSON schemas, `store:false`, 500 output tokens and 20-second timeouts. API/refusal/malformed/incomplete responses fail safely. Rendering uses `textContent`, and account, revision, question and language changes abort/discard stale answers. The server cache has no raw question in its keys.

The implementation follows the existing [OpenAI structured output integration](https://developers.openai.com/api/docs/guides/structured-outputs), with additional application validation.

## Cache and request budget

The summary store is reused. Local handlers with the same environment object share memory storage; production requires shared REST Redis (`KV_REST_API_URL`, `KV_REST_API_TOKEN`), including on Vercel. Local memory mode is development-only. No Redis configuration means production fails closed. The prepared Ask Vercel function timeout is 90 seconds to accommodate ledger reads plus two bounded model stages; nothing was deployed.

Across summaries and Ask: 300 authenticated requests/hour per user before ledger access, 2 uncached generations/minute and 20/day per user, 200/day per Redis deployment. An Ask generation is one allowance covering up to two model calls. The allowance is acquired before interpretation, including unsupported questions and failures. Duplicate in-flight questions share a lease. Cache reads still authenticate and read the current active ledger. Results expire after 24 hours and are keyed by hashed owner/question, validated follow-up context, answer language, ledger generation/revision, store-local date/timezone, model and prompt version. New context, day, language or revision gets a fresh answer. Prompt version 3 prevents older verbose comparison answers from being reused after the presentation update. Cache keys contain no raw question; cached values contain the calculated answer/evidence, not saved notes. Existing shared-store error text may refer to “summary” limits.

The reconciliation wording follow-up uses presentation version 4 so earlier status/count wording is not reused. Its 5 focused tests and the full 51-test unit/API suite pass, along with the production build; financial calculations are unchanged.

## Verification

```powershell
npm.cmd test
npm.cmd run test:emulators
npm.cmd run build
```

`tests/ask.test.js` covers deterministic dates/timezones/coverage/calculations, zero baselines, empty records, counted zero, validation, owner/cache isolation, request budgets, bilingual fixtures, invalid/injected outputs, API failures and stale UI responses. `tests/browser/ask.spec.js` uses the real interface with mocked context/requests to test mobile sizing, keyboard submission, suggestions, Nepali selection, evidence, errors and empty states. Existing emulator tests exercise real Auth and Firestore rules/persistence/isolation; emulator AI is disabled. These tests do not verify a real cloud endpoint or model interpretation. No real OpenAI call was made for this feature. Production Firebase, Redis, model access and human English/Nepali review remain required before deployment.

Initial Ask implementation results (October 17): 30 unit/API tests plus retained ledger regressions passed; 2 emulator integration tests and 5 Chrome tests passed. The production build passed with the existing Firebase bundle-size warning. Mobile/desktop screenshots were inspected. An intermediate Google popup timeout was traced to optional CDN assets in the emulator widget; the test now blocks those assets and waits for initialization. These results are historical; see VALIDATION.md for custom comparison verification.

`tests/comparison.test.js` adds English/Nepali natural-phrasing model fixtures, multi-field date-pair queries, strict rejection of arbitrary fields/aggregation/code, balance snapshots versus flow sums, actual-zero and missing counts, non-netted reconciliation, owner-bound context, expired/missing context, follow-up reuse, account changes, sign-out and Forget. The model outputs in these fixtures are supplied by mocks; passing fixtures verifies the protocol and calculations, not real language interpretation. `tests/browser/comparison.spec.js` exercises the existing UI with mocked custom results, bilingual follow-ups, interpreted periods/fields, mobile/desktop layout and account clearing.

October 18 local results: 42 unit/API tests plus retained ledger regressions pass; 2 emulator integration tests and 6 Chrome tests pass. The final missing-value/empty-context refinements were checked with the unit/API suite and build after that browser run. Production build passes with the existing bundle-size warning, and desktop/mobile screenshots were inspected. The emulator runner initially stalled; the successful run used an isolated ignored `.tools/firebase-test-config` via `XDG_CONFIG_HOME`. No real OpenAI call, commit, push or deployment was performed for this extension. Human bilingual review and production model/cache verification remain pending.

Presentation follow-up on October 18: 46 unit/API tests plus retained regressions pass; all 3 focused Ask/comparison Chrome tests and the production build pass. Native Evidence keyboard behavior, coverage/warning conditions, the exact natural-language example, duplicate prevention and immutable facts were tested. Mobile/desktop screenshots were inspected. The full emulator launcher stalled before tests and was stopped; focused browser tests used mocked services and ran directly via the installed Playwright CLI. Financial calculation modules remain unchanged. No live OpenAI call or publication was performed for this update.

Standalone questions after comparisons: explicit dates and standalone intent override history. One-period queries support every comparison field with the same deterministic flow/snapshot rules. The active-question indicator shows the answered standalone date and fields, and clears previous comparison context. Only genuine references such as “What about card sales on those same days?” receive the last confirmed comparison. Missing actual counts remain distinct from entered zero. Notes remain excluded from model input.

Date-only follow-ups: after a confirmed standalone answer, “What about October 13?” retains the previous fields, replaces the date, and stays a single-period query. Omitted years use an unambiguous confirmed year. Explicit fields override the old topic. Missing/expired topic context asks for clarification. Only opaque references are sent by the browser; the server validates dates/fields and scopes stored context to the signed-in owner. No notes or raw conversation are retained in context.
