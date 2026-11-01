import { describe, expect, it } from 'vitest';
import {
  INITIAL_JS_BUDGET_BYTES,
  buildReport,
  findHtmlFiles,
  findInitialFiles,
  formatReport,
  measureFile,
  type Manifest,
} from './measure';

const html = `<!doctype html>
<html>
  <head>
    <script type="module" crossorigin src="/assets/index-a.js"></script>
    <link rel="modulepreload" crossorigin href="/assets/vendor-b.js">
    <link rel="stylesheet" crossorigin href="/assets/index-c.css">
  </head>
  <body><div id="app"></div></body>
</html>`;

const manifest: Manifest = {
  'index.html': { file: 'assets/index-a.js', imports: ['_vendor.js'] },
  '_vendor.js': { file: 'assets/vendor-b.js', imports: ['_shared.js'] },
  '_shared.js': { file: 'assets/shared-d.js' },
  'src/three.ts': { file: 'assets/three-e.js', imports: ['_shared.js'] },
};

describe('findHtmlFiles', () => {
  it('finds scripts and module preloads but not stylesheets', () => {
    expect(findHtmlFiles(html)).toEqual(['assets/index-a.js', 'assets/vendor-b.js']);
  });

  it('handles relative paths, single quotes and query strings', () => {
    expect(findHtmlFiles(`<script src='./assets/a.js?v=1'></script>`)).toEqual(['assets/a.js']);
  });

  it('ignores lookalike attributes', () => {
    expect(findHtmlFiles('<script data-src="/assets/a.js"></script>')).toEqual([]);
  });

  it('refuses scripts from another host, which the budget could not see', () => {
    expect(() => findHtmlFiles('<script src="https://cdn.example/a.js"></script>')).toThrow(
      'another host',
    );
    expect(() => findHtmlFiles('<script src="//cdn.example/a.js"></script>')).toThrow(
      'another host',
    );
  });
});

describe('findInitialFiles', () => {
  it('follows static imports the HTML does not mention', () => {
    expect(findInitialFiles(html, manifest)).toContain('assets/shared-d.js');
  });

  it('leaves out lazy chunks', () => {
    expect(findInitialFiles(html, manifest)).not.toContain('assets/three-e.js');
  });

  it('copes with circular imports', () => {
    const circular: Manifest = {
      a: { file: 'a.js', imports: ['b'] },
      b: { file: 'b.js', imports: ['a'] },
    };
    expect(findInitialFiles('<script src="/a.js"></script>', circular)).toEqual(['a.js', 'b.js']);
  });

  it('fails rather than reporting 0 bytes when it finds no scripts', () => {
    expect(() => findInitialFiles('<html></html>', manifest)).toThrow('no scripts');
  });

  it('fails on a manifest that points at a missing chunk', () => {
    const broken: Manifest = { 'index.html': { file: 'a.js', imports: ['_gone.js'] } };
    expect(() => findInitialFiles('<script src="/a.js"></script>', broken)).toThrow('_gone.js');
  });
});

describe('measureFile', () => {
  it('reports the gzipped size, not the raw size', () => {
    const size = measureFile('a.js', () => new Uint8Array(100_000));
    expect(size.file).toBe('a.js');
    expect(size.gzipBytes).toBeGreaterThan(0);
    expect(size.gzipBytes).toBeLessThan(1_000);
  });
});

describe('buildReport', () => {
  const sized = (gzipBytes: number) => ({ file: 'a.js', gzipBytes });

  it('adds up every initial file', () => {
    const report = buildReport([sized(200), sized(300)], []);
    expect(report.initialBytes).toBe(500);
  });

  it('allows exactly the budget', () => {
    expect(buildReport([sized(INITIAL_JS_BUDGET_BYTES)], []).isOverBudget).toBe(false);
  });

  it('fails one byte over the budget', () => {
    expect(buildReport([sized(INITIAL_JS_BUDGET_BYTES + 1)], []).isOverBudget).toBe(true);
  });

  it("doesn't count lazy chunks against the budget", () => {
    const report = buildReport([sized(100)], [sized(INITIAL_JS_BUDGET_BYTES * 2)]);
    expect(report.initialBytes).toBe(100);
    expect(report.isOverBudget).toBe(false);
  });
});

describe('formatReport', () => {
  it('shows the total, the budget, the verdict and every file', () => {
    const text = formatReport(
      buildReport([{ file: 'a.js', gzipBytes: 1500 }], [{ file: 'b.js', gzipBytes: 2500 }], 1000),
    );
    expect(text).toContain('Initial JS: 1.5 KB gzipped of 1.0 KB. Over budget.');
    expect(text).toContain('| Initial | `a.js` | 1.5 KB |');
    expect(text).toContain('| Lazy | `b.js` | 2.5 KB |');
  });
});
