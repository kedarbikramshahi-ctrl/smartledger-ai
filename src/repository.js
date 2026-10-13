import { collection, doc, getDocFromServer, getDocsFromServer, onSnapshot, runTransaction, writeBatch } from 'firebase/firestore';
import { validateRecord, validateBackup, importPlan } from './ledger.js';

// A revision detects writes from other tabs while an import/restore is staged.
// Only the final profile transaction switches the visible ledger generation.
export function createRepository(db, uid) {
  const profile = doc(db, 'users', uid);
  const recordsAt = generation => collection(db, 'users', uid, 'ledgers', generation, 'records');
  const recordAt = (generation, date) => doc(recordsAt(generation), date);
  const same = (a, b) => a.activeLedger === b.activeLedger && a.revision === b.revision;
  function requireVersion(snapshot, expected) {
    if (!snapshot.exists() || !same(snapshot.data(), expected)) throw Error('Ledger changed in another session. Reload and review before trying again.');
  }
  return {
    async initialize() {
      await runTransaction(db, async tx => {
        const snapshot = await tx.get(profile);
        if (!snapshot.exists()) tx.set(profile, { activeLedger: 'primary', revision: 0 });
      });
    },
    watch(onRecords, onError) {
      let stopRecords = () => {}, generation = null, currentVersion = null, currentRecords = null;
      const stopProfile = onSnapshot(profile, { includeMetadataChanges: true }, snapshot => {
        if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;
        if (!snapshot.exists()) return onError(Error('Account ledger is unavailable.'));
        currentVersion = snapshot.data();
        if (generation !== currentVersion.activeLedger) {
          stopRecords(); generation = currentVersion.activeLedger; currentRecords = null;
          stopRecords = onSnapshot(recordsAt(generation), { includeMetadataChanges: true }, rows => {
            if (rows.metadata.fromCache || rows.metadata.hasPendingWrites) return;
            try { currentRecords = rows.docs.map(row => validateRecord(row.data())); onRecords(currentRecords, currentVersion); }
            catch (error) { onError(error); }
          }, onError);
        } else if (currentRecords) onRecords(currentRecords, currentVersion);
      }, onError);
      return () => { stopProfile(); stopRecords(); };
    },
    async load() {
      const snapshot = await getDocFromServer(profile);
      if (!snapshot.exists()) throw Error('Account ledger is unavailable.');
      const version = snapshot.data();
      const rows = await getDocsFromServer(recordsAt(version.activeLedger));
      return { version, records: rows.docs.map(row => validateRecord(row.data())) };
    },
    async save(record, editing, expected) {
      const clean = validateRecord(record);
      await runTransaction(db, async tx => {
        const snapshot = await tx.get(profile); requireVersion(snapshot, expected);
        const target = recordAt(expected.activeLedger, clean.date);
        const targetSnapshot = await tx.get(target);
        let oldSnapshot;
        if (editing && editing !== clean.date) oldSnapshot = await tx.get(recordAt(expected.activeLedger, editing));
        if (clean.date !== editing && targetSnapshot.exists()) throw Error('A record exists for this date. Edit that record instead.');
        if (editing && (editing === clean.date ? !targetSnapshot.exists() : !oldSnapshot.exists())) throw Error('The record being edited no longer exists.');
        tx.set(target, clean);
        if (editing && editing !== clean.date) tx.delete(recordAt(expected.activeLedger, editing));
        tx.update(profile, { revision: expected.revision + 1 });
      });
    },
    async remove(date, expected) {
      await runTransaction(db, async tx => {
        const snapshot = await tx.get(profile); requireVersion(snapshot, expected);
        tx.delete(recordAt(expected.activeLedger, date));
        tx.update(profile, { revision: expected.revision + 1 });
      });
    },
    async replace(records, expected) {
      const clean = validateBackup({ version: 1, records });
      const generation = doc(collection(db, 'users', uid, 'ledgers')).id;
      // Failed uploads leave an inactive generation; the old active ledger stays intact.
      for (let offset = 0; offset < clean.length; offset += 400) {
        const batch = writeBatch(db);
        for (const record of clean.slice(offset, offset + 400)) batch.set(recordAt(generation, record.date), record);
        await batch.commit();
      }
      await runTransaction(db, async tx => {
        const snapshot = await tx.get(profile); requireVersion(snapshot, expected);
        tx.set(profile, { activeLedger: generation, revision: expected.revision + 1 });
      });
    },
    async importLocal(local, reviewedVersion) {
      const current = await this.load();
      if (!same(current.version, reviewedVersion)) throw Error('Ledger changed. Preview the import again.');
      const plan = importPlan(local, current.records);
      if (!plan.eligible.length) return 0;
      await this.replace([...current.records, ...plan.eligible], current.version);
      return plan.eligible.length;
    },
  };
}
