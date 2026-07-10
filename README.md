# OmniEmu

Cross-platform emulator manager and ROM library — for Windows, macOS, and Linux.

## Features

- **Emulator Management** — Detect installed emulators, download new ones, manage versions
- **ROM Library** — Scan directories for ROMs, organise by platform, launch games
- **Cross-Platform** — Same experience on Windows, macOS, and Linux (x86-64 & ARM64)
- **Built-in Launcher** — Launch games directly from the library with proper emulator arguments

## Supported Emulators

| Emulator   | Systems           | Windows | macOS | Linux |
|------------|-------------------|---------|-------|-------|
| Dolphin    | GameCube, Wii     | ✅      | ✅    | ✅    |
| RPCS3      | PlayStation 3     | ✅      | ✅    | ✅    |
| Ryujinx    | Nintendo Switch   | ✅      | ✅    | ✅    |
| PCSX2      | PlayStation 2     | ✅      | ✅    | ✅    |
| MAME       | Arcade            | ✅      | ✅    | ✅    |
| RetroArch  | Multi-system      | ✅      | ✅    | ✅    |

## Development

### Prerequisites

- Node.js 20+ (recommended: 22)
- npm 10+

### Setup

```bash
npm install
npm run start
```

This starts the Vite dev server for the renderer and the TypeScript compiler for the main process in watch mode.

### Build for production

```bash
npm run build
```

### Package for distribution

```bash
# Current platform
npm run package:mac
npm run package:win
npm run package:linux

# All platforms
npm run package:all
```

Output goes to `./release/`.

### Platform-specific scripts

```bash
# macOS (specify arch: x64 or arm64)
./scripts/build-mac.sh arm64

# Windows (PowerShell)
.\scripts\build-win.ps1 -Arch x64

# Linux
./scripts/build-linux.sh x64
```

## Project Structure

```
src/
├── main/          # Electron main process
│   ├── index.ts   # App entry, window creation, tray
│   ├── preload.ts # Context bridge API
│   ├── ipc.ts     # IPC handler registration
│   ├── platform.ts # OS/arch detection utilities
│   ├── emulators.ts # Emulator detection, ROM scanning, launching
│   └── settings.ts  # Persistent settings
├── renderer/      # React UI (Vite)
│   ├── App.tsx
│   ├── components/
│   ├── pages/
│   └── styles.css
└── shared/        # Types shared between main & renderer
    └── types.ts
scripts/           # Build and install scripts
.github/workflows/ # CI configuration
```

## License

MIT
