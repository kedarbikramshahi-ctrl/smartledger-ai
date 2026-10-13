import { MONEY_FIELDS, DEMO_KEY, money, iso, close, cashStatus, escapeText, sample, validateRecord, validateBackup, parseCents, importPlan, readLegacy, toCSV } from './ledger.js';
import { renderDashboard } from './dashboard.js';
import { createBackend } from './firebase.js';

const $ = selector => document.querySelector(selector);
const form = $('#form'), dialog = $('#dialog'), authForm = $('#auth-form'), signupForm = $('#signup-form');
let authMode = 'signin';
let records = [], dateRange = { start: '', end: '' }, editing = null;
let backend = null, user = null, repository = null, version = null;
let ready = false, busy = false, authBusy = false, session = 0, stopRecords = () => {}, pendingImport = null;
let connectionTimer;

function loadDemo() {
  try {
    const stored = localStorage.getItem(DEMO_KEY);
    return stored === null ? sample() : validateBackup({ version: 1, records: JSON.parse(stored) });
  } catch { $('#message').textContent = 'Demo storage could not be read. Showing fictional samples; your original local records are untouched.'; return sample(); }
}
function render() { renderDashboard(records, dateRange); }
function filteredRecords() { return records.filter(r => (!dateRange.start || r.date >= dateRange.start) && (!dateRange.end || r.date <= dateRange.end)); }
function controls() {
  for (const id of ['#add', '#restore', '#reset', '#preview-import', '#import-confirm', '#backup', '#export']) $(id).disabled = busy || !ready;
  for (const button of $('#rows').querySelectorAll('button')) button.disabled = busy || !ready;
  for (const button of form.querySelectorAll('button')) button.disabled = busy || !ready;
  for (const button of authForm.querySelectorAll('button')) button.disabled = busy || authBusy || !backend;
  for (const button of signupForm.querySelectorAll('button')) button.disabled = busy || authBusy || !backend;
  for (const [id, mode] of [['#show-signin','signin'],['#show-signup','signup']]) {
    $(id).disabled = busy || authBusy;
    $(id).setAttribute('aria-pressed', String(authMode === mode));
    $(id).className = authMode === mode ? 'btn' : 'btn secondary';
  }
  $('#signout').disabled = busy || authBusy;
  $('#import-cancel').disabled = busy;
  $('#reset').hidden = !!user;
  $('#signout').hidden = !user;
  $('#auth-switch').hidden = !!user;
  authForm.hidden = !!user || authMode !== 'signin';
  signupForm.hidden = !!user || authMode !== 'signup';
}
function showError(error) {
  const messages = {
    'auth/invalid-credential': 'Email or password is incorrect.',
    'auth/user-not-found': 'Email or password is incorrect.',
    'auth/wrong-password': 'Email or password is incorrect.',
    'auth/email-already-in-use': 'An account already exists for this email. Sign in instead.',
    'auth/weak-password': 'Use a password with at least six characters.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/too-many-requests': 'Too many attempts. Wait a moment and try again.',
    'auth/network-request-failed': 'Cannot connect. Check your connection and, in emulator mode, start the emulators.',
    'auth/popup-closed-by-user': 'Google sign-in was canceled. You can try again or use email and password.',
    'auth/cancelled-popup-request': 'Another sign-in window was opened. Complete that window or try again.',
    'auth/popup-blocked': 'Your browser blocked the Google sign-in window. Allow popups for this site and try again.',
    'auth/unauthorized-domain': 'This site is not authorized for Google sign-in. Add its hostname in Firebase Authentication → Settings → Authorized domains.',
    'auth/operation-not-allowed': 'This sign-in provider is not enabled in Firebase Authentication.',
    'auth/account-exists-with-different-credential': 'This email already uses another sign-in method. Sign in with that method; do not create a second account.',
    'permission-denied': 'You are signed in, but Firestore denied access. In the same Firebase project, publish this app’s firestore.rules for the (default) database, then retry.',
    'unavailable': 'The ledger service is unavailable. Check your connection and try again.',
  };
  return messages[error.code] || error.message || 'Something went wrong. Please try again.';
}
function updateImportOffer() {
  $('#import-panel').hidden = !user || !ready;
  if (!user || !ready) return;
  try {
    const local = readLegacy(localStorage);
    $('#preview-import').hidden = !local?.length;
    $('#import-status').textContent = local?.length ? `${local.length} existing local records are available. Nothing has been uploaded. Preview them before importing.` : 'No existing records were found on this browser origin. You can restore an older JSON backup instead.';
  } catch (error) { $('#preview-import').hidden = true; $('#import-status').textContent = 'Local records were not imported: ' + showError(error) + ' The local copy is untouched.'; }
}
async function refresh() {
  if (!user) { render(); return; }
  const token = session, result = await repository.load();
  if (token !== session) return;
  records = result.records; version = result.version; render(); updateImportOffer(); controls();
}
async function operation(action, success) {
  if (busy || !ready) return false;
  const token = session;
  busy = true; $('#message').textContent = 'Saving…'; controls();
  try {
    await action();
    if (token !== session) return false;
    await refresh();
    $('#message').textContent = success;
    return true;
  } catch (error) {
    if (token === session) $('#message').textContent = 'Could not save: ' + showError(error);
    return false;
  } finally {
    busy = false;
    if (token === session) render();
    controls();
  }
}
function persistDemo(next) {
  const clean = validateBackup({ version: 1, records: next });
  localStorage.setItem(DEMO_KEY, JSON.stringify(clean));
  records = clean;
}
async function replace(next) {
  if (user) await repository.replace(next, version);
  else persistDemo(next);
}
async function accountChanged(nextUser) {
  const token = ++session;
  clearTimeout(connectionTimer); stopRecords(); stopRecords = () => {};
  dialog.close(); $('#import-dialog').close(); pendingImport = null;
  user = nextUser; repository = null; version = null; records = []; ready = false;
  dateRange = { start: '', end: '' }; $('#ledger-filter').reset(); $('#filter-end').setCustomValidity('');
  $('#message').textContent = ''; $('#auth-error').textContent = ''; $('#retry').hidden = true;
  $('#import-panel').hidden = true;
  $('#account-mode').textContent = user ? (backend.emulator ? 'Local emulator account' : 'Account ledger') : 'Fictional demo';
  $('#storage-notice').textContent = user ? (backend.emulator ? 'Your account records are stored in the local Firebase emulator.' : 'Your account records are stored privately in Cloud Firestore.') : 'Fictional demo records are kept separately in this browser. They are never uploaded to an account.';
  controls(); render();
  if (!user) {
    records = loadDemo(); ready = true;
    $('#account-status').textContent = backend ? 'Signed out. Explore fictional demo records, or sign in to your own ledger.' : 'Firebase is not configured. Fictional demo is available. See README.md for local emulator setup.';
    render(); controls(); return;
  }
  $('#account-status').textContent = 'Loading your ledger…';
  repository = backend.repository(user.uid);
  connectionTimer = setTimeout(() => {
    if (token !== session || ready) return;
    $('#account-status').textContent = 'Still connecting to your ledger…';
    $('#auth-error').textContent = 'Check your connection and emulator setup. You can retry or sign out.';
    $('#retry').hidden = false;
  }, 12000);
  try {
    await repository.initialize();
    if (token !== session) return;
    stopRecords = repository.watch((next, nextVersion) => {
      if (token !== session) return;
      clearTimeout(connectionTimer); records = next; version = nextVersion; ready = true;
      $('#account-status').textContent = `Signed in as ${user.email}. Ledger loaded.`;
      $('#auth-error').textContent = ''; $('#retry').hidden = true;
      render(); updateImportOffer(); controls();
    }, error => {
      if (token !== session) return;
      clearTimeout(connectionTimer); ready = false; records = []; render(); controls();
      $('#account-status').textContent = 'Could not load your ledger. Retry or sign out.';
      $('#auth-error').textContent = showError(error); $('#retry').hidden = false;
    });
  } catch (error) {
    if (token !== session) return;
    clearTimeout(connectionTimer); $('#account-status').textContent = 'Could not load your ledger. Retry or sign out.'; $('#auth-error').textContent = showError(error); $('#retry').hidden = false; controls();
  }
}

const filterForm = $('#ledger-filter'), filterStart = $('#filter-start'), filterEnd = $('#filter-end');
filterForm.onsubmit = e => {
  e.preventDefault(); filterEnd.setCustomValidity('');
  if (filterStart.value && filterEnd.value && filterStart.value > filterEnd.value) {
    filterEnd.setCustomValidity('To date must be on or after From date.'); filterEnd.reportValidity(); return;
  }
  dateRange = { start: filterStart.value, end: filterEnd.value }; render(); controls();
};
filterForm.addEventListener('input', () => filterEnd.setCustomValidity(''));
$('#filter-clear').onclick = () => { filterForm.reset(); filterEnd.setCustomValidity(''); dateRange = { start: '', end: '' }; render(); controls(); };
function open(date = null) {
  if (busy || !ready) return;
  editing = date; form.reset();
  $('#form-error').textContent = '';
  const r = records.find(record => record.date === date);
  form.elements.date.max = iso(new Date()); form.elements.date.value = r ? r.date : iso(new Date());
  form.elements.notes.value = r?.notes || '';
  form.elements.actual.value = r?.actual === undefined ? '' : (r.actual / 100).toFixed(2);
  for (const field of MONEY_FIELDS) form.elements[field].value = r ? (r[field] / 100).toFixed(2) : '0';
  $('#formtitle').textContent = r ? 'Edit daily record' : 'Add daily record';
  estimate(); dialog.showModal();
}
function estimate() {
  try {
    const preview = Object.fromEntries(MONEY_FIELDS.map(field => [field, parseCents(form.elements[field].value)]));
    const actual = parseCents(form.elements.actual.value, true); if (actual !== undefined) preview.actual = actual;
    $('#estimate').textContent = 'Closing cash: ' + money(close(preview)) + ' · ' + cashStatus(preview);
  } catch { $('#estimate').textContent = 'Enter valid amounts to calculate closing cash.'; }
}
form.addEventListener('input', estimate);
$('#add').onclick = () => open(); $('#cancel').onclick = () => dialog.close();
form.onsubmit = async e => {
  e.preventDefault(); if (busy || !ready) return;
  $('#form-error').textContent = '';
  try {
    const record = { date: form.elements.date.value, notes: form.elements.notes.value.trim() };
    for (const field of MONEY_FIELDS) record[field] = parseCents(form.elements[field].value);
    const actual = parseCents(form.elements.actual.value, true); if (actual !== undefined) record.actual = actual;
    const clean = validateRecord(record);
    if (clean.date > iso(new Date())) throw Error('Choose today or an earlier date.');
    if (records.some(r => r.date === clean.date && r.date !== editing)) throw Error('A record exists for this date. Edit that record instead.');
    if (close(clean) < 0 && !confirm('This entry gives a negative closing cash balance. Check your amounts. Save anyway?')) return;
    const saved = await operation(async () => {
      if (user) await repository.save(clean, editing, version);
      else persistDemo([...records.filter(r => r.date !== editing), clean]);
    }, 'Daily record saved.');
    if (saved) dialog.close();
    else $('#form-error').textContent = $('#message').textContent;
  } catch (error) { $('#form-error').textContent = showError(error); $('#message').textContent = showError(error); }
};
$('#rows').onclick = async e => {
  if (busy || !ready) return;
  const button = e.target.closest('button'); if (!button) return;
  if (button.dataset.edit) open(button.dataset.edit);
  if (button.dataset.delete && confirm('Delete this daily record?')) await operation(async () => {
    if (user) await repository.remove(button.dataset.delete, version);
    else persistDemo(records.filter(r => r.date !== button.dataset.delete));
  }, 'Daily record deleted.');
};
$('#reset').onclick = async () => {
  if (user || !confirm('Replace fictional demo records with fresh fictional sample data?')) return;
  await operation(() => replace(sample()), 'Fictional demo records reset.');
};
function download(content, type, filename) {
  const url = URL.createObjectURL(new Blob([content], { type })), link = document.createElement('a');
  link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
}
$('#export').onclick = () => { if (ready) download(toCSV(filteredRecords()), 'text/csv', 'smartledger-records.csv'); };
$('#backup').onclick = () => {
  if (!ready) return;
  download(JSON.stringify({ version: 1, records }, null, 2), 'application/json', 'smartledger-backup-' + iso(new Date()) + '.json');
  $('#message').textContent = 'Backup downloaded. Keep it somewhere you can find it.';
};
$('#restore').onclick = () => $('#restorefile').click();
$('#restorefile').onchange = async e => {
  const file = e.target.files[0]; if (!file || busy || !ready) return;
  const token = session;
  try {
    if (file.size > 5000000) throw Error('Backup is too large.');
    const restored = validateBackup(JSON.parse(await file.text()));
    if (token !== session) return;
    if (confirm(`Replace ${user ? 'your account ledger' : 'fictional demo records'} with ${restored.length} records from this backup?`)) await operation(() => replace(restored), 'Backup restored successfully.');
  } catch (error) { alert('Could not restore: ' + showError(error)); }
  finally { e.target.value = ''; }
};

authForm.onsubmit = async e => {
  e.preventDefault(); if (!backend || authBusy || busy) return;
  authBusy = true; $('#auth-error').textContent = '';
  $('#account-status').textContent = 'Signing in…'; controls();
  try {
    await backend.signIn(authForm.elements.email.value.trim(), authForm.elements.password.value);
    authForm.elements.password.value = '';
  } catch (error) { $('#auth-error').textContent = showError(error); $('#account-status').textContent = 'Sign-in failed.'; }
  finally { authBusy = false; controls(); }
};
function chooseAuth(mode) {
  if (authBusy || busy || user) return;
  authMode = mode; $('#auth-error').textContent = '';
  authForm.elements.password.value = '';
  signupForm.elements.password.value = ''; signupForm.elements.confirmation.value = '';
  controls();
}
$('#show-signin').onclick = () => chooseAuth('signin');
$('#show-signup').onclick = () => chooseAuth('signup');
signupForm.onsubmit = async e => {
  e.preventDefault(); if (!backend || authBusy || busy) return;
  $('#auth-error').textContent = '';
  if (signupForm.elements.password.value !== signupForm.elements.confirmation.value) {
    $('#auth-error').textContent = 'Passwords do not match.'; return;
  }
  authBusy = true; $('#account-status').textContent = 'Creating your account…'; controls();
  const email = signupForm.elements.email.value.trim();
  try {
    await backend.signUp(email, signupForm.elements.password.value);
    authMode = 'signin'; authForm.elements.email.value = email;
    signupForm.reset();
    $('#account-status').textContent = 'Account created. Sign in to open your ledger.';
  } catch (error) { $('#auth-error').textContent = showError(error); $('#account-status').textContent = 'Account creation failed.'; }
  finally { authBusy = false; controls(); }
};
$('#signout').onclick = async () => {
  if (busy || authBusy) return;
  authBusy = true; $('#account-status').textContent = 'Signing out…'; controls();
  try { await backend.signOut(); } catch (error) { $('#auth-error').textContent = showError(error); $('#account-status').textContent = 'Sign-out failed. Please try again.'; }
  finally { authBusy = false; controls(); }
};
$('#google-signin').onclick = async () => {
  if (!backend || authBusy || busy) return;
  authBusy = true; $('#auth-error').textContent = '';
  $('#account-status').textContent = 'Signing in with Google…'; controls();
  try {
    await backend.signInGoogle();
    authForm.elements.password.value = '';
  } catch (error) {
    $('#auth-error').textContent = showError(error);
    $('#account-status').textContent = 'Google sign-in did not complete.';
  } finally { authBusy = false; controls(); }
};
$('#retry').onclick = () => accountChanged(user);
$('#preview-import').onclick = () => {
  if (!user || !ready || busy) return;
  try {
    const local = readLegacy(localStorage);
    if (!local) throw Error('No local records were found.');
    const plan = importPlan(local, records);
    pendingImport = { records: local, version: { ...version }, session };
    $('#import-preview-status').textContent = `${plan.eligible.length} new dates to import; ${plan.duplicates.length} existing dates will be skipped.`;
    const eligible = new Set(plan.eligible.map(r => r.date));
    $('#import-preview-rows').innerHTML = plan.records.map(r => `<tr><td>${r.date}</td><td>${money(r.cash + r.card)}</td><td>${money(close(r))}</td><td>${cashStatus(r)}</td><td>${eligible.has(r.date) ? 'Import' : 'Skip duplicate date'}</td></tr>`).join('');
    $('#import-confirm').disabled = !plan.eligible.length;
    $('#import-dialog').showModal();
  } catch (error) { $('#import-status').textContent = showError(error) + ' The local copy is untouched.'; }
};
$('#import-cancel').onclick = () => { pendingImport = null; $('#import-dialog').close(); };
$('#import-confirm').onclick = async () => {
  if (!pendingImport || pendingImport.session !== session || busy) return;
  const reviewed = pendingImport;
  const saved = await operation(() => repository.importLocal(reviewed.records, reviewed.version), 'Local records imported successfully. The original local copy is still in this browser.');
  if (saved) { pendingImport = null; $('#import-dialog').close(); }
};

let configurationError;
try { backend = createBackend(); }
catch (error) { configurationError = error; }
if (backend) { controls(); backend.onAuth(accountChanged); }
else accountChanged(null);
if (configurationError) $('#auth-error').textContent = showError(configurationError);
