import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { UiPreferencesService } from '@core/theme/ui-preferences.service';
import {
  THEME_PREFERENCES,
  UI_DENSITIES,
  ThemePreference,
  UiDensity,
} from '@core/theme/ui-preferences.types';
import { TranslatePipe } from '@shared/pipes/translate.pipe';

/**
 * Header quick switcher for theme and density. A disclosure button opens a panel with two native radio groups, so the
 * arrow keys, Space and Tab work without extra scripting. Escape and a click outside close the panel and give the
 * focus back to the button.
 */
@Component({
  selector: 'app-appearance-switcher',
  imports: [TranslatePipe],
  host: {
    class: 'appearance-switcher',
    '(document:click)': 'onDocumentClick($event)',
    '(keydown.escape)': 'close(true)',
  },
  template: `
    <button
      #trigger
      type="button"
      class="action-btn appearance-trigger"
      aria-haspopup="true"
      [attr.aria-expanded]="open()"
      aria-controls="ff-appearance-panel"
      [attr.aria-label]="'DESIGN_SYSTEM.APPEARANCE' | translate"
      [title]="'DESIGN_SYSTEM.APPEARANCE' | translate"
      (click)="toggle()"
    >
      <i
        class="fa-solid"
        [class.fa-moon]="prefs.isDark()"
        [class.fa-sun]="!prefs.isDark()"
        aria-hidden="true"
      ></i>
    </button>

    @if (open()) {
      <div
        id="ff-appearance-panel"
        class="appearance-panel"
        role="group"
        [attr.aria-label]="'DESIGN_SYSTEM.APPEARANCE' | translate"
      >
        <fieldset class="appearance-group">
          <legend>{{ 'DESIGN_SYSTEM.THEME' | translate }}</legend>
          @for (theme of themes; track theme) {
            <label class="appearance-option">
              <input
                type="radio"
                name="ff-theme"
                [value]="theme"
                [checked]="prefs.themePreference() === theme"
                (change)="prefs.setTheme(theme)"
              />
              <span>{{ themeKey(theme) | translate }}</span>
            </label>
          }
        </fieldset>
        <fieldset class="appearance-group">
          <legend>{{ 'DESIGN_SYSTEM.DENSITY' | translate }}</legend>
          @for (density of densities; track density) {
            <label class="appearance-option">
              <input
                type="radio"
                name="ff-density"
                [value]="density"
                [checked]="prefs.density() === density"
                (change)="prefs.setDensity(density)"
              />
              <span>{{ densityKey(density) | translate }}</span>
            </label>
          }
        </fieldset>
      </div>
    }
  `,
  styles: `
    :host {
      position: relative;
      display: inline-flex;
    }

    .appearance-panel {
      position: absolute;
      top: calc(100% + var(--ff-space-2));
      right: 0;
      z-index: 1050;
      display: grid;
      gap: var(--ff-space-3);
      min-width: 220px;
      padding: var(--ff-space-4);
      background: var(--ff-color-surface-raised);
      color: var(--ff-color-text);
      border: 1px solid var(--ff-color-border);
      border-radius: var(--ff-radius-lg);
      box-shadow: var(--ff-shadow-elevated);
    }

    .appearance-group {
      margin: 0;
      padding: 0;
      border: 0;
    }

    legend {
      padding: 0 0 var(--ff-space-1);
      color: var(--ff-color-text-secondary);
      font-size: var(--ff-font-size-xs);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .appearance-option {
      display: flex;
      align-items: center;
      gap: var(--ff-space-2);
      min-height: var(--ff-a11y-target-min);
      padding: var(--ff-space-1) 0;
      cursor: pointer;
    }
  `,
})
export class AppearanceSwitcherComponent {
  readonly prefs = inject(UiPreferencesService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');

  readonly themes = THEME_PREFERENCES;
  readonly densities = UI_DENSITIES;
  readonly open = signal(false);

  toggle(): void {
    this.open.update((value) => !value);
  }

  close(restoreFocus: boolean): void {
    if (!this.open()) {
      return;
    }
    this.open.set(false);
    if (restoreFocus) {
      this.trigger().nativeElement.focus();
    }
  }

  onDocumentClick(event: Event): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) {
      this.close(false);
    }
  }

  themeKey(theme: ThemePreference): string {
    return `DESIGN_SYSTEM.THEME_${theme.toUpperCase()}`;
  }

  densityKey(density: UiDensity): string {
    return `DESIGN_SYSTEM.DENSITY_${density.toUpperCase()}`;
  }
}
