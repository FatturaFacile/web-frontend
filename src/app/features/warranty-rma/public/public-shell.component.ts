import { Component, inject, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { I18nService, SupportedLanguage } from '@core';
import { TranslatePipe } from '@shared';

/** Minimal customer-facing frame (no app shell): title, language switch and main landmark. */
@Component({
  selector: 'app-rma-public-shell',
  imports: [FormsModule, NzSelectModule, TranslatePipe],
  template: `
    <div class="public-page">
      <header class="public-header">
        <span class="public-brand">{{ brand() || ('RMA.PUBLIC.BRAND' | translate) }}</span>
        <div class="public-lang">
          <label for="public-lang">{{ 'RMA.PUBLIC.LANGUAGE' | translate }}</label>
          <nz-select
            nzId="public-lang"
            nzSize="small"
            [ngModel]="i18n.currentLanguage()"
            (ngModelChange)="setLanguage($event)"
            [nzOptions]="languageOptions"
          />
        </div>
      </header>
      <main class="public-main">
        <ng-content />
      </main>
    </div>
  `,
  styles: `
    .public-page {
      min-height: 100vh;
      background: var(--bg-main, #f5f7f9);
      color: var(--text-primary, #1f1f1f);
    }
    .public-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: var(--bg-card, #fff);
      border-bottom: 1px solid var(--border-color, #e8e8e8);
    }
    .public-brand {
      font-weight: 700;
      font-size: 16px;
    }
    .public-lang {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .public-lang nz-select {
      width: 120px;
    }
    .public-main {
      max-width: 860px;
      margin: 0 auto;
      padding: 24px 16px 48px;
    }
  `,
})
export class PublicShellComponent {
  readonly i18n = inject(I18nService);
  readonly brand = input<string | null>(null);

  readonly languageOptions = this.i18n.languages.map((l) => ({ label: l.label, value: l.code }));

  setLanguage(lang: SupportedLanguage): void {
    void this.i18n.setLanguage(lang);
  }
}
