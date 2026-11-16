import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { ThemePreference, THEME_PREFERENCES, UiPreferencesService } from '@core/theme';
import { TranslatePipe } from '@shared';

const LABEL_KEYS: Record<ThemePreference, string> = {
  light: 'AUTH.THEME_LIGHT',
  dark: 'AUTH.THEME_DARK',
  system: 'AUTH.THEME_SYSTEM',
};

/**
 * Light / Dark / System choice for the pages reached before signing in. It goes through the same preference the rest
 * of the app uses (UiPreferencesService, cached in the browser), so it applies at once and survives the sign-in.
 */
@Component({
  selector: 'app-theme-selector',
  styleUrl: './theme-selector.component.scss',
  imports: [FormsModule, NzSelectModule, TranslatePipe],
  template: `
    <nz-select
      class="theme-select"
      nzSize="default"
      [ngModel]="preference()"
      (ngModelChange)="onThemeChange($event)"
      [attr.aria-label]="'AUTH.THEME' | translate"
    >
      @for (option of options; track option.value) {
        <nz-option [nzValue]="option.value" [nzLabel]="option.labelKey | translate" />
      }
    </nz-select>
  `,
})
export class ThemeSelectorComponent {
  private readonly prefs = inject(UiPreferencesService);

  protected readonly preference = this.prefs.themePreference;
  protected readonly options = THEME_PREFERENCES.map((value) => ({ value, labelKey: LABEL_KEYS[value] }));

  protected onThemeChange(theme: ThemePreference): void {
    this.prefs.setTheme(theme);
  }
}
