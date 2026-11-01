import { appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildReport, findInitialFiles, formatReport, measureFile, type Manifest } from './measure';

const distDir = fileURLToPath(new URL('../../../apps/client/dist', import.meta.url));

function readDistFile(file: string): Buffer {
  return readFileSync(join(distDir, file));
}

const html = readDistFile('index.html').toString();
const manifest = JSON.parse(readDistFile('.vite/manifest.json').toString()) as Manifest;

const initialFiles = findInitialFiles(html, manifest);
const lazyFiles = [...new Set(Object.values(manifest).map(({ file }) => file))]
  .filter((file) => file.endsWith('.js') && !initialFiles.includes(file))
  .sort();

const report = buildReport(
  initialFiles.map((file) => measureFile(file, readDistFile)),
  lazyFiles.map((file) => measureFile(file, readDistFile)),
);
const text = formatReport(report);

console.log(text);
const summaryPath = process.env['GITHUB_STEP_SUMMARY'];
if (summaryPath) appendFileSync(summaryPath, `${text}\n`);

if (report.isOverBudget) {
  console.error('Client initial JS is over budget.');
  process.exitCode = 1;
}
