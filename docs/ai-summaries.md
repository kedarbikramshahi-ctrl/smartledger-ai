# Phase 6: AI summaries

The app keeps its **Calculated summary** and adds an optional **AI summary**. Generation runs only after clicking Generate summary while signed into a cloud account. Select English or Nepali. Demo and Firebase-emulator accounts do not make real OpenAI requests.

## Local setup

1. Sign into https://platform.openai.com/api-keys, select an API project, and create a project key named SmartLedger summaries. API usage requires API billing/credit separately from Codex access. Use the key only on the server; do not paste it into chat or source code.
2. Add these entries to your ignored `.env.local`:

```dotenv
OPENAI_API_KEY="your-project-key"
OPENAI_MODEL=gpt-6-luna
AI_USE_LOCAL_STORE=true
```

3. Keep your four Firebase Web values and `VITE_USE_FIREBASE_EMULATORS=false` in that file. The summary endpoint verifies real Firebase ID tokens and reads the current account's ledger under its published Firestore rules. No service-account credential is needed.
4. Stop/restart `npm.cmd run dev`, open http://127.0.0.1:5173, sign in and use a range containing records. Generate summary. `vite preview` serves only static files; use `npm run dev` for local API testing.

The Vite server serves `/api/summary` through server middleware. `api/summary.js` exports the same handler as a Vercel Node Function. A missing key, failed model call, denied Firestore read, rate limit or failed cache does not remove or replace the calculated summary.

## Vercel configuration (not deployed by this change)

Add **server** Environment Variables for the intended Vercel environment:

| Name | Value |
|---|---|
| `OPENAI_API_KEY` | Your project API key, stored as a Secret |
| `OPENAI_MODEL` | `gpt-6-luna` |
| `KV_REST_API_URL` | HTTPS REST endpoint of a Redis store supporting EVAL, such as Upstash Redis |
| `KV_REST_API_TOKEN` | Redis REST write token, stored as a Secret |

None of these names may start with `VITE_`. Vite also rejects public-prefixed OpenAI/cache-token variable names to prevent accidental exposure. A REST Redis store can be connected through Vercel Marketplace. Do not change Firestore rules to allow public reads or to give browser clients access to summary rate counters. Production **fails closed** if shared storage is missing. `AI_USE_LOCAL_STORE=true` is permitted only in local development and never on Vercel. Redis is a separate service; review its pricing and storage settings before connecting it.

Default generation caps: **2 uncached summaries/minute and 20/day per user**, plus **200/day across this deployment's Redis store**. Failed model requests count toward the cap. Authenticated summary requests, including cache reads, are limited to 300/hour per user before Firestore is queried. Unauthenticated requests are rejected before cache/ledger/model access. Keep an OpenAI project spend limit as an additional spending control.

## Data and cache behavior

- The server verifies the Firebase token signature against Google's public signing keys, audience, issuer, expiry, subject, issue time and auth time. Unsigned emulator tokens are rejected. Like default ID-token verification, this does not check server-side revocation; Firebase tokens expire after their normal validity window.
- The endpoint accepts only date bounds and language. It derives the UID from the verified token, reads that user's active ledger through Firestore REST with that token, and calculates integer-cent totals server-side.
- Firestore query projection excludes notes. No email, UID, raw daily records or notes are sent to OpenAI. Only calculated aggregate facts, coverage and a strongest-day date are sent.
- A revision check catches ledger changes during the read. Totals and dates in AI text must use approved placeholders, which are replaced with code-owned values. Generated digits, currencies, unknown placeholders and explicit profit/loss claims are rejected. Free-form explanations still need review; automated checks are not a guarantee of perfect qualitative interpretation.
- The app separately discloses recorded/missing calendar days, insufficient data for day-to-day comparisons, and that sales minus cash expenses is not a complete profit calculation. Missing days are based on explicit bounds, or the earliest/latest recorded days when a bound is open. No missing sales are estimated.
- Summaries are cached for 24 hours by user, model, prompt version, language, date range, current ledger revision and aggregate facts. User changes, filter changes and edits invalidate the visible result; signing out clears browser summary cache. Old results are discarded if data changes while a request is running.
- A shared Redis lease prevents simultaneous duplicate model calls. OpenAI calls have a 20-second timeout, ledger reads 10 seconds, Redis calls 5 seconds and capped model output of 700 tokens. Requests use Responses API structured output and `store:false`.
- The model has no tools and never receives store notes or instructions from records. HTML is rejected, and summaries render through `textContent`.

## Verification status

`npm.cmd test` includes API authorization, signed JWT tests, English/Nepali fixture summaries, facts/calculations, malformed requests, invented figures/profit rejection, cache isolation, version/language keys, concurrency leases, rate limits, upstream failures, Firestore query projection and stale browser results. These are automated tests with mocked upstream services, not proof that your account can call the model.

Existing Firebase emulator/browser tests remain separate. A real OpenAI request and human review of English/Nepali output are required before marking Phase 6 Verified. No real model call has been confirmed yet.

After adding the API key, run `npm.cmd run test:ai-live -- --confirm` for two billable calls using fictional facts (English and Nepali). The command displays only those fictional summaries; never the key. It verifies model access and output checks, not the full signed-in endpoint. Then test Generate summary while signed into your cloud ledger locally, including repeat clicks, edits, filters and failure states.

Official references: [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna), [Structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [Firebase token verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens), [Firestore REST](https://firebase.google.com/docs/firestore/use-rest-api), [Redis REST](https://upstash.com/docs/redis/features/restapi).
