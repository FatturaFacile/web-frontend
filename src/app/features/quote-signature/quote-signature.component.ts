import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { CpqApiService, CpqPublicQuoteLine, CpqPublicSigningView, CpqSignRequest, I18nService, SupportedLanguage } from '@core';
import { SignaturePadComponent, TranslatePipe, RadioControlDirective } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';

/**
 * Public page of the online quote signature (no login): the secret token of the link is the credential. The customer
 * reviews the quote in the language of their choice, picks the optional lines when the quote allows it, enters the
 * signer details, draws or types the signature and accepts, or asks changes.
 */
@Component({
  selector: 'app-quote-signature',
  imports: [
    RadioControlDirective,
    FormsModule,
    ReactiveFormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzCheckboxModule,
    NzInputModule,
    NzRadioModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    SignaturePadComponent,
    TranslatePipe,
  ],
  template: `
    <nz-card class="card" [nzTitle]="'CPQ.SIGN.TITLE' | translate">
      <nz-spin [nzSpinning]="loading()">
        @if (invalid()) {
          <nz-alert nzType="error" nzShowIcon data-test="invalid" [nzMessage]="'CPQ.SIGN.LINK_UNAVAILABLE' | translate" />
        } @else if (view(); as v) {
          <div class="language">
            <label for="ui-language">{{ 'CPQ.PREVIEW.LANGUAGE' | translate }}</label>
            <nz-select id="ui-language" [ngModel]="i18n.currentLanguage()" (ngModelChange)="changeLanguage($event)" [ngModelOptions]="{ standalone: true }">
              @for (lang of i18n.languages; track lang.code) {
                <nz-option [nzValue]="lang.code" [nzLabel]="lang.label" />
              }
            </nz-select>
          </div>

          @if (pdfUrl(); as src) {
            <iframe class="pdf" data-test="pdf" [src]="src" [title]="'CPQ.PREVIEW.TITLE' | translate"></iframe>
          }

          <nz-table #lines [nzData]="v.quote.items" nzSize="small" [nzShowPagination]="false" data-test="lines">
            <tbody>
              @for (line of lines.data; track line.id) {
                <tr>
                  <td>
                    @if (line.is_optional && v.quote.allow_optional_selection && outcome() === null) {
                      <label [attr.for]="'quote-signature-field-' + $index" [nzId]="'quote-signature-field-' + $index" nz-checkbox [ngModel]="isSelected(line)" (ngModelChange)="toggle(line, $event)" [ngModelOptions]="{ standalone: true }">
                        {{ line.description }}
                      </label>
                    } @else {
                      {{ line.description }}
                    }
                    @for (spec of line.specs; track spec) {
                      <div class="spec">{{ spec }}</div>
                    }
                  </td>
                  <td>{{ line.quantity }}</td>
                  <td>{{ line.line_total }} {{ v.quote.currency }}</td>
                </tr>
              }
            </tbody>
          </nz-table>
          <p data-test="total">{{ v.quote.total_gross }} {{ v.quote.currency }}</p>

          @switch (outcome()) {
            @case ('signed') {
              <nz-alert nzType="success" nzShowIcon data-test="signed" [nzMessage]="'CPQ.SIGN.SUCCESS' | translate" />
            }
            @case ('changes') {
              <nz-alert nzType="info" nzShowIcon data-test="changes-sent" [nzMessage]="'CPQ.SIGN.CHANGES_SENT' | translate" />
            }
            @default {
              <form [formGroup]="form" (ngSubmit)="sign()" class="form">
                <label for="signer-name">{{ 'CPQ.SIGN.SIGNER_NAME' | translate }}</label>
                <input nz-input id="signer-name" formControlName="signer_name" />
                <label for="signer-role">{{ 'CPQ.SIGN.SIGNER_ROLE' | translate }}</label>
                <input nz-input id="signer-role" formControlName="signer_role" />
                <label for="po-number">{{ 'CPQ.SIGN.PO_NUMBER' | translate }}</label>
                <input nz-input id="po-number" formControlName="purchase_order_number" />

                <nz-radio-group formControlName="signature_type" data-test="signature-type">
                  <label for="quote-signature-drawn" appRadioControl nz-radio nzValue="drawn">{{ 'CPQ.SIGN.SIGNATURE_DRAW' | translate }}</label>
                  <label for="quote-signature-typed" appRadioControl nz-radio nzValue="typed">{{ 'CPQ.SIGN.SIGNATURE_TYPE' | translate }}</label>
                </nz-radio-group>
                @if (form.controls.signature_type.value === 'drawn') {
                  <app-signature-pad (signatureChange)="drawn.set($event)" />
                } @else {
                  <input nz-input id="typed-signature" formControlName="typed_signature" [attr.aria-label]="'CPQ.SIGN.SIGNATURE_TYPE' | translate" />
                }

                <label for="quote-signature-accept-terms" nzId="quote-signature-accept-terms" nz-checkbox formControlName="accept_terms" data-test="accept-terms">{{ 'CPQ.SIGN.ACCEPT_TERMS' | translate }}</label>

                <div class="actions">
                  <button nz-button nzType="primary" type="submit" data-test="accept" [nzLoading]="busy()" [disabled]="!canSign()">
                    {{ 'CPQ.SIGN.ACCEPT' | translate }}
                  </button>
                  <button nz-button type="button" data-test="start-changes" (click)="requesting.set(true)">
                    {{ 'CPQ.SIGN.REQUEST_CHANGES' | translate }}
                  </button>
                </div>
              </form>

              @if (requesting()) {
                <form [formGroup]="changesForm" (ngSubmit)="requestChanges()" class="form">
                  <label for="changes-message">{{ 'CPQ.SIGN.CHANGES_MESSAGE' | translate }}</label>
                  <textarea nz-input id="changes-message" rows="3" formControlName="message"></textarea>
                  <button nz-button type="submit" data-test="send-changes" [nzLoading]="busy()" [disabled]="changesForm.invalid">
                    {{ 'CPQ.SIGN.REQUEST_CHANGES' | translate }}
                  </button>
                </form>
              }
              @if (errorMessage(); as error) {
                <nz-alert nzType="error" nzShowIcon data-test="error" [nzMessage]="error" />
              }
            }
          }
        }
      </nz-spin>
    </nz-card>
  `,
  styles: `
    .card {
      max-width: 880px;
      margin: 24px auto;
    }
    .language,
    .actions {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }
    .form {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 16px;
    }
    .pdf {
      width: 100%;
      height: 60vh;
      border: 0;
    }
    .spec {
      opacity: 0.75;
    }
  `,
})
export class QuoteSignatureComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(CpqApiService);
  private readonly fb = inject(FormBuilder);
  private readonly sanitizer = inject(DomSanitizer);
  protected readonly i18n = inject(I18nService);

  protected readonly view = signal<CpqPublicSigningView | null>(null);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly invalid = signal(false);
  protected readonly requesting = signal(false);
  protected readonly outcome = signal<'signed' | 'changes' | null>(null);
  protected readonly errorMessage = signal('');
  protected readonly pdfUrl = signal<SafeResourceUrl | null>(null);
  protected readonly drawn = signal<string | null>(null);
  protected readonly selected = signal<ReadonlySet<string>>(new Set());

  protected readonly form = this.fb.nonNullable.group({
    signer_name: ['', [Validators.required, Validators.maxLength(150)]],
    signer_role: ['', [Validators.required, Validators.maxLength(150)]],
    purchase_order_number: ['', Validators.maxLength(100)],
    signature_type: this.fb.nonNullable.control<'drawn' | 'typed'>('typed'),
    typed_signature: ['', Validators.maxLength(150)],
    accept_terms: [false, Validators.requiredTrue],
  });
  protected readonly changesForm = this.fb.nonNullable.group({
    message: ['', [Validators.required, Validators.maxLength(2000)]],
  });

  protected readonly canSign = computed(() => {
    // The signal below makes the check follow the form: valid status and the chosen signature.
    this.formVersion();
    const value = this.form.getRawValue();
    const hasSignature = value.signature_type === 'drawn' ? this.drawn() !== null : value.typed_signature.trim() !== '';

    return this.form.valid && hasSignature && !this.busy();
  });

  private readonly formVersion = signal(0);
  private token = '';
  private objectUrl: string | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.revoke());
    this.form.valueChanges.subscribe(() => this.formVersion.update((n) => n + 1));
  }

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') ?? '';
    this.api.getPublicSigning(this.token).subscribe({
      next: (res) => {
        this.view.set(res.data);
        this.selected.set(new Set(res.data.quote.items.filter((line) => line.is_optional && line.is_selected).map((line) => line.id)));
        this.loading.set(false);
        void this.i18n.setLanguage(res.data.locale);
        this.loadPdf();
      },
      error: () => {
        this.invalid.set(true);
        this.loading.set(false);
      },
    });
  }

  protected changeLanguage(lang: SupportedLanguage): void {
    void this.i18n.setLanguage(lang);
    this.loadPdf();
  }

  protected isSelected(line: CpqPublicQuoteLine): boolean {
    return this.selected().has(line.id);
  }

  protected toggle(line: CpqPublicQuoteLine, checked: boolean): void {
    this.selected.update((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(line.id);
      } else {
        next.delete(line.id);
      }

      return next;
    });
  }

  protected sign(): void {
    if (!this.canSign()) {
      return;
    }

    const value = this.form.getRawValue();
    const view = this.view();
    const payload: CpqSignRequest = {
      signer_name: value.signer_name,
      signer_role: value.signer_role,
      purchase_order_number: value.purchase_order_number === '' ? null : value.purchase_order_number,
      signature_type: value.signature_type,
      signature_data: value.signature_type === 'drawn' ? (this.drawn() ?? '') : value.typed_signature.trim(),
      selected_optional_item_ids: view?.quote.allow_optional_selection ? [...this.selected()] : null,
      accept_terms: true,
    };

    this.busy.set(true);
    this.errorMessage.set('');
    this.api.signPublic(this.token, payload).subscribe({
      next: () => this.done('signed'),
      error: (err: HttpErrorResponse) => this.fail(err),
    });
  }

  protected requestChanges(): void {
    if (this.changesForm.invalid) {
      return;
    }

    this.busy.set(true);
    this.api.requestPublicChanges(this.token, this.changesForm.getRawValue().message).subscribe({
      next: () => this.done('changes'),
      error: (err: HttpErrorResponse) => this.fail(err),
    });
  }

  private done(outcome: 'signed' | 'changes'): void {
    this.busy.set(false);
    this.outcome.set(outcome);
  }

  private fail(err: HttpErrorResponse): void {
    this.busy.set(false);
    const errors = (err.error as { message?: string } | null)?.message;
    this.errorMessage.set(errors ?? this.i18n.translate('CPQ.SIGN.LINK_UNAVAILABLE'));
  }

  private loadPdf(): void {
    this.api.getPublicPdf(this.token, this.i18n.currentLanguage()).subscribe({
      next: (blob) => {
        this.revoke();
        this.objectUrl = URL.createObjectURL(blob);
        this.pdfUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.objectUrl));
      },
    });
  }

  private revoke(): void {
    if (this.objectUrl !== null) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }
}
