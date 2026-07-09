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
  const dirs = entries.filter(e => e.isDirectory());
  const files = entries.filter(e => e.isFile());

  // Check .app bundles first (before cores or other dirs)
  for (const e of dirs) {
    if (e.name.endsWith('.app')) {
      const macosBin = join(dir, e.name, 'Contents', 'MacOS', basename(e.name, '.app'));
      if (existsSync(macosBin)) return macosBin;
    }
  }

  // Then check known executable files in root
  for (const e of files) {
    const lowerName = e.name.toLowerCase();
    const knownNames = ['retroarch', 'dolphin-emu', 'dolphin', 'rpcs3', 'ryujinx', 'eden', 'mame', 'mame64', 'pcsx2', 'duckstation'];
    const isExec = e.name.endsWith('.exe') || e.name.endsWith('.AppImage')
      || knownNames.includes(lowerName);
    if (isExec) return join(dir, e.name);
  }

  // Recurse into non-.app directories (skip .app bundles)
  for (const e of dirs) {
    if (!e.name.endsWith('.app')) {
      const found = findAppInDir(join(dir, e.name));
      if (found) return found;
    }
  }

  // Last resort: any executable file in root
  for (const e of files) {
    try {
      if (statSync(join(dir, e.name)).mode & 0o111) return join(dir, e.name);
    } catch { /* skip */ }
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
  if (candidates.length === 0) throw new Error(`No download available for ${emulatorId} on ${platform} (${arch})`);

  const report = (stage: InstallProgress['stage'], percent: number, message: string) => {
    onProgress({ emulatorId, stage, percent, message });
  };

  const installDir = join(app.getPath('userData'), 'emulators', emulatorId);
  if (!existsSync(installDir)) mkdirSync(installDir, { recursive: true });

  const archiveFormats = ['zip', 'tar.gz', 'tar.bz2', '7z', 'dmg'];
  const installerFormats = ['exe', 'msi', 'pkg', 'appimage'];

  let totalSteps = candidates.length;
  let completedSteps = 0;

  for (const download of candidates) {
    const stepLabel = totalSteps > 1 ? ` (${completedSteps + 1}/${totalSteps})` : '';
    report('downloading', Math.round((completedSteps / totalSteps) * 100), `Downloading ${download.url.split('/').pop()}${stepLabel}...`);

    const downloadPath = tempName(`.${download.format}`);
    await downloadFile(download.url, downloadPath, (pct) => {
      report('downloading', Math.round(((completedSteps + pct / 100) / totalSteps) * 100), `Downloading ${download.url.split('/').pop()}${stepLabel}... ${pct}%`);
    });

    if (archiveFormats.includes(download.format)) {
      report('extracting', Math.round((completedSteps / totalSteps) * 100), `Extracting ${download.url.split('/').pop()}${stepLabel}...`);
      extractArchive(downloadPath, installDir, download.format, emulatorId, (msg) => {
        report('extracting', Math.round(((completedSteps + 0.5) / totalSteps) * 100), msg);
      });
    }

    if (installerFormats.includes(download.format)) {
      report('installing', Math.round((completedSteps / totalSteps) * 100), `Installing ${download.url.split('/').pop()}${stepLabel}...`);
      runInstaller(downloadPath, download.format, emulatorId, installDir, (msg) => {
        report('installing', Math.round(((completedSteps + 0.5) / totalSteps) * 100), msg);
      });
    }

    try { execSync(`rm -f "${downloadPath}"`); } catch { /* ignore */ }
    completedSteps++;
  }

  report('done', 100, `${emulatorId} installed`);

  return installDir;
}

/** After install, find the executable in the install dir */
export function findInstalledBinary(emulatorId: string, installDir: string, executablePath?: string): string | undefined {
  if (!existsSync(installDir)) return undefined;

  // Try explicit executablePath first (from download config)
  if (executablePath) {
    const explicit = join(installDir, executablePath);
    if (existsSync(explicit)) return explicit;
  }

  // macOS: check for .app bundle with several naming variants
  if (isMacOS()) {
    const appNames = [
      `${capitalize(emulatorId)}.app`,           // Retroarch.app
      `${emulatorId}.app`,                       // retroarch.app
      `${emulatorId.charAt(0).toUpperCase()}${emulatorId.slice(1).toLowerCase()}.app`, // Retroarch.app
    ];
    // Also check common overrides
    if (emulatorId === 'retroarch') {
      appNames.unshift('RetroArch.app');          // actual macOS app name
    }

    for (const appName of appNames) {
      const appDir = join(installDir, appName);
      if (existsSync(appDir)) {
        const binName = basename(appName, '.app');
        const macosBin = join(appDir, 'Contents', 'MacOS', binName);
        if (existsSync(macosBin)) return macosBin;
      }
    }
  }

  return findAppInDir(installDir);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
