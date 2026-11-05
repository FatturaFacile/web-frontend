import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { AuthStore, I18nService, SupportedLanguage } from '@core';
import { TranslatePipe } from '@shared';

/** Language choice for the pages reached before signing in: it applies at once and is remembered in the browser. */
@Component({
  selector: 'app-language-selector',
  imports: [FormsModule, NzSelectModule, TranslatePipe],
  template: `
    <nz-select
      class="language-select"
      nzSize="small"
      [ngModel]="activeLocale()"
      (ngModelChange)="onLocaleChange($event)"
      [attr.aria-label]="'AUTH.LANGUAGE' | translate"
    >
      @for (language of languages; track language.code) {
        <nz-option [nzValue]="language.code" [nzLabel]="language.flag + ' ' + language.label" />
      }
    </nz-select>
  `,
  styles: `
    :host {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 16px;
    }

    .language-select {
      width: 140px;
    }
  `,
})
export class LanguageSelectorComponent {
  private readonly authStore = inject(AuthStore);

  protected readonly activeLocale = this.authStore.activeLocale;
  protected readonly languages = inject(I18nService).languages;

  protected onLocaleChange(locale: SupportedLanguage): void {
    this.authStore.setLocale(locale);
  }
}
