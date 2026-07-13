# **OmniEmu v0.2.0 — Fourth Pre-Release**

Cross-platform emulator manager, game launcher, and ROM manager.

---

## **What's New**

### **Frontend Support**

OmniEmu now supports multiple emulation frontends — install and configure them alongside your emulators.

**ES-DE (EmulationStation Desktop Edition)** — available in Beta

- Multi-system frontend with a polished UI for browsing and launching games
- Auto-configured with your ROM directory and installed emulators
- Supports all 20+ systems
- macOS: requires manual install (OmniEmu guides you through it)

**NeoStation** — available in Beta

- Modern Flutter-based frontend with ScreenScraper integration
- Auto-discovers emulators and ROMs
- RetroAchievements built in
- macOS: requires manual install (OmniEmu guides you through it)

**EmuBuddy**

- Cross-platform frontend with automated setup and game downloading
- One-click controller configuration
- Supports 14 systems
- Available on Windows, macOS, and Linux

**Pegasus Frontend** — available in Beta

- Lightweight, themeable game launcher
- OmniEmu auto-generates collection files (`metadata.pegasus.txt`) in each ROM subdirectory
- Writes Pegasus settings to point at your ROM library

---

### **Beta Features Toggle**

A new **Settings > Experimental** section lets you opt into beta features.

Enable **Beta Features** to unlock ES-DE, NeoStation, and Pegasus in the Emulators page. EmuBuddy is available without the toggle.

---

### **Pegasus Collection File Generation**

When Pegasus is configured (or on app startup with beta features enabled), OmniEmu now writes `metadata.pegasus.txt` files directly into each ROM subdirectory (e.g. `roms/nes/metadata.pegasus.txt`). This is where Pegasus discovers collections — not in a central config folder.

Each collection file includes:

- Collection name and shortname
- File extensions for that system
- Launch command pointing to the correct emulator
- Individual game entries with filenames

---

### **ROM Library Auto-Scan**

The Library page now scans for games automatically on startup — no need to manually select a folder first. If your ROMs directory is set (defaults to `~/Documents/roms`), games appear immediately.

---

## **Bug Fixes & Improvements**

### **macOS Frontend Installation**

- ES-DE and NeoStation require manual DMG installation on macOS due to license dialogs
- OmniEmu now shows a guided install flow: detects the DMG, opens it for you, then detects the installed app
- **"Install Manually"** button in the Emulators page lets you skip the automated flow and install at your own pace

### **Emulator Detection**

- Added alternative install paths for all emulators (Homebrew, snap, Flatpak, common directories)
- Improved binary discovery with recursive directory scanning

### **ROM Scanning**

- ROMs are automatically organized into the correct subdirectory on scan
- Platform guessing improved: `.iso` files in a `ps2/` folder are classified as PS2, not PS1
- Supported extensions now include `.cdi` (Dreamcast), `.pbp` (PSP), `.chd` (multiple systems)

---

## **Supported Emulators**

Emulator | Systems | Platforms
--- | --- | ---
Dolphin | GameCube, Wii | Win, macOS, Linux
RPCS3 | PlayStation 3 | Win, Linux
Eden | Nintendo Switch | Win, macOS, Linux
PCSX2 | PlayStation 2 | Win, macOS, Linux
MAME | Arcade | Win, Linux
DuckStation | PlayStation 1 | Win, macOS, Linux
RetroArch | NES, SNES, N64, GB, GBC, GBA, PS1, PCE, Sega MD, Sega Saturn, Dreamcast | Win, macOS, Linux
PPSSPP | PlayStation Portable | Win, macOS, Linux
melonDS | Nintendo DS | Win, macOS, Linux
Flycast | Dreamcast, Naomi, Naomi 2, Atomiswave | Win, macOS, Linux

### **Frontends (Beta)**

Frontend | Type | Platforms
--- | --- | ---
ES-DE | Multi-system frontend | Win, macOS, Linux
NeoStation | Flutter-based frontend | Win, macOS, Linux
Pegasus | Themeable game launcher | Win, macOS, Linux
EmuBuddy | Automated emulation frontend | Win, macOS, Linux

---

## **Auto-Update**

If you're downloading OmniEmu from GitHub, you can safely ignore the `.yml` files included with each release.

These are used internally by OmniEmu's built-in updater and are **not required** for manual installation.

Simply download the installer for your platform.

---

# **Installation**

## **macOS**

Download:

- `OmniEmu-0.2.0-mac-universal.dmg`

Install:

1. Drag **OmniEmu** into **Applications**.
2. Right-click **OmniEmu** > **Open** on first launch.

If macOS blocks the app, run:

```bash
sudo xattr -rd com.apple.quarantine /Applications/OmniEmu.app
```

## **Windows**

Download:

- `OmniEmu-0.2.0-win-x64.exe` *(Intel / AMD)*
- `OmniEmu-0.2.0-win-arm64.exe` *(ARM64)*

Portable ZIP builds are also available.

If Windows SmartScreen appears:

**More info > Run anyway**

## **Linux**

Download:

- `OmniEmu-0.2.0-linux-x86_64.AppImage`
- `OmniEmu-0.2.0-linux-arm64.AppImage`

Make it executable:

```bash
chmod +x OmniEmu*.AppImage
./OmniEmu*.AppImage
```

If the AppImage doesn't launch, install **libfuse2**.

---

## **Thanks for Testing!**

OmniEmu is still in **pre-release**, so bug reports, feature requests, and feedback are greatly appreciated.

Thank you for helping improve OmniEmu, and enjoy the update!
