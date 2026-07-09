import { createWriteStream, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, basename, extname, dirname } from 'path';
import { get as httpsGet, RequestOptions } from 'https';
import { get as httpGet } from 'http';
import { execSync } from 'child_process';
import { pipeline } from 'stream/promises';
import { randomBytes } from 'crypto';
import { app } from 'electron';
import { EmulatorDownload, InstallProgress, Platform, Arch } from '../shared/types';
import { getPlatform, getArch, isWindows, isMacOS, isLinux } from './platform';

type ProgressCallback = (progress: InstallProgress) => void;

function downloadDir(): string {
  const d = join(app.getPath('userData'), 'downloads');
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
  return d;
}

function tempName(suffix: string): string {
  return join(downloadDir(), `${randomBytes(8).toString('hex')}${suffix}`);
}

function downloadFile(url: string, dest: string, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const doRequest = (currentUrl: string) => {
      const protocol = currentUrl.startsWith('https') ? httpsGet : httpGet;
      const opts: RequestOptions = {
        headers: { 'User-Agent': 'OmniEmu/0.1.0' },
        timeout: 30000,
      };
      protocol(currentUrl, opts, (response) => {
        const code = response.statusCode ?? 500;
        if (code >= 300 && code < 400 && response.headers.location) {
          doRequest(response.headers.location);
          return;
        }
        if (code !== 200) {
          reject(new Error(`HTTP ${code} — ${currentUrl}`));
          return;
        }
        const total = parseInt(response.headers['content-length'] ?? '0', 10);
        let downloaded = 0;
        const fileStream = createWriteStream(dest);
        response.on('data', (chunk: Buffer) => {
          downloaded += chunk.length;
          if (total > 0) onProgress(Math.round((downloaded / total) * 100));
        });
        pipeline(response, fileStream).then(resolve).catch(reject);
      }).on('error', reject).on('timeout', function (this: any) { this.destroy(); reject(new Error('Download timed out')); });
    };
    doRequest(url);
  });
}

function execOrThrow(cmd: string): string {
  try {
    return execSync(cmd, { stdio: 'pipe', timeout: 120000 }).toString();
  } catch (e: any) {
    throw new Error(`Command failed: ${cmd}\n${e.stderr?.toString() || e.message}`);
  }
}

function findAppInDir(dir: string): string | undefined {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name.endsWith('.app')) {
        const macosBin = join(full, 'Contents', 'MacOS', basename(e.name, '.app'));
        if (existsSync(macosBin)) return macosBin;
      }
      const found = findAppInDir(full);
      if (found) return found;
    } else if (e.isFile()) {
      const isExec = e.name.endsWith('.exe') || e.name.endsWith('.AppImage')
        || e.name === 'retroarch' || e.name === 'dolphin-emu'
        || e.name === 'rpcs3' || e.name === 'Ryujinx'
        || e.name === 'mame' || e.name === 'mame64' || e.name === 'PCSX2';
      if (isExec) return full;
      // Check if it's executable
      try {
        if (statSync(full).mode & 0o111) return full;
      } catch { /* skip */ }
    }
  }
  return undefined;
}

function extractArchive(archivePath: string, destDir: string, format: string, emulatorId: string, onProgress: (msg: string) => void): void {
  if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });
  onProgress(`Extracting ${basename(archivePath)}...`);

  switch (format) {
    case 'zip':
      execOrThrow(`unzip -o "${archivePath}" -d "${destDir}"`);
      break;
    case 'tar.gz':
      execOrThrow(`tar -xzf "${archivePath}" -C "${destDir}"`);
      break;
    case 'tar.bz2':
      execOrThrow(`tar -xjf "${archivePath}" -C "${destDir}"`);
      break;
    case '7z': {
      try {
        execOrThrow(`7z x "${archivePath}" -o"${destDir}" -y`);
      } catch {
        // Try unzip as fallback (some 7z files are actually zip)
        execOrThrow(`unzip -o "${archivePath}" -d "${destDir}"`);
      }
      break;
    }
    case 'dmg': {
      if (!isMacOS()) throw new Error('DMG files can only be extracted on macOS');
      const mountPoint = `/tmp/omniemu_${emulatorId}_${randomBytes(4).toString('hex')}`;
      try {
        execOrThrow(`hdiutil attach "${archivePath}" -mountpoint "${mountPoint}" -nobrowse -quiet`);
        // Copy any .app bundles found in the mounted volume
        const result = execSync(`ls "${mountPoint}" 2>/dev/null || true`).toString();
        for (const item of result.split('\n').filter(Boolean)) {
          const src = join(mountPoint, item);
          if (item.endsWith('.app') || (statSync(src).isDirectory() && !item.startsWith('.'))) {
            execOrThrow(`cp -R "${src}" "${destDir}/"`);
          }
        }
      } finally {
        execOrThrow(`hdiutil detach "${mountPoint}" -quiet 2>/dev/null; true`);
      }
      break;
    }
    case 'exe':
    case 'msi':
    case 'appimage':
    case 'pkg':
      // These are installers, not archives
      break;
    default:
      throw new Error(`Unknown archive format: ${format}`);
  }
  onProgress('Extraction complete');
}

function runInstaller(installerPath: string, format: string, emulatorId: string, installDir: string, onProgress: (msg: string) => void): void {
  onProgress(`Running installer...`);

  switch (format) {
    case 'exe': {
      if (isWindows()) {
        execOrThrow(`"${installerPath}" /S /D="${installDir}"`);
      } else {
        execOrThrow(`chmod +x "${installerPath}" && "${installerPath}"`);
      }
      break;
    }
    case 'msi': {
      execOrThrow(`msiexec /i "${installerPath}" /quiet /norestart INSTALLDIR="${installDir}"`);
      break;
    }
    case 'appimage': {
      execOrThrow(`chmod +x "${installerPath}"`);
      execOrThrow(`cp "${installerPath}" "${installDir}/${emulatorId}.AppImage"`);
      break;
    }
    case 'pkg': {
      execOrThrow(`installer -pkg "${installerPath}" -target /`);
      break;
    }
    case 'dmg':
    case 'zip':
    case 'tar.gz':
    case 'tar.bz2':
    case '7z':
      // Already handled in extractArchive
      break;
    default:
      throw new Error(`Cannot install format: ${format}`);
  }
  onProgress('Installer finished');
}

export type { ProgressCallback };

export async function installEmulator(
  emulatorId: string,
  downloads: EmulatorDownload[],
  platform: Platform,
  arch: Arch,
  onProgress: ProgressCallback
): Promise<string> {
  const candidates = downloads.filter((d) => !d.arch || d.arch === arch);
  const download = candidates[0];
  if (!download) throw new Error(`No download available for ${emulatorId} on ${platform} (${arch})`);

  const report = (stage: InstallProgress['stage'], percent: number, message: string) => {
    onProgress({ emulatorId, stage, percent, message });
  };

  report('downloading', 0, `Downloading ${emulatorId}...`);
  const downloadPath = tempName(`.${download.format}`);
  await downloadFile(download.url, downloadPath, (pct) => {
    report('downloading', pct, `Downloading ${emulatorId}... ${pct}%`);
  });
  report('downloading', 100, 'Download complete');

  const installDir = join(app.getPath('userData'), 'emulators', emulatorId);
  if (!existsSync(installDir)) mkdirSync(installDir, { recursive: true });

  const archiveFormats = ['zip', 'tar.gz', 'tar.bz2', '7z', 'dmg'];
  const installerFormats = ['exe', 'msi', 'pkg', 'appimage'];

  if (archiveFormats.includes(download.format)) {
    report('extracting', 0, `Extracting ${emulatorId}...`);
    extractArchive(downloadPath, installDir, download.format, emulatorId, (msg) => {
      report('extracting', 50, msg);
    });
    report('extracting', 100, 'Extraction complete');
  }

  if (installerFormats.includes(download.format)) {
    report('installing', 0, `Installing ${emulatorId}...`);
    runInstaller(downloadPath, download.format, emulatorId, installDir, (msg) => {
      report('installing', 50, msg);
    });
    report('installing', 100, 'Installation complete');
  }

  // Cleanup
  try { execSync(`rm -f "${downloadPath}"`); } catch { /* ignore */ }

  report('done', 100, `${emulatorId} installed`);

  return installDir;
}

/** After install, find the executable in the install dir */
export function findInstalledBinary(emulatorId: string, installDir: string): string | undefined {
  if (!existsSync(installDir)) return undefined;
  return findAppInDir(installDir);
}
