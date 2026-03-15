/**
 * CLI Game Export Module
 *
 * Produces a self-contained Node.js script that plays an interactive
 * fiction game in the terminal using Ink (React for CLIs).
 *
 * The process:
 * 1. Write a thin entry file that sets __STORY_DATA__ then imports the template
 * 2. Use esbuild to bundle everything (engine, Ink, React) into one .js file
 * 3. Prepend a shebang so the file can be run directly
 */

import fs from 'node:fs';
import path from 'node:path';
import { build, type Plugin } from 'esbuild';
import type { Story } from '../../src/types/index.js';

const TEMPLATE_PATH = path.resolve(import.meta.dirname, 'cli-template.tsx');

/**
 * esbuild plugin that:
 * 1. Provides story data as a virtual module (game:story-data)
 * 2. Stubs out optional dev-only imports (react-devtools-core)
 */
function cliExportPlugin(storyJson: string): Plugin {
  return {
    name: 'cli-export',
    setup(b) {
      // Virtual module: the template imports story data from "game:story-data"
      b.onResolve({ filter: /^game:story-data$/ }, () => ({
        path: 'game:story-data',
        namespace: 'virtual',
      }));
      b.onLoad({ filter: /^game:story-data$/, namespace: 'virtual' }, () => ({
        contents: `export default ${storyJson};`,
        loader: 'js',
      }));

      // Ink optionally imports react-devtools-core at runtime.
      // Replace it with an empty module so the bundle doesn't need it installed.
      b.onResolve({ filter: /^react-devtools-core$/ }, () => ({
        path: 'react-devtools-core',
        namespace: 'stub',
      }));
      b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
        contents: 'export default undefined;',
        loader: 'js',
      }));
    },
  };
}

export interface ExportCliOptions {
  /** The complete story data to embed */
  story: Story;
  /** Output file path (e.g. /path/to/my-game.js) */
  outputPath: string;
}

/**
 * Export a game as a single-file Node.js CLI player.
 */
export async function exportGameCli(options: ExportCliOptions): Promise<void> {
  const { story, outputPath } = options;

  // The template imports story data from a virtual module "game:story-data".
  // We use an esbuild plugin to resolve this to the actual JSON at bundle time.
  const tmpDir = path.join(path.dirname(outputPath), '.cli-export-tmp');
  fs.mkdirSync(tmpDir, { recursive: true });

  const storyJson = JSON.stringify(story);
  const entryPath = path.join(tmpDir, 'entry.tsx');
  fs.writeFileSync(
    entryPath,
    `import ${JSON.stringify(TEMPLATE_PATH)};\n`,
    'utf-8'
  );

  try {
    // Bundle everything into a single file
    await build({
      entryPoints: [entryPath],
      bundle: true,
      platform: 'node',
      target: 'node18',
      format: 'esm',
      outfile: outputPath,
      plugins: [cliExportPlugin(storyJson)],
      minify: false,
      banner: {
        js: '#!/usr/bin/env node',
      },
      // Silence warnings about dynamic require in ink internals
      logLevel: 'error',
      // Handle JSX
      jsx: 'automatic',
      // Resolve from the project root so engine imports work
      tsconfig: path.resolve(import.meta.dirname, '../../tsconfig.json'),
    });

    // Post-process: fix esbuild's broken CJS-in-ESM require shim.
    // When esbuild bundles CJS modules (signal-exit, etc.) into ESM output,
    // it generates a __require shim that throws "Dynamic require is not supported".
    // Replace it with a real require() via createRequire.
    let output = fs.readFileSync(outputPath, 'utf-8');
    if (output.includes('Dynamic require of "')) {
      // Add createRequire import after the shebang line
      output = output.replace(
        '#!/usr/bin/env node\n',
        '#!/usr/bin/env node\nimport { createRequire as __bundled_createRequire } from "node:module";\nvar __require = __bundled_createRequire(import.meta.url);\n'
      );
      // Remove esbuild's broken __require shim (it looks like this):
      //   var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : ...)(...);
      output = output.replace(
        /var __require = \/\* @__PURE__ \*\/ \(\(x\) =>[\s\S]*?(?=var __)/m,
        ''
      );
      fs.writeFileSync(outputPath, output, 'utf-8');
    }

    // Make the file executable
    fs.chmodSync(outputPath, 0o755);
  } finally {
    // Clean up temp files
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
