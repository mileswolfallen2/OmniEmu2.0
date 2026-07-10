import { useEffect, useRef } from 'react';

const DEBOUNCE_MS = 300;

const SIDEBAR_SELECTOR = '.nav-item';

export function useGamepadNav() {
  const lastTime = useRef<Record<string, number>>({});

  useEffect(() => {
    let raf = 0;

    const poll = () => {
      const gamepads = navigator.getGamepads();
      const now = Date.now();

      for (const gp of gamepads) {
        if (!gp || !gp.connected) continue;

        const debounced = (key: string): boolean => {
          if (now - (lastTime.current[key] || 0) < DEBOUNCE_MS) return false;
          lastTime.current[key] = now;
          return true;
        };

        // D-Pad buttons (12-15) and left stick
        const dpadUp = gp.buttons[12]?.pressed || gp.axes[1] < -0.6;
        const dpadDown = gp.buttons[13]?.pressed || gp.axes[1] > 0.6;
        const dpadLeft = gp.buttons[14]?.pressed || gp.axes[0] < -0.6;
        const dpadRight = gp.buttons[15]?.pressed || gp.axes[0] > 0.6;

        // --- Sidebar navigation with Left/Right (only when sidebar is focused) ---
        if (dpadLeft && debounced('left')) {
          const focused = document.activeElement;
          if (focused?.closest('.sidebar')) cycleSidebar(-1);
        }
        if (dpadRight && debounced('right')) {
          const focused = document.activeElement;
          if (focused?.closest('.sidebar')) cycleSidebar(1);
        }

        // --- Page content navigation with Up/Down (Tab/Shift+Tab) ---
        if (dpadUp && debounced('up')) {
          const focused = document.activeElement;
          const sidebar = focused?.closest('.sidebar');
          if (sidebar) {
            cycleSidebar(-1);
          } else {
            const focusable = getFocusableElements();
            const idx = focusable.indexOf(focused as HTMLElement);
            if (idx > 0) focusable[idx - 1]?.focus();
          }
        }
        if (dpadDown && debounced('down')) {
          const focused = document.activeElement;
          const sidebar = focused?.closest('.sidebar');
          if (sidebar) {
            cycleSidebar(1);
          } else {
            const focusable = getFocusableElements();
            const idx = focusable.indexOf(focused as HTMLElement);
            if (idx < focusable.length - 1) focusable[idx + 1]?.focus();
            else focusable[0]?.focus();
          }
        }

        // A button (0) → confirm / click
        if (gp.buttons[0]?.pressed && debounced('a')) {
          const el = document.activeElement as HTMLElement;
          if (el) el.click();
        }

        // B button (1) → back / blur (do not force sidebar)
        if (gp.buttons[1]?.pressed && debounced('b')) {
          const focused = document.activeElement as HTMLElement;
          if (focused) focused.blur();
        }

        // Start (9) → focus first interactive element on page
        if (gp.buttons[9]?.pressed && debounced('start')) {
          const all = getFocusableElements();
          all[0]?.focus();
        }
      }

      raf = requestAnimationFrame(poll);
    };

    raf = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(raf);
  }, []);
}

function getFocusableElements(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"]), .game-card, .nav-item'
    )
  ).filter(el => el.offsetParent !== null); // only visible
}

function cycleSidebar(dir: 1 | -1): void {
  const items = document.querySelectorAll<HTMLElement>(SIDEBAR_SELECTOR);
  if (items.length === 0) return;
  const activeIdx = Array.from(items).findIndex(el =>
    el.classList.contains('active') || el === document.activeElement
  );
  let next = activeIdx + dir;
  if (next < 0) next = items.length - 1;
  if (next >= items.length) next = 0;
  items[next]?.click();
  items[next]?.focus();
}
