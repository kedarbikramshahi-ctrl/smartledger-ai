# Local validation — October 13, 2026

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
