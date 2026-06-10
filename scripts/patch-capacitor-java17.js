const fs = require('fs');
const path = require('path');

const replacements = [
  'node_modules/@capacitor/android/capacitor/build.gradle',
  'node_modules/@capacitor/app/android/build.gradle',
  'node_modules/@capacitor/status-bar/android/build.gradle',
  'node_modules/@capacitor/cli/dist/android/update.js',
];

let changed = false;
for (const rel of replacements) {
  const file = path.join(process.cwd(), rel);
  if (!fs.existsSync(file)) {
    console.warn(`[patch-capacitor-java17] skip missing ${rel}`);
    continue;
  }
  const original = fs.readFileSync(file, 'utf8');
  const patched = original.replace(/JavaVersion\.VERSION_21/g, 'JavaVersion.VERSION_17');
  if (patched !== original) {
    fs.writeFileSync(file, patched, 'utf8');
    console.log(`[patch-capacitor-java17] patched ${rel}`);
    changed = true;
  } else {
    console.log(`[patch-capacitor-java17] already ok ${rel}`);
  }
}

if (changed) {
  console.log('[patch-capacitor-java17] done');
} else {
  console.log('[patch-capacitor-java17] no changes needed');
}
