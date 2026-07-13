import { useEffect, useRef, useState, useCallback } from 'react';

const DEBOUNCE_MS = 300;
const LEGEND_TIMEOUT_MS = 4000;

type Page = 'dashboard' | 'emulators' | 'library' | 'settings' | 'controller' | 'utilities';

const pageOrder: Page[] = ['dashboard', 'emulators', 'library', 'controller', 'utilities', 'settings'];

export function useGamepadNav(onNavigate: (page: Page) => void, currentPage: Page) {
  const lastTime = useRef<Record<string, number>>({});
  const [connected, setConnected] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const legendTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showLegendTemporarily = useCallback(() => {
    setShowLegend(true);
    if (legendTimer.current) clearTimeout(legendTimer.current);
    legendTimer.current = setTimeout(() => setShowLegend(false), LEGEND_TIMEOUT_MS);
  }, []);

  useEffect(() => {
    let raf = 0;
    let lastConnected = false;
    let navigationPending = false;

    const poll = () => {
      const gamepads = navigator.getGamepads();
      const now = Date.now();

      const activePad = Array.from(gamepads).find(g => g && g.connected);

      if (activePad && !lastConnected) {
        lastConnected = true;
        setConnected(true);
        showLegendTemporarily();
      } else if (!activePad && lastConnected) {
        lastConnected = false;
        setConnected(false);
      }

      const gp = activePad;
      if (!gp) { raf = requestAnimationFrame(poll); return; }

      if (navigationPending) {
        navigationPending = false;
        focusFirstOnPage();
      }

      const debounced = (key: string): boolean => {
        if (now - (lastTime.current[key] || 0) < DEBOUNCE_MS) return false;
        lastTime.current[key] = now;
        return true;
      };

      // D-Pad (12-15) and left stick
      const dpadUp = gp.buttons[12]?.pressed || gp.axes[1] < -0.5;
      const dpadDown = gp.buttons[13]?.pressed || gp.axes[1] > 0.5;
      const dpadLeft = gp.buttons[14]?.pressed || gp.axes[0] < -0.5;
      const dpadRight = gp.buttons[15]?.pressed || gp.axes[0] > 0.5;

      // --- Sidebar navigation with Left/Right (only when sidebar is focused) ---
      if (dpadLeft && debounced('left')) {
        const focused = document.activeElement;
        if (focused?.closest('.sidebar')) {
          cycleSidebar(-1);
          navigationPending = true;
        }
      }
      if (dpadRight && debounced('right')) {
        const focused = document.activeElement;
        if (focused?.closest('.sidebar')) {
          cycleSidebar(1);
          navigationPending = true;
        }
      }

      // --- Page content navigation with Up/Down ---
      if (dpadUp && debounced('up')) {
        const focused = document.activeElement;
        if (focused?.closest('.sidebar')) {
          cycleSidebar(-1);
          navigationPending = true;
        } else {
          const focusable = getFocusableElements();
          const idx = focusable.indexOf(focused as HTMLElement);
          if (idx > 0) {
            focusable[idx - 1]?.focus();
            focusable[idx - 1]?.scrollIntoView({ block: 'nearest' });
          }
        }
      }
      if (dpadDown && debounced('down')) {
        const focused = document.activeElement;
        if (focused?.closest('.sidebar')) {
          cycleSidebar(1);
          navigationPending = true;
        } else {
          const focusable = getFocusableElements();
          const idx = focusable.indexOf(focused as HTMLElement);
          if (idx < focusable.length - 1) {
            focusable[idx + 1]?.focus();
            focusable[idx + 1]?.scrollIntoView({ block: 'nearest' });
          } else {
            focusable[0]?.focus();
            focusable[0]?.scrollIntoView({ block: 'nearest' });
          }
        }
      }

      // A button (0) → confirm / click
      if (gp.buttons[0]?.pressed && debounced('a')) {
        const el = document.activeElement as HTMLElement;
        if (el) {
          const inSidebar = !!el.closest('.sidebar');
          el.click();
          if (inSidebar) navigationPending = true;
        }
      }

      // B (1), X (2), Select (8) → blur / back
      const backPressed = (gp.buttons[1]?.pressed || gp.buttons[2]?.pressed || gp.buttons[8]?.pressed);
      if (backPressed && debounced('back')) {
        const focused = document.activeElement as HTMLElement;
        if (focused?.closest('.sidebar')) {
          // If in sidebar, blur and focus first page element
          focused.blur();
          focusFirstOnPage();
        } else if (focused) {
          focused.blur();
        }
      }

      // Start (9) → focus first element on the page
      if (gp.buttons[9]?.pressed && debounced('start')) {
        focusFirstOnPage();
      }

      // LB (4) → previous tab, RB (5) → next tab
      if (gp.buttons[4]?.pressed && debounced('lb')) {
        const idx = pageOrder.indexOf(currentPage);
        const prev = idx > 0 ? idx - 1 : pageOrder.length - 1;
        onNavigate(pageOrder[prev]);
        navigationPending = true;
      }
      if (gp.buttons[5]?.pressed && debounced('rb')) {
        const idx = pageOrder.indexOf(currentPage);
        const next = idx < pageOrder.length - 1 ? idx + 1 : 0;
        onNavigate(pageOrder[next]);
        navigationPending = true;
      }

      // Home/Guide (16) → go to dashboard
      if (gp.buttons[16]?.pressed && debounced('guide')) {
        onNavigate('dashboard');
        navigationPending = true;
      }

      raf = requestAnimationFrame(poll);
    };

    raf = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(raf);
  }, [onNavigate, showLegendTemporarily]);

  return { connected, showLegend, dismissLegend: () => setShowLegend(false) };
}

function getFocusableElements(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"]), .game-card, .nav-item'
    )
  ).filter(el => el.offsetParent !== null);
}

function focusFirstOnPage() {
  requestAnimationFrame(() => {
    const focusable = getFocusableElements().filter(el => !el.closest('.sidebar'));
    if (focusable.length > 0) {
      focusable[0]?.focus();
      focusable[0]?.scrollIntoView({ block: 'nearest' });
    }
  });
}

function cycleSidebar(dir: 1 | -1): void {
  const items = document.querySelectorAll<HTMLElement>('.nav-item');
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
