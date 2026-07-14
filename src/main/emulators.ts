import { execSync, exec, ChildProcess } from 'child_process';
import { existsSync, mkdirSync, readdirSync, renameSync, readFileSync, rmSync, statSync } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { app } from 'electron';
import { homedir } from 'os';
import {
  EmulatorConfig,
  EmulatorState,
  GameEntry,
  InstallProgress,
} from '../shared/types';
import { getPlatform, getArch, isWindows, isMacOS } from './platform';
import { settings } from './settings';
import { applyCachedCovers } from './scraper';

const platform = getPlatform();
const arch = getArch();

export const knownEmulators: EmulatorConfig[] = [
  {
    id: 'dolphin',
    name: 'Dolphin',
    description: 'GameCube & Wii emulator',
    platforms: ['gc', 'wii'],
    defaultPath: {
      win32: 'C:\\Program Files\\Dolphin\\Dolphin.exe',
      darwin: '/Applications/Dolphin.app/Contents/MacOS/Dolphin',
      linux: '/usr/bin/dolphin-emu',
    },
    downloads: {
      win32: [
        {
          url: 'https://dl.dolphin-emu.org/releases/2606/dolphin-2606-x64.7z',
          format: '7z',
          executablePath: 'Dolphin.exe',
          arch: 'x64',
        },
      ],
      darwin: [
        {
          url: 'https://dl.dolphin-emu.org/releases/2606/dolphin-2606-universal.dmg',
          format: 'dmg',
        },
      ],
      linux: [
        {
          url: 'https://dl.dolphin-emu.org/releases/2412/dolphin-2412-x86_64.AppImage',
          format: 'appimage',
        },
      ],
    },
    packageNames: { linux: 'dolphin-emu' },
    supported: true,
    websiteUrl: {
      win32: 'https://dolphin-emu.org/download/',
      darwin: 'https://dolphin-emu.org/download/',
      linux: 'https://dolphin-emu.org/download/',
    },
  },
  {
    id: 'rpcs3',
    name: 'RPCS3',
    description: 'PlayStation 3 emulator',
    platforms: ['ps3'],
    defaultPath: {
      win32: 'C:\\Program Files\\RPCS3\\rpcs3.exe',
      darwin: '/Applications/RPCS3.app/Contents/MacOS/rpcs3',
      linux: '/usr/bin/rpcs3',
    },
    downloads: {
      win32: [
        {
          url: 'https://github.com/RPCS3/rpcs3-binaries-win/releases/download/build-4003b017f55f6ba3793469f35927cb5a2815cd22/rpcs3-v0.0.41-19563-4003b017_win64_msvc.7z',
          format: '7z',
          executablePath: 'rpcs3.exe',
        },
      ],
      linux: [
        {
          url: 'https://github.com/RPCS3/rpcs3-binaries-linux/releases/download/build-4003b017f55f6ba3793469f35927cb5a2815cd22/rpcs3-v0.0.41-19563-4003b017_linux64.AppImage',
          format: 'appimage',
        },
      ],
    },
    supported: true,
    websiteUrl: {
      win32: 'https://rpcs3.net/download',
      darwin: 'https://rpcs3.net/download',
      linux: 'https://rpcs3.net/download',
    },
  },
  {
    id: 'eden',
    name: 'Eden',
    description: 'Nintendo Switch emulator (community fork)',
    platforms: ['switch'],
    defaultPath: {
      win32: 'C:\\Program Files\\Eden\\Eden.exe',
      darwin: '/Applications/Eden.app/Contents/MacOS/Eden',
      linux: '/usr/bin/eden',
    },
    downloads: {
      win32: [
        {
          url: 'https://master.eden-emu.dev/v1783561671.41762940d6/Eden-Windows-41762940d6-amd64-gcc-standard.zip',
          format: 'zip',
          executablePath: 'Eden.exe',
        },
      ],
      darwin: [
        {
          url: 'https://master.eden-emu.dev/v1783561671.41762940d6/Eden-macOS-41762940d6.dmg',
          format: 'dmg',
        },
      ],
      linux: [
        {
          url: 'https://master.eden-emu.dev/v1783561671.41762940d6/Eden-Linux-41762940d6-amd64-gcc-standard.AppImage',
          format: 'appimage',
        },
      ],
    },
    supported: true,
    websiteUrl: {
      win32: 'https://eden-emu.dev/',
      darwin: 'https://eden-emu.dev/',
      linux: 'https://eden-emu.dev/',
    },
  },
  {
    id: 'pcsx2',
    name: 'PCSX2',
    description: 'PlayStation 2 emulator',
    platforms: ['ps2'],
    defaultPath: {
      win32: 'C:\\Program Files\\PCSX2\\pcsx2.exe',
      darwin: '/Applications/PCSX2.app/Contents/MacOS/PCSX2',
      linux: '/usr/bin/pcsx2',
    },
    downloads: {
      win32: [
        {
          url: 'https://github.com/PCSX2/pcsx2/releases/download/v2.6.3/pcsx2-v2.6.3-windows-x64-Qt.7z',
          format: '7z',
          executablePath: 'pcsx2-qt.exe',
        },
      ],
      darwin: [
        {
          url: 'https://github.com/PCSX2/pcsx2/releases/download/v2.6.3/pcsx2-v2.6.3-macos-Qt.tar.xz',
          format: 'tar.xz',
          executablePath: 'PCSX2.app/Contents/MacOS/PCSX2',
        },
      ],
      linux: [
        {
          url: 'https://github.com/PCSX2/pcsx2/releases/download/v2.6.3/pcsx2-v2.6.3-linux-appimage-x64-Qt.AppImage',
          format: 'appimage',
        },
      ],
    },
    packageNames: { linux: 'pcsx2' },
    supported: true,
    websiteUrl: {
      win32: 'https://pcsx2.net/downloads/',
      darwin: 'https://pcsx2.net/downloads/',
      linux: 'https://pcsx2.net/downloads/',
    },
  },
  {
    id: 'mame',
    name: 'MAME',
    description: 'Multi Arcade Machine Emulator',
    platforms: ['arcade'],
    defaultPath: {
      win32: 'C:\\Program Files\\MAME\\mame.exe',
      darwin: '/Applications/MAME.app/Contents/MacOS/mame',
      linux: '/usr/bin/mame',
    },
    downloads: {
      win32: [
        {
          url: 'https://github.com/mamedev/mame/releases/download/mame0288/mame0288b_x64.exe',
          format: 'exe',
          installerType: 'nsis',
          executablePath: 'mame64.exe',
        },
      ],
      linux: [
        {
          url: 'https://github.com/mamedev/mame/releases/download/mame0288/mame0288lx.zip',
          format: 'zip',
          executablePath: 'mame',
        },
      ],
    },
    packageNames: { linux: 'mame', darwin: 'mame' },
    supported: true,
    websiteUrl: {
      win32: 'https://www.mamedev.org/release.html',
      darwin: 'https://www.mamedev.org/release.html',
      linux: 'https://www.mamedev.org/release.html',
    },
  },
  {
    id: 'duckstation',
    name: 'DuckStation',
    description: 'PlayStation 1 emulator',
    platforms: ['ps1'],
    defaultPath: {
      win32: 'C:\\Program Files\\DuckStation\\duckstation-qt-x64-ReleaseLGL.normal.exe',
      darwin: '/Applications/DuckStation.app/Contents/MacOS/DuckStation',
      linux: '/usr/bin/duckstation-qt',
    },
    downloads: {
      win32: [
        {
          url: 'https://github.com/stenzek/duckstation/releases/download/latest/duckstation-windows-x64-release.zip',
          format: 'zip',
          executablePath: 'duckstation-qt-x64-ReleaseLGL.normal.exe',
          arch: 'x64',
        },
        {
          url: 'https://github.com/stenzek/duckstation/releases/download/latest/duckstation-windows-arm64-release.zip',
          format: 'zip',
          executablePath: 'duckstation-qt-arm64-ReleaseLGL.normal.exe',
          arch: 'arm64',
        },
      ],
      darwin: [
        {
          url: 'https://github.com/stenzek/duckstation/releases/download/latest/duckstation-mac-release.zip',
          format: 'zip',
          executablePath: 'DuckStation.app/Contents/MacOS/DuckStation',
        },
      ],
      linux: [
        {
          url: 'https://github.com/stenzek/duckstation/releases/download/latest/DuckStation-x64.AppImage',
          format: 'appimage',
          arch: 'x64',
        },
        {
          url: 'https://github.com/stenzek/duckstation/releases/download/latest/DuckStation-arm64.AppImage',
          format: 'appimage',
          arch: 'arm64',
        },
      ],
    },
    supported: true,
    websiteUrl: {
      win32: 'https://github.com/stenzek/duckstation/releases/latest',
      darwin: 'https://github.com/stenzek/duckstation/releases/latest',
      linux: 'https://github.com/stenzek/duckstation/releases/latest',
    },
  },
  {
    id: 'retroarch',
    name: 'RetroArch',
    description: 'Multi-system emulator frontend (NES, SNES, N64, GB, GBA, PS1, etc.)',
    platforms: [
      'nes', 'snes', 'n64', 'gb', 'gba', 'gbc',
      'ps1', 'pce', 'sega-md', 'sega-saturn', 'sega-dc',
      'dreamcast',
    ],
    defaultPath: {
      win32: 'C:\\Program Files\\RetroArch\\retroarch.exe',
      darwin: '/Applications/RetroArch.app/Contents/MacOS/RetroArch',
      linux: '/usr/bin/retroarch',
    },
    downloads: {
      win32: [
        {
          url: 'https://buildbot.libretro.com/stable/1.22.2/windows/x86_64/RetroArch.7z',
          format: '7z',
          executablePath: 'retroarch.exe',
        },
        {
          url: 'https://buildbot.libretro.com/stable/1.22.2/windows/x86_64/RetroArch_cores.7z',
          format: '7z',
        },
      ],
      darwin: [
        {
          url: 'https://buildbot.libretro.com/stable/1.22.2/apple/osx/universal/RetroArch_Metal.dmg',
          format: 'dmg',
          arch: 'arm64',
        },
        {
          url: 'https://buildbot.libretro.com/stable/1.22.2/apple/osx/x86_64/RetroArch.dmg',
          format: 'dmg',
          arch: 'x64',
        },
      ],
      linux: [
        {
          url: 'https://buildbot.libretro.com/stable/1.22.2/linux/x86_64/RetroArch.7z',
          format: '7z',
          executablePath: 'retroarch',
        },
        {
          url: 'https://buildbot.libretro.com/stable/1.22.2/linux/x86_64/RetroArch_cores.7z',
          format: '7z',
        },
      ],
    },
    packageNames: {
      linux: 'retroarch',
      darwin: 'retroarch',
    },
    supported: true,
    websiteUrl: {
      win32: 'https://retroarch.com/?page=platforms',
      darwin: 'https://retroarch.com/?page=platforms',
      linux: 'https://retroarch.com/?page=platforms',
    },
  },
  {
    id: 'ppsspp',
    name: 'PPSSPP',
    description: 'PlayStation Portable emulator',
    platforms: ['psp'],
    defaultPath: {
      win32: 'C:\\Program Files\\PPSSPP\\PPSSPP.exe',
      darwin: '/Applications/PPSSPP.app/Contents/MacOS/PPSSPP',
      linux: '/usr/bin/ppsspp',
    },
    downloads: {
      win32: [
        {
          url: 'https://github.com/hrydgard/ppsspp/releases/download/v1.20.4/ppsspp_win64_v1.20.4.7z',
          format: '7z',
          executablePath: 'PPSSPPWindows64.exe',
        },
      ],
      darwin: [
        {
          url: 'https://github.com/hrydgard/ppsspp/releases/download/v1.20.4/PPSSPPSDL-macOS-v1.20.4.zip',
          format: 'zip',
          executablePath: 'PPSSPPSDL.app/Contents/MacOS/PPSSPPSDL',
        },
      ],
      linux: [
        {
          url: 'https://github.com/hrydgard/ppsspp/releases/download/v1.20.4/PPSSPPSDL_Linux-x64_v1.20.4.AppImage',
          format: 'appimage',
        },
      ],
    },
    supported: true,
    websiteUrl: {
      win32: 'https://www.ppsspp.org/download/',
      darwin: 'https://www.ppsspp.org/download/',
      linux: 'https://www.ppsspp.org/download/',
    },
  },
  {
    id: 'melonds',
    name: 'melonDS',
    description: 'Nintendo DS emulator',
    platforms: ['nds'],
    defaultPath: {
      win32: 'C:\\Program Files\\melonDS\\melonDS.exe',
      darwin: '/Applications/melonDS.app/Contents/MacOS/melonDS',
      linux: '/usr/bin/melonds',
    },
    downloads: {
      win32: [
        {
          url: 'https://github.com/melonDS-emu/melonDS/releases/download/1.1/melonDS-1.1-win64.zip',
          format: 'zip',
          executablePath: 'melonDS.exe',
        },
      ],
      darwin: [
        {
          url: 'https://melonds.kuribo64.net/downloads/melonDS-1.1-macOS-universal.zip',
          format: 'zip',
          executablePath: 'melonDS.app/Contents/MacOS/melonDS',
        },
      ],
      linux: [
        {
          url: 'https://github.com/melonDS-emu/melonDS/releases/download/1.1/melonDS-1.1-appimage-x86_64.zip',
          format: 'zip',
          executablePath: 'melonDS-x86_64.AppImage',
        },
      ],
    },
    supported: true,
    websiteUrl: {
      win32: 'https://melonds.kuribo64.net/',
      darwin: 'https://melonds.kuribo64.net/',
      linux: 'https://melonds.kuribo64.net/',
    },
  },
  {
    id: 'flycast',
    name: 'Flycast',
    description: 'Sega Dreamcast, Naomi & Atomiswave emulator',
    platforms: ['dreamcast'],
    defaultPath: {
      win32: 'C:\\Program Files\\Flycast\\flycast.exe',
      darwin: '/Applications/Flycast.app/Contents/MacOS/Flycast',
      linux: '/usr/bin/flycast',
    },
    downloads: {
      win32: [
        {
          url: 'https://github.com/flyinghead/flycast/releases/download/v2.6/flycast-win64-2.6.zip',
          format: 'zip',
          executablePath: 'flycast-win64.exe',
        },
      ],
      darwin: [
        {
          url: 'https://github.com/flyinghead/flycast/releases/download/v2.6/flycast-macOS-2.6.zip',
          format: 'zip',
          executablePath: 'Flycast.app/Contents/MacOS/Flycast',
        },
      ],
      linux: [
        {
          url: 'https://github.com/flyinghead/flycast/releases/download/v2.6/flycast-x86_64.AppImage',
          format: 'appimage',
        },
      ],
    },
    supported: true,
    websiteUrl: {
      win32: 'https://github.com/flyinghead/flycast/releases',
      darwin: 'https://github.com/flyinghead/flycast/releases',
      linux: 'https://github.com/flyinghead/flycast/releases',
    },
  },
  {
    id: 'esde',
    name: 'ES-DE',
    description: 'EmulationStation Desktop Edition — multi-system frontend & game launcher',
    platforms: [
      'nes', 'snes', 'n64', 'gb', 'gbc', 'gba', 'nds',
      'ps1', 'ps2', 'ps3', 'psp', 'gc', 'wii', 'switch',
      'arcade', 'dreamcast', 'sega-md', 'sega-saturn', 'sega-dc', 'pce',
    ],
    defaultPath: {
      win32: 'C:\\Program Files\\ES-DE\\esde.exe',
      darwin: '/Applications/ES-DE.app/Contents/MacOS/esde',
      linux: '/usr/bin/es-de',
    },
    downloads: {
      win32: [
        {
          url: 'https://gitlab.com/es-de/emulationstation-de/-/package_files/288156889/download',
          format: 'exe',
          installerType: 'nsis',
          executablePath: 'esde.exe',
        },
      ],
      darwin: [
        {
          url: 'https://gitlab.com/es-de/emulationstation-de/-/package_files/288889626/download',
          format: 'dmg',
          arch: 'arm64',
        },
        {
          url: 'https://gitlab.com/es-de/emulationstation-de/-/package_files/288889701/download',
          format: 'dmg',
          arch: 'x64',
        },
      ],
      linux: [
        {
          url: 'https://gitlab.com/es-de/emulationstation-de/-/package_files/288156961/download',
          format: 'appimage',
          arch: 'x64',
        },
        {
          url: 'https://gitlab.com/es-de/emulationstation-de/-/package_files/288156935/download',
          format: 'appimage',
          arch: 'arm64',
        },
      ],
    },
    supported: true,
    websiteUrl: {
      win32: 'https://es-de.org/download/',
      darwin: 'https://es-de.org/download/',
      linux: 'https://es-de.org/download/',
    },
  },
  {
    id: 'neostation',
    name: 'NeoStation',
    description: 'Modern multi-platform emulation frontend — auto-discovers emulators and ROMs',
    platforms: [
      'nes', 'snes', 'n64', 'gb', 'gbc', 'gba', 'nds',
      'ps1', 'ps2', 'ps3', 'psp', 'gc', 'wii', 'switch',
      'arcade', 'dreamcast', 'sega-md', 'sega-saturn', 'sega-dc', 'pce',
    ],
    defaultPath: {
      win32: 'C:\\Program Files\\NeoStation\\neostation.exe',
      darwin: '/Applications/NeoStation.app/Contents/MacOS/neostation',
      linux: '/usr/bin/neostation',
    },
    downloads: {
      win32: [
        {
          url: 'https://github.com/misobadev/neostation-frontend/releases/download/v0.9.3%2B114/neostation-windows-x64-0.9.3+114.zip',
          format: 'zip',
          executablePath: 'neostation.exe',
        },
      ],
      darwin: [
        {
          url: 'https://github.com/misobadev/neostation-frontend/releases/download/v0.9.3%2B114/neostation-macos-universal-0.9.3+114.dmg',
          format: 'dmg',
        },
      ],
      linux: [
        {
          url: 'https://github.com/misobadev/neostation-frontend/releases/download/v0.9.3%2B114/neostation-linux-x86_64-0.9.3+114.AppImage',
          format: 'appimage',
        },
      ],
    },
    supported: true,
    websiteUrl: {
      win32: 'https://neostation.dev/downloads/',
      darwin: 'https://neostation.dev/downloads/',
      linux: 'https://neostation.dev/downloads/',
    },
  },
  {
    id: 'emubuddy',
    name: 'EmuBuddy',
    description: 'Cross-platform emulation frontend — one-click setup, game downloading, controller support',
    platforms: [
      'nes', 'snes', 'n64', 'gb', 'gbc', 'gba', 'nds',
      'ps1', 'ps2', 'psp', 'gc', 'wii', 'dreamcast', 'sega-saturn',
    ],
    defaultPath: {
      win32: 'C:\\Program Files\\EmuBuddy\\EmuBuddyLauncher.exe',
      darwin: '/Applications/EmuBuddy.app/Contents/MacOS/EmuBuddy',
      linux: '/usr/bin/emubuddy',
    },
    downloads: {
      win32: [
        {
          url: 'https://github.com/computerex/EmuBuddy/releases/download/1.0.0/EmuBuddy-Windows-v1.0.0.zip',
          format: 'zip',
          executablePath: 'EmuBuddyLauncher.exe',
        },
      ],
      darwin: [
        {
          url: 'https://github.com/computerex/EmuBuddy/releases/download/1.0.0/EmuBuddy-macOS-v1.0.0.zip',
          format: 'zip',
        },
      ],
      linux: [
        {
          url: 'https://github.com/computerex/EmuBuddy/releases/download/1.0.0/EmuBuddy-Linux-v1.0.0.zip',
          format: 'zip',
        },
      ],
    },
    supported: true,
    websiteUrl: {
      win32: 'https://github.com/computerex/EmuBuddy',
      darwin: 'https://github.com/computerex/EmuBuddy',
      linux: 'https://github.com/computerex/EmuBuddy',
    },
  },
  {
    id: 'pegasus',
    name: 'Pegasus Frontend',
    description: 'Cross-platform customizable game launcher with theme support',
    platforms: [
      'nes', 'snes', 'n64', 'gb', 'gbc', 'gba', 'nds',
      'ps1', 'ps2', 'ps3', 'psp', 'gc', 'wii', 'switch',
      'arcade', 'dreamcast', 'sega-md', 'sega-saturn', 'sega-dc', 'pce',
    ],
    defaultPath: {
      win32: 'C:\\Program Files\\Pegasus\\pegasus-fe.exe',
      darwin: '/Applications/Pegasus.app/Contents/MacOS/pegasus-fe',
      linux: '/usr/bin/pegasus-fe',
    },
    downloads: {
      win32: [
        {
          url: 'https://github.com/mmatyas/pegasus-frontend/releases/download/weekly_2024w38/pegasus-fe_alpha16-82-gc3462e68_win-mingw-static.zip',
          format: 'zip',
          executablePath: 'pegasus-fe.exe',
        },
      ],
      darwin: [
        {
          url: 'https://github.com/mmatyas/pegasus-frontend/releases/download/weekly_2024w38/pegasus-fe_alpha16-82-gc3462e68_macos-static.zip',
          format: 'zip',
        },
      ],
      linux: [
        {
          url: 'https://github.com/mmatyas/pegasus-frontend/releases/download/weekly_2024w38/pegasus-fe_alpha16-82-gc3462e68_x11-static.zip',
          format: 'zip',
        },
      ],
    },
    supported: true,
    websiteUrl: {
      win32: 'https://pegasus-frontend.org/download/',
      darwin: 'https://pegasus-frontend.org/download/',
      linux: 'https://pegasus-frontend.org/download/',
    },
  },
  {
    id: 'cemu',
    name: 'Cemu',
    description: 'Wii U emulator',
    platforms: ['wiiu'],
    defaultPath: {
      win32: 'C:\\Program Files\\Cemu\\Cemu.exe',
      darwin: '/Applications/Cemu.app/Contents/MacOS/Cemu',
      linux: '/usr/bin/cemu',
    },
    downloads: {
      win32: [
        {
          url: 'https://github.com/cemu-project/Cemu/releases/download/v2.6/cemu-2.6-windows-x64.zip',
          format: 'zip',
          executablePath: 'Cemu.exe',
        },
      ],
      darwin: [
        {
          url: 'https://github.com/cemu-project/Cemu/releases/download/v2.6/cemu-2.6-macos-12-x64.dmg',
          format: 'dmg',
        },
      ],
      linux: [
        {
          url: 'https://github.com/cemu-project/Cemu/releases/download/v2.6/Cemu-2.6-x86_64.AppImage',
          format: 'appimage',
        },
      ],
    },
    supported: true,
    websiteUrl: {
      win32: 'https://cemu-project.github.io/',
      darwin: 'https://cemu-project.github.io/',
      linux: 'https://cemu-project.github.io/',
    },
  },
  {
    id: 'xemu',
    name: 'xemu',
    description: 'Original Xbox emulator',
    platforms: ['xbox'],
    defaultPath: {
      win32: 'C:\\Program Files\\xemu\\xemu.exe',
      darwin: '/Applications/xemu.app/Contents/MacOS/xemu',
      linux: '/usr/bin/xemu',
    },
    downloads: {
      win32: [
        {
          url: 'https://github.com/xemu-project/xemu/releases/download/v0.8.136/xemu-0.8.136-windows-x86_64.zip',
          format: 'zip',
          executablePath: 'xemu.exe',
        },
      ],
      darwin: [
        {
          url: 'https://github.com/xemu-project/xemu/releases/download/v0.8.136/xemu-0.8.136-macos-universal.zip',
          format: 'zip',
        },
      ],
      linux: [
        {
          url: 'https://github.com/xemu-project/xemu/releases/download/v0.8.136/xemu-0.8.136-x86_64.AppImage',
          format: 'appimage',
        },
      ],
    },
    supported: true,
    websiteUrl: {
      win32: 'https://xemu.app/',
      darwin: 'https://xemu.app/',
      linux: 'https://xemu.app/',
    },
  },
  {
    id: 'vita3k',
    name: 'Vita3K',
    description: 'PlayStation Vita emulator',
    platforms: ['psvita'],
    defaultPath: {
      win32: 'C:\\Program Files\\Vita3K\\Vita3K.exe',
      darwin: '/Applications/Vita3K.app/Contents/MacOS/Vita3K',
      linux: '/usr/bin/vita3k',
    },
    downloads: {
      win32: [
        {
          url: 'https://github.com/Vita3K/Vita3K/releases/download/continuous/windows-latest.zip',
          format: 'zip',
          executablePath: 'Vita3K.exe',
        },
      ],
      darwin: [
        {
          url: 'https://github.com/Vita3K/Vita3K/releases/download/continuous/macos-arm64-latest.dmg',
          format: 'dmg',
          arch: 'arm64',
        },
        {
          url: 'https://github.com/Vita3K/Vita3K/releases/download/continuous/macos-latest.dmg',
          format: 'dmg',
          arch: 'x64',
        },
      ],
      linux: [
        {
          url: 'https://github.com/Vita3K/Vita3K/releases/download/continuous/Vita3K-x86_64.AppImage',
          format: 'appimage',
        },
      ],
    },
    supported: true,
    websiteUrl: {
      win32: 'https://vita3k.org/',
      darwin: 'https://vita3k.org/',
      linux: 'https://vita3k.org/',
    },
  },
  {
    id: 'azahar',
    name: 'Azahar',
    description: 'Nintendo 3DS emulator (formerly Lime3DS)',
    platforms: ['3ds'],
    defaultPath: {
      win32: 'C:\\Program Files\\Azahar\\azahar.exe',
      darwin: '/Applications/Azahar.app/Contents/MacOS/azahar',
      linux: '/usr/bin/azahar',
    },
    downloads: {
      win32: [
        {
          url: 'https://github.com/azahar-emu/azahar/releases/download/2125.1.3/azahar-windows-msys2-2125.1.3.zip',
          format: 'zip',
          executablePath: 'azahar.exe',
        },
      ],
      darwin: [
        {
          url: 'https://github.com/azahar-emu/azahar/releases/download/2125.1.3/azahar-macos-universal-2125.1.3.zip',
          format: 'zip',
        },
      ],
      linux: [
        {
          url: 'https://github.com/azahar-emu/azahar/releases/download/2125.1.3/azahar.AppImage',
          format: 'appimage',
        },
      ],
    },
    supported: true,
    websiteUrl: {
      win32: 'https://azahar-emu.org/',
      darwin: 'https://azahar-emu.org/',
      linux: 'https://azahar-emu.org/',
    },
  },
];

export function findEmulator(id: string): EmulatorConfig | undefined {
  return knownEmulators.find((e) => e.id === id);
}

function detectEmulatorPath(config: EmulatorConfig): string | undefined {
  const path = config.defaultPath[platform];
  if (path && existsSync(path)) return path;

  const alternatives = alternativePaths(config.id);
  for (const alt of alternatives) {
    if (existsSync(alt)) return alt;
  }

  try {
    const cmd = isWindows() ? 'where' : 'which';
    const result = execSync(`${cmd} ${config.id} 2>${isWindows() ? 'nul' : '/dev/null'}`)
      .toString().trim();
    if (result) return result.split('\n')[0];
  } catch {
    // not found
  }

  return undefined;
}

function alternativePaths(emulatorId: string): string[] {
  const home = homedir();
  const userData = app.getPath('userData');
  const omniEmuDir = join(userData, 'emulators', emulatorId);

  // Check marker file first (written after a successful install)
  const markerFile = join(omniEmuDir, '.installed');
  try {
    const markerPath = readFileSync(markerFile, 'utf-8').trim();
    if (markerPath && existsSync(markerPath)) return [markerPath];
  } catch { /* no marker */ }

  const common: Record<string, string[]> = {
    dolphin: [
      join(omniEmuDir, 'Dolphin.exe'),
      join(omniEmuDir, 'Dolphin'),
      join(omniEmuDir, 'dolphin-emu'),
      join(home, 'Applications', 'Dolphin.app', 'Contents', 'MacOS', 'Dolphin'),
      '/usr/local/bin/dolphin-emu',
      '/snap/bin/dolphin-emu',
    ],
    retroarch: [
      join(omniEmuDir, 'RetroArch.exe'),
      join(omniEmuDir, 'RetroArch'),
      join(omniEmuDir, 'retroarch'),
      join(home, 'Applications', 'RetroArch.app', 'Contents', 'MacOS', 'RetroArch'),
      '/usr/local/bin/retroarch',
      '/snap/bin/retroarch',
    ],
    rpcs3: [
      join(omniEmuDir, 'rpcs3.exe'),
      join(omniEmuDir, 'rpcs3'),
      join(omniEmuDir, 'RPCS3.AppImage'),
    ],
    eden: [
      join(omniEmuDir, 'Eden.exe'),
      join(omniEmuDir, 'Eden'),
      join(home, 'Applications', 'Eden.app', 'Contents', 'MacOS', 'Eden'),
      '/usr/local/bin/eden',
    ],
    duckstation: [
      join(omniEmuDir, 'duckstation-qt-x64-ReleaseLGL.normal.exe'),
      join(omniEmuDir, 'DuckStation'),
      join(omniEmuDir, 'DuckStation.app', 'Contents', 'MacOS', 'DuckStation'),
      join(home, 'Applications', 'DuckStation.app', 'Contents', 'MacOS', 'DuckStation'),
      '/usr/local/bin/duckstation-qt',
    ],
    pcsx2: [
      join(omniEmuDir, 'pcsx2.exe'),
      join(omniEmuDir, 'PCSX2'),
      join(omniEmuDir, 'pcsx2.AppImage'),
    ],
    mame: [
      join(omniEmuDir, 'mame64.exe'),
      join(omniEmuDir, 'mame'),
      join(omniEmuDir, 'MAME.AppImage'),
    ],
    flycast: [
      join(omniEmuDir, 'flycast-win64.exe'),
      join(omniEmuDir, 'flycast'),
      join(omniEmuDir, 'Flycast.app', 'Contents', 'MacOS', 'Flycast'),
      join(home, 'Applications', 'Flycast.app', 'Contents', 'MacOS', 'Flycast'),
      '/usr/local/bin/flycast',
    ],
    esde: [
      join(omniEmuDir, 'esde.exe'),
      join(omniEmuDir, 'ES-DE', 'esde.exe'),
      join(omniEmuDir, 'es-de'),
      join(omniEmuDir, 'ES-DE.app', 'Contents', 'MacOS', 'esde'),
      join(home, 'Applications', 'ES-DE.app', 'Contents', 'MacOS', 'esde'),
      '/usr/local/bin/es-de',
      '/usr/bin/es-de',
    ],
    neostation: [
      join(omniEmuDir, 'neostation.exe'),
      join(omniEmuDir, 'NeoStation', 'neostation.exe'),
      join(omniEmuDir, 'neostation'),
      join(omniEmuDir, 'NeoStation.app', 'Contents', 'MacOS', 'neostation'),
      join(home, 'Applications', 'NeoStation.app', 'Contents', 'MacOS', 'neostation'),
      '/usr/local/bin/neostation',
      '/usr/bin/neostation',
    ],
    emubuddy: [
      join(omniEmuDir, 'EmuBuddyLauncher.exe'),
      join(omniEmuDir, 'EmuBuddy', 'EmuBuddyLauncher.exe'),
      join(omniEmuDir, 'EmuBuddyLauncher'),
      join(omniEmuDir, 'EmuBuddy.app', 'Contents', 'MacOS', 'EmuBuddy'),
      join(home, 'Applications', 'EmuBuddy.app', 'Contents', 'MacOS', 'EmuBuddy'),
      '/usr/local/bin/emubuddy',
      '/usr/bin/emubuddy',
    ],
    pegasus: [
      join(omniEmuDir, 'pegasus-fe.exe'),
      join(omniEmuDir, 'pegasus-fe'),
      join(omniEmuDir, 'Pegasus.app', 'Contents', 'MacOS', 'pegasus-fe'),
      join(home, 'Applications', 'Pegasus.app', 'Contents', 'MacOS', 'pegasus-fe'),
      '/usr/local/bin/pegasus-fe',
      '/usr/bin/pegasus-fe',
    ],
    melonds: [
      join(omniEmuDir, 'melonDS.exe'),
      join(omniEmuDir, 'melonDS'),
      join(omniEmuDir, 'melonDS.app', 'Contents', 'MacOS', 'melonDS'),
      join(home, 'Applications', 'melonDS.app', 'Contents', 'MacOS', 'melonDS'),
    ],
    cemu: [
      join(omniEmuDir, 'Cemu.exe'),
      join(omniEmuDir, 'Cemu'),
      join(omniEmuDir, 'Cemu.app', 'Contents', 'MacOS', 'Cemu'),
      join(home, 'Applications', 'Cemu.app', 'Contents', 'MacOS', 'Cemu'),
      '/usr/local/bin/cemu',
    ],
    xemu: [
      join(omniEmuDir, 'xemu.exe'),
      join(omniEmuDir, 'xemu'),
      join(omniEmuDir, 'xemu.app', 'Contents', 'MacOS', 'xemu'),
      join(home, 'Applications', 'xemu.app', 'Contents', 'MacOS', 'xemu'),
      '/usr/bin/xemu',
    ],
    vita3k: [
      join(omniEmuDir, 'Vita3K.exe'),
      join(omniEmuDir, 'Vita3K'),
      join(omniEmuDir, 'Vita3K.app', 'Contents', 'MacOS', 'Vita3K'),
      join(home, 'Applications', 'Vita3K.app', 'Contents', 'MacOS', 'Vita3K'),
      '/usr/bin/vita3k',
    ],
    azahar: [
      join(omniEmuDir, 'azahar.exe'),
      join(omniEmuDir, 'azahar'),
      join(omniEmuDir, 'Azahar.app', 'Contents', 'MacOS', 'azahar'),
      join(home, 'Applications', 'Azahar.app', 'Contents', 'MacOS', 'azahar'),
      '/usr/bin/azahar',
    ],
  };
  return common[emulatorId] || [join(omniEmuDir)];
}

function detectVersion(binaryPath: string): string | undefined {
  if (isMacOS() && binaryPath.includes('.app/Contents/MacOS/')) {
    const plist = join(binaryPath, '..', '..', '..', 'Info.plist');
    if (existsSync(plist)) {
      try {
        const out = execSync(
          `/usr/libexec/PlistBuddy -c "Print CFBundleShortVersionString" "${plist}" 2>/dev/null || true`,
          { timeout: 3000 }
        ).toString().trim();
        if (out) return out;
      } catch { /* ignore */ }
    }
  }

  if (isWindows()) {
    try {
      const out = execSync(
        `powershell -NoProfile -Command "(Get-Item '${binaryPath}').VersionInfo.ProductVersion" 2>nul`
      ).toString().trim();
      if (out) return out;
    } catch { /* ignore */ }
  }

  return undefined;
}

export function checkEmulator(id: string): EmulatorState {
  const config = findEmulator(id);
  if (!config) {
    return {
      installed: false,
      configured: false,
      config: {
        id,
        name: id,
        description: '',
        platforms: [],
        defaultPath: { win32: '', darwin: '', linux: '' },
        downloads: {},
        supported: false,
      },
    };
  }

  const path = detectEmulatorPath(config);
  const version = path ? detectVersion(path) : undefined;

  const hasDownload = config.downloads[platform] && config.downloads[platform]!.length > 0;
  const hasPackage = !!config.packageNames?.[platform];
  const configClone = { ...config, supported: hasDownload || hasPackage };

  return {
    installed: !!path,
    version,
    path,
    config: configClone,
    configured: !!path && existsSync(join(app.getPath('userData'), 'configs', `${id}.configured`)),
  };
}

export function getAllEmulatorStates(): EmulatorState[] {
  const s = settings.get();
  const beta = !!s.betaFeatures;
  return knownEmulators
    .filter(e => (e.id === 'esde' || e.id === 'neostation' || e.id === 'pegasus') ? beta : true)
    .map((e) => checkEmulator(e.id));
}

export function launchEmulator(emulatorId: string): boolean {
  const state = checkEmulator(emulatorId);
  if (!state.installed || !state.path) return false;

  const child = exec(`"${state.path}"`, { cwd: dirname(state.path) });
  if (child) child.unref();

  return true;
}

export function launchGame(emulatorId: string, romPath: string): ChildProcess | null {
  const state = checkEmulator(emulatorId);
  if (!state.installed || !state.path) return null;

  const emu = findEmulator(emulatorId);
  if (!emu) return null;

  const args = launchArgs(emulatorId, romPath);
  const cmd = `"${state.path}" ${args}`;

  const proc = exec(cmd, {
    cwd: dirname(state.path),
  });

  return proc;
}

function findRetroArchCore(romPath: string): string | undefined {
  const ext = extname(romPath).toLowerCase().replace(/^\./, '');
  const corePreference: Record<string, string[]> = {
    'nes': ['nestopia', 'mesen', 'fceumm'],
    'smc': ['snes9x', 'bsnes_hd', 'bsnes', 'mednafen_snes'],
    'sfc': ['snes9x', 'bsnes_hd', 'bsnes', 'mednafen_snes'],
    'swc': ['snes9x', 'bsnes'],
    'n64': ['mupen64plus_next', 'parallel_n64'],
    'z64': ['mupen64plus_next', 'parallel_n64'],
    'v64': ['mupen64plus_next', 'parallel_n64'],
    'gba': ['mgba', 'vba_next', 'gpsp'],
    'gb': ['mgba', 'gambatte', 'sameboy', 'gearboy'],
    'gbc': ['mgba', 'gambatte', 'sameboy', 'gearboy'],
    'nds': ['melonds', 'desmume'],
    'bin': ['mednafen_psx_hw', 'pcsx_rearmed', 'swanstation'],
    'cue': ['mednafen_psx_hw', 'pcsx_rearmed', 'swanstation'],
    'iso': ['mednafen_psx_hw', 'pcsx_rearmed', 'swanstation'],
    'pce': ['mednafen_pce_fast', 'mednafen_pce'],
    'md': ['genesis_plus_gx', 'picodrive'],
    'smd': ['genesis_plus_gx', 'picodrive'],
  };
  const candidates = corePreference[ext];
  if (!candidates) return undefined;

  const home = homedir();
  const userData = app.getPath('userData');
  const coreDirs = [
    join(userData, 'emulators', 'retroarch', 'RetroArch.app', 'Contents', 'Resources', 'cores'),
    join(userData, 'emulators', 'retroarch', 'cores'),
    join(home, 'Library', 'Application Support', 'RetroArch', 'cores'),
    '/usr/local/lib/retroarch/cores',
    '/usr/lib/x86_64-linux-gnu/libretro',
  ];
  if (isWindows()) {
    coreDirs.unshift(join(process.env.APPDATA || '', 'RetroArch', 'cores'));
  }

  for (const dir of coreDirs) {
    if (!existsSync(dir)) continue;
    let coreFiles: string[];
    try { coreFiles = readdirSync(dir); } catch { continue; }
    for (const preferred of candidates) {
      const match = coreFiles.find(f => f.toLowerCase().includes(preferred));
      if (match) return join(dir, match);
    }
  }
  return undefined;
}

function launchArgs(emulatorId: string, romPath: string): string {
  switch (emulatorId) {
    case 'dolphin':
      return `--exec="${romPath}"`;
    case 'rpcs3':
      return `"${romPath}"`;
    case 'eden':
      return `"${romPath}"`;
    case 'pcsx2':
      return `"${romPath}"`;
    case 'mame':
      return `"${romPath}"`;
    case 'retroarch': {
      const core = findRetroArchCore(romPath);
      if (core) return `-L "${core}" "${romPath}"`;
      return `"${romPath}"`;
    }
    case 'duckstation':
      return `"${romPath}"`;
    case 'flycast':
      return `"${romPath}"`;
    case 'esde':
      return '';
    case 'neostation':
      return '';
    case 'emubuddy':
      return '';
    case 'pegasus':
      return '';
    default:
      return `"${romPath}"`;
  }
}

const defaultRomsDir = () => join(require('os').homedir(), 'Documents', 'roms');

const romsSubdirs = [
  'nes', 'snes', 'n64', 'gb', 'gbc', 'gba', 'nds', '3ds',
  'ps1', 'ps2', 'ps3', 'psp', 'psvita', 'gc', 'wii', 'wiiu', 'switch',
  'arcade', 'pce', 'sega-md', 'sega-saturn', 'sega-dc', 'dreamcast',
  'xbox', 'other',
];

export function ensureRomsStructure(romsDir?: string): void {
  const dir = romsDir || settings.get().romsDirectory || defaultRomsDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  for (const sub of romsSubdirs) {
    const subDir = join(dir, sub);
    if (!existsSync(subDir)) mkdirSync(subDir, { recursive: true });
  }
}

export function getRomsDirectory(): string {
  const s = settings.get();
  if (s.romsDirectory && existsSync(s.romsDirectory)) {
    ensureRomsStructure(s.romsDirectory);
    return s.romsDirectory;
  }

  const dir = defaultRomsDir();
  ensureRomsStructure(dir);
  return dir;
}

export function getEmulatorsDirectory(): string {
  const s = settings.get();
  if (s.emulatorsDirectory && existsSync(s.emulatorsDirectory)) return s.emulatorsDirectory;

  const dir = join(app.getPath('userData'), 'emulators');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export function scanRoms(directory: string): GameEntry[] {
  ensureRomsStructure(directory);
  const romExtensions = [
    '.nes', '.sfc', '.smc', '.n64', '.z64', '.v64',
    '.gba', '.gb', '.gbc', '.nds', '.iso', '.bin', '.cue',
    '.wbfs', '.wad', '.nsp', '.xci', '.pkg', '.chd',
    '.gcm', '.gcz', '.rvz', '.m3u', '.ps2', '.cso',
    '.rom', '.zip', '.7z', '.gdi', '.pbp', '.cdi',
    '.rpx', '.rpl', '.xbe', '.vpk', '.3ds', '.3dsx', '.cia', '.cxi',
  ];

  const entries: GameEntry[] = [];
  const emuPrefs = settings.get().systemEmulators ?? {};

  function scanDir(dir: string) {
    try {
      const files = readdirSync(dir);
      for (const file of files) {
        const fullPath = join(dir, file);
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          if (file.toLowerCase() === 'bios') continue;
          scanDir(fullPath);
        } else {
          const ext = extname(file).toLowerCase();
          if (romExtensions.includes(ext)) {
            const platform = guessPlatform(ext, dir);
            const dirName = basename(dir).toLowerCase();
            const inCorrectDir = romsSubdirs.includes(dirName) && (dirHints[dirName] === platform || dirName === platform);

            let finalPath = fullPath;
            if (!inCorrectDir) {
              const targetDir = join(directory, platform);
              if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true });
              const targetPath = join(targetDir, file);
              try {
                renameSync(fullPath, targetPath);
                finalPath = targetPath;
              } catch { /* skip if move fails */ }
            }

            entries.push({
              id: finalPath,
              romPath: finalPath,
              title: basename(file, ext),
              platform,
              emulatorId: emuPrefs[platform] ?? guessEmulator(ext, platform),
              playCount: 0,
              addedAt: new Date().toISOString(),
            });
          }
        }
      }
    } catch { /* skip unreadable */ }
  }

  scanDir(directory);
  return applyCachedCovers(entries);
}

const dirHints: Record<string, string> = {
  psp: 'psp', ppsspp: 'psp',
  dreamcast: 'dreamcast', dc: 'dreamcast',
  saturn: 'sega-saturn', 'sega-saturn': 'sega-saturn', 'sega saturn': 'sega-saturn',
  ps1: 'ps1', psx: 'ps1', playstation: 'ps1', 'playstation 1': 'ps1',
  ps2: 'ps2', 'playstation 2': 'ps2',
  ps3: 'ps3', 'playstation 3': 'ps3',
  gc: 'gc', gamecube: 'gc', 'game cube': 'gc',
  wii: 'wii',
  switch: 'switch', nsw: 'switch',
  nes: 'nes', famicom: 'nes',
  snes: 'snes', 'super nintendo': 'snes', superfamicom: 'snes', sfc: 'snes',
  n64: 'n64', 'nintendo 64': 'n64',
  gba: 'gba', 'game boy advance': 'gba',
  gb: 'gb', 'game boy': 'gb',
  gbc: 'gbc', 'game boy color': 'gbc',
  nds: 'nds', ds: 'nds', 'nintendo ds': 'nds',
  arcade: 'arcade', mame: 'arcade',
  'sega-md': 'sega-md', 'sega genesis': 'sega-md', genesis: 'sega-md', megadrive: 'sega-md', 'mega drive': 'sega-md',
  'sega-dc': 'dreamcast',
  wiiu: 'wiiu', 'wii u': 'wiiu',
  xbox: 'xbox', 'original xbox': 'xbox',
  psvita: 'psvita', vita: 'psvita', 'ps vita': 'psvita',
  '3ds': '3ds', 'nintendo 3ds': '3ds',
};

function guessPlatform(ext: string, dirPath?: string): string {
  if (dirPath) {
    const dirName = basename(dirPath).toLowerCase().replace(/[^a-z0-9\s-]/g, '');
    const hint = dirHints[dirName];
    if (hint) return hint;
  }

  const map: Record<string, string> = {
    '.nes': 'nes', '.sfc': 'snes', '.smc': 'snes',
    '.n64': 'n64', '.z64': 'n64', '.v64': 'n64',
    '.gba': 'gba', '.gb': 'gb', '.gbc': 'gbc', '.nds': 'nds',
    '.iso': 'ps1', '.bin': 'ps1', '.cue': 'ps1', '.chd': 'ps1',
    '.wbfs': 'wii', '.wad': 'wii',
    '.nsp': 'switch', '.xci': 'switch',
    '.pkg': 'ps3',
    '.gcm': 'gc', '.gcz': 'gc', '.rvz': 'gc',
    '.ps2': 'ps2', '.cso': 'ps2',
    '.gdi': 'dreamcast',
    '.cdi': 'dreamcast',
    '.pbp': 'psp',
    '.rpx': 'wiiu', '.rpl': 'wiiu',
    '.xbe': 'xbox',
    '.vpk': 'psvita',
    '.3ds': '3ds', '.3dsx': '3ds', '.cia': '3ds', '.cxi': '3ds',
  };
  return map[ext] || 'other';
}

export function uninstallEmulator(id: string): boolean {
  const userData = app.getPath('userData');
  const installDir = join(userData, 'emulators', id);
  const configMarker = join(userData, 'configs', `${id}.configured`);
  let removed = false;

  if (existsSync(installDir)) {
    rmSync(installDir, { recursive: true, force: true });
    removed = true;
  }
  if (existsSync(configMarker)) {
    rmSync(configMarker, { force: true });
  }

  return removed;
}

function guessEmulator(ext: string, platform?: string): string {
  if (platform) {
    const platformMap: Record<string, string> = {
      psp: 'ppsspp',
      'sega-saturn': 'retroarch',
      'sega-dc': 'retroarch',
      'sega-md': 'retroarch',
      pce: 'retroarch',
      nes: 'retroarch', snes: 'retroarch', n64: 'retroarch',
      gb: 'retroarch', gbc: 'retroarch', gba: 'retroarch',
      nds: 'melonds',
      dreamcast: 'flycast',
      gc: 'dolphin', wii: 'dolphin',
      wiiu: 'cemu',
      xbox: 'xemu',
      psvita: 'vita3k',
      '3ds': 'azahar',
      ps2: 'pcsx2',
      ps3: 'rpcs3',
      ps1: 'duckstation',
      switch: 'eden',
      arcade: 'mame',
    };
    const mapped = platformMap[platform];
    if (mapped) return mapped;
  }

  const map: Record<string, string> = {
    '.nes': 'retroarch', '.sfc': 'retroarch', '.smc': 'retroarch',
    '.n64': 'retroarch', '.z64': 'retroarch', '.v64': 'retroarch',
    '.gba': 'retroarch', '.gb': 'retroarch', '.gbc': 'retroarch',
    '.wbfs': 'dolphin', '.wad': 'dolphin', '.gcm': 'dolphin',
    '.gcz': 'dolphin', '.rvz': 'dolphin',
    '.nsp': 'eden', '.xci': 'eden', '.nca': 'eden',
    '.pkg': 'rpcs3',
    '.bin': 'duckstation', '.cue': 'duckstation', '.iso': 'duckstation',
    '.img': 'duckstation', '.m3u': 'duckstation',
    '.chd': 'duckstation', '.ecm': 'duckstation', '.mds': 'duckstation',
    '.ps2': 'pcsx2', '.cso': 'pcsx2',
    '.gdi': 'flycast',
    '.cdi': 'flycast',
    '.pbp': 'ppsspp',
    '.rpx': 'cemu', '.rpl': 'cemu',
    '.xbe': 'xemu',
    '.vpk': 'vita3k',
    '.3ds': 'azahar', '.3dsx': 'azahar', '.cia': 'azahar', '.cxi': 'azahar',
  };
  return map[ext] || 'retroarch';
}

export function getSystemEmulators(): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const emu of knownEmulators) {
    for (const sys of emu.platforms) {
      if (!map[sys]) map[sys] = [];
      map[sys].push(emu.id);
    }
  }
  return map;
}
