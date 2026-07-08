import type { OmniApi } from '../main/preload';

declare global {
  interface Window {
    omni: OmniApi;
  }
}

export interface NavItem {
  page: string;
  label: string;
  icon: string;
}
