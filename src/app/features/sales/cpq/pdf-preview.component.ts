import { Component, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { CPQ_LOCALES, CpqApiService, CpqLocale } from '@core';
import { TranslatePipe } from '@shared';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzSwitchModule } from 'ng-zorro-antd/switch';

/**
 * Live PDF preview of the quote: switching language (it, en, de, fr) or the technical details (unit breakdown against
 * the package price) renders the PDF again.
 */
@Component({
  selector: 'app-cpq-pdf-preview',
  imports: [ReactiveFormsModule, NzSelectModule, NzSpinModule, NzSwitchModule, TranslatePipe],
  template: `
    <form [formGroup]="form" class="controls">
      <label for="pdf-locale">{{ 'CPQ.PREVIEW.LANGUAGE' | translate }}</label>
      <nz-select id="pdf-locale" formControlName="locale" data-test="locale">
        @for (locale of locales; track locale) {
          <nz-option [nzValue]="locale" [nzLabel]="locale.toUpperCase()" />
        }
      </nz-select>
      <nz-switch id="pdf-details" formControlName="details" data-test="details" />
      <label for="pdf-details">{{ 'CPQ.PREVIEW.SHOW_DETAILS' | translate }}</label>
    </form>
    <nz-spin [nzSpinning]="loading()">
      @if (url(); as src) {
        <iframe class="pdf" data-test="pdf" [src]="src" [title]="'CPQ.PREVIEW.TITLE' | translate"></iframe>
      }
    </nz-spin>
  `,
  styles: `
    .controls {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }
    .pdf {
      width: 100%;
      height: 70vh;
      border: 0;
    }
  `,
})
export class CpqPdfPreviewComponent {
  private readonly api = inject(CpqApiService);
  private readonly fb = inject(FormBuilder);
  private readonly sanitizer = inject(DomSanitizer);

  readonly quoteId = input.required<string>();

  protected readonly locales = CPQ_LOCALES;
  protected readonly loading = signal(false);
  protected readonly url = signal<SafeResourceUrl | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    locale: this.fb.nonNullable.control<CpqLocale>('it'),
    details: this.fb.nonNullable.control(true),
  });

  private objectUrl: string | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.revoke());
    effect(() => this.render(this.quoteId()));
    this.form.valueChanges.subscribe(() => this.render(this.quoteId()));
  }

  private render(quoteId: string): void {
    const { locale, details } = this.form.getRawValue();
    this.loading.set(true);
    this.api.previewPdf(quoteId, locale, details).subscribe({
      next: (blob) => {
        this.revoke();
        this.objectUrl = URL.createObjectURL(blob);
        this.url.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.objectUrl));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private revoke(): void {
    if (this.objectUrl !== null) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }
}
