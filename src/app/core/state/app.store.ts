import { computed } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';

export interface AppState {
  readonly isSidebarCollapsed: boolean;
  readonly theme: 'light' | 'dark';
}

const initialAppState: AppState = {
  isSidebarCollapsed: false,
  theme: 'light',
};

export const AppStore = signalStore(
  { providedIn: 'root' },
  withState(initialAppState),
  withComputed(({ isSidebarCollapsed, theme }) => ({
    isCollapsed: computed(() => isSidebarCollapsed()),
    isDarkMode: computed(() => theme() === 'dark'),
  })),
  withMethods((store) => ({
    toggleSidebar(): void {
      patchState(store, (state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed }));
    },
    setSidebarCollapsed(isSidebarCollapsed: boolean): void {
      patchState(store, { isSidebarCollapsed });
    },
    setTheme(theme: 'light' | 'dark'): void {
      patchState(store, { theme });
    },
  }))
);
