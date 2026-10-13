import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, setDoc, getDoc, getDocs, collection, deleteDoc, terminate, setLogLevel } from 'firebase/firestore';
import { createRepository } from '../src/repository.js';
import { cashStatus, validateBackup } from '../src/ledger.js';

const projectId='demo-smartledger-tests';
setLogLevel('silent'); // Expected permission denials are asserted below.
const base={date:'2026-01-01',opening:10000,cash:2000,card:9000,expenses:500,withdrawals:1000,notes:'original'};
let environment;const clients=[];
before(async()=>{
  assert.ok(process.env.FIRESTORE_EMULATOR_HOST,'Run npm run test:emulators. Tests never target cloud services.');
  assert.ok(process.env.FIREBASE_AUTH_EMULATOR_HOST,'Auth emulator must be running.');
  environment=await initializeTestEnvironment({projectId,firestore:{host:'127.0.0.1',port:8180,rules:await readFile('firestore.rules','utf8')}});
  await environment.clearFirestore();
});
after(async()=>{
  for(const {db,app} of clients){await terminate(db);await deleteApp(app);}
  await environment?.cleanup();
});
function client(name){
  const app=initializeApp({projectId,apiKey:'demo-key',authDomain:'demo-smartledger.firebaseapp.com'},name);
  const auth=getAuth(app),db=getFirestore(app);
  connectAuthEmulator(auth,'http://127.0.0.1:9199',{disableWarnings:true});connectFirestoreEmulator(db,'127.0.0.1',8180);
  const result={app,auth,db};clients.push(result);return result;
}
test('security rules validate dates, types, optional count, notes, and ownership',async()=>{
  const alice=environment.authenticatedContext('rules-alice').firestore();
  const bob=environment.authenticatedContext('rules-bob').firestore();
  const anonymous=environment.unauthenticatedContext().firestore();
  const path='users/rules-alice/ledgers/primary/records/2026-01-01';
  await assertSucceeds(setDoc(doc(alice,path),base));
  await assertSucceeds(getDoc(doc(alice,path)));
  for(const outsider of [bob,anonymous]){
    await assertFails(getDoc(doc(outsider,path)));
    await assertFails(getDocs(collection(outsider,'users/rules-alice/ledgers/primary/records')));
    await assertFails(setDoc(doc(outsider,path),base));
    await assertFails(deleteDoc(doc(outsider,path)));
    await assertFails(setDoc(doc(outsider,'users/rules-alice'),{activeLedger:'primary',revision:0}));
  }
  for(const field of ['opening','cash','card','expenses','withdrawals','actual']){
    for(const invalid of [-1,0.5,'0',null,10000000001])await assertFails(setDoc(doc(alice,path),{...base,[field]:invalid}));
    await assertSucceeds(setDoc(doc(alice,path),{...base,[field]:0}));
  }
  for(const invalid of [{...base,notes:'x'.repeat(301)},{...base,notes:42},{...base,unexpected:true},{...base,date:'2026-01-02'}])await assertFails(setDoc(doc(alice,path),invalid));
  const missing={...base};delete missing.cash;await assertFails(setDoc(doc(alice,path),missing));
  for(const date of ['0000-01-01','1900-02-29','2026-02-29','2026-04-31','2026-13-01','2026-00-01','2026-01-00','2026-1-01','bad'])await assertFails(setDoc(doc(alice,`users/rules-alice/ledgers/primary/records/${date}`),{...base,date}));
  for(const date of ['2024-02-29','2000-02-29','2026-04-30'])await assertSucceeds(setDoc(doc(alice,`users/rules-alice/ledgers/primary/records/${date}`),{...base,date}));
  await assertSucceeds(setDoc(doc(alice,path),{...base,actual:0}));
  const older={...base};delete older.notes;await assertSucceeds(setDoc(doc(alice,path),older));
  await assertSucceeds(setDoc(doc(alice,path),{...base,notes:'😀'.repeat(300)}));
  await assertFails(setDoc(doc(alice,path),{...base,notes:'😀'.repeat(301)}));
  await assertSucceeds(setDoc(doc(alice,path),{...base,notes:'line one\nline two'}));
  await assertFails(setDoc(doc(alice,'unprotected/test'),base));
  await assertFails(setDoc(doc(alice,'users/rules-alice'),{activeLedger:'../other',revision:0}));
});
test('real Auth emulator sign-up/sign-in and Firestore persistence isolate two users',async()=>{
  const alice=client('alice-'+Date.now()),bob=client('bob-'+Date.now());
  const email=`alice-${Date.now()}@example.test`,password='test-password-123';
  const a=await createUserWithEmailAndPassword(alice.auth,email,password);
  const b=await createUserWithEmailAndPassword(bob.auth,`bob-${Date.now()}@example.test`,password);
  const repoA=createRepository(alice.db,a.user.uid),repoB=createRepository(bob.db,b.user.uid);
  await repoA.initialize();await repoB.initialize();
  assert.equal((await repoA.load()).records.length,0,'Accounts must not receive demo data');
  await repoA.save({...base,actual:0},null,(await repoA.load()).version);
  assert.equal((await repoB.load()).records.length,0);
  await repoB.save({...base,cash:3000},null,(await repoB.load()).version);
  assert.equal((await repoA.load()).records[0].cash,2000);
  const path=`users/${a.user.uid}/ledgers/primary/records/${base.date}`;
  await assertFails(getDoc(doc(bob.db,path)));
  await assertFails(setDoc(doc(bob.db,path),base));
  await assertFails(deleteDoc(doc(bob.db,path)));
  await signOut(alice.auth);await assertFails(getDoc(doc(alice.db,path)));
  await assert.rejects(signInWithEmailAndPassword(alice.auth,email,'wrong-password'));
  await signInWithEmailAndPassword(alice.auth,email,password);
  assert.equal((await repoA.load()).records[0].actual,0);
  let state=await repoA.load();
  await assert.rejects(repoA.save(base,null,state.version),/record exists/);
  await repoA.save({...base,date:'2026-01-02',actual:10500},base.date,state.version);
  state=await repoA.load();assert.equal(state.records[0].date,'2026-01-02');assert.equal(cashStatus(state.records[0]),'Balanced');
  const stale=state.version;
  await repoA.save({...state.records[0],actual:11000},'2026-01-02',state.version);
  await assert.rejects(repoA.replace([base],stale),/Ledger changed/);
  assert.equal((await repoA.load()).records[0].date,'2026-01-02','Failed restore cannot switch active ledger');
  state=await repoA.load();
  const local=[{...base,date:'2026-01-02',cash:1},{...base,date:'2026-01-03',actual:0}];
  const before=JSON.stringify(local);
  assert.equal(await repoA.importLocal(local,state.version),1);
  state=await repoA.load();assert.equal(state.records.length,2);assert.equal(state.records.find(r=>r.date==='2026-01-02').cash,2000);assert.equal(JSON.stringify(local),before);
  assert.equal(await repoA.importLocal(local,state.version),0,'Retry cannot duplicate dates');
  await assert.rejects(repoA.importLocal(local,stale),/Preview the import again/);
  const many=Array.from({length:401},(_,i)=>({...base,date:new Date(Date.UTC(2024,0,1+i)).toISOString().slice(0,10)}));
  await repoA.replace(many,state.version);state=await repoA.load();assert.equal(state.records.length,401,'Restore spans multiple staging batches');
  const older=validateBackup({version:1,records:[base]});
  await repoA.replace(older,state.version);state=await repoA.load();assert.equal(state.records.length,1);assert.equal(cashStatus(state.records[0]),'Not counted');
  await repoA.remove(base.date,state.version);assert.equal((await repoA.load()).records.length,0);
  assert.equal((await repoB.load()).records.length,1,'Alice restores/deletes never affect Bob');
});
