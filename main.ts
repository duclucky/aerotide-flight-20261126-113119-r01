
import { copyFileSync, lstatSync, mkdirSync, readdirSync, writeFileSync, constants } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier, readGameTree } from './vendor/makefun-game.ts';

const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000
};

const source = fileURLToPath(new URL('.', import.meta.url));
const output = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');
const game = readGameTree(join(source, 'game'), CAPS);
const screenshots = join(source, 'screenshots');

function listCaptures() {
  if (!lstatSync(screenshots).isDirectory()) throw new Error('Expected a plain screenshots directory.');
  const names = readdirSync(screenshots).sort();
  if (names.length < 3 || names.length > CAPS.screenshots.max)
    throw new Error('Supply three or four browser captures.');
  for (const name of names) {
    const shot = lstatSync(join(screenshots,name));
    if (!/^[A-Za-z0-9_][A-Za-z0-9._-]{0,122}\.(?:png|jpe?g)$/i.test(name) ||
        name.length > 128 || !shot.isFile() || shot.size > CAPS.screenshots.max_bytes)
      throw new Error('Invalid browser capture: ' + name);
  }
  return names;
}

function copyDeliverables(captures: string[]) {
  mkdirSync(output, { recursive: true });
  if (readdirSync(output).length !== 0) throw new Error('Choose an empty output directory.');
  for (const name of ['game','screenshots']) mkdirSync(join(output,name));
  for (const dir of game.directories) mkdirSync(join(output,'game',dir), {recursive:true});
  for (const {path} of game.files)
    copyFileSync(join(source,'game',path),join(output,'game',path),constants.COPYFILE_EXCL);
  for (const name of captures)
    copyFileSync(join(screenshots,name),join(output,'screenshots',name),constants.COPYFILE_EXCL);
}

copyDeliverables(listCaptures());
const dossier = buildDossier(output, CAPS);
if (dossier.byteLength > 1572864) throw new Error('Dossier exceeds the competition limit.');
writeFileSync(join(output,'dossier.json'),dossier,{flag:'wx'});
