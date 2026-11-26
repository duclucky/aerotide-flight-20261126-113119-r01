
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
const screenshots = join(source, 'screenshots');

function parseDeliveryArgs(args: string[]) {
  let outputDir: string | undefined;
  let help = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help') help = true;
    else if (arg === '--output-dir' && outputDir === undefined) {
      const path = args[++i];
      if (!path?.trim() || path.startsWith('-')) throw new Error('--output-dir requires a path argument.');
      outputDir = path;
    } else throw new Error('Unknown or repeated argument: ' + arg);
  }
  return { help, outputDir };
}

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

function copyDeliverables(output: string, captures: string[]) {
  const game = readGameTree(join(source, 'game'), CAPS);
  mkdirSync(output, { recursive: true });
  if (readdirSync(output).length !== 0) throw new Error('Choose an empty output directory.');
  for (const name of ['game','screenshots']) mkdirSync(join(output,name));
  for (const dir of game.directories) mkdirSync(join(output,'game',dir), {recursive:true});
  for (const {path} of game.files)
    copyFileSync(join(source,'game',path),join(output,'game',path),constants.COPYFILE_EXCL);
  for (const name of captures)
    copyFileSync(join(screenshots,name),join(output,'screenshots',name),constants.COPYFILE_EXCL);
}

function deliver(args: string[]) {
  const { help, outputDir } = parseDeliveryArgs(args);
  if (help) {
    console.log('Usage: node main.ts [--output-dir <path>] [--help]\nCopies the game and captures and writes dossier.json to a fresh empty directory.\nDefaults to MAKEFUN_OUTPUT_DIR, or /output if unset.');
    return;
  }
  const output = resolve(outputDir ?? (process.env.MAKEFUN_OUTPUT_DIR || '/output'));
  copyDeliverables(output, listCaptures());
  const dossier = buildDossier(output, CAPS);
  if (dossier.byteLength > 1572864) throw new Error('Dossier exceeds the competition limit.');
  writeFileSync(join(output,'dossier.json'),dossier,{flag:'wx'});
}

try {
  deliver(process.argv.slice(2));
} catch (error) {
  console.error('Aerotide delivery: ' + (error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
}
