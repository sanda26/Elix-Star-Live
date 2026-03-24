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
  const before = fs.readFileSync(cordovaGradle, 'utf8');
  const crlf = before.includes('\r\n');
  const beforeNl = before.replace(/\r\n/g, '\n');
  let s = beforeNl;

  // Remove flatDir repository block (several Capacitor whitespace variants).
  s = s.replace(
    /repositories\s*\{\s*google\(\)\s*mavenCentral\(\)\s*flatDir\s*\{\s*dirs\s*'src\/main\/libs',\s*'libs'\s*\}\s*\}/s,
    `repositories {
    google()
    mavenCentral()
}`,
  );
  if (/flatDir/.test(s)) {
    s = s.replace(/\s*flatDir\s*\{\s*dirs\s*'src\/main\/libs',\s*'libs'\s*\}/s, '');
  }

  // Prefer fileTree for jars + aars instead of relying on flatDir.
  s = s.replace(
    /implementation fileTree\(dir: 'src\/main\/libs', include: \['\*\.jar'\]\)/,
    "implementation fileTree(dir: 'src/main/libs', include: ['*.jar', '*.aar'])\n    implementation fileTree(dir: 'libs', include: ['*.jar', '*.aar'])",
  );

  if (s !== beforeNl) {
    const out = crlf ? s.replace(/\n/g, '\r\n') : s;
    fs.writeFileSync(cordovaGradle, out, 'utf8');
    console.log('[patch-android-flatdir] Updated capacitor-cordova-android-plugins/build.gradle');
  }

  const check = fs.readFileSync(cordovaGradle, 'utf8');
  if (/flatDir/.test(check)) {
    console.warn(
      '[patch-android-flatdir] Warning: flatDir still present in capacitor-cordova-android-plugins/build.gradle — edit manually or report Capacitor format change.',
    );
  }
}

patchCordovaPluginsGradle();
