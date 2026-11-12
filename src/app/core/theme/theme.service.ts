import { DOCUMENT } from '@angular/common';
import { effect, inject, Injectable } from '@angular/core';
import { AuthStore } from '../auth/auth.store';

const DARK_STYLESHEET_ID = 'theme-dark-stylesheet';

/**
 * Applies the light/dark theme chosen in the AuthStore: the dark NG-ZORRO stylesheet (theme-dark.css, built from
 * theme-dark.less) is added to the page only while the dark theme is active, so the two themes never duplicate
 * their rules in the same stylesheet.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly authStore = inject(AuthStore);

  constructor() {
    effect(() => this.apply(this.authStore.isDarkMode()));
  }

  private apply(dark: boolean): void {
    const root = this.document.documentElement;
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
    root.style.colorScheme = dark ? 'dark' : 'light';

    const existing = this.document.getElementById(DARK_STYLESHEET_ID);
    if (dark && !existing) {
      const link = this.document.createElement('link');
      link.id = DARK_STYLESHEET_ID;
      link.rel = 'stylesheet';
      link.href = 'theme-dark.css';
      this.document.head.appendChild(link);
    } else if (!dark && existing) {
      existing.remove();
    }
  }
}
