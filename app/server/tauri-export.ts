/**
 * Tauri Desktop Export Module
 *
 * Generates a ready-to-build Tauri v2 project from an exported game.
 * The output includes:
 *   - Tauri scaffold (Cargo.toml, main.rs, tauri.conf.json)
 *   - Pre-built web assets (player HTML with embedded story data)
 *   - GitHub Actions workflow for cross-platform CI builds
 *   - README with build instructions
 *
 * The generated project can be pushed to GitHub for automated builds,
 * or built locally with `cargo tauri build` if Rust is installed.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { Story } from '../../src/types/index.js';
import { exportGame, isPlayerBuilt } from './export.js';

export interface DesktopExportOptions {
  /** The complete story data to embed */
  story: Story;
  /** Output directory for the Tauri project */
  outputDir: string;
}

/**
 * Export a game as a Tauri v2 desktop project.
 *
 * Produces a complete, buildable project directory that includes
 * the web player assets and all Tauri scaffolding.
 */
export async function exportGameDesktop(options: DesktopExportOptions): Promise<void> {
  const { story, outputDir } = options;

  if (!isPlayerBuilt()) {
    throw new Error(
      'Player bundle not found. Run "npx vite build --config vite.player.config.ts" first.'
    );
  }

  const title = story.manifest.title || 'Untitled Game';
  const appName = toKebabCase(title);
  const identifier = `com.michelangelo.${appName.replace(/-/g, '')}`;

  // Create directory structure
  const dirs = [
    outputDir,
    path.join(outputDir, 'src-tauri', 'src'),
    path.join(outputDir, 'src-tauri', 'capabilities'),
    path.join(outputDir, 'src-tauri', 'icons'),
    path.join(outputDir, 'web'),
    path.join(outputDir, '.github', 'workflows'),
  ];
  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Generate web assets using existing export
  const webDir = path.join(outputDir, 'web');
  await exportGame({ story, outputDir: webDir });

  // Write all Tauri scaffold files
  writeFile(outputDir, 'src-tauri/Cargo.toml', generateCargoToml(appName));
  writeFile(outputDir, 'src-tauri/build.rs', generateBuildRs());
  writeFile(outputDir, 'src-tauri/src/main.rs', generateMainRs(appName));
  writeFile(outputDir, 'src-tauri/src/lib.rs', generateLibRs());
  writeFile(outputDir, 'src-tauri/tauri.conf.json', generateTauriConf(title, appName, identifier));
  writeFile(outputDir, 'src-tauri/capabilities/default.json', generateCapabilities());
  writeFile(outputDir, 'package.json', generatePackageJson(appName));
  writeFile(outputDir, '.github/workflows/build.yml', generateGitHubWorkflow(appName));
  writeFile(outputDir, 'README.md', generateReadme(title));

  // Generate a minimal placeholder icon (1x1 PNG)
  generatePlaceholderIcon(path.join(outputDir, 'src-tauri', 'icons'));
}

// =============================================================================
// Helpers
// =============================================================================

function writeFile(baseDir: string, relativePath: string, content: string): void {
  const fullPath = path.join(baseDir, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf-8');
}

function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    || 'game';
}

/**
 * Write a minimal valid PNG as a placeholder app icon.
 * Users should replace this with their own icon.
 */
function generatePlaceholderIcon(iconsDir: string): void {
  // Minimal 1x1 white PNG (68 bytes)
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
    'base64'
  );
  fs.writeFileSync(path.join(iconsDir, 'icon.png'), png);

  // Tauri also expects a 32x32 and 128x128 but will generate them from icon.png
  // during `cargo tauri build` via the `cargo tauri icon` command.
  // The README instructs users to run this.
}

// =============================================================================
// Template generators
// =============================================================================

function generateCargoToml(appName: string): string {
  return `[package]
name = "${appName}"
version = "0.1.0"
edition = "2021"

[lib]
name = "${appName.replace(/-/g, '_')}_lib"
crate-type = ["lib", "cdylib", "staticlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
`;
}

function generateBuildRs(): string {
  return `fn main() {
    tauri_build::build();
}
`;
}

function generateMainRs(appName: string): string {
  const libName = appName.replace(/-/g, '_') + '_lib';
  return `// Prevents an additional console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    ${libName}::run();
}
`;
}

function generateLibRs(): string {
  return `pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
`;
}

function generateTauriConf(title: string, appName: string, identifier: string): string {
  const conf = {
    $schema: 'https://raw.githubusercontent.com/tauri-apps/tauri/dev/crates/tauri-config-schema/schema.json',
    productName: title,
    version: '0.1.0',
    identifier,
    build: {
      frontendDist: '../web',
    },
    app: {
      title,
      windows: [
        {
          title,
          width: 1024,
          height: 768,
          resizable: true,
          fullscreen: false,
        },
      ],
      security: {
        csp: null,
      },
    },
    bundle: {
      active: true,
      targets: 'all',
      icon: [
        'icons/icon.png',
      ],
    },
  };
  return JSON.stringify(conf, null, 2) + '\n';
}

function generateCapabilities(): string {
  const capabilities = {
    $schema: 'https://raw.githubusercontent.com/tauri-apps/tauri/dev/crates/tauri-utils/schema.json',
    identifier: 'default',
    description: 'Default capabilities for the game window',
    windows: ['main'],
    permissions: [
      'core:default',
    ],
  };
  return JSON.stringify(capabilities, null, 2) + '\n';
}

function generatePackageJson(appName: string): string {
  const pkg = {
    name: appName,
    version: '0.1.0',
    private: true,
    scripts: {
      'tauri': 'tauri',
      'tauri:dev': 'tauri dev',
      'tauri:build': 'tauri build',
      'tauri:icon': 'tauri icon src-tauri/icons/icon.png',
    },
    devDependencies: {
      '@tauri-apps/cli': '^2',
    },
  };
  return JSON.stringify(pkg, null, 2) + '\n';
}

function generateGitHubWorkflow(appName: string): string {
  return `name: Build Desktop App

on:
  push:
    branches: [main]
    tags: ['v*']
  pull_request:
    branches: [main]
  workflow_dispatch:

jobs:
  build:
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: ubuntu-latest
            rust_target: x86_64-unknown-linux-gnu
          - platform: windows-latest
            rust_target: x86_64-pc-windows-msvc
          - platform: macos-latest
            rust_target: aarch64-apple-darwin

    runs-on: \${{ matrix.platform }}

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Install Rust stable
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: \${{ matrix.rust_target }}

      - name: Install dependencies (Linux)
        if: matrix.platform == 'ubuntu-latest'
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf

      - name: Install npm dependencies
        run: npm install

      - name: Build with Tauri
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        with:
          tagName: v__VERSION__
          releaseName: '${appName} v__VERSION__'
          releaseBody: 'See the assets below to download the installer for your platform.'
          releaseDraft: true
          prerelease: false

      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: ${appName}-\${{ matrix.platform }}
          path: src-tauri/target/release/bundle/*
`;
}

function generateReadme(title: string): string {
  return `# ${title}

A desktop game built with [Michelangelo](https://github.com/michelangelo) and [Tauri](https://tauri.app).

## Quick Start (GitHub Actions)

The easiest way to build for all platforms:

1. Push this folder to a GitHub repository
2. GitHub Actions will automatically build for Linux, macOS, and Windows
3. Download the installers from the Actions artifacts or GitHub Releases

## Local Development

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://rustup.rs/) (latest stable)
- Platform-specific dependencies:
  - **Linux:** \`sudo apt install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf\`
  - **macOS:** Xcode Command Line Tools (\`xcode-select --install\`)
  - **Windows:** [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with C++ workload

### Build

\`\`\`bash
# Install dependencies
npm install

# Generate app icons from your icon.png (replace the placeholder first)
npx tauri icon src-tauri/icons/icon.png

# Development mode (hot reload)
npx tauri dev

# Production build
npx tauri build
\`\`\`

The built installer will be in \`src-tauri/target/release/bundle/\`.

## Customization

- **Window size:** Edit \`src-tauri/tauri.conf.json\` → \`app.windows\`
- **App icon:** Replace \`src-tauri/icons/icon.png\` and run \`npx tauri icon\`
- **App name:** Edit \`src-tauri/tauri.conf.json\` → \`productName\`
`;
}

