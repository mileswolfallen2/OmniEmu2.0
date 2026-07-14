import { useEffect, useRef, useState, useCallback } from 'react';

const DEBOUNCE_MS = 180;
const LEGEND_TIMEOUT_MS = 4000;

type Page = 'dashboard' | 'emulators' | 'library' | 'settings' | 'controller' | 'utilities';

const pageOrder: Page[] = ['dashboard', 'emulators', 'library', 'controller', 'utilities', 'settings'];

export function useGamepadNav(onNavigate: (page: Page) => void, currentPage: Page) {
  const lastTime = useRef<Record<string, number>>({});
  const [connected, setConnected] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const legendTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const currentPageRef = useRef(currentPage);
  currentPageRef.current = currentPage;

  const showLegendTemporarily = useCallback(() => {
    setShowLegend(true);
    if (legendTimer.current) clearTimeout(legendTimer.current);
    legendTimer.current = setTimeout(() => setShowLegend(false), LEGEND_TIMEOUT_MS);
  }, []);

  useEffect(() => {
    let raf = 0;
    let lastConnected = false;

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

      const debounced = (key: string): boolean => {
        if (now - (lastTime.current[key] || 0) < DEBOUNCE_MS) return false;
        lastTime.current[key] = now;
        return true;
      };

      const dpadUp = gp.buttons[12]?.pressed || gp.axes[1] < -0.5;
      const dpadDown = gp.buttons[13]?.pressed || gp.axes[1] > 0.5;
      const dpadLeft = gp.buttons[14]?.pressed || gp.axes[0] < -0.5;
      const dpadRight = gp.buttons[15]?.pressed || gp.axes[0] > 0.5;

      // LB (4) → previous tab, RB (5) → next tab
      if (gp.buttons[4]?.pressed && debounced('lb')) {
        const idx = pageOrder.indexOf(currentPageRef.current);
        const prev = idx > 0 ? idx - 1 : pageOrder.length - 1;
        onNavigate(pageOrder[prev]);
        return;
      }
      if (gp.buttons[5]?.pressed && debounced('rb')) {
        const idx = pageOrder.indexOf(currentPageRef.current);
        const next = idx < pageOrder.length - 1 ? idx + 1 : 0;
        onNavigate(pageOrder[next]);
        return;
      }

      // Home/Guide (16) → go to dashboard
      if (gp.buttons[16]?.pressed && debounced('guide')) {
        onNavigate('dashboard');
        return;
      }

      // Start (9) → focus first element on the page
      if (gp.buttons[9]?.pressed && debounced('start')) {
        focusFirstOnPage();
        return;
      }

      // D-Pad navigation within page content
      const focusable = getFocusableElements();

      if (dpadDown && debounced('down')) {
        const focused = document.activeElement as HTMLElement;
        const idx = focusable.indexOf(focused);
        if (idx >= 0 && idx < focusable.length - 1) {
          focusable[idx + 1].focus();
          focusable[idx + 1].scrollIntoView({ block: 'nearest' });
        } else if (focusable.length > 0) {
          focusable[0].focus();
          focusable[0].scrollIntoView({ block: 'nearest' });
        }
      }

      if (dpadUp && debounced('up')) {
        const focused = document.activeElement as HTMLElement;
        const idx = focusable.indexOf(focused);
        if (idx > 0) {
          focusable[idx - 1].focus();
          focusable[idx - 1].scrollIntoView({ block: 'nearest' });
        } else if (focusable.length > 0) {
          focusable[focusable.length - 1].focus();
          focusable[focusable.length - 1].scrollIntoView({ block: 'nearest' });
        }
      }

      // Left/Right for horizontal grid navigation
      if (dpadRight && debounced('right')) {
        const focused = document.activeElement as HTMLElement;
        if (focused) {
          const next = findNextInRow(focused, 1);
          if (next) {
            next.focus();
            next.scrollIntoView({ block: 'nearest' });
          }
        }
      }

      if (dpadLeft && debounced('left')) {
        const focused = document.activeElement as HTMLElement;
        if (focused) {
          const prev = findNextInRow(focused, -1);
          if (prev) {
            prev.focus();
            prev.scrollIntoView({ block: 'nearest' });
          }
        }
      }

      // A (0) → confirm / click
      if (gp.buttons[0]?.pressed && debounced('a')) {
        const el = document.activeElement as HTMLElement;
        if (el) el.click();
      }

      // B (1) → back / deselect
      if (gp.buttons[1]?.pressed && debounced('back')) {
        const focused = document.activeElement as HTMLElement;
        if (focused) focused.blur();
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
      '.topbar-tab, button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"]), .game-card'
    )
  ).filter(el => el.offsetParent !== null);
}

function focusFirstOnPage() {
  requestAnimationFrame(() => {
    const focusable = getFocusableElements().filter(el => !el.closest('.topbar-nav'));
    if (focusable.length > 0) {
      focusable[0].focus();
      focusable[0].scrollIntoView({ block: 'nearest' });
    }
  });
}

function findNextInRow(current: HTMLElement, direction: 1 | -1): HTMLElement | null {
  const focusable = getFocusableElements();
  const idx = focusable.indexOf(current);
  if (idx < 0) return null;

  const currentRect = current.getBoundingClientRect();
  const currentCenterY = currentRect.top + currentRect.height / 2;

  // Find elements on roughly the same row (within 50px vertically)
  const sameRow = focusable.filter(el => {
    if (el === current) return false;
    const rect = el.getBoundingClientRect();
    const centerY = rect.top + rect.height / 2;
    return Math.abs(centerY - currentCenterY) < 50;
  });

  if (sameRow.length === 0) return null;

  if (direction === 1) {
    const right = sameRow.filter(el => el.getBoundingClientRect().left > currentRect.right - 10);
    return right.length > 0 ? right[0] : null;
  } else {
    const left = sameRow.filter(el => el.getBoundingClientRect().right < currentRect.left + 10);
    return left.length > 0 ? left[left.length - 1] : null;
  }
}
