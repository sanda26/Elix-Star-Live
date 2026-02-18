import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const giftsDir = path.resolve(projectRoot, 'public', 'gifts');
const postersDir = path.resolve(giftsDir, 'posters');

const coreBase = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

function isVideo(file) {
  const ext = path.extname(file).toLowerCase();
  return ext === '.mp4' || ext === '.webm';
}

function outName(file) {
  return `${path.basename(file, path.extname(file))}.webp`;
}

async function main() {
  await ensureDir(postersDir);
  const entries = await fs.readdir(giftsDir);
  const videos = entries.filter(isVideo);

  if (videos.length === 0) {
    console.log('No videos found in', giftsDir);
    return;
  }

  const ffmpeg = new FFmpeg();
  await ffmpeg.load({
    coreURL: await toBlobURL(`${coreBase}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${coreBase}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  for (const file of videos) {
    const inputPath = path.resolve(giftsDir, file);
    const outputPath = path.resolve(postersDir, outName(file));

    try {
      await fs.access(outputPath);
      continue;
    } catch {
    }

    const data = await fs.readFile(inputPath);
    const inName = `in${path.extname(file).toLowerCase()}`;
    const out = 'out.webp';

    await ffmpeg.writeFile(inName, await fetchFile(data));
    await ffmpeg.exec([
      '-ss',
      '0.5',
      '-i',
      inName,
      '-frames:v',
      '1',
      '-vf',
      'scale=512:-1',
      '-vcodec',
      'libwebp',
      '-quality',
      '85',
      out,
    ]);

    const webp = await ffmpeg.readFile(out);
    await fs.writeFile(outputPath, Buffer.from(webp));
    await ffmpeg.deleteFile(inName);
    await ffmpeg.deleteFile(out);

    console.log('Generated', path.relative(projectRoot, outputPath));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

