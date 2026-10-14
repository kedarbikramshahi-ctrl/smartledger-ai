import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, initializeAuth, inMemoryPersistence, connectAuthEmulator, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { createRepository } from './repository.js';

export function createBackend(env = import.meta.env, hostname = location.hostname) {
  const emulator = env.VITE_USE_FIREBASE_EMULATORS === 'true';
  if (emulator && !['localhost', '127.0.0.1', '[::1]'].includes(hostname)) throw Error('Emulators may only be used from localhost.');
  if (emulator && !env.VITE_FIREBASE_PROJECT_ID?.startsWith('demo-')) throw Error('Emulator mode requires a demo- project ID.');
  const fields = { apiKey: env.VITE_FIREBASE_API_KEY, authDomain: env.VITE_FIREBASE_AUTH_DOMAIN, projectId: env.VITE_FIREBASE_PROJECT_ID, appId: env.VITE_FIREBASE_APP_ID };
  if (Object.values(fields).some(value => !value)) return null;
  const app = initializeApp(fields);
  const auth = getAuth(app), db = getFirestore(app);
  if (emulator) {
    connectAuthEmulator(auth, 'http://127.0.0.1:' + (env.VITE_FIREBASE_AUTH_EMULATOR_PORT || '9099'), { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', Number(env.VITE_FIREBASE_FIRESTORE_EMULATOR_PORT || 8080));
  }
  return {
    emulator,
    onAuth: listener => onAuthStateChanged(auth, listener),
    async signUp(email, password) {
      // Firebase signs a new user in automatically. Use a temporary memory-only
      // Auth instance so registration does not enter the main app's ledger.
      const registration = initializeApp(fields, 'registration-' + crypto.randomUUID());
      const registrationAuth = initializeAuth(registration, { persistence: inMemoryPersistence });
      try {
        if (emulator) connectAuthEmulator(registrationAuth, 'http://127.0.0.1:' + (env.VITE_FIREBASE_AUTH_EMULATOR_PORT || '9099'), { disableWarnings: true });
        await createUserWithEmailAndPassword(registrationAuth, email, password);
      } finally { await deleteApp(registration); }
    },
    signIn: (email, password) => signInWithEmailAndPassword(auth, email, password),
    signInGoogle: () => {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      return signInWithPopup(auth, provider);
    },
    signOut: () => signOut(auth),
    async generateSummary(range,signal){
      if(!auth.currentUser)throw Error('Sign in to generate a summary.');
      const token=await auth.currentUser.getIdToken();
      const response=await fetch('/api/summary',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(range),signal});
      let result;try{result=await response.json();}catch{throw Error('Summary endpoint is unavailable. Start the app with its API server.');}
      if(!response.ok)throw Error(result.error||'AI summary generation failed.');return result;
    },
    repository: uid => createRepository(db, uid),
  };
}
