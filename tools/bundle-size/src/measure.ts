import { gzipSync } from 'node:zlib';

export const INITIAL_JS_BUDGET_BYTES = 500_000;

/** The parts of Vite's build manifest this tool uses. */
export interface ManifestChunk {
  readonly file: string;
  readonly imports?: readonly string[];
}

export type Manifest = Readonly<Record<string, ManifestChunk>>;

export interface FileSize {
  readonly file: string;
  readonly gzipBytes: number;
}

export interface BundleReport {
  readonly initial: readonly FileSize[];
  readonly lazy: readonly FileSize[];
  readonly initialBytes: number;
  readonly budgetBytes: number;
  readonly isOverBudget: boolean;
}

const TAG_PATTERN = /<(?:script|link)\b[^>]*>/gi;

function readAttribute(tag: string, name: string): string | null {
  const match = new RegExp(`\\s${name}=(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag);
  return match ? (match[1] ?? match[2] ?? match[3] ?? null) : null;
}

function referencedFile(tag: string): string | null {
  if (/^<script/i.test(tag)) return readAttribute(tag, 'src');
  return readAttribute(tag, 'rel')?.toLowerCase() === 'modulepreload'
    ? readAttribute(tag, 'href')
    : null;
}

function toDistPath(reference: string): string {
  // Code loaded from another host would escape the budget without anyone noticing.
  if (/^(?:[a-z]+:)?\/\//i.test(reference)) {
    throw new Error(`Can't measure a script from another host: ${reference}`);
  }
  return reference.replace(/^\.?\/+/, '').replace(/[?#].*$/, '');
}

/** Scripts and module preloads, which are everything the browser fetches as JS at startup. */
export function findHtmlFiles(html: string): string[] {
  const references = (html.match(TAG_PATTERN) ?? []).map(referencedFile);
  return references.filter((reference) => reference !== null).map(toDistPath);
}

/**
 * Follows static imports only. Dynamic imports are left out on purpose: they're how each game
 * and Three.js stay out of the first download.
 */
export function findInitialFiles(html: string, manifest: Manifest): string[] {
  const chunksByFile = new Map(Object.values(manifest).map((chunk) => [chunk.file, chunk]));
  const seen = new Set<string>();

  function visit(file: string): void {
    if (seen.has(file)) return;
    seen.add(file);
    for (const key of chunksByFile.get(file)?.imports ?? []) {
      const chunk = manifest[key];
      if (!chunk) throw new Error(`Manifest has no chunk named ${key}`);
      visit(chunk.file);
    }
  }

  findHtmlFiles(html).forEach(visit);
  // Finding nothing means this tool is broken, and a 0 byte total would pass the budget.
  if (seen.size === 0) throw new Error('Found no scripts in index.html');
  return [...seen].sort();
}

export function measureFile(file: string, read: (file: string) => Uint8Array): FileSize {
  return { file, gzipBytes: gzipSync(read(file), { level: 9 }).length };
}

export function buildReport(
  initial: readonly FileSize[],
  lazy: readonly FileSize[],
  budgetBytes = INITIAL_JS_BUDGET_BYTES,
): BundleReport {
  const initialBytes = initial.reduce((total, { gzipBytes }) => total + gzipBytes, 0);
  return { initial, lazy, initialBytes, budgetBytes, isOverBudget: initialBytes > budgetBytes };
}

function formatKb(bytes: number): string {
  return `${(bytes / 1000).toFixed(1)} KB`;
}

function formatRows(files: readonly FileSize[], label: string): string[] {
  return files.map(({ file, gzipBytes }) => `| ${label} | \`${file}\` | ${formatKb(gzipBytes)} |`);
}

export function formatReport(report: BundleReport): string {
  const { initial, lazy, initialBytes, budgetBytes, isOverBudget } = report;
  const verdict = isOverBudget ? 'Over budget' : 'Within budget';
  return [
    '## Client bundle size',
    '',
    `**Initial JS: ${formatKb(initialBytes)} gzipped of ${formatKb(budgetBytes)}. ${verdict}.**`,
    '',
    '| Loaded | File | Gzipped |',
    '| --- | --- | --- |',
    ...formatRows(initial, 'Initial'),
    ...formatRows(lazy, 'Lazy'),
    '',
  ].join('\n');
}
