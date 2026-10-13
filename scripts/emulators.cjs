const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const env = { ...process.env, FIREBASE_EMULATORS_PATH: path.join(root, '.tools', 'emulators') };
// The Firebase CLI prints the full child environment in DEBUG mode.
// Do not inherit unrelated shell debugging settings into this launcher.
delete env.DEBUG;
const portable = path.join(root, '.tools', 'java');
if (fs.existsSync(portable)) {
  const jdk = fs.readdirSync(portable).find(name => fs.existsSync(path.join(portable, name, 'bin', 'java.exe')));
  if (jdk) {
    env.JAVA_HOME = path.join(portable, jdk);
    env.PATH = path.join(env.JAVA_HOME, 'bin') + path.delimiter + env.PATH;
  }
}
const mode = process.argv[2];
const args = ['emulators:' + (mode === 'exec' ? 'exec' : 'start'), '--project', mode === 'exec' ? 'demo-smartledger-tests' : 'demo-smartledger', '--only', 'auth,firestore'];
if (mode === 'exec') args.push('--config', 'firebase.test.json');
if (mode === 'exec') args.push('npm run test:integration');
else if (fs.existsSync(path.join(root, '.emulator-data'))) args.push('--import=.emulator-data', '--export-on-exit=.emulator-data');
else args.push('--export-on-exit=.emulator-data');
const result = spawnSync(process.execPath, [path.join(root, 'node_modules/firebase-tools/lib/bin/firebase.js'), ...args], { cwd: root, env, stdio: 'inherit' });
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
