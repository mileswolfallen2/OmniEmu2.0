# OmniEmu v0.3.0 Release Notes

> All your games. One place.

---

## What's New

### Cloud Sync (Beta)
Sync your game saves between devices using Syncthing — free, open-source, and fully local. No third-party accounts needed.
- Install Syncthing directly from the app (one-click download)
- Auto-starts on launch once configured
- Host your device or pair with another to share saves
- Manage shared folders and paired devices from the Cloud Sync tab
- Web UI access for advanced configuration

### Save Manager
Browse, back up, and delete game saves across all your emulators.
- Dual view: **By Game** (fuzzy-matched titles) or **By Emulator**
- RetroArch saves with recursive core-directory scanning
- Custom save directories per emulator
- Backup saves before deleting

### New Emulators
Four new emulators added to the library:
| Emulator | System | Platforms |
|---|---|---|
| **Cemu** | Wii U | Windows, macOS, Linux |
| **xemu** | Original Xbox | Windows, macOS, Linux |
| **Vita3K** | PS Vita | Windows, macOS, Linux |
| **Azahar** | Nintendo 3DS | Windows, macOS, Linux |

### Frontend Support (Beta)
Launch alternative frontends directly from OmniEmu:
- **ES-DE** — full integration with auto-configuration
- **NeoStation** — Flutter-based frontend with ScreenScraper integration
- **Pegasus** — automatic collection file generation from your ROM library
- **EmuBuddy** — available to all users (not behind beta toggle)

### Decompilations (Beta)
Native PC ports built from reverse-engineered source code — bring your own ROM:
- **Ship of Harkinian** (OoT), **2 Ship 2 Harkinian** (MM), **SoH Demo** — Zelda
- **Portal 64**, **Banana Mania PC** — additional ports
- Auto-download from GitHub releases, built-in ROM management
- Supported titles include N64, NDS, GBA, DS, Wii, GameCube, and more

Enable frontends and decompilations under **Settings > Experimental > Beta Features**.

### SteamGridDB Cover Art
Search and set custom cover art from SteamGridDB's free API.
- Search covers from the game detail modal
- Thumbnails downloaded locally for instant display
- Rate-limit aware with automatic retry
- "Reset Cover" button to clear custom art

### Themes
Seven themes available in Settings:
- Light, Dark, System (auto)
- **Midnight** — deep navy
- **Ember** — warm dark
- **Lavender** — soft purple
- **Jade** — cool teal

### Horizontal Navigation
Redesigned top-bar navigation with full gamepad/controller support:
- Spatial D-pad navigation (up/down/left/right between elements)
- A to select, B to close modals
- LB/RB to switch tabs
- Auto-focus on page change

---

## Bug Fixes
- **RetroArch save detection** — now finds saves in core subdirectories (`saves/Snes9x/file.srm`) and supports portable installs (`~/Documents/RetroArch/saves/`)
- **Syncthing install** — fixed macOS extraction from nested zip directory, updated to v2.1.2
- **Syncthing blue screen** — fixed IPC handler crashes, pipe buffer deadlock (`stdio: 'pipe'` → `stdio: 'ignore'`), null device ID crash in API response parsing
- **Cloud Sync poll leak** — start polling now cleans up on unmount, loading state stays visible during startup
- **Cemu macOS** — removed x64-only filter so it installs via Rosetta on ARM Macs
- **Vita3K macOS** — added ARM64 DMG variant alongside x64
- **RetroArch cores 404** — removed broken `RetroArch_cores.7z` download (use RetroArch's Online Updater instead)
- **BIOS folder scan** — `scanRoms()` now skips BIOS directories
- **CSS accent colors** — replaced hardcoded colors with `color-mix()` using theme variables
- **Duplicate CSS** — renamed `.platform-tag` conflict to `.platform-tag-accent`
- **Unused imports** — cleaned up `require()` calls, dead imports, stale `types.d.ts`

---

## System Requirements
- **OS:** Windows 10+, macOS 11+, Ubuntu 20.04+
- **Disk:** ~200 MB for app + emulators vary
- **RAM:** 4 GB minimum

---

## Supported Emulators (18 total)
RetroArch, Dolphin, RPCS3, Cemu, xemu, Vita3K, Azahar, Eden, PPSSPP, DuckStation, PCSX2, Flycast, Dolphin (trio), Yuzu (legacy), mGBA, MelonDS, and more.

---

*Built with Electron, React, and TypeScript.*
