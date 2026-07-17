# OmniEmu v0.3.2 Release Notes

> All your games. One place.

---

## What's New

### Cloud Sync
Sync your game saves between devices using Syncthing — free, open-source, and fully local. No third-party accounts needed.
- Install Syncthing directly from the app (one-click download)
- Toggle on/off from **Settings > Experimental > Cloud Sync**
- Host your device or pair with another to share saves
- Manage shared folders and paired devices from the Cloud Sync tab
- Web UI access for advanced configuration

### Save Manager
Browse, back up, and delete game saves across all your emulators.
- Dual view: **By Game** (fuzzy-matched titles) or **By Emulator**
- RetroArch saves with recursive core-directory scanning
- Custom save directories per emulator
- Backup saves before deleting
- **Restore** — restore any previous backup with one click (new)
- **Open Backup Folder** — jump straight to your backups on disk (new)

### New Emulators
Five new emulators added to the library:
| Emulator | System | Platforms |
|---|---|---|
| **Cemu** | Wii U | Windows, macOS, Linux |
| **xemu** | Original Xbox | Windows, macOS, Linux |
| **Vita3K** | PS Vita | Windows, macOS, Linux |
| **Azahar** | Nintendo 3DS | Windows, macOS, Linux |
| **Mednafen** | Multi-system | Windows, macOS, Linux |

### Frontend Support
Launch alternative frontends directly from OmniEmu — toggle on in **Settings > Experimental > Frontend Support**:
- **ES-DE** — full integration with auto-configuration, scraping, themes, and more
- **NeoStation** — Flutter-based frontend with built-in ScreenScraper integration
- **Pegasus** — automatic collection file generation from your ROM library
- **EmuBuddy** — available to all users (not behind the toggle)

### Decompilations
Native PC ports built from reverse-engineered source code — toggle on in **Settings > Experimental > Decomp Projects**:
- **Ship of Harkinian** (OoT), **2 Ship 2 Harkinian** (MM), **SoH Demo** — Zelda
- **Portal 64**, **Banana Mania PC** — additional ports
- Auto-download from GitHub releases, built-in ROM management
- Supported titles include N64, NDS, GBA, DS, Wii, GameCube, and more

### Settings > Experimental
Individual toggles for each beta feature — enable only what you want:
- **Frontend Support** — ES-DE, NeoStation, Pegasus, EmuBuddy
- **Beta Emulators** — additional experimental emulator support
- **Decomp Projects** — native PC ports from reverse-engineered source
- **Remote Presets** — fetch recommended config presets from a remote URL
- **Cloud Sync** — sync saves between devices via Syncthing

### Settings > Appearance
Visual theme picker with live color swatches:
- Light, Dark, System (auto)
- **Midnight** — deep navy
- **Ember** — warm dark
- **Lavender** — soft purple
- **Jade** — cool teal

### EmulatorsPage Tabs
Organized emulator list with filter tabs:
- **All** — every emulator, frontend, and decomp
- **Emulators** — core emulators only (Dolphin, PCSX2, RetroArch, etc.)
- **Frontends** — ES-DE, NeoStation, Pegasus, EmuBuddy (shown only when Frontend Support is enabled)
- **Decomps** — native PC ports (visible when Decomp Projects is on)

### Beta Badges
Beta and experimental emulators are now clearly labeled with a "Beta" badge in their card header. The following emulators are marked beta: ES-DE, NeoStation, EmuBuddy, Pegasus, xemu, Vita3K, Azahar, Project64, Mednafen.

### SteamGridDB Cover Art
Search and set custom cover art from SteamGridDB's free API.
- Search covers from the game detail modal
- Thumbnails downloaded locally for instant display
- Rate-limit aware with automatic retry
- "Reset Cover" button to clear custom art

### Horizontal Navigation
Redesigned top-bar navigation with full gamepad/controller support:
- Spatial D-pad navigation (up/down/left/right between elements)
- A to select, B to close modals
- LB/RB to switch tabs
- Auto-focus on page change

---

## Bug Fixes
- **Emulator launch command injection** — replaced `exec()` with `spawn()` for all emulator and game launches, preventing shell argument injection
- **RetroAchievements password** — encrypted on disk using Electron safeStorage
- **Single-instance lock** — bypass fix prevents second instance from ignoring the lock
- **Sandbox flags** — `--no-sandbox` and `--disable-gpu-sandbox` now only applied on Steam Deck
- **Controller detection** — fixed Xbox L2/R2 axis mapping (axes +4/+5), fixed button/axis comparison including both arrays
- **RetroArch presets** — removed hardcoded `audio_driver = "pulseaudio"` from both presets
- **Save file extension** — fixed `.SVS` → `.svs` case sensitivity in save detection
- **URL scraper** — `urlExists()` now follows 301/302 redirects (up to 5 deep)
- **Game detail modal** — fixed prop mutation on `coverUrl` (now uses local state)
- **UtilitiesPage** — fixed `window.omni.emu` → `window.omni.emulators`
- **Error boundaries** — all 8 pages wrapped with ErrorBoundary for graceful crash recovery
- **RetroArch save detection** — now finds saves in core subdirectories and supports portable installs
- **Syncthing install** — fixed macOS extraction from nested zip directory, updated to v2.1.2
- **Syncthing blue screen** — fixed IPC handler crashes, pipe buffer deadlock, null device ID crash
- **Cloud Sync poll leak** — start polling now cleans up on unmount
- **Cemu macOS** — removed x64-only filter so it installs via Rosetta on ARM Macs
- **Vita3K macOS** — added ARM64 DMG variant alongside x64
- **RetroArch cores 404** — removed broken download (use RetroArch's Online Updater instead)
- **BIOS folder scan** — `scanRoms()` now skips BIOS directories
- **CSS accent colors** — replaced hardcoded colors with `color-mix()` using theme variables
- **Duplicate CSS** — renamed `.platform-tag` conflict to `.platform-tag-accent`
- **Frontend Support toggle** — now actually gates ES-DE, NeoStation, Pegasus, and EmuBuddy on/off in the Emulators page
- **Beta Emulators toggle** — now actually hides/shows beta emulators in the Emulators page
- **Decomp launch** — decomps now copy the ROM into the install directory and set execute permissions before launch
- **Stuck loading screens** — all 5 main pages (Dashboard, Settings, Emulators, Save Manager, Library) now resolve loading state on errors instead of hanging forever
- **setTimeout memory leaks** — fixed 12+ tracked-but-never-cleaned timers across ControllerPage, SaveManagerPage, UtilitiesPage, BiosCheckPanel, and useGamepadNav
- **App startup crash** — `ensureRomsStructure()` now caught; fatal window creation shows error dialog instead of zombie process
- **Syncthing quit cleanup** — Syncthing process now stopped on app quit
- **execSync hangs** — path detection and version detection now have 3-5 second timeouts instead of blocking indefinitely
- **BrowserWindow null crash** — removed unsafe `!` assertions on `fromWebContents()` calls in IPC handlers
- **Download redirect loops** — both installer and Syncthing download functions now cap redirects at 10
- **Download timeouts** — Syncthing binary download now has a 30s request timeout
- **Cloud Sync type error** — added missing `uninstall` method to cloud IPC type definition
- **Decomp tab rendering** — Decomps tab now correctly hides emulator cards and shows only decomp entries
- **Build fix** — removed Linux ARM64 cross-compile from `build:all` (requires Linux host)

---

## System Requirements
- **OS:** Windows 10+, macOS 11+, Ubuntu 20.04+
- **Disk:** ~200 MB for app + emulators vary
- **RAM:** 4 GB minimum

---

## Supported Emulators (20+ total)
RetroArch, Dolphin, RPCS3, Cemu, xemu, Vita3K, Azahar, Eden, PPSSPP, DuckStation, PCSX2, Flycast, mGBA, MelonDS, Mednafen, Project64, Snes9x, Mesen2, MAME, ES-DE, NeoStation, Pegasus, EmuBuddy, and more.

---

## Thank You!

Thanks for using OmniEmu! Every star on GitHub, every bug report, and every feature request helps us make this app better for everyone. If you run into any issues, please open an issue on [GitHub](https://github.com/mileswolfallen2/OmniEmu2.0) — we're always happy to help.

Happy gaming!
