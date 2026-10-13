import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./tests/browser',
  workers:1,
  timeout:45000,
  expect:{timeout:15000},
  use:{baseURL:'http://127.0.0.1:5174',headless:true,channel:'chrome'},
  webServer:{command:'npm run dev:emulator -- --port 5174',url:'http://127.0.0.1:5174',reuseExistingServer:false,timeout:30000,env:{VITE_FIREBASE_PROJECT_ID:'demo-smartledger-tests',VITE_FIREBASE_AUTH_EMULATOR_PORT:'9199',VITE_FIREBASE_FIRESTORE_EMULATOR_PORT:'8180'}},
});
