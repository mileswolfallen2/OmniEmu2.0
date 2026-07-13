# OmniEmu 2.0 — Project Specification

> All your games. One place.

OmniEmu is a cross-platform desktop application for managing emulators, launching games, and organizing ROM libraries. Built with Electron, React, and TypeScript.

**Repository:** [github.com/mileswolfallen2/OmniEmu2.0](https://github.com/mileswolfallen2/OmniEmu2.0)
**Version:** 0.2.0
**License:** MIT (Copyright 2026 mileswa1q22)

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Licenses](#licenses)
3. [Architecture](#architecture)
4. [Supported Emulators](#supported-emulators)
5. [Supported Frontends](#supported-frontends)
6. [Supported Systems](#supported-systems)
7. [ROM Format Support](#rom-format-support)
8. [Configuration Presets](#configuration-presets)
9. [IPC API Reference](#ipc-api-reference)
10. [File Structure](#file-structure)
11. [Build & Development](#build--development)
12. [Release Artifacts](#release-artifacts)
13. [Security](#security)
14. [Contributing](#contributing)

---

## Tech Stack

| Technology | Version | Purpose | License |
|---|---|---|---|
| Electron | 43.1.0 | Desktop app shell | MIT |
| React | 19.2.7 | UI framework | MIT |
| React DOM | 19.2.7 | DOM rendering | MIT |
| TypeScript | 5.9.3 | Type-safe language | Apache-2.0 |
| Vite | 6.4.3 | Renderer bundler | MIT |
| electron-builder | 25.1.8 | Packaging & distribution | MIT |
| electron-updater | 6.8.9 | Auto-update support | MIT |
| @vitejs/plugin-react | 4.7.0 | React Fast Refresh for Vite | MIT |
| concurrently | 9.2.3 | Parallel dev scripts | MIT |
| 7zip-bin | 5.2.0 | Archive extraction (7z) | MIT |

All dependencies are MIT-licensed except TypeScript (Apache-2.0).

---

## Licenses

### OmniEmu

```
MIT License

Copyright (c) 2026 mileswa1q22

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### Third-Party Licenses

| Component | License | SPDX |
|---|---|---|
| Electron | MIT | MIT |
| React | MIT | MIT |
| React DOM | MIT | MIT |
| TypeScript | Apache-2.0 | Apache-2.0 |
| Vite | MIT | MIT |
| electron-builder | MIT | MIT |
| electron-updater | MIT | MIT |
| @vitejs/plugin-react | MIT | MIT |
| concurrently | MIT | MIT |
| 7zip-bin | MIT | MIT |

### External Software (Not Bundled)

OmniEmu can install and configure the following third-party software. Each has its own license:

| Software | License | Website |
|---|---|---|
| RetroArch | GPLv3 | https://retroarch.com |
| Dolphin | GPLv2+ | https://dolphin-emu.org |
| RPCS3 | GPLv2 | https://rpcs3.net |
| Eden | GPLv3 | https://eden-emu.dev |
| PCSX2 | GPLv2+ | https://pcsx2.net |
| MAME | GPLv2+ | https://mamedev.org |
| DuckStation | GPLv3 | https://github.com/stenzek/duckstation |
| PPSSPP | GPLv2+ | https://ppsspp.org |
| melonDS | GPLv2 | https://melonds.kuribo64.net |
| Flycast | GPLv2 | https://github.com/flyinghead/flycast |
| ES-DE | GPLv3 | https://es-de.org |
| NeoStation | MIT | https://neostation.dev |
| Pegasus Frontend | MIT | https://pegasus-frontend.org |
| EmuBuddy | Unknown | https://github.com/computerex/EmuBuddy |

---

## Architecture

OmniEmu uses a standard Electron two-process architecture:

```
+------------------+     IPC (ipcMain/ipcRenderer)     +------------------+
|                  | <---------------------------------> |                  |
|   Main Process   |                                     | Renderer Process |
|   (Node.js)      |                                     | (Chromium)       |
|                  |                                     |                  |
| - Emulator mgmt  |                                     | - React UI       |
| - ROM scanning   |                                     | - Pages          |
| - Installation   |                                     | - Components     |
| - Config writing |                                     | - Gamepad nav    |
| - Auto-updater   |                                     | - Modals         |
| - Settings       |                                     |                  |
| - RetroAchieve.  |                                     |                  |
| - BIOS checks    |                                     |                  |
+------------------+                                     +------------------+
         |                                                          |
         v                                                          v
   File system                                              window.omni API
   (settings, configs,                                        (contextBridge)
    ROMs, cache, emulators)
```

### Main Process (`src/main/`)

| File | Purpose |
|---|---|
| `index.ts` | App entry point. Creates window (1200x800, min 900x600), system tray, single-instance lock, startup tasks |
| `emulators.ts` | Core emulator registry. 14 emulators with download URLs, detection, version checking, ROM scanning, game launching |
| `configurator.ts` | Configuration engine. Presets, config file writing, ES-DE XML generation, NeoStation JSON generation, Pegasus collection generation, controller bindings, RetroAchievements setup |
| `ipc.ts` | IPC handler registry. 35+ channels exposed to the renderer |
| `preload.ts` | Context bridge. Exposes `window.omni` API with typed wrappers |
| `platform.ts` | Platform detection (`win32`/`darwin`/`linux`, `x64`/`arm64`) |
| `settings.ts` | Settings persistence (`settings.json` in userData) |
| `installer.ts` | Download, extract, and install emulators (zip, 7z, tar.gz, DMG, NSIS, AppImage, Homebrew, snap) |
| `scraper.ts` | Cover art (libretro-thumbnails) and metadata (MobyGames) scraping with local cache |
| `updater.ts` | Auto-update via electron-updater |
| `bios.ts` | BIOS file detection and management |
| `ra.ts` | RetroAchievements integration (game lookup, achievement data) |

### Renderer Process (`src/renderer/`)

| File | Purpose |
|---|---|
| `App.tsx` | Root component. Page routing, theme application, gamepad nav |
| `main.tsx` | React entry point |
| `index.html` | HTML shell with CSP |
| `styles.css` | Complete CSS design system (dark/light themes) |
| `types.ts` | `window.omni` type declarations |

### Pages

| Page | Purpose |
|---|---|
| `Dashboard.tsx` | System info, emulator overview, recent games, quick actions |
| `EmulatorsPage.tsx` | Emulator cards with install/configure/launch/uninstall actions |
| `LibraryPage.tsx` | ROM library grid with cover art, auto-scan |
| `ControllerPage.tsx` | Gamepad detection, button states, controller config |
| `SettingsPage.tsx` | Directories, BIOS, emulator assignments, appearance, beta features, updates, about |
| `UtilitiesPage.tsx` | ROM folder structure, RetroAchievements credentials |

### Components

| Component | Purpose |
|---|---|
| `Sidebar.tsx` | Navigation sidebar (6 items + version) |
| `BiosCheckPanel.tsx` | BIOS file scanner |
| `GameDetailModal.tsx` | Game detail view with metadata, achievements, screenshots |
| `ReleaseNotesModal.tsx` | Markdown release notes display |

### Hooks

| Hook | Purpose |
|---|---|
| `useGamepadNav.ts` | 60fps gamepad polling, D-Pad/button navigation, controller detection |

---

## Supported Emulators

### Core Emulators

| Emulator | ID | Description | Systems | Download Formats |
|---|---|---|---|---|
| RetroArch | `retroarch` | Multi-system emulator frontend | NES, SNES, N64, GB, GBC, GBA, PS1, PCE, Sega MD, Sega Saturn, Dreamcast | 7z |
| Dolphin | `dolphin` | GameCube & Wii emulator | GC, Wii | 7z, DMG, AppImage |
| RPCS3 | `rpcs3` | PlayStation 3 emulator | PS3 | 7z, AppImage (no macOS) |
| Eden | `eden` | Nintendo Switch emulator | Switch | ZIP, DMG, AppImage |
| PCSX2 | `pcsx2` | PlayStation 2 emulator | PS2 | 7z, tar.xz, AppImage |
| DuckStation | `duckstation` | PlayStation 1 emulator | PS1 | ZIP, AppImage |
| MAME | `mame` | Multi Arcade Machine Emulator | Arcade | EXE, ZIP (no macOS download) |
| PPSSPP | `ppsspp` | PlayStation Portable emulator | PSP | 7z, ZIP, AppImage |
| melonDS | `melonds` | Nintendo DS emulator | NDS | ZIP, AppImage |
| Flycast | `flycast` | Dreamcast/Naomi/Atomiswave emulator | Dreamcast | ZIP, AppImage |

### Frontends

| Frontend | ID | Description | Gated |
|---|---|---|---|
| ES-DE | `esde` | EmulationStation Desktop Edition | Beta |
| NeoStation | `neostation` | Flutter-based frontend with ScreenScraper | Beta |
| Pegasus | `pegasus` | Themeable game launcher | Beta |
| EmuBuddy | `emubuddy` | Automated emulation frontend | No |

### Detection

OmniEmu detects installed emulators via:

1. Default hardcoded paths per platform
2. Marker file (`userData/emulators/<id>/.installed`)
3. Alternative common paths (Homebrew, snap, Flatpak, etc.)
4. System `which`/`where` lookup

---

## Supported Systems

| System ID | Name | Primary Emulator | Alternatives |
|---|---|---|---|
| `nes` | Nintendo Entertainment System | RetroArch (Nestopia) | RetroArch (Mesen, FCEUX) |
| `snes` | Super Nintendo | RetroArch (Snes9x) | RetroArch (bsnes HD) |
| `n64` | Nintendo 64 | RetroArch (Mupen64Plus-Next) | RetroArch (Parallel) |
| `gb` | Game Boy | RetroArch (Gambatte) | RetroArch (SameBoy) |
| `gbc` | Game Boy Color | RetroArch (Gambatte) | RetroArch (SameBoy) |
| `gba` | Game Boy Advance | RetroArch (mGBA) | RetroArch (VBA-M) |
| `nds` | Nintendo DS | melonDS | RetroArch (melonDS) |
| `ps1` | PlayStation 1 | DuckStation | RetroArch (SwanStation) |
| `ps2` | PlayStation 2 | PCSX2 | — |
| `ps3` | PlayStation 3 | RPCS3 | — |
| `psp` | PlayStation Portable | PPSSPP | — |
| `gc` | Nintendo GameCube | Dolphin | — |
| `wii` | Nintendo Wii | Dolphin | — |
| `switch` | Nintendo Switch | Eden | — |
| `arcade` | Arcade | MAME | RetroArch (MAME) |
| `dreamcast` | Sega Dreamcast | Flycast | RetroArch (Flycast) |
| `sega-md` | Sega Mega Drive / Genesis | RetroArch (Genesis Plus GX) | — |
| `sega-saturn` | Sega Saturn | RetroArch (Yaba Sanshiro) | — |
| `pce` | PC Engine / TurboGrafx-16 | RetroArch (Mednafen PCE) | — |

---

## ROM Format Support

| Extension | System(s) |
|---|---|
| `.nes` | NES |
| `.sfc`, `.smc` | SNES |
| `.n64`, `.z64`, `.v64` | N64 |
| `.gb` | Game Boy |
| `.gbc` | Game Boy Color |
| `.gba` | Game Boy Advance |
| `.nds` | Nintendo DS |
| `.iso`, `.bin`, `.cue` | PS1, PS2, PS3, PSP, GC, Wii, Saturn |
| `.chd` | PS1, PS2, PSP, Dreamcast, Saturn |
| `.pbp` | PSP |
| `.cso` | PSP |
| `.gcm`, `.gcz`, `.rvz` | GameCube |
| `.wbfs`, `.wad` | Wii |
| `.nsp`, `.xci` | Switch |
| `.pkg` | PS3 |
| `.m3u` | Multi-disc games |
| `.zip`, `.7z` | Arcade (MAME), various |
| `.gdi`, `.cdi` | Dreamcast |
| `.rom` | Various |

Platform is guessed from file extension, with directory name as override (e.g. `.iso` in `ps2/` is classified as PS2).

---

## Configuration Presets

### Built-In Presets

| Emulator | Preset Name | Config Files |
|---|---|---|
| RetroArch | OmniEmu Recommended | `retroarch.cfg` |
| RetroArch | OmniEmu Performance | `retroarch.cfg` |
| Dolphin | OmniEmu Recommended | `Config/Dolphin.ini`, `Config/GFX.ini` |
| RPCS3 | OmniEmu Recommended | `config.yml` |
| Eden | OmniEmu Recommended | `Config.json` |
| PCSX2 | OmniEmu Recommended | `inis/PCSX2.ini` |
| DuckStation | OmniEmu Recommended | `settings.ini` |
| MAME | OmniEmu Recommended | `mame.ini` |
| melonDS | OmniEmu Recommended | `melonDS.ini` |
| Flycast | OmniEmu Recommended | `emu.cfg` |
| ES-DE | OmniEmu Recommended | Generates `es_settings.xml`, `es_find_rules.xml` |
| NeoStation | OmniEmu Recommended | Generates `omniemu_config.json` |
| Pegasus | OmniEmu Recommended | Generates `metadata.pegasus.txt` per ROM dir |

### Preset Loading Priority

1. Remote URL (`https://raw.githubusercontent.com/mileswolfallen2/OmniEmu2.0/main/presets.json`)
2. Local file (`userData/presets.json`)
3. Built-in presets (compiled into the app)

### Remote Preset Source

Configurable in **Settings > Presets**. Point to any JSON file following the `presets.json` schema.

---

## IPC API Reference

### System

| Channel | Arguments | Returns |
|---|---|---|
| `system:info` | — | `SystemInfo` |
| `system:platform-name` | — | `string` |

### Emulators

| Channel | Arguments | Returns |
|---|---|---|
| `emulators:list` | — | `EmulatorConfig[]` |
| `emulators:states` | — | `EmulatorState[]` |
| `emulators:check` | `id: string` | `EmulatorState` |
| `emulators:install` | `id: string` | `EmulatorState` |
| `emulators:configure` | `id, installPath` | `{ success, state }` |
| `emulators:presets` | `id: string` | `ConfigPreset[]` |
| `emulators:configured` | `id, installPath?` | `boolean` |
| `emulators:launch` | `id: string` | `boolean` |
| `emulators:uninstall` | `id: string` | `{ removed, state }` |
| `emulators:open-website` | `id: string` | `boolean` |
| `emulators:system-assignments` | — | `Record<string, string[]>` |
| `emulators:update-controller-config` | `id, installPath, controllerName?` | `boolean` |

### ROMs / Games

| Channel | Arguments | Returns |
|---|---|---|
| `roms:scan` | `directory?: string` | `GameEntry[]` |
| `roms:select-directory` | — | `string \| null` |
| `game:launch` | `emulatorId, romPath` | `boolean` |
| `games:recent` | — | `GameEntry[]` |
| `games:clear-recent` | — | `boolean` |
| `games:scrape-art` | `title, platform` | `string \| undefined` |
| `games:cache-covers` | `{ romPath, coverUrl }[]` | `boolean` |
| `games:scrape-metadata` | `romPath, title, platform` | `GameMetadata` |
| `games:achievements` | `romPath, title, platform` | `AchievementInfo \| null` |

### Settings

| Channel | Arguments | Returns |
|---|---|---|
| `settings:get` | — | `AppSettings` |
| `settings:save` | `Partial<AppSettings>` | `AppSettings` |
| `settings:reset` | — | `AppSettings` |

### BIOS

| Channel | Arguments | Returns |
|---|---|---|
| `bios:list-known` | — | `BiosEntry[]` |
| `bios:scan` | `directory?: string` | `BiosCheckResult[]` |
| `bios:select-directory` | — | `string \| null` |
| `bios:configure-retroarch` | `configDir, biosDir` | `boolean` |

### RetroAchievements

| Channel | Arguments | Returns |
|---|---|---|
| `retroachievements:save` | `username, password` | `Record<string, boolean>` |

### Utilities

| Channel | Arguments | Returns |
|---|---|---|
| `utilities:regenerate-roms-structure` | — | `boolean` |

### Updates

| Channel | Arguments | Returns |
|---|---|---|
| `updates:check` | — | `boolean` |
| `updates:download` | — | `boolean` |
| `updates:quit-and-install` | — | `boolean` |

### Outbound Events (Main -> Renderer)

| Event | Data |
|---|---|
| `emulators:install-progress` | `InstallProgress` |
| `updates:status` | `{ status, version, releaseNotes, message, manualLink }` |
| `updates:download-progress` | `{ percent, bytesPerSecond, transferred, total }` |

---

## File Structure

```
OmniEmu2.0/
├── src/
│   ├── main/                  # Electron main process
│   │   ├── index.ts           # Entry point
│   │   ├── emulators.ts       # Emulator registry & ROM scanning
│   │   ├── configurator.ts    # Config presets & emulator setup
│   │   ├── ipc.ts             # IPC handler registration
│   │   ├── preload.ts         # Context bridge (window.omni)
│   │   ├── platform.ts        # OS/arch detection
│   │   ├── settings.ts        # Settings persistence
│   │   ├── installer.ts       # Download & install emulators
│   │   ├── scraper.ts         # Art & metadata scraping
│   │   ├── updater.ts         # Auto-update
│   │   ├── bios.ts            # BIOS detection
│   │   └── ra.ts              # RetroAchievements
│   ├── renderer/              # React UI
│   │   ├── App.tsx            # Root component
│   │   ├── main.tsx           # React entry point
│   │   ├── index.html         # HTML shell
│   │   ├── styles.css         # Design system
│   │   ├── types.ts           # window.omni types
│   │   ├── pages/             # Page components
│   │   ├── components/        # Shared components
│   │   ├── hooks/             # Custom hooks
│   │   └── utils/             # Utilities (markdown)
│   └── shared/
│       └── types.ts           # Shared TypeScript types
├── assets/                    # App icons
├── scripts/                   # Build & install scripts
├── presets.json               # Remote preset source
├── package.json               # Project config & electron-builder
├── vite.config.ts             # Vite build config
├── tsconfig.json              # Base TS config
├── tsconfig.main.json         # Main process TS config
├── tsconfig.renderer.json     # Renderer TS config
├── LICENSE                    # MIT
└── README.md                  # Project docs
```

### Runtime Directories

| Path | Platform | Contents |
|---|---|---|
| `userData/settings.json` | All | App settings |
| `userData/cache/scrape-cache.json` | All | Cover art cache |
| `userData/cache/metadata-cache.json` | All | Game metadata cache |
| `userData/cache/ra-game-list-cache.json` | All | RetroAchievements game lists |
| `userData/emulators/<id>/.installed` | All | Installed emulator marker |
| `userData/configs/` | All | Config state markers |
| `~/Documents/roms/` | Default | ROM library root |
| `~/Documents/roms/<system>/` | Default | System-specific ROM folders |

---

## Build & Development

### Prerequisites

- Node.js 18+
- npm
- Python 3 (for icon generation)
- Platform-specific tools:
  - macOS: Xcode Command Line Tools
  - Windows: NSIS (for installer)
  - Linux: libfuse2 (for AppImage)

### Commands

```bash
# Install dependencies
npm install

# Development (hot reload)
npm run dev

# Build renderer + main
npm run build

# Type checking
npm run typecheck

# Package for current platform
npm run package:mac      # macOS universal
npm run package:win      # Windows x64
npm run package:linux    # Linux x64

# Package all platforms
npm run build:all        # macOS universal + Win x64/arm64 + Linux x64/arm64
```

### Build Configuration

- **App ID:** `com.omniemu.app`
- **Product Name:** `OmniEmu`
- **Output:** `release/`
- **Renderer:** Vite builds to `dist/renderer/`
- **Main:** TypeScript compiles to `dist/main/`
- **Publish:** GitHub Releases

---

## Release Artifacts

| Platform | Format | Architecture | Filename Pattern |
|---|---|---|---|
| macOS | DMG | Universal (x64 + ARM64) | `OmniEmu-{ver}-mac-universal.dmg` |
| macOS | ZIP | Universal | `OmniEmu-{ver}-mac-universal.zip` |
| Windows | NSIS EXE | x64 | `OmniEmu-{ver}-win-x64.exe` |
| Windows | NSIS EXE | ARM64 | `OmniEmu-{ver}-win-arm64.exe` |
| Windows | ZIP | x64 | `OmniEmu-{ver}-win-x64.zip` |
| Windows | ZIP | ARM64 | `OmniEmu-{ver}-win-arm64.zip` |
| Linux | AppImage | x86_64 | `OmniEmu-{ver}-linux-x86_64.AppImage` |
| Linux | AppImage | ARM64 | `OmniEmu-{ver}-linux-arm64.AppImage` |

`.yml` files in releases are for electron-updater and can be ignored for manual installs.

---

## Security

- **Context Isolation:** Enabled
- **Node Integration:** Disabled
- **Sandbox:** Disabled (required for native module access)
- **CSP:** `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'`
- **Single Instance:** Enforced via `app.requestSingleInstanceLock()`
- **No secrets or API keys** are committed to the repository

---

## Contributing

### Code Style

- TypeScript strict mode
- React functional components with hooks
- No comments unless requested
- Follow existing patterns and naming conventions

### Key Conventions

- Emulators are defined in `knownEmulators` array in `src/main/emulators.ts`
- Config presets are in `builtInPresets` in `src/main/configurator.ts`
- All IPC channels are registered in `src/main/ipc.ts`
- All renderer API calls go through `window.omni` (defined in `src/main/preload.ts`)
- Shared types are in `src/shared/types.ts`

### Testing Changes

1. Run `npm run typecheck` to verify types
2. Run `npm run build` to verify compilation
3. Run `npm run dev` to test in development mode
4. Test on all target platforms if possible

---

*Last updated: July 2026*
