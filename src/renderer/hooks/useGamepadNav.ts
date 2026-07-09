import { useEffect, useRef } from 'react';

const DEBOUNCE_MS = 200;

type NavDir = 'up' | 'down' | 'left' | 'right';

export function useGamepadNav() {
  const lastInput = useRef<Record<string, number>>({});

  useEffect(() => {
    let raf = 0;

    const poll = () => {
      const gamepads = navigator.getGamepads();
      const now = Date.now();

      for (const gp of gamepads) {
        if (!gp || !gp.connected) continue;

        // D-Pad buttons (indices 12-15)
        const dpadUp = gp.buttons[12]?.pressed;
        const dpadDown = gp.buttons[13]?.pressed;
        const dpadLeft = gp.buttons[14]?.pressed;
        const dpadRight = gp.buttons[15]?.pressed;

        // Left stick axes (indices 0, 1)
        const axisX = gp.axes[0] || 0;
        const axisY = gp.axes[1] || 0;

        const threshold = 0.5;

        const dirs: NavDir[] = [];
        if (dpadUp) dirs.push('up');
        if (dpadDown) dirs.push('down');
        if (dpadLeft) dirs.push('left');
        if (dpadRight) dirs.push('right');

        if (axisY < -threshold) dirs.push('up');
        if (axisY > threshold) dirs.push('down');
        if (axisX < -threshold) dirs.push('left');
        if (axisX > threshold) dirs.push('right');

        for (const dir of dirs) {
          const key = `dir:${dir}`;
          if (now - (lastInput.current[key] || 0) < DEBOUNCE_MS) continue;
          lastInput.current[key] = now;

          const keyMap: Record<NavDir, string> = {
            up: 'ArrowUp',
            down: 'ArrowDown',
            left: 'ArrowLeft',
            right: 'ArrowRight',
          };
          document.dispatchEvent(new KeyboardEvent('keydown', {
            key: keyMap[dir],
            bubbles: true,
            cancelable: true,
          }));
        }

        // A button (0) → Enter
        if (gp.buttons[0]?.pressed) {
          if (now - (lastInput.current['a'] || 0) < DEBOUNCE_MS) continue;
          lastInput.current['a'] = now;
          const focused = document.activeElement;
          if (focused) {
            focused.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          } else {
            document.dispatchEvent(new KeyboardEvent('keydown', {
              key: 'Enter', bubbles: true, cancelable: true,
            }));
          }
        }

        // B button (1) → Escape
        if (gp.buttons[1]?.pressed) {
          if (now - (lastInput.current['b'] || 0) < DEBOUNCE_MS) continue;
          lastInput.current['b'] = now;
          document.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Escape', bubbles: true, cancelable: true,
          }));
        }

        // Start (9) → Enter on first focusable
        if (gp.buttons[9]?.pressed) {
          if (now - (lastInput.current['start'] || 0) < DEBOUNCE_MS) continue;
          lastInput.current['start'] = now;
          const firstBtn = document.querySelector<HTMLElement>('button, [tabindex]:not([tabindex="-1"]), a, input');
          firstBtn?.focus();
        }
      }

      raf = requestAnimationFrame(poll);
    };

    raf = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(raf);
  }, []);
}
