/**
 * Capacitor regenerates android/capacitor-cordova-android-plugins/build.gradle with
 * repositories { flatDir { ... } }, which triggers AGP warnings. Replace with fileTree
 * for local jars/aars (same effect for typical Cordova libs without flatDir).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const cordovaGradle = path.join(root, 'android', 'capacitor-cordova-android-plugins', 'build.gradle');

function patchCordovaPluginsGradle() {
  if (!fs.existsSync(cordovaGradle)) {
    return;
  }
  let s = fs.readFileSync(cordovaGradle, 'utf8');
  const before = s;
  // Remove flatDir repository block (keep google + mavenCentral).
  s = s.replace(
    /repositories\s*\{\s*google\(\)\s*mavenCentral\(\)\s*flatDir\s*\{\s*dirs\s*'src\/main\/libs',\s*'libs'\s*\}\s*\}/s,
    `repositories {
    google()
    mavenCentral()
}`,
  );
  // Prefer fileTree for jars + aars instead of relying on flatDir.
  s = s.replace(
    /implementation fileTree\(dir: 'src\/main\/libs', include: \['\*\.jar'\]\)/,
    "implementation fileTree(dir: 'src/main/libs', include: ['*.jar', '*.aar'])\n    implementation fileTree(dir: 'libs', include: ['*.jar', '*.aar'])",
  );
  if (s !== before) {
    fs.writeFileSync(cordovaGradle, s, 'utf8');
    console.log('[patch-android-flatdir] Updated capacitor-cordova-android-plugins/build.gradle');
  }
}

patchCordovaPluginsGradle();
