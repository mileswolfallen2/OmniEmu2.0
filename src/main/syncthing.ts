import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';
import http from 'http';
import { spawn, ChildProcess } from 'child_process';
import { getPlatform, getArch } from './platform';
import { settings } from './settings';
import { SyncthingStatus, SyncthingFolder, SyncthingRemoteDevice } from '../shared/types';

let stProcess: ChildProcess | null = null;

const VERSION = 'v2.1.2';

function getSyncthingDir(): string {
  return join(app.getPath('userData'), 'syncthing');
}

function getBinaryPath(): string {
  const platform = getPlatform();
  const dir = getSyncthingDir();
  return platform === 'win32' ? join(dir, 'syncthing.exe') : join(dir, 'syncthing');
}

function getConfigDir(): string {
  return join(getSyncthingDir(), 'config');
}

function getDataDir(): string {
  return join(getSyncthingDir(), 'data');
}

function getApiKeyPath(): string {
  return join(getSyncthingDir(), '.apikey');
}

function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = '';
  for (let i = 0; i < 32; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

function getApiKey(): string {
  const apiKeyPath = getApiKeyPath();
  if (existsSync(apiKeyPath)) {
    return readFileSync(apiKeyPath, 'utf-8').trim();
  }
  const key = generateApiKey();
  const dir = getSyncthingDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(apiKeyPath, key, 'utf-8');
  return key;
}

function getPort(): number {
  return settings.get().syncthingPort || 8384;
}

function apiUrl(path: string): string {
  return `http://127.0.0.1:${getPort()}${path}`;
}

function httpRequest(
  method: string,
  url: string,
  headers: Record<string, string>,
  body?: string
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method, headers, timeout: 5000 }, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
      res.on('end', () => resolve({ status: res.statusCode || 0, body: data }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    if (body) req.write(body);
    req.end();
  });
}

async function apiRequest(method: string, path: string, body?: any): Promise<any> {
  const url = apiUrl(path);
  const apiKey = getApiKey();

  const resp = await httpRequest(method, url, {
    'X-API-Key': apiKey,
    'Content-Type': 'application/json',
  }, body ? JSON.stringify(body) : undefined);

  if (resp.status < 200 || resp.status >= 300) {
    throw new Error(`Syncthing API ${method} ${path} failed (${resp.status}): ${resp.body}`);
  }

  if (!resp.body) return null;
  try { return JSON.parse(resp.body); } catch { return resp.body; }
}

async function healthCheck(timeoutMs = 1000): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.request(apiUrl('/rest/noauth/health'), { method: 'GET', timeout: timeoutMs }, (res) => {
      let data = '';
      res.on('data', () => {});
      res.on('end', () => resolve(res.statusCode === 200));
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

function ensureConfigXml(): void {
  const configDir = getConfigDir();
  const dataDir = getDataDir();
  if (!existsSync(configDir)) mkdirSync(configDir, { recursive: true });
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

  const cfgPath = join(configDir, 'config.xml');
  if (existsSync(cfgPath)) return;

  const apiKey = getApiKey();
  const port = getPort();

  const xml = `<configuration version="37">
  <folder id="omniemu-saves" label="OmniEmu Saves" path="${join(dataDir, 'saves').replace(/\\/g, '/')}" type="sendreceive" rescanIntervalS="3600" fsWatcherEnabled="true" fsWatcherDelayS="10" ignorePerms="false" autoNormalize="true">
    <filesystemType>basic</filesystemType>
    <minDiskFree unit="%">1</minDiskFree>
  </folder>
  <device id="" name="OmniEmu" compression="metadata" introducer="false">
    <address>dynamic</address>
  </device>
  <gui enabled="true" tls="false">
    <address>127.0.0.1:${port}</address>
    <apikey>${apiKey}</apikey>
    <theme>default</theme>
  </gui>
  <options>
    <listenAddress>default</listenAddress>
    <globalAnnounceEnabled>false</globalAnnounceEnabled>
    <localAnnounceEnabled>true</localAnnounceEnabled>
    <startBrowser>false</startBrowser>
    <urAccepted>-1</urAccepted>
  </options>
</configuration>`;

  writeFileSync(cfgPath, xml, 'utf-8');
}

export async function installSyncthing(
  onProgress?: (stage: string, percent: number, message: string) => void
): Promise<boolean> {
  const platform = getPlatform();
  const arch = getArch();

  let assetName: string;
  let ext: string;
  if (platform === 'win32') {
    assetName = `syncthing-windows-amd64-${VERSION}`;
    ext = 'zip';
  } else if (platform === 'darwin') {
    assetName = arch === 'arm64'
      ? `syncthing-macos-arm64-${VERSION}`
      : `syncthing-macos-amd64-${VERSION}`;
    ext = 'zip';
  } else {
    assetName = `syncthing-linux-amd64-${VERSION}`;
    ext = 'tar.gz';
  }

  const url = `https://github.com/syncthing/syncthing/releases/download/${VERSION}/${assetName}.${ext}`;
  const dir = getSyncthingDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  onProgress?.('downloading', 0, `Downloading Syncthing ${VERSION}...`);

  const tmpFile = join(dir, `tmp_${Date.now()}.${ext}`);

  try {
    const buffer = await downloadFile(url, (received, total) => {
      const pct = total > 0 ? Math.round((received / total) * 60) : 0;
      onProgress?.('downloading', pct, `Downloading... ${Math.round(received / 1024 / 1024 * 10) / 10}MB`);
    });
    writeFileSync(tmpFile, buffer);

    onProgress?.('extracting', 70, 'Extracting...');

    if (ext === 'zip') {
      const { execSync } = require('child_process');
      if (platform === 'win32') {
        execSync(`powershell -Command "Expand-Archive -Path '${tmpFile}' -DestinationPath '${dir}' -Force"`);
        const extracted = join(dir, `${assetName}\\syncthing.exe`);
        const target = join(dir, 'syncthing.exe');
        if (existsSync(extracted) && !existsSync(target)) {
          const { renameSync } = require('fs');
          renameSync(extracted, target);
        }
      } else {
        execSync(`ditto -x -k '${tmpFile}' '${dir}'`, { stdio: 'ignore' });
        const binaryPath = getBinaryPath();
        if (!existsSync(binaryPath)) {
          try { execSync(`unzip -o '${tmpFile}' -d '${dir}'`, { stdio: 'ignore' }); } catch { /* ignore */ }
        }
      }
      // Move binary out of nested directory if needed
      const binaryPath = getBinaryPath();
      if (!existsSync(binaryPath)) {
        const nestedBinary = join(dir, assetName, getPlatform() === 'win32' ? 'syncthing.exe' : 'syncthing');
        if (existsSync(nestedBinary)) {
          const { renameSync } = require('fs');
          renameSync(nestedBinary, binaryPath);
        }
      }
    } else {
      const { execSync } = require('child_process');
      execSync(`tar -xzf '${tmpFile}' -C '${dir}' --strip-components=1`, { stdio: 'ignore' });
    }

    onProgress?.('installing', 90, 'Setting up...');
    const binaryPath = getBinaryPath();
    if (platform !== 'win32' && existsSync(binaryPath)) {
      const { chmodSync } = require('fs');
      chmodSync(binaryPath, 0o755);
    }

    ensureConfigXml();

    onProgress?.('done', 100, 'Syncthing installed!');
    return true;
  } catch (err) {
    onProgress?.('error', 0, `Install failed: ${err}`);
    return false;
  } finally {
    try { const { unlinkSync } = require('fs'); unlinkSync(tmpFile); } catch { /* ignore */ }
  }
}

function downloadFile(
  url: string,
  onProgress?: (received: number, total: number) => void
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const https = require('https');
    const get = url.startsWith('https') ? https.get : http.get;
    get(url, (res: any) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadFile(res.headers.location, onProgress).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const total = parseInt(res.headers['content-length'] || '0', 10);
      const chunks: Buffer[] = [];
      let received = 0;
      res.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
        received += chunk.length;
        onProgress?.(received, total);
      });
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

export async function startSyncthing(): Promise<boolean> {
  const binaryPath = getBinaryPath();
  if (!existsSync(binaryPath)) return false;

  // If already running and healthy, just return
  if (stProcess && !stProcess.killed && await healthCheck()) return true;

  // Kill stale process if any
  if (stProcess && !stProcess.killed) {
    try { stProcess.kill(); } catch { /* ignore */ }
    stProcess = null;
    await new Promise(r => setTimeout(r, 500));
  }

  ensureConfigXml();

  stProcess = spawn(binaryPath, [
    '--no-browser',
    '--no-restart',
    '--config', getConfigDir(),
    '--data', getDataDir(),
  ], {
    detached: false,
    stdio: 'ignore',
  });

  stProcess.on('error', () => { stProcess = null; });
  stProcess.on('exit', (code) => { stProcess = null; });

  // Quick check — if process died immediately, bail
  await new Promise(r => setTimeout(r, 300));
  if (!stProcess || stProcess.killed) return false;

  // Wait for Syncthing to become healthy, but bail early if process dies
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 1000));
    // Process died — don't keep polling
    if (!stProcess || stProcess.killed) return false;
    if (await healthCheck()) return true;
  }

  return false;
}

export async function stopSyncthing(): Promise<void> {
  if (!stProcess || stProcess.killed) return;

  try {
    await apiRequest('POST', '/rest/system/shutdown');
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        stProcess?.kill();
        resolve();
      }, 3000);
      stProcess!.on('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  } catch {
    stProcess?.kill();
  }
  stProcess = null;
}

export async function getSyncthingStatus(): Promise<SyncthingStatus> {
  const installed = existsSync(getBinaryPath());
  const running = installed ? await healthCheck() : false;

  if (!running) {
    return {
      installed,
      running: false,
      deviceId: '',
      apiAddress: '',
      apiKey: '',
      version: '',
      folders: [],
      remoteDevices: [],
    };
  }

  try {
    const status = await apiRequest('GET', '/rest/system/status');
    const config = await apiRequest('GET', '/rest/config');

    const folders: SyncthingFolder[] = (config.folders || []).map((f: any) => ({
      id: f.id,
      label: f.label || f.id,
      path: f.path,
      type: f.type,
    }));

    const remoteDevices: SyncthingRemoteDevice[] = (config.devices || [])
      .filter((d: any) => d.deviceID && d.deviceID !== status.myID)
      .map((d: any) => ({
        id: d.deviceID,
        name: d.name || (d.deviceID ? d.deviceID.slice(0, 8) : 'Unknown'),
        addresses: d.addresses || [],
        connected: !!status?.connections?.[d.deviceID]?.connected,
      }));

    return {
      installed: true,
      running: true,
      deviceId: status.myID || '',
      apiAddress: apiUrl(''),
      apiKey: getApiKey(),
      version: status?.version || VERSION,
      folders,
      remoteDevices,
    };
  } catch {
    return {
      installed: true,
      running: true,
      deviceId: '',
      apiAddress: apiUrl(''),
      apiKey: getApiKey(),
      version: '',
      folders: [],
      remoteDevices: [],
    };
  }
}

export async function addRemoteDevice(deviceId: string, name: string): Promise<boolean> {
  try {
    await apiRequest('POST', '/rest/config/devices', {
      deviceID: deviceId,
      name: name || deviceId.slice(0, 8),
      addresses: ['dynamic'],
      compression: 'metadata',
      introducer: false,
    });
    return true;
  } catch {
    return false;
  }
}

export async function removeRemoteDevice(deviceId: string): Promise<boolean> {
  try {
    await apiRequest('DELETE', `/rest/config/devices/${deviceId}`);
    return true;
  } catch {
    return false;
  }
}

export async function addSharedFolder(
  id: string,
  label: string,
  path: string,
  deviceIds: string[]
): Promise<boolean> {
  try {
    const devices = deviceIds.map(dId => ({ deviceID: dId }));
    await apiRequest('POST', '/rest/config/folders', {
      id,
      label,
      path,
      type: 'sendreceive',
      rescanIntervalS: 3600,
      fsWatcherEnabled: true,
      fsWatcherDelayS: 10,
      devices,
    });
    return true;
  } catch {
    return false;
  }
}

export async function removeSharedFolder(folderId: string): Promise<boolean> {
  try {
    await apiRequest('DELETE', `/rest/config/folders/${folderId}`);
    return true;
  } catch {
    return false;
  }
}

export async function getSyncthingVersion(): Promise<string> {
  try {
    const status = await apiRequest('GET', '/rest/system/version');
    return status?.version || '';
  } catch {
    return '';
  }
}

export interface PendingDeviceInfo {
  id: string;
  name: string;
  address?: string;
}

export interface PendingFolderInfo {
  folderId: string;
  folderLabel: string;
  deviceId: string;
}

export async function getPendingDevices(): Promise<PendingDeviceInfo[]> {
  try {
    const data = await apiRequest('GET', '/rest/cluster/pending/devices');
    if (!data) return [];
    return Object.entries(data).map(([id, info]: [string, any]) => ({
      id,
      name: info.name || '',
      address: info.address || '',
    }));
  } catch {
    return [];
  }
}

export async function acceptPendingDevice(deviceId: string): Promise<boolean> {
  try {
    await apiRequest('PUT', `/rest/cluster/pending/devices?device=${deviceId}`);
    return true;
  } catch {
    return false;
  }
}

export async function getPendingFolders(): Promise<PendingFolderInfo[]> {
  try {
    const data = await apiRequest('GET', '/rest/cluster/pending/folders');
    if (!data) return [];
    const results: PendingFolderInfo[] = [];
    for (const [folderId, info] of Object.entries<any>(data)) {
      const deviceIds = info.offeredBy ? Object.keys(info.offeredBy) : [];
      for (const deviceId of deviceIds) {
        results.push({ folderId, folderLabel: info.label || folderId, deviceId });
      }
    }
    return results;
  } catch {
    return [];
  }
}

export async function acceptPendingFolder(
  folderId: string,
  folderLabel: string,
  localPath: string,
  deviceId: string
): Promise<boolean> {
  try {
    await apiRequest('POST', '/rest/config/folders', {
      id: folderId,
      label: folderLabel,
      path: localPath,
      type: 'sendreceive',
      rescanIntervalS: 3600,
      fsWatcherEnabled: true,
      fsWatcherDelayS: 10,
      devices: [{ deviceID: deviceId }],
    });
    return true;
  } catch {
    return false;
  }
}

export { getBinaryPath, getPort, getApiKey, apiUrl, getSyncthingDir };

export async function uninstallSyncthing(): Promise<boolean> {
  try {
    if (stProcess && !stProcess.killed) {
      try { await apiRequest('POST', '/rest/system/shutdown'); } catch { /* ignore */ }
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => { stProcess?.kill(); resolve(); }, 3000);
        stProcess!.on('exit', () => { clearTimeout(timeout); resolve(); });
      });
      stProcess = null;
    }
    const dir = getSyncthingDir();
    if (existsSync(dir)) {
      const { rmSync } = await import('fs');
      rmSync(dir, { recursive: true, force: true });
    }
    return true;
  } catch {
    return false;
  }
}
