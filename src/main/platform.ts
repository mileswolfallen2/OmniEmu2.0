import { app } from 'electron';
import { arch as osArch, platform as osPlatform, homedir } from 'os';
import { Platform, Arch, SystemInfo } from '../shared/types';

export function getPlatform(): Platform {
  const p = osPlatform();
  if (p === 'win32' || p === 'darwin' || p === 'linux') return p;
  return 'linux';
}

export function getArch(): Arch {
  const a = osArch();
  if (a === 'arm64') return 'arm64';
  return 'x64';
}

export function getSystemInfo(): SystemInfo {
  return {
    platform: getPlatform(),
    arch: getArch(),
    homeDir: homedir(),
    appDataDir: app.getPath('userData'),
  };
}

export function isWindows(): boolean {
  return getPlatform() === 'win32';
}

export function isMacOS(): boolean {
  return getPlatform() === 'darwin';
}

export function isLinux(): boolean {
  return getPlatform() === 'linux';
}

export function platformName(): string {
  const map: Record<Platform, string> = {
    win32: 'Windows',
    darwin: 'macOS',
    linux: 'Linux',
  };
  return map[getPlatform()];
}
