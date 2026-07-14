import { useEffect, useRef, useState, useCallback } from 'react';

const DEBOUNCE_MS = 180;
const LEGEND_TIMEOUT_MS = 8000;

type Page = 'dashboard' | 'emulators' | 'library' | 'saves' | 'cloud' | 'settings' | 'controller' | 'utilities';

const pageOrder: Page[] = ['dashboard', 'emulators', 'library', 'saves', 'cloud', 'controller', 'utilities', 'settings'];

export function useGamepadNav(onNavigate: (page: Page) => void, currentPage: Page) {
  const lastTime = useRef<Record<string, number>>({});
  const [connected, setConnected] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const legendTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const currentPageRef = useRef(currentPage);
  const lastPageRef = useRef(currentPage);
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
      try {
        pollInner();
      } catch {
        // don't let errors kill the loop
      }
      raf = requestAnimationFrame(poll);
    };

    const pollInner = () => {
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
      if (!gp) return;

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

      const focusable = getFocusableElements().filter(el => !el.closest('.topbar-nav'));

      // When nothing meaningful is focused, auto-focus first element on any d-pad press
      const active = document.activeElement as HTMLElement;
      const isNothingFocused = !active || active === document.body || active === document.documentElement;

      if (isNothingFocused && (dpadUp || dpadDown || dpadLeft || dpadRight)) {
        if (focusable.length > 0) {
          focusable[0].focus();
          focusable[0].scrollIntoView({ block: 'nearest' });
        }
        return;
      }

      // If page just changed (LB/RB) and nothing is focused, auto-focus
      if (lastPageRef.current !== currentPageRef.current) {
        lastPageRef.current = currentPageRef.current;
        if (isNothingFocused && focusable.length > 0) {
          focusable[0].focus();
          focusable[0].scrollIntoView({ block: 'nearest' });
          return;
        }
      }

      // Spatial d-pad navigation
      if (dpadDown && debounced('down')) {
        const next = spatialNav(focusable, active, 'down');
        if (next) {
          next.focus();
          next.scrollIntoView({ block: 'nearest' });
        }
      }

      if (dpadUp && debounced('up')) {
        const next = spatialNav(focusable, active, 'up');
        if (next) {
          next.focus();
          next.scrollIntoView({ block: 'nearest' });
        }
      }

      if (dpadRight && debounced('right')) {
        const next = spatialNav(focusable, active, 'right');
        if (next) {
          next.focus();
          next.scrollIntoView({ block: 'nearest' });
        }
      }

      if (dpadLeft && debounced('left')) {
        const next = spatialNav(focusable, active, 'left');
        if (next) {
          next.focus();
          next.scrollIntoView({ block: 'nearest' });
        }
      }

      // A (0) → confirm / click
      if (gp.buttons[0]?.pressed && debounced('a')) {
        const el = document.activeElement as HTMLElement;
        if (el && el !== document.body) el.click();
      }

      // B (1) → back / close modal / deselect
      if (gp.buttons[1]?.pressed && debounced('back')) {
        // Check if a modal overlay is open — close it via Escape
        const modal = document.querySelector('.modal-overlay');
        if (modal) {
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
          return;
        }
        const focused = document.activeElement as HTMLElement;
        if (focused && focused !== document.body) focused.blur();
      }
    };

    raf = requestAnimationFrame(poll);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, [onNavigate, showLegendTemporarily]);

  // Track page changes
  useEffect(() => {
    lastPageRef.current = currentPage;
  }, [currentPage]);

  return { connected, showLegend, dismissLegend: () => setShowLegend(false) };
}

function getFocusableElements(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(
      '.topbar-tab, button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), .game-card, [role="button"]'
    )
  ).filter(el => {
    if (el.offsetParent === null && el.tagName !== 'BODY') return false;
    if (el.offsetWidth === 0 && el.offsetHeight === 0) return false;
    return true;
  });
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

type Direction = 'up' | 'down' | 'left' | 'right';

function spatialNav(elements: HTMLElement[], current: HTMLElement | null, dir: Direction): HTMLElement | null {
  if (elements.length === 0) return null;

  // Get the reference point
  let refX: number;
  let refY: number;

  if (current && current !== document.body && current !== document.documentElement) {
    const rect = current.getBoundingClientRect();
    refX = rect.left + rect.width / 2;
    refY = rect.top + rect.height / 2;
  } else {
    // No element focused — use viewport center
    refX = window.innerWidth / 2;
    refY = window.innerHeight / 2;
  }

  const candidates: { el: HTMLElement; score: number }[] = [];

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    if (el === current) continue;

    const r = el.getBoundingClientRect();
    const ex = r.left + r.width / 2;
    const ey = r.top + r.height / 2;
    const dx = ex - refX;
    const dy = ey - refY;

    if (dir === 'down') {
      if (dy > 5) {
        candidates.push({ el, score: Math.abs(dy) + Math.abs(dx) * 1.5 });
      }
    } else if (dir === 'up') {
      if (dy < -5) {
        candidates.push({ el, score: Math.abs(dy) + Math.abs(dx) * 1.5 });
      }
    } else if (dir === 'right') {
      if (dx > 5 && Math.abs(dy) < 100) {
        candidates.push({ el, score: Math.abs(dx) + Math.abs(dy) * 2 });
      }
    } else if (dir === 'left') {
      if (dx < -5 && Math.abs(dy) < 100) {
        candidates.push({ el, score: Math.abs(dx) + Math.abs(dy) * 2 });
      }
    }
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => a.score - b.score);
    return candidates[0].el;
  }

  // Wrap around
  if (elements.length === 0) return null;
  if (dir === 'down' || dir === 'right') return elements[0];
  return elements[elements.length - 1];
}
