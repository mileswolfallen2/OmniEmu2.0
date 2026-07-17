import React, { useEffect, useState, useRef, useCallback } from 'react';
import type { EmulatorState } from '../../shared/types';

interface ControllerState {
  index: number;
  id: string;
  buttons: { pressed: boolean; value: number }[];
  axes: number[];
  connected: boolean;
}

type ControllerVendor = 'xbox' | 'playstation' | 'switch' | 'generic';

function detectVendor(id: string): ControllerVendor {
  const lower = id.toLowerCase();
  if (lower.includes('ps4') || lower.includes('ps5') || lower.includes('dualsense')
    || lower.includes('dualshock') || lower.includes('sony') || lower.includes('wireless controller')
    || lower.includes('playstation')) return 'playstation';
  if (lower.includes('xbox') || lower.includes('xinput') || lower.includes('x-box')
    || lower.includes('microsoft')) return 'xbox';
  if (lower.includes('switch') || lower.includes('pro controller') || lower.includes('nintendo'))
    return 'switch';
  return 'generic';
}

const vendorLabels: Record<ControllerVendor, string[]> = {
  playstation: [
    'Cross', 'Circle', 'Square', 'Triangle', 'L1', 'R1', 'L2', 'R2',
    'Share', 'Options', 'L3', 'R3', 'DPad-Up', 'DPad-Down', 'DPad-Left', 'DPad-Right',
    'PS',
  ],
  xbox: [
    'A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT',
    'Back', 'Start', 'L3', 'R3', 'DPad-Up', 'DPad-Down', 'DPad-Left', 'DPad-Right',
    'Home',
  ],
  switch: [
    'B', 'A', 'Y', 'X', 'L', 'R', 'ZL', 'ZR',
    '-', '+', 'L3', 'R3', 'DPad-Up', 'DPad-Down', 'DPad-Left', 'DPad-Right',
    'Home',
  ],
  generic: [
    'A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT',
    'Back', 'Start', 'L3', 'R3', 'DPad-Up', 'DPad-Down', 'DPad-Left', 'DPad-Right',
    'Home',
  ],
};

export function ControllerPage() {
  const [controllers, setControllers] = useState<ControllerState[]>([]);
  const [emulators, setEmulators] = useState<EmulatorState[]>([]);
  const [configStatus, setConfigStatus] = useState<string>('');
  const rafRef = useRef<number>(0);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const poll = useCallback(() => {
    const gamepads = navigator.getGamepads();
    const connected: ControllerState[] = [];
    for (const gp of gamepads) {
      if (gp && gp.connected) {
        connected.push({
          index: gp.index,
          id: gp.id,
          buttons: gp.buttons.map(b => ({ pressed: b.pressed, value: b.value })),
          axes: Array.from(gp.axes),
          connected: true,
        });
      }
    }
    setControllers(prev => {
      if (prev.length !== connected.length) return connected;
      const same = prev.every((c, i) => {
        const n = connected[i];
        return c.id === n?.id && c.index === n?.index &&
          c.buttons.length === n.buttons.length &&
          c.buttons.every((b, j) => b.pressed === n.buttons[j]?.pressed && b.value === n.buttons[j]?.value) &&
          c.axes.length === n.axes.length &&
          c.axes.every((a, j) => a === n.axes[j]);
      });
      return same ? prev : connected;
    });
    rafRef.current = requestAnimationFrame(poll);
  }, []);

  useEffect(() => {
    const onConnected = (e: GamepadEvent) => {
      setControllers(prev => [...prev.filter(c => c.index !== e.gamepad.index), {
        index: e.gamepad.index,
        id: e.gamepad.id,
        buttons: [],
        axes: [],
        connected: true,
      }]);
    };
    const onDisconnected = (e: GamepadEvent) => {
      setControllers(prev => prev.filter(c => c.index !== e.gamepad.index));
    };

    window.addEventListener('gamepadconnected', onConnected);
    window.addEventListener('gamepaddisconnected', onDisconnected);

    poll();

    (async () => {
      const states = await window.omni.emulators.states();
      setEmulators(states.filter(s => s.installed && s.path));
    })();

    return () => {
      window.removeEventListener('gamepadconnected', onConnected);
      window.removeEventListener('gamepaddisconnected', onDisconnected);
      cancelAnimationFrame(rafRef.current);
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    };
  }, [poll]);

  const handleUpdateConfig = async (emulatorId: string, installPath: string, controllerId?: string) => {
    setConfigStatus(`Configuring ${emulatorId}...`);
    try {
      const result = await window.omni.emulators.updateControllerConfig(emulatorId, installPath, controllerId);
      setConfigStatus(result ? `${emulatorId} controller config applied` : `${emulatorId}: no config available`);
    } catch (e: any) {
      setConfigStatus(`Error: ${e.message}`);
    }
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    statusTimerRef.current = setTimeout(() => setConfigStatus(''), 4000);
  };

  return (
    <div>
      {controllers.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">🎮</div>
          <h3>No Controller Detected</h3>
          <p>Connect a gamepad and press a button to start</p>
        </div>
      )}

      {controllers.map((ctrl) => {
        const vendor = detectVendor(ctrl.id);
        const labels = vendorLabels[vendor];

        return (
          <div key={ctrl.index} className="card mb-4">
            <div className="card-header">
              <h3>
                {vendor === 'playstation' ? '🎮 PlayStation' : vendor === 'xbox' ? '🎮 Xbox' : '🎮 Controller'} {ctrl.index + 1}
              </h3>
              <span className="badge badge-installed">Connected</span>
            </div>
            <p className="text-sm text-muted mb-2">{ctrl.id}</p>

            <div className="controller-buttons">
              {ctrl.buttons.length > 0 && labels.map((label, i) => {
                const btn = ctrl.buttons[i];
                if (!btn) return null;
                return (
                  <div
                    key={i}
                    className={`controller-btn ${btn.pressed ? 'pressed' : ''}`}
                  >
                    <span className="controller-btn-label">{label}</span>
                    <span className="controller-btn-value">{btn.value.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>

            {ctrl.axes.length > 0 && (
              <div className="mt-2">
                <p className="text-sm text-muted mb-2">Axes</p>
                <div className="controller-axes">
                  {ctrl.axes.map((val, i) => (
                    <div key={i} className="axis-bar">
                      <span className="axis-label">Axis {i}</span>
                      <div className="axis-track">
                        <div
                          className="axis-fill"
                          style={{ left: `${((val + 1) / 2) * 100}%` }}
                        />
                      </div>
                      <span className="axis-value">{val.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {emulators.length > 0 && (
        <div>
          <h3 className="mb-2" style={{ fontSize: 16, fontWeight: 600 }}>
            Emulator Controller Config
          </h3>
          <p className="text-sm text-muted mb-4">
            Apply controller bindings to installed emulators so they recognize your gamepad.
          </p>

          {configStatus && (
            <div className="info-bar" style={{ color: 'var(--success)', marginBottom: 8 }}>
              {configStatus}
            </div>
          )}

          <div className="card-grid">
            {emulators.map((emu) => (
              <div key={emu.config.id} className="card">
                <div className="card-header">
                  <h3>{emu.config.name}</h3>
                  <span className={`badge ${emu.configured ? 'badge-installed' : 'badge-missing'}`}>
                    {emu.configured ? 'Configured' : 'Not Configured'}
                  </span>
                </div>
                <p className="text-sm text-muted">{emu.config.description}</p>
                <div style={{ marginTop: 8 }}>
                  {emu.config.platforms.map((p) => (
                    <span className="platform-tag" key={p}>{p}</span>
                  ))}
                </div>
                <button
                  className="btn btn-primary btn-sm mt-4"
                  onClick={() => handleUpdateConfig(emu.config.id, emu.path!, controllers[0]?.id)}
                >
                  Update Controller Config
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!controllers.length && !emulators.length && (
        <div className="loading">Loading emulators...</div>
      )}
    </div>
  );
}
