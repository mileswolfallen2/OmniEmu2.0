import { createWriteStream, existsSync, mkdirSync, createReadStream } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { get } from 'https';
import { get as getHttp } from 'http';
import { execSync, spawn } from 'child_process';
import { pipeline } from 'stream/promises';
import { createGunzip, createBrotliDecompress, createInflate } from 'zlib';
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
    const protocol = url.startsWith('https') ? get : getHttp;
    protocol(url, (response) => {
      const code = response.statusCode ?? 500;
      if (code >= 300 && code < 400 && response.headers.location) {
        downloadFile(response.headers.location, dest, onProgress).then(resolve).catch(reject);
        return;
      }
      if (code !== 200) {
        reject(new Error(`HTTP ${code} downloading ${url}`));
        return;
      }

      const total = parseInt(response.headers['content-length'] ?? '0', 10);
      let downloaded = 0;
      const file = createWriteStream(dest);

      response.on('data', (chunk: Buffer) => {
        downloaded += chunk.length;
        if (total > 0) onProgress(Math.round((downloaded / total) * 100));
      });

      pipeline(response, file)
        .then(() => {
          onProgress(100);
          resolve();
        })
        .catch(reject);
    }).on('error', reject);
  });
}

function extractArchive(archivePath: string, destDir: string, format: string, emulatorId: string, onProgress: (msg: string) => void): void {
  if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });

  onProgress(`Extracting ${basename(archivePath)}...`);

  switch (format) {
    case 'zip': {
      execSync(`unzip -o "${archivePath}" -d "${destDir}"`, { stdio: 'pipe' });
      break;
    }
    case 'tar.gz':
    case 'tar.bz2': {
      const decompress = format === 'tar.bz2' ? '-j' : '-z';
      execSync(`tar -x${decompress}f "${archivePath}" -C "${destDir}"`, { stdio: 'pipe' });
      break;
    }
    case '7z': {
      execSync(`7z x "${archivePath}" -o"${destDir}" -y`, { stdio: 'pipe' });
      break;
    }
    case 'dmg': {
      // Attach DMG and copy .app out
      const mountPoint = `/tmp/omniemu_${emulatorId}`;
      execSync(`hdiutil attach "${archivePath}" -mountpoint "${mountPoint}" -nobrowse -quiet`, { stdio: 'pipe' });
      execSync(`cp -R "${mountPoint}"/*.app "${destDir}/" 2>/dev/null; cp -R "${mountPoint}"/*/*.app "${destDir}/" 2>/dev/null; true`, { stdio: 'pipe' });
      execSync(`hdiutil detach "${mountPoint}" -quiet 2>/dev/null; true`, { stdio: 'pipe' });
      break;
    }
    case 'exe':
    case 'msi':
    case 'appimage':
    case 'pkg': {
      // These are direct installers, not archives
      break;
    }
    default:
      throw new Error(`Unknown archive format: ${format}`);
  }

  onProgress('Extraction complete');
}

function runInstaller(installerPath: string, format: string, emulatorId: string, installDir: string, onProgress: (msg: string) => void): void {
  onProgress(`Running installer for ${emulatorId}...`);

  switch (format) {
    case 'exe': {
      if (isWindows()) {
        execSync(`"${installerPath}" /S /D="${installDir}"`, { stdio: 'pipe', timeout: 300000 });
      } else {
        execSync(`chmod +x "${installerPath}" && "${installerPath}" -- "${installDir}"`, { stdio: 'pipe', timeout: 300000 });
      }
      break;
    }
    case 'msi': {
      execSync(`msiexec /i "${installerPath}" /quiet /norestart INSTALLDIR="${installDir}"`, { stdio: 'pipe', timeout: 300000 });
      break;
    }
    case 'appimage': {
      execSync(`chmod +x "${installerPath}"`, { stdio: 'pipe' });
      // Copy AppImage to install dir
      execSync(`cp "${installerPath}" "${installDir}/${emulatorId}.AppImage"`, { stdio: 'pipe' });
      break;
    }
    case 'pkg': {
      execSync(`installer -pkg "${installerPath}" -target /`, { stdio: 'pipe', timeout: 300000 });
      break;
    }
    case 'dmg': {
      // Already handled in extractArchive
      break;
    }
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
  // Pick the right download for this platform + arch
  const candidates = downloads.filter((d) => !d.arch || d.arch === arch);
  const download = candidates[0];
  if (!download) throw new Error(`No download available for ${platform}/${arch}`);

  const report = (stage: InstallProgress['stage'], percent: number, message: string) => {
    onProgress({ emulatorId, stage, percent, message });
  };

  report('downloading', 0, `Downloading ${download.url}...`);

  const downloadPath = tempName(`.${download.format}`);
  await downloadFile(download.url, downloadPath, (pct) => {
    report('downloading', pct, `Downloading ${emulatorId}... ${pct}%`);
  });

  const installDir = join(app.getPath('userData'), 'emulators', emulatorId);
  if (!existsSync(installDir)) mkdirSync(installDir, { recursive: true });

  // Determine if this is an archive or an installer
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

  report('done', 100, `${emulatorId} installed successfully`);

  return installDir;
}
