# SmartLedger AI

SmartLedger uses HTML5, CSS and vanilla JavaScript, bundled with Vite. Email/password accounts use Firebase Authentication and private ledgers use Cloud Firestore. The summary is a **Calculated summary**; there is no AI service or AI API key.

**Create account** opens a separate registration form with email, password and password confirmation. Successful registration returns to the Sign in form; it does not open the ledger automatically. **Sign in** opens an existing account's ledger using email/password or Google. Registration uses a temporary memory-only Firebase Auth instance to avoid Firebase's normal automatic sign-in of newly created users; the main account session stays signed out until you sign in explicitly.

**Continue with Google** also signs in through Firebase Authentication using an account-selection popup. Enable the Google provider (including its support email) in the same Firebase project. Under Authentication → Settings → Authorized domains, add the hostname you use locally (`127.0.0.1` or `localhost`) and your eventual Vercel/custom domain. Allow the sign-in popup in your browser. Google cancellation, blocked popups, unauthorized domains and provider/account conflicts have explicit error messages. A Google login uses the same UID-based Firestore permissions; it does not bypass denied database rules. Accounts are not automatically merged when Firebase reports a provider conflict.

If an account appears in Authentication but the app says **Firestore denied access**, Authentication succeeded but the ledger read/write failed. In that same project, create/select the `(default)` Firestore database, open its Rules tab, replace the starter rules with the entire local `firestore.rules` and click Publish. Wait for propagation and click Retry loading ledger. Do not substitute a public `allow read, write: if true` rule. Verify `users/{uid}` and ledger record documents in Firestore's Data tab after saving; an entry in Authentication's Users list is not a ledger record.

## Project structure

- `index.html`: page structure and forms, retaining the existing green dashboard design.
- `src/styles.css`: responsive layout and styles.
- `src/ledger.js`: integer-cent calculations, validation, CSV, backups and import planning.
- `src/dashboard.js`: filtered totals, chart, ledger and calculated summary.
- `src/app.js`: account states, forms, CRUD and explicit import preview.
- `src/firebase.js`: Firebase Web SDK initialization and local emulator connection.
- `src/repository.js`: authenticated Firestore reads/writes and staged import/restore.
- `firestore.rules`, `firebase.json`: ownership/validation rules and emulators.
- `test-ledger.cjs`, `tests/`: regression, unit, security, integration and browser tests.
- `originals/index-pre-firebase.html`: preserved working app immediately before migration. Earlier originals and `index (1).html` remain unchanged.

## Local preview

Use Node.js 22.12+ (Node 24 works), npm, and Java **21+** for the Firestore emulator. On Windows use `npm.cmd` if PowerShell blocks `npm.ps1`. No global Firebase CLI installation or Firebase login is needed for emulator mode.

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run emulators
```

Keep that terminal open. In a second terminal in the same project folder:

```powershell
npm.cmd run dev:emulator
```

Open **http://127.0.0.1:5173**. Create disposable accounts with test email addresses and passwords. The `demo-smartledger` project in `.env.emulator` targets only Auth on port 9099 and Firestore on port 8080. It cannot upload to a real Firebase project. Emulator connections are rejected on non-localhost origins.

The emulator launcher uses a portable Java runtime under ignored `.tools/java` if present; otherwise it uses your installed `JAVA_HOME`/PATH. Download caches stay under `.tools`. Use Ctrl+C to stop the emulator normally: it exports records/accounts into ignored `.emulator-data` for the next preview session. Tests start fresh ephemeral emulators under `demo-smartledger-tests` using Auth port 9199, Firestore port 8180 and Vite port 5174 (`firebase.test.json`). They never import or clear the preview project's data, and can run alongside the preview servers.

For the fictional demo without any Firebase configuration:

```powershell
npm.cmd run dev
```

Accounts are disabled with an explanatory message if configuration is missing. Demo edits use a separate `smartledger-demo-v2` localStorage key. New signed-in accounts always start empty. Do not double-click the new `index.html`: ES modules now need the Vite server.

## Tests and production preview

```powershell
npm.cmd test
npm.cmd run test:emulators
npm.cmd run build
npm.cmd run preview
```

`test` runs the retained simulated-DOM regression suite against the **new split modules**, plus domain tests. `test:emulators` runs real Auth sign-up/sign-in/sign-out and Firestore persistence tests, deny/allow security-rule tests for two users and unauthenticated clients, then Playwright browser tests. Browser tests use installed Google Chrome (`channel: chrome`); install Chrome or change the channel and install Playwright Chromium if you use another platform.

`build` outputs `dist`; `preview` serves it at **http://127.0.0.1:4173**. The default production build needs real `.env.local` values for cloud accounts; with no values it shows fictional demo mode. To preview an emulator-enabled production bundle, run `npm.cmd run build -- --mode emulator`, keep the emulators running, then `npm.cmd run preview`. Never publish that emulator bundle.

The dependency audit after the gRPC patch reports zero production dependency vulnerabilities. The Firebase CLI's development dependencies still have 11 audit findings (7 high, 4 moderate). Do not run `npm audit fix --force` blindly: its suggested changes include incompatible package downgrades. Review these development-tool findings before publication and update the toolchain when compatible fixes are available.

## Firebase configuration you must supply for cloud testing

No real Firebase project configuration is included. In Firebase Console:

1. Create/select your project and register a **Web app**.
2. Create **Cloud Firestore, Standard edition, Native mode**, using the default database `(default)`. Choose its location deliberately. Do not leave permissive test rules enabled.
3. Enable **Authentication → Sign-in method → Email/Password**.
4. Copy `.env.example` to `.env.local` and enter the Web app values:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_APP_ID`
   - Keep `VITE_USE_FIREBASE_EMULATORS=false` for cloud testing.
5. Add localhost and your exact Vercel/custom domains to Authentication's authorized domains as appropriate.
6. Review and publish **this project's `firestore.rules`** to that Firebase project before testing real accounts. Vercel builds do not publish Firebase security rules. No rules have been published by this migration.
7. Restart Vite and test two disposable accounts against the cloud. Emulator passing results do not prove that your live Firebase project, rules or Vercel deployment are configured correctly.

These are public Firebase Web app settings, not server credentials. Authorization comes from Authentication and Firestore rules. **Never put a service-account JSON/private key, Firebase Admin SDK credentials or any AI API key in `VITE_*`, frontend code or GitHub.** `.env.local`, `.tools`, emulator data, build output and common credential filenames are ignored. There is no Firebase Admin SDK in the app.

## Data, import and restore behavior

Each account has `/users/{uid}` containing its active ledger ID and a revision. Records are stored at `/users/{uid}/ledgers/{ledgerId}/records/{YYYY-MM-DD}`. Dates are unique document IDs. Only that authenticated UID can read/write its profile and ledger records. All other paths are denied.

Rules and app validation accept real calendar dates, non-negative integer-cent inputs up to 10,000,000,000 cents per field, optional integer `actual` (zero is valid), and optional notes up to 300 characters. No unknown record fields are accepted. Calculated closing cash can be negative and excludes card sales. Normal entry forms allow today or earlier; older backups accept any valid calendar date to preserve prior backup compatibility.

After sign-in, **Preview local import** reads the original `smartledger-v1` key on the current browser origin. Nothing uploads on sign-in or preview. The preview shows each date, sales, closing cash, count status, and whether it will be imported or skipped. Existing account dates are skipped, never overwritten. Click **Import new dates** explicitly to proceed. Local data can include old fictional sample records: review it before importing. The original localStorage value is never changed or deleted, even after success or failure.

localStorage is specific to a browser profile and origin. The old Vercel domain, `file://` preview and `http://127.0.0.1:5173` do **not** share storage. If you do not see local records on localhost, download a JSON backup from your still-open old app or the old deployment, then use Restore after sign-in. The preserved standalone app under `originals/` can open old backup files. Do not assume a different file URL can see the old file's storage. Keep the original backup safely before replacing account data.

JSON version-1 backups remain compatible, including those without notes or actual cash counted. Backups include the entire active ledger; CSV includes only the selected date range and adds actual cash, signed difference and count status. Formula-like CSV notes are prefixed to make spreadsheet opening safer.

Import and restore validate all input and upload a new ledger generation in bounded batches. Only after every upload succeeds does a transaction switch the active ledger. The revision prevents a stale restore/import from overwriting concurrent edits. On a conflict, reload and preview again. Prior generations and interrupted staging uploads remain private in Firestore; they are not automatically deleted. They consume storage and can be cleaned up later through an explicitly authorized maintenance process. Active-ledger backups/exports exclude them. Restore is an explicit replacement; import merges only absent dates. The app supports up to 10,000 records per backup/ledger and 5 MB backup files, matching the previous backup limits.

## Existing Vercel deployment

The prepared `vercel.json` keeps Vercel as hosting:

- Framework preset: **Vite**
- Install command: **npm ci**
- Build command: **npm run build**
- Output directory: **dist**
- Node version: **24.x** (or supported 22.12+)

Add the four public Firebase values in Vercel Environment Variables for the intended environment and set `VITE_USE_FIREBASE_EMULATORS=false`. Values are baked into the frontend build, so changes require a rebuild. Do not set service-account credentials or AI API keys. Build output serves only the app, not the archived HTML or tests. Add the deployed hostname to Firebase Authentication's authorized domains for Google sign-in.

## Before publication

- [ ] Review the local desktop and mobile design, loading messages and sign-in errors.
- [ ] Create accounts A and B; confirm new ledgers are empty and records never cross accounts.
- [ ] Add/edit/move/delete dates, check duplicate-date errors and data after reload/sign-out/sign-in.
- [ ] Verify cash/card separation, integer cents, Balanced/Short/Over/Not counted and entered zero.
- [ ] Verify ranges update totals/chart/summary/CSV; backups include all records.
- [ ] Preview/cancel/import local data; verify duplicate skips and the retained original local copy.
- [ ] Restore both older and newer backups; confirm canceled/failed restores preserve the active ledger.
- [ ] Run `npm test`, `npm run test:emulators`, `npm run build`; review dependency audit findings.
- [ ] Configure the real Firebase project, rules, authorized domains and Vercel environment values.
- [ ] Test cloud persistence and two-user isolation with disposable accounts; record results separately from emulator tests.
- [ ] Confirm the production build is not in emulator mode and has no private credentials.
- [ ] Confirm publication is authorized before pushing changes or deploying to production.

Reference documentation: [Firebase Auth emulator](https://firebase.google.com/docs/emulator-suite/connect_auth), [Firestore emulator](https://firebase.google.com/docs/emulator-suite/connect_firestore), [rules testing](https://firebase.google.com/docs/firestore/security/test-rules-emulator), [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite).
