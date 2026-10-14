# SmartLedger AI — Implementation Plan

## Project goal

Help small grocery and convenience stores replace paper ledgers
with digital records for daily sales, cash expenses and cash balances.

The project comes from firsthand grocery-store experience.
The first release focuses on accurate recordkeeping and clear reports.

## Target technology stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS, vanilla JavaScript |
| Build tooling | Vite and npm |
| Authentication | Firebase Authentication |
| Database | Firebase Cloud Firestore |
| Local backend testing | Firebase Emulator Suite |
| Hosting | Vercel |
| Version control | Git and GitHub |
| AI integration | Server-side Vercel Function and model API |

Firebase migration is implemented and verified in local emulators. Production
ledger persistence and isolation still need verification. Real AI integration
is in progress. Do not describe unverified work as completed.

## Core rules

- Store monetary amounts as integer cents.
- Calculate financial totals in code, not with AI.
- Keep card sales separate from drawer cash.
- Closing cash = opening cash + cash sales
  − cash expenses − cash withdrawals.
- Cash difference = actual cash counted − closing cash.
- Blank actual cash means “Not counted”; zero is a valid amount.
- Recorded sales minus cash expenses is not a complete profit calculation.
- Keep sample data separate from user records.
- Preserve existing records during migration.
- Do not publish secrets or service-account credentials.

## Phase 1 — Preserve and verify the current app

**Status: Verified**

### Tasks

- [x] Inspect the existing files and identify the current version.
- [x] Preserve the original implementation.
- [x] Run existing tests.
- [x] Verify entry, editing, deletion, cash calculations and reconciliation.
- [x] Verify date filters, charts, summaries, CSV and backup/restore.
- [x] Record browser-testing results separately from simulated DOM tests.

### Completion criteria

- [x] Existing tests pass.
- [x] The core workflow works in a browser.
- [x] Current limitations are documented.

### Verification notes — October 13, 2026

Originals are preserved in `originals/`, including the pre-Firebase app. Ledger regression checks pass. Chrome tests cover entry editing, reconciliation, filters, downloads and older-backup restore; emulator tests also cover CRUD and isolation. Simulated-DOM and browser results are distinguished in `VALIDATION.md`. Known toolchain and storage limitations are documented.

## Phase 2 — Organize the frontend

**Status: Verified**

### Tasks

- [x] Add Vite and npm scripts.
- [x] Separate HTML, styles, application logic and calculation helpers.
- [x] Preserve the existing design and behavior.
- [x] Add .gitignore and setup instructions.
- [x] Configure Vercel to run the build and serve dist/.

### Completion criteria

- [x] Local development and production build work.
- [x] Existing features still pass their checks.
- [x] No generated files or secrets are accidentally tracked.

### Verification notes — October 13, 2026

HTML, CSS, dashboard rendering, ledger helpers, Firebase setup and repository logic are separated. Vite development and production builds pass. `.env.local`, credentials, caches and generated files are excluded from GitHub; `.vercelignore` also protects deployment uploads. Vercel builds with `npm run build` and serves `dist/`. The original design passed desktop/mobile checks.

## Phase 3 — Add Firebase authentication

**Status: Verified**

### Tasks

- [x] Configure Firebase using documented environment variables.
- [x] Add email/password registration, login and logout.
- [x] Add loading, validation and error states.
- [x] Handle authentication changes and clear prior user state on logout.
- [x] Keep demo mode available without accessing private records.

### Completion criteria

- [x] Authentication works in the emulator.
- [x] Signing out clears private records from the interface.
- [x] Missing configuration produces a useful message.

### Verification notes — October 13, 2026

Separate email/password registration, password confirmation, sign-in and sign-out are implemented, with Google sign-in added beyond this phase’s original scope. Registration stays signed out until explicit sign-in. Emulator/browser tests verify account flows, wrong-password handling and clearing private state. The user confirmed local cloud registration and Google sign-in. Production Google sign-in still requires the Vercel hostname in Firebase Authorized domains.

## Phase 4 — Add Firestore persistence

**Status: In progress**

### Proposed data structure

users/{uid}
  - storeName
  - createdAt

users/{uid}/dailyRecords/{YYYY-MM-DD}
  - date
  - opening
  - cash
  - card
  - expenses
  - withdrawals
  - actualCash: integer cents or null
  - notes
  - createdAt
  - updatedAt

Amounts are stored in cents. Document IDs enforce one record
per user per date.

**Implemented structure differs from the proposal:** profiles store `activeLedger`
and `revision`; records use `users/{uid}/ledgers/{ledgerId}/records/{date}`.
The optional counted-cash field is `actual`, omitted when blank. `storeName`,
`createdAt` and `updatedAt` are not implemented. Ledger generations support safe
restore/import switching. The proposed structure above remains a reference.

### Tasks

- [x] Implement reading, creating, editing and deleting records.
- [x] Show save progress and failures accurately.
- [x] Write security rules requiring ownership.
- [x] Validate allowed fields, dates, amount bounds and notes.
- [x] Test unauthenticated access and cross-user access denial.
- [x] Prevent edits from silently overwriting a different date’s record.

### Completion criteria

- [x] Records persist across sessions. **Verified in emulators; live verification pending.**
- [x] Two users cannot access each other’s records. **Verified in emulators; live verification pending.**
- [x] Invalid writes are rejected by security rules. **Verified in emulators; live verification pending.**
- [ ] Verify persistence, account isolation and rejection of invalid writes against the live Firebase project.

### Verification notes — October 13, 2026

All listed implementation tasks pass local/emulator checks. Authenticated persistence after re-authentication, two-user read/write/delete isolation and rejection of invalid records are tested. These results do not verify the live Firebase project’s published rules. Live ledger persistence and account isolation remain unchecked.

## Phase 5 — Migrate existing records

**Status: In progress**

### Tasks

- [x] Detect existing localStorage records.
- [x] Let the user preview and explicitly approve an import.
- [ ] Identify possible sample data; do not silently import it.
- [x] Validate records and resolve duplicate dates.
- [ ] Make imports safe to retry after partial failures.
- [x] Preserve the local copy until successful import is confirmed.
- [x] Keep old JSON backups compatible.

### Completion criteria

- [x] Imports do not silently overwrite records.
- [ ] Interrupted imports can be retried without duplicates.
- [x] Existing backups remain readable.

### Verification notes — October 13, 2026

Preview, cancellation, explicit confirmation, duplicate skipping, retained local copies and older backups are tested. Imports/restores stage a new private ledger and switch only after upload succeeds; stale revisions are rejected. Successful retry does not duplicate dates. Automatic identification of possible legacy sample records is not implemented. A forced interruption between upload batches followed by retry has not been tested.

## Phase 6 — Add real AI summaries

**Status: In progress**

### Tasks

- [x] Add a server-side Vercel Function. **Implemented locally.**
- [x] Keep the AI API key in server environment variables. **Server-only configuration; real key setup pending.**
- [x] Verify the user’s identity before accepting requests. **Signed JWT validation tested.**
- [x] Calculate totals in code and send only necessary data.
- [ ] Generate a short summary based on supplied facts. **Structured-output integration implemented; real model request pending.**
- [x] Clearly distinguish AI summaries from calculated summaries.
- [x] Add request limits, timeouts and error handling. **Automated tests; production shared cache configuration pending.**
- [x] Keep the calculated summary available when AI fails.

### Completion criteria

- [ ] A real model request succeeds in a configured environment.
- [x] Secrets are absent from browser code. **Server environment names have no VITE_ prefix.**
- [x] Missing days and insufficient data are disclosed.
- [ ] Summaries do not invent figures or claim profit without adequate data. **Placeholder validation tested; real-output review pending.**

### Verification notes — October 13, 2026

The app keeps its Calculated summary and adds click-to-generate AI output with English/Nepali selection. The server verifies Firebase tokens, reads owned Firestore records, computes facts and requests gpt-6-luna via Responses API. Notes and account details are not sent. Shared cache/rate limits are required on Vercel; a local memory store is available for development. Authorization, calculations, caching, concurrency, failure handling and output checks are tested using mocked upstream services. A real API key, real model request, language review and production configuration are still required. No AI deployment or publication was performed by this phase. See `docs/ai-summaries.md`.

## Phase 7 — Prepare and publish the demo

**Status: In progress**

### Tasks

- [x] Test on desktop and mobile.
- [x] Verify forms, filters, cash reconciliation and exports.
- [x] Verify backup/restore and user-data isolation. **Local/emulator verification.**
- [x] Deploy the tested version to Vercel.
- [ ] Confirm the live URL and production behavior. **URL and page smoke test verified; complete live workflow pending.**
- [ ] Prepare a two-minute demonstration.

### Demo flow

1. Explain the paper-ledger problem.
2. Enter a daily record.
3. Compare expected and actual cash.
4. Filter a reporting period.
5. Show a summary and export.
6. Explain implemented features and remaining limitations.

### Completion criteria

- [ ] The live deployment works.
- [ ] Demonstration uses fictional data.
- [x] No unfinished feature is presented as completed.

### Verification notes — October 13, 2026

Desktop/mobile checks, GitHub publication and Vercel production deployment are complete. Live smoke testing confirmed HTTP 200, Firebase initialization, enabled sign-in controls, separate registration and zero JavaScript errors. The live URL is https://smartledger-ai-psi.vercel.app. Full live ledger behavior/isolation and production Google authorization remain to verify. A two-minute fictional-data demonstration has not been prepared.

## Later improvements

- Nepali interface and summaries.
- Detailed expense categories.
- Receipt attachments.
- Staff roles and shared store access.
- Inventory and scheduling as separate future modules.

## Progress tracking

Last reviewed: **October 13, 2026**. Checked tasks are implemented/tested to the
scope stated in their notes; they do not imply unperformed production tests.

| Phase | Status |
|---|---|
| 1 | Verified |
| 2 | Verified |
| 3 | Verified |
| 4 | In progress |
| 5 | In progress |
| 6 | In progress |
| 7 | In progress |

Use these states for each phase:
Not started / In progress / Blocked / Verified

For each completed phase, record:
- Changes made
- Tests run and results
- Browser verification
- Remaining limitations
- Deployment status
