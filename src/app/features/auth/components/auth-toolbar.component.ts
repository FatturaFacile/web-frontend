import { Component } from '@angular/core';
import { LanguageSelectorComponent } from './language-selector.component';
import { ThemeSelectorComponent } from './theme-selector.component';

/** Language and theme choice at the top of the public pages, side by side. */
@Component({
  selector: 'app-auth-toolbar',
  imports: [LanguageSelectorComponent, ThemeSelectorComponent],
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: var(--space-2);
      margin-bottom: var(--space-4);
    }
    app-language-selector {
      margin-bottom: 0;
    }
  `,
  template: `
    <app-theme-selector />
    <app-language-selector />
  `,
})
export class AuthToolbarComponent {}
