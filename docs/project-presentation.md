# SmartLedger AI — project presentation

Six-slide draft · 18 October 2026 · Suggested duration: 7–9 minutes

Open [the presentation](project-presentation.html) in a browser. Use the arrow keys to move between slides, **N** for speaker notes, and browser Print to export six pages to PDF. This Markdown file is the editable content and presenter guide. Demo placeholders deliberately use fictional data.

## Slide 1 — SmartLedger AI

**Daily bookkeeping for small stores**

Record sales and expenses, reconcile the cash drawer, and understand saved records in English or Nepali.

**Speaker notes:**
SmartLedger AI is a daily ledger for small grocery and convenience stores. It brings daily amounts, cash checks, reports and optional AI explanations into one place. The records are daily totals, not individual checkout transactions. A store owner can answer three practical questions: What did I record? Does the counted cash match the expected amount? What changed between recorded dates?

Sources: [README](../README.md), [ledger calculations](../src/ledger.js), [Ask documentation](ask-your-ledger.md).

---

## Slide 2 — What owners can do today

- Sign in with email/password or Google to access a private ledger.
- Add, edit and delete daily records for sales, expenses and cash balances.
- See sales charts, date-filtered totals and a calculated summary.
- Check **Balanced, Short, Over or Not counted** cash statuses.
- Export CSV, back up/restore JSON, and preview imports of browser records.

**[DEMO PLACEHOLDER — dashboard and one daily cash check]**

**Speaker notes:**
Use a fictional ledger. Show cash and card sales separately, then opening cash, cash expenses, withdrawals and actual cash counted. Explain that expected closing cash is opening cash + cash sales − cash expenses − withdrawals; card payments do not add cash to the drawer. A blank actual count means Not counted. Entered zero is a real count. Apply a date filter and point out that CSV follows the filter while a full backup includes all records. New accounts start empty; sample records belong to demo mode.

Suggested visual: replace the demo placeholder with a dashboard screenshot containing only fictional records. Avoid emails and account details.

Sources: [dashboard](../src/dashboard.js), [app workflows](../src/app.js), [repository](../src/repository.js), [ledger](../src/ledger.js).

---

## Slide 3 — AI features and model

- **AI summary:** an optional English or Nepali explanation of calculated dashboard facts.
- **Ask your ledger:** read-only questions, date comparisons and follow-ups about saved records.
- **Code default: `gpt-6-luna`**, configurable through server-only `OPENAI_MODEL`.
- AI interprets intent and arranges explanations; server code calculates the money.

**[DEMO PLACEHOLDER — ask a question, then expand Evidence]**

**Speaker notes:**
Both AI features use the OpenAI Responses API with structured output. The summary uses validated placeholders for amounts; Ask first validates an allowlisted query and then validates the IDs of approved answer sentences. Ask covers opening cash, cash/card/total sales, expenses, withdrawals, expected closing cash, actual counted cash, cash differences, payment mix and reconciliation. It supports single dates, periods, multiple fields and comparisons. Evidence shows the interpreted dates/fields and coverage.

Demo sequence: (1) Compare total sales on October 14 and October 15, 2026. (2) What about card sales on those same days? (3) Was the cash drawer balanced on October 10, 2026? (4) What about October 13? With the regression fixture, October 10 is not counted with expected cash of $342; October 13 is balanced with expected and actual cash both $0. These are fictional fixture outcomes, not claims about every ledger. The fourth question retains reconciliation and replaces the date. This latest date-only follow-up fix is currently local and uncommitted.

The configured production model cannot be established from the default in source code. There is one shared model setting, not a separate model for each AI feature. Codex assists development; the exact coding-session model is not recorded in the repository. Do not claim benchmark, cost or speed results: none were measured here. Use a reviewed screenshot/recording if a live cloud AI demo has not been verified.

Sources: [AI request implementation](../server/ask-services.js), [summary implementation](../server/summary-services.js), [environment template](../.env.example), [Ask documentation](ask-your-ledger.md).

---

## Slide 4 — Technology stack

| Layer | What we use |
|---|---|
| Interface | HTML5, CSS and vanilla JavaScript modules |
| Build and local development | Vite 7; Node.js 22.12+ |
| Accounts and saved records | Firebase Authentication; Cloud Firestore |
| Server endpoints | JavaScript handlers; Vercel function entry points |
| AI | OpenAI Responses API; strict JSON schemas |
| Cache and request limits | Shared REST Redis in production; memory store for local development |

**Speaker notes:**
The frontend uses the Firebase Web SDK. The server verifies Firebase ID tokens with jose, reads the authenticated owner's active ledger, performs calculations and calls OpenAI. The server keeps the API key and Redis credentials out of the browser bundle. Vite serves the API handlers during local development; the repository also has Vercel API entry points. Production requires shared Redis so caching and budgets work across function instances. These describe the implemented architecture, not a fresh audit of production infrastructure. Test tooling includes Node's test runner, a simulated DOM regression suite, Playwright/Chrome, and Firebase Auth/Firestore emulators.

Sources: [package.json](../package.json), [Vite configuration](../vite.config.js), [API entry points](../api/ask.js), [Firebase client](../src/firebase.js), [server store](../server/summary-store.js).

---

## Slide 5 — Financial accuracy and security

- Money uses **integer cents**; balances use dated snapshots, while sales and expenses use sums.
- Missing records stay missing; zero counts remain valid; shortages and overages stay separate.
- Firebase tokens and owner-only access isolate accounts; AI cannot write ledger records.
- Queries and model output are validated; no model-generated code or arbitrary database queries run.
- Server-only secrets, request limits and caching protect API access; saved notes stay out of AI input.

**Speaker notes:**
Opening cash is the first recorded opening balance; closing cash is the latest recorded closing balance. Neither is summed into “available cash.” Actual cash uses counted dates and distinguishes missing counts from zero. Evidence preserves exact dates, figures and recorded-day coverage. Weeks start Monday; unfinished-week comparisons use equivalent elapsed weekdays. No percentage change is calculated with a zero baseline. The deployment timezone is explicit, with America/New_York as the fallback; currency formatting currently uses USD.

Ask is read-only even though owners can manage records through the ordinary ledger interface. It does not infer causes, profit, inventory or individual transactions. Notes render as text and are not sent to the model. Authenticated reads are capped at 300/hour per user; uncached generations share limits of 3/minute and 25/day per user, plus 200/day per deployment. Caches expire after 24 hours and account for owner, data revision, language and date/context. Follow-up references are owner-bound and cleared by the UI on account change/sign-out.

Sources: [financial calculations](../server/comparison.js), [Ask handler](../server/ask-handler.js), [security rules](../firestore.rules), [cache/limits](../server/summary-store.js).

---

## Slide 6 — Testing and the next demo

- **60 unit/API tests passed**, plus the retained ledger DOM regressions.
- **3 focused browser tests passed** for Ask/comparisons; the production build passed.
- Regressions cover account isolation, dates, zero counts, API failures and follow-up transitions.
- Firebase emulator suites cover authentication, persistence and security rules.
- **Still to verify:** a real OpenAI call, bilingual interpretation quality and the latest cloud configuration.

**[DEMO PLACEHOLDER — four-question walkthrough with Evidence]**

**Speaker notes:**
The 60-test result and three focused browser tests are the latest local run recorded in VALIDATION.md. API tests cover authentication, validation, isolation, caching, quotas, malformed model output and upstream failures. Browser tests exercise real UI behavior with mocked requests, including keyboard/mobile use. The new four-question sequence runs through the DOM fixture and real handler/calculator with mocked AI. Earlier emulator integration runs are documented, but the full emulator suite was not rerun for the latest follow-up fix. The production build passes with a bundle-size warning above 500 kB.

Passing mocked AI tests proves the protocol and calculations, not that the real model understands every English/Nepali question. Do not describe the latest local change as deployed. Before presenting a live demo, verify real model access, cloud account isolation, Redis configuration and the responses in both languages. Prepare a fictional-data recording or screenshots as backup. Leave one minute for questions about the bookkeeping workflow and trust in the evidence.

Sources: [validation record](../VALIDATION.md), [Ask tests](../tests/ask.test.js), [comparison regressions](../tests/comparison.test.js), [browser tests](../tests/browser/comparison.spec.js), [emulator tests](../tests/emulator.test.js).
