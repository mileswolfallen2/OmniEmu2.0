import { createWriteStream, existsSync, mkdirSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'fs';
import { join, basename, dirname } from 'path';
import { get as httpsGet, RequestOptions } from 'https';
import { get as httpGet } from 'http';
import { spawn, execSync } from 'child_process';
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
        headers: { 'User-Agent': 'OmniEmu/0.1.3' },
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

function execOrThrow(cmd: string, timeoutMs = 300000): string {
  try {
    return execSync(cmd, { stdio: 'pipe', timeout: timeoutMs }).toString();
  } catch (e: any) {
    throw new Error(`Command failed: ${cmd}\n${e.stderr?.toString() || e.message}`);
  }
}

/** Run a command with args asynchronously with a timeout */
function runAsync(cmd: string, args: string[], timeoutMs = 300000): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: 'pipe',
      timeout: timeoutMs,
    });
    let stderr = '';
    child.stderr?.on('data', (data: Buffer) => { stderr += data.toString(); });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Exit code ${code}: ${stderr}`));
    });
    child.on('error', reject);
  });
}

function findAppInDir(dir: string): string | undefined {
  const entries = readdirSync(dir, { withFileTypes: true });
  const dirs = entries.filter(e => e.isDirectory());
  const files = entries.filter(e => e.isFile());

  for (const e of dirs) {
    if (e.name.endsWith('.app')) {
      const macosDir = join(dir, e.name, 'Contents', 'MacOS');
      if (existsSync(macosDir)) {
        const candidates = readdirSync(macosDir);
        const bin = candidates.find(b => statSync(join(macosDir, b)).mode & 0o111);
        if (bin) return join(macosDir, bin);
      }
    }
  }

  for (const e of files) {
    const lowerName = e.name.toLowerCase();
    const knownNames = ['retroarch', 'dolphin-emu', 'dolphin', 'rpcs3', 'ryujinx', 'eden', 'mame', 'mame64', 'pcsx2', 'duckstation', 'esde'];
    const isExec = e.name.endsWith('.exe') || e.name.endsWith('.AppImage')
      || knownNames.includes(lowerName);
    if (isExec) return join(dir, e.name);
  }

  for (const e of dirs) {
    if (!e.name.endsWith('.app')) {
      const found = findAppInDir(join(dir, e.name));
      if (found) return found;
    }
  }

  for (const e of files) {
    try {
      if (statSync(join(dir, e.name)).mode & 0o111) return join(dir, e.name);
    } catch { /* skip */ }
  }

  return undefined;
}

function get7zaPath(): string {
  try {
    return require('7zip-bin').path7za;
  } catch {
    throw new Error('7z extraction requires 7zip-bin package — run: npm install 7zip-bin');
  }
}

async function extractArchive(
  archivePath: string,
  destDir: string,
  format: string,
  emulatorId: string,
  onProgress: (msg: string) => void
): Promise<void> {
  if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });
  onProgress(`Extracting ${basename(archivePath)}...`);

  switch (format) {
    case 'zip':
      await runAsync('unzip', ['-o', archivePath, '-d', destDir]);
      break;
    case 'tar.gz':
      await runAsync('tar', ['-xzf', archivePath, '-C', destDir]);
      break;
    case 'tar.bz2':
      await runAsync('tar', ['-xjf', archivePath, '-C', destDir]);
      break;
    case 'tar.xz':
      await runAsync('tar', ['-xJf', archivePath, '-C', destDir]);
      break;
    case '7z': {
      const sevenZa = get7zaPath();
      await runAsync(sevenZa, ['x', archivePath, `-o${destDir}`, '-y']);
      break;
    }
    case 'dmg': {
      if (!isMacOS()) throw new Error('DMG files can only be extracted on macOS');
      onProgress('Opening DMG (please accept the license in the dialog)...');
      execSync(`open "${archivePath}"`);
      let mountPoint = '';
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 1000));
        try {
          const lines = execSync('ls /Volumes/').toString().split('\n').filter(Boolean);
          for (const vol of lines) {
            const volPath = join('/Volumes', vol);
            if (existsSync(join(volPath, 'ES-DE.app')) || existsSync(join(volPath, '..app'))) {
              mountPoint = volPath;
              break;
            }
          }
          if (!mountPoint) {
            for (const vol of lines) {
              const volPath = join('/Volumes', vol);
              if (statSync(volPath).isDirectory() && vol.toLowerCase().includes('es-de')) {
                mountPoint = volPath;
                break;
              }
            }
          }
          if (!mountPoint) {
            for (const vol of lines) {
              if (vol === 'Macintosh HD' || vol.startsWith('Recovery') || vol === 'OpenCode' || vol.startsWith('com.apple')) continue;
              const volPath = join('/Volumes', vol);
              try {
                const entries = readdirSync(volPath);
                if (entries.some(e => e.endsWith('.app'))) {
                  mountPoint = volPath;
                  break;
                }
              } catch { /* skip */ }
            }
          }
          if (mountPoint) break;
        } catch { /* retry */ }
      }
      if (!mountPoint) throw new Error('DMG did not mount within 60 seconds. Please accept the license dialog and try again.');
      try {
        const entries = readdirSync(mountPoint);
        for (const item of entries) {
          const src = join(mountPoint, item);
          if (item.endsWith('.app') || (statSync(src).isDirectory() && !item.startsWith('.'))) {
            execOrThrow(`cp -R "${src}" "${destDir}/"`);
          }
        }
      } finally {
        try { execSync(`hdiutil detach "${mountPoint}" -quiet 2>/dev/null`); } catch { /* ignore */ }
      }
      break;
    }
    case 'exe':
    case 'msi':
    case 'appimage':
    case 'pkg':
      break;
    default:
      throw new Error(`Unknown archive format: ${format}`);
  }
  onProgress('Extraction complete');
}

function runInstaller(
  installerPath: string,
  format: string,
  emulatorId: string,
  installDir: string,
  installerType?: 'nsis' | 'inno',
  onProgress?: (msg: string) => void
): void {
  onProgress?.(`Running installer...`);

  switch (format) {
    case 'exe': {
      if (isWindows()) {
        if (installerType === 'inno') {
          execOrThrow(`"${installerPath}" /VERYSILENT /SUPPRESSMSGBOXES /DIR="${installDir}"`);
        } else {
          execOrThrow(`"${installerPath}" /S /D="${installDir}"`);
        }
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
    case 'tar.xz':
    case '7z':
      break;
    default:
      throw new Error(`Cannot install format: ${format}`);
  }
  onProgress?.('Installer finished');
}

export type { ProgressCallback };

export async function installEmulator(
  emulatorId: string,
  downloads: EmulatorDownload[],
  platform: Platform,
  arch: Arch,
  onProgress: ProgressCallback,
  packageName?: string,
): Promise<string> {
  const candidates = downloads.filter((d) => !d.arch || d.arch === arch);
  if (candidates.length === 0) {
    if (packageName) {
      return installViaPackageManager(emulatorId, packageName, platform, onProgress);
    }
    throw new Error(`No download available for ${emulatorId} on ${platform} (${arch})`);
  }

  const report = (stage: InstallProgress['stage'], percent: number, message: string) => {
    onProgress({ emulatorId, stage, percent, message });
  };

  const installDir = join(app.getPath('userData'), 'emulators', emulatorId);
  if (!existsSync(installDir)) mkdirSync(installDir, { recursive: true });

  const archiveFormats = ['zip', 'tar.gz', 'tar.bz2', 'tar.xz', '7z', 'dmg'];
  const installerFormats = ['exe', 'msi', 'pkg', 'appimage'];

  let totalSteps = candidates.length;
  let completedSteps = 0;

  for (const download of candidates) {
    const stepLabel = totalSteps > 1 ? ` (${completedSteps + 1}/${totalSteps})` : '';
    report('downloading', Math.round((completedSteps / totalSteps) * 100), `Downloading ${download.url.split('/').pop()}${stepLabel}...`);

    const downloadPath = tempName(`.${download.format}`);
    try {
      await downloadFile(download.url, downloadPath, (pct) => {
        report('downloading', Math.round(((completedSteps + pct / 100) / totalSteps) * 100), `Downloading ${download.url.split('/').pop()}${stepLabel}... ${pct}%`);
      });

      if (archiveFormats.includes(download.format)) {
        report('extracting', Math.round((completedSteps / totalSteps) * 100), `Extracting ${download.url.split('/').pop()}${stepLabel}...`);
        await extractArchive(downloadPath, installDir, download.format, emulatorId, (msg) => {
          report('extracting', Math.round(((completedSteps + 0.5) / totalSteps) * 100), msg);
        });
      }

      if (installerFormats.includes(download.format)) {
        report('installing', Math.round((completedSteps / totalSteps) * 100), `Installing ${download.url.split('/').pop()}${stepLabel}...`);
        runInstaller(downloadPath, download.format, emulatorId, installDir, download.installerType, (msg) => {
          report('installing', Math.round(((completedSteps + 0.5) / totalSteps) * 100), msg);
        });
      }
    } finally {
      try { unlinkSync(downloadPath); } catch { /* ignore */ }
    }
    completedSteps++;
  }

  report('done', 100, `${emulatorId} installed`);

  return installDir;
}

async function installViaPackageManager(
  emulatorId: string,
  packageName: string,
  platform: Platform,
  onProgress: ProgressCallback,
): Promise<string> {
  const report = (stage: InstallProgress['stage'], percent: number, message: string) => {
    onProgress({ emulatorId, stage, percent, message });
  };
  const installDir = join(app.getPath('userData'), 'emulators', emulatorId);
  if (!existsSync(installDir)) mkdirSync(installDir, { recursive: true });

  if (platform === 'darwin') {
    report('installing', 10, `Installing ${packageName} via Homebrew...`);
    execOrThrow(`brew install ${packageName}`, 600000);
    try {
      const binary = execSync(`which ${emulatorId} 2>/dev/null || which ${packageName} 2>/dev/null`).toString().trim();
      if (binary) {
        writeFileSync(join(installDir, '.installed'), binary);
      }
    } catch { /* binary not found via which, ok */ }
    report('done', 100, `${emulatorId} installed via Homebrew`);
  } else if (platform === 'linux') {
    report('installing', 10, `Installing ${packageName} via package manager...`);
    try {
      execOrThrow(`snap install ${packageName} 2>/dev/null || apt-get install -y ${packageName} 2>/dev/null || echo "fallback"`, 600000);
    } catch { /* package manager not available */ }
    report('done', 100, `${emulatorId} installed`);
  } else {
    throw new Error(`Package manager install not supported on ${platform}`);
  }

  return installDir;
}

export function findInstalledBinary(emulatorId: string, installDir: string, executablePath?: string): string | undefined {
  if (!existsSync(installDir)) return undefined;

  if (executablePath) {
    const explicit = join(installDir, executablePath);
    if (existsSync(explicit)) return explicit;
  }

  if (isMacOS()) {
    const appNames = [
      `${capitalize(emulatorId)}.app`,
      `${emulatorId}.app`,
      `${emulatorId.charAt(0).toUpperCase()}${emulatorId.slice(1).toLowerCase()}.app`,
    ];
    if (emulatorId === 'retroarch') {
      appNames.unshift('RetroArch.app');
    }
    if (emulatorId === 'esde') {
      appNames.unshift('ES-DE.app');
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
