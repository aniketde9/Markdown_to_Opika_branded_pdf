/**
 * Downloads Roboto + JetBrains Mono TTFs into ../fonts (project root).
 * Uses native fetch + PowerShell Expand-Archive on win32, unzip on POSIX.
 */
import { createWriteStream, mkdirSync, existsSync, copyFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { pipeline } from 'stream/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const FONTS = join(ROOT, 'fonts');
const TMP = join(ROOT, '.font-cache');

const ROBOTO_ZIP =
  'https://github.com/googlefonts/roboto/releases/download/v2.138/roboto-unhinted.zip';
const JB_ZIP =
  'https://github.com/JetBrains/JetBrainsMono/releases/download/v2.304/JetBrainsMono-2.304.zip';

mkdirSync(FONTS, { recursive: true });
mkdirSync(TMP, { recursive: true });

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed ${res.status}: ${url}`);
  await pipeline(res.body, createWriteStream(dest));
}

function unzip(zipPath, outDir) {
  if (process.platform === 'win32') {
    execSync(
      `powershell -NoProfile -Command "Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${outDir.replace(/'/g, "''")}' -Force"`,
      { stdio: 'inherit' }
    );
  } else {
    execSync(`unzip -o -q "${zipPath}" -d "${outDir}"`, { stdio: 'inherit' });
  }
}

function findFile(dir, name) {
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    for (const ent of readdirSync(d)) {
      const p = join(d, ent);
      const st = statSync(p);
      if (st.isDirectory()) stack.push(p);
      else if (ent === name) return p;
    }
  }
  return null;
}

const robotoZip = join(TMP, 'roboto.zip');
const jbZip = join(TMP, 'jbmono.zip');

console.log('Downloading Roboto...');
await download(ROBOTO_ZIP, robotoZip);
const robotoOut = join(TMP, 'roboto');
mkdirSync(robotoOut, { recursive: true });
unzip(robotoZip, robotoOut);

for (const f of [
  'Roboto-Regular.ttf',
  'Roboto-Bold.ttf',
  'Roboto-Italic.ttf',
  'Roboto-BoldItalic.ttf',
]) {
  const found = findFile(robotoOut, f);
  if (!found) throw new Error(`Could not find ${f} in Roboto archive`);
  copyFileSync(found, join(FONTS, f));
  console.log('  → fonts/' + f);
}

console.log('Downloading JetBrains Mono...');
await download(JB_ZIP, jbZip);
const jbOut = join(TMP, 'jbmono');
mkdirSync(jbOut, { recursive: true });
unzip(jbZip, jbOut);

const jbBold = findFile(jbOut, 'JetBrainsMono-Bold.ttf');
if (!jbBold) throw new Error('Could not find JetBrainsMono-Bold.ttf in archive');
copyFileSync(jbBold, join(FONTS, 'JetBrainsMono-Bold.ttf'));
console.log('  → fonts/JetBrainsMono-Bold.ttf');

console.log('Done. Fonts are in fonts/');
