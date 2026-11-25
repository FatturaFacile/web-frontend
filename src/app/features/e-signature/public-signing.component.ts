import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  ESIG_ID_DOCUMENT_TYPES,
  EsigIdDocumentType,
  EsigSignatureMethod,
  EsigSignPayload,
  SupportedLanguage,
  TranslateService,
} from '@core';
import { RadioControlDirective, SignaturePadComponent, TranslatePipe } from '@shared';
import { EsigOutcome, levelColor } from './e-signature.util';
import { PdfViewBox, PdfViewComponent } from './pdf-view.component';
import { PublicSigningStore } from './public-signing.store';

const LANGUAGES: readonly SupportedLanguage[] = ['it', 'de', 'fr', 'en'];

/**
 * The public signing page (`/sign/:token`, no login, no application shell). The recipient reads the document, proves who
 * they are (a code by SMS, a push to the phone or the provider's page, depending on the tier), draws, types or confirms the
 * signature with the explicit eIDAS / ZertES consents, or declines with a reason. Every text comes from the seeded
 * dictionary, in the language of the request.
 */
@Component({
  selector: 'app-public-signing',
  providers: [PublicSigningStore],
  imports: [
    DatePipe,
    FormsModule,
    PdfViewComponent,
    RadioControlDirective,
    SignaturePadComponent,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzCheckboxModule,
    NzInputModule,
    NzModalModule,
    NzRadioModule,
    NzSelectModule,
    NzSpinModule,
    NzTagModule,
  ],
  template: `
    <main class="page">
      <header class="top">
        <h1>{{ 'signatures.portal.title' | translate }}</h1>
        <nz-select
          class="lang"
          [ngModel]="language()"
          [attr.aria-label]="'signatures.portal.language' | translate"
          (ngModelChange)="setLanguage($event)"
        >
          @for (code of languages; track code) {
            <nz-option [nzValue]="code" [nzLabel]="code.toUpperCase()"></nz-option>
          }
        </nz-select>
      </header>

      <nz-spin [nzSpinning]="store.loading()">
        @if (store.blocked(); as blocked) {
          <nz-alert
            nzType="error"
            nzShowIcon
            data-test="blocked"
            [nzMessage]="blocked | translate"
          ></nz-alert>
        } @else if (store.context(); as context) {
          <nz-card class="card">
            <div class="summary">
              <h2>{{ context.envelope.title }}</h2>
              <nz-tag [nzColor]="levelColor(context.envelope.required_level)">{{
                context.envelope.required_level
              }}</nz-tag>
              <nz-tag>{{
                'signatures.jurisdictionBadge.' + context.envelope.jurisdiction | translate
              }}</nz-tag>
              @if (context.envelope.sandbox) {
                <nz-tag nzColor="orange">{{ 'signatures.field.sandbox' | translate }}</nz-tag>
              }
            </div>
            <p class="muted">
              {{ 'signatures.portal.greeting' | translate: { name: context.recipient.full_name } }}
              @if (context.envelope.expires_at) {
                · {{ 'signatures.portal.expires' | translate }}
                {{ context.envelope.expires_at | date: 'dd.MM.yyyy' }}
              }
            </p>
            @if (context.envelope.message) {
              <blockquote class="message">{{ context.envelope.message }}</blockquote>
            }
          </nz-card>

          <div class="layout">
            <section class="document" [attr.aria-label]="'signatures.portal.document' | translate">
              <app-esig-pdf-view
                mode="view"
                [source]="store.document()"
                [boxes]="boxes()"
              ></app-esig-pdf-view>
              @if (store.document() === null && !store.loading()) {
                <nz-alert
                  nzType="warning"
                  nzShowIcon
                  [nzMessage]="'signatures.portal.noPreview' | translate"
                ></nz-alert>
              }
            </section>

            <section class="action">
              @if (store.declined()) {
                <nz-alert
                  nzType="info"
                  nzShowIcon
                  data-test="declined"
                  [nzMessage]="'signatures.portal.declinedDone' | translate"
                ></nz-alert>
              } @else if (store.signed()) {
                <nz-alert
                  nzType="success"
                  nzShowIcon
                  data-test="signed"
                  [nzMessage]="'signatures.portal.signedDone' | translate"
                ></nz-alert>
                @if (store.context()?.can_download_signed) {
                  <button nz-button nzType="primary" type="button" class="gap" (click)="download()">
                    {{ 'signatures.action.downloadSigned' | translate }}
                  </button>
                } @else {
                  <p class="muted">{{ 'signatures.portal.waitingOthers' | translate }}</p>
                }
              } @else if (store.pending()) {
                <nz-alert
                  nzType="info"
                  nzShowIcon
                  data-test="pending"
                  [nzMessage]="'signatures.portal.pendingProvider' | translate"
                ></nz-alert>
              } @else if (!store.canSign()) {
                <nz-alert
                  nzType="warning"
                  nzShowIcon
                  data-test="closed"
                  [nzMessage]="'signatures.status.' + context.envelope.status | translate"
                ></nz-alert>
              } @else {
                @if (error(); as failure) {
                  <nz-alert
                    class="gap"
                    nzType="error"
                    nzShowIcon
                    data-test="error"
                    [nzMessage]="failure | translate"
                  ></nz-alert>
                }

                @if (context.recipient.auth_method !== 'email_link') {
                  <h3>{{ 'signatures.portal.identityTitle' | translate }}</h3>
                  <p class="muted">
                    {{
                      'signatures.portal.identity.' + context.recipient.auth_method
                        | translate: { phone: context.recipient.phone_hint ?? '' }
                    }}
                  </p>
                  <button
                    nz-button
                    type="button"
                    [nzLoading]="store.challenging()"
                    (click)="challenge()"
                  >
                    {{
                      (store.challenge()
                        ? 'signatures.portal.resendCode'
                        : 'signatures.portal.sendCode'
                      ) | translate
                    }}
                  </button>
                  @if (store.challenge(); as challenge) {
                    @if (challenge.type === 'redirect' && challenge.url) {
                      <a
                        nz-button
                        nzType="primary"
                        class="gap"
                        [href]="challenge.url"
                        rel="noopener"
                        >{{ 'signatures.portal.continueAtProvider' | translate }}</a
                      >
                    }
                    @if (challenge.sandbox_code) {
                      <nz-alert
                        class="gap"
                        nzType="warning"
                        nzShowIcon
                        [nzMessage]="
                          'signatures.portal.sandboxCode'
                            | translate: { code: challenge.sandbox_code }
                        "
                      ></nz-alert>
                    }
                    @if (challenge.type === 'otp') {
                      <label class="field" for="esig-otp">
                        <span>{{ 'signatures.portal.otp' | translate }}</span>
                        <input
                          nz-input
                          id="esig-otp"
                          inputmode="numeric"
                          autocomplete="one-time-code"
                          maxlength="12"
                          [ngModel]="otp()"
                          (ngModelChange)="otp.set($event)"
                        />
                      </label>
                    }
                  }
                }

                @if (context.recipient.requires_identity_document) {
                  <h3>{{ 'signatures.portal.documentTitle' | translate }}</h3>
                  <label class="field" for="esig-doc-type">
                    <span>{{ 'signatures.portal.documentType' | translate }}</span>
                    <nz-select
                      nzId="esig-doc-type"
                      [ngModel]="documentType()"
                      (ngModelChange)="documentType.set($event)"
                    >
                      @for (type of documentTypes; track type) {
                        <nz-option
                          [nzValue]="type"
                          [nzLabel]="'signatures.idDocument.' + type | translate"
                        ></nz-option>
                      }
                    </nz-select>
                  </label>
                  <label class="field" for="esig-doc-number">
                    <span>{{ 'signatures.portal.documentNumber' | translate }}</span>
                    <input
                      nz-input
                      id="esig-doc-number"
                      maxlength="40"
                      [ngModel]="documentNumber()"
                      (ngModelChange)="documentNumber.set($event)"
                    />
                  </label>
                }

                <h3>{{ 'signatures.portal.signatureTitle' | translate }}</h3>
                <nz-radio-group [ngModel]="method()" (ngModelChange)="method.set($event)">
                  <label for="esig-method-typed" appRadioControl nz-radio nzValue="typed">{{
                    'signatures.signatureMethod.typed' | translate
                  }}</label>
                  <label for="esig-method-drawn" appRadioControl nz-radio nzValue="drawn">{{
                    'signatures.signatureMethod.drawn' | translate
                  }}</label>
                  <label for="esig-method-click" appRadioControl nz-radio nzValue="click">{{
                    'signatures.signatureMethod.click' | translate
                  }}</label>
                </nz-radio-group>
                @if (method() === 'typed') {
                  <label class="field" for="esig-typed">
                    <span>{{ 'signatures.portal.typedName' | translate }}</span>
                    <input
                      nz-input
                      id="esig-typed"
                      class="typed"
                      maxlength="160"
                      [ngModel]="typedName()"
                      (ngModelChange)="typedName.set($event)"
                    />
                  </label>
                }
                @if (method() === 'drawn') {
                  <app-signature-pad (signatureChange)="drawn.set($event)"></app-signature-pad>
                }

                <div class="consents">
                  <label
                    for="esig-consent-terms"
                    nzId="esig-consent-terms"
                    nz-checkbox
                    [ngModel]="consentTerms()"
                    (ngModelChange)="consentTerms.set($event)"
                    >{{ context.consents.terms | translate }}</label
                  >
                  <label
                    for="esig-consent-legal"
                    nzId="esig-consent-legal"
                    nz-checkbox
                    [ngModel]="consentLegal()"
                    (ngModelChange)="consentLegal.set($event)"
                    >{{ context.consents.legal | translate }}</label
                  >
                </div>

                <div class="buttons">
                  <button
                    nz-button
                    nzDanger
                    type="button"
                    [disabled]="store.submitting()"
                    (click)="declineOpen.set(true)"
                  >
                    {{ 'signatures.action.decline' | translate }}
                  </button>
                  <button
                    nz-button
                    nzType="primary"
                    type="button"
                    data-test="sign"
                    [disabled]="!canSubmit()"
                    [nzLoading]="store.submitting()"
                    (click)="submit()"
                  >
                    {{ 'signatures.action.sign' | translate }}
                  </button>
                </div>
              }
            </section>
          </div>
        }
      </nz-spin>
    </main>

    <nz-modal
      [nzVisible]="declineOpen()"
      [nzTitle]="'signatures.portal.declineTitle' | translate"
      [nzOkText]="'signatures.action.decline' | translate"
      [nzCancelText]="'signatures.action.cancel' | translate"
      [nzOkDanger]="true"
      [nzOkDisabled]="reason().trim().length < 3"
      [nzOkLoading]="store.submitting()"
      (nzOnOk)="decline()"
      (nzOnCancel)="declineOpen.set(false)"
    >
      <ng-container *nzModalContent>
        <label class="field" for="esig-reason">
          <span>{{ 'signatures.portal.declineReason' | translate }}</span>
          <textarea
            nz-input
            id="esig-reason"
            rows="4"
            maxlength="1000"
            [ngModel]="reason()"
            (ngModelChange)="reason.set($event)"
          ></textarea>
        </label>
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .page {
      max-width: 1180px;
      margin: 0 auto;
      padding: 16px;
    }

    .top {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .lang {
      width: 84px;
    }

    .card {
      margin-bottom: 16px;
    }

    .summary {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }

    .summary h2 {
      margin: 0;
    }

    .muted {
      color: var(--ant-color-text-secondary, #6b7280);
    }

    .message {
      border-left: 3px solid var(--ant-color-border, #d9d9d9);
      margin: 8px 0 0;
      padding-left: 12px;
      white-space: pre-line;
    }

    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1.5fr) minmax(300px, 1fr);
      gap: 16px;
      align-items: start;
    }

    @media (max-width: 900px) {
      .layout {
        grid-template-columns: minmax(0, 1fr);
      }
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin: 12px 0;
    }

    .typed {
      font-family: 'Segoe Script', 'Brush Script MT', cursive;
      font-size: 20px;
    }

    .consents {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin: 16px 0;
    }

    .buttons {
      display: flex;
      justify-content: space-between;
      gap: 8px;
    }

    .gap {
      margin-top: 12px;
    }
  `,
})
export class PublicSigningComponent {
  protected readonly store = inject(PublicSigningStore);
  private readonly i18n = inject(TranslateService);
  private readonly route = inject(ActivatedRoute);

  protected readonly languages = LANGUAGES;
  protected readonly documentTypes: readonly EsigIdDocumentType[] = ESIG_ID_DOCUMENT_TYPES;
  protected readonly levelColor = levelColor;
  protected readonly language = this.i18n.currentLanguage;

  protected readonly method = signal<EsigSignatureMethod>('typed');
  protected readonly typedName = signal('');
  protected readonly drawn = signal<string | null>(null);
  protected readonly otp = signal('');
  protected readonly documentType = signal<EsigIdDocumentType>('identity_card');
  protected readonly documentNumber = signal('');
  protected readonly consentTerms = signal(false);
  protected readonly consentLegal = signal(false);
  protected readonly declineOpen = signal(false);
  protected readonly reason = signal('');
  protected readonly error = signal<string | null>(null);

  /** The box of the signer on the document, shown over the page so they see where the signature goes. */
  protected readonly boxes = computed<PdfViewBox[]>(() => {
    const box = this.store.context()?.recipient.signature_box;
    return box
      ? [
          {
            id: 'own',
            label: this.i18n.instant('signatures.portal.yourSignature'),
            box,
            active: true,
          },
        ]
      : [];
  });

  protected readonly canSubmit = computed(() => {
    const context = this.store.context();
    if (
      context === null ||
      this.store.submitting() ||
      !this.consentTerms() ||
      !this.consentLegal()
    ) {
      return false;
    }
    if (this.method() === 'typed' && this.typedName().trim().length < 2) {
      return false;
    }
    if (this.method() === 'drawn' && this.drawn() === null) {
      return false;
    }
    if (context.recipient.requires_identity_document && this.documentNumber().trim() === '') {
      return false;
    }
    if (
      context.recipient.auth_method !== 'email_link' &&
      this.store.challenge()?.type === 'otp' &&
      this.otp().trim().length < 4
    ) {
      return false;
    }
    return context.recipient.auth_method === 'email_link' || this.store.challenge() !== null;
  });

  constructor() {
    const token = this.route.snapshot.paramMap.get('token') ?? '';
    void this.store.load(token);

    effect(() => {
      const context = this.store.context();
      if (context !== null && this.typedName() === '') {
        this.typedName.set(context.recipient.full_name);
        const base = context.envelope.locale.slice(0, 2) as SupportedLanguage;
        if (LANGUAGES.includes(base) && base !== this.i18n.currentLanguage()) {
          void this.i18n.setLanguage(base);
        }
      }
    });
  }

  protected setLanguage(language: SupportedLanguage): void {
    void this.i18n.setLanguage(language);
  }

  protected async challenge(): Promise<void> {
    this.report(await this.store.requestChallenge());
  }

  protected async submit(): Promise<void> {
    const context = this.store.context();
    if (context === null) {
      return;
    }
    const identity: EsigSignPayload['identity'] = context.recipient.requires_identity_document
      ? { id_document_type: this.documentType(), id_document_number: this.documentNumber().trim() }
      : null;
    const payload: EsigSignPayload = {
      consent_terms: this.consentTerms(),
      consent_legal: this.consentLegal(),
      signature_method: this.method(),
      signature_data:
        this.method() === 'typed'
          ? this.typedName().trim()
          : this.method() === 'drawn'
            ? this.drawn()
            : null,
      otp: this.otp().trim() === '' ? null : this.otp().trim(),
      identity,
    };
    this.report(await this.store.sign(payload));
  }

  protected async decline(): Promise<void> {
    const outcome = await this.store.decline(this.reason().trim());
    if (outcome.ok) {
      this.declineOpen.set(false);
    }
    this.report(outcome);
  }

  protected async download(): Promise<void> {
    this.report(await this.store.downloadSigned());
  }

  private report(outcome: EsigOutcome): void {
    this.error.set(outcome.ok ? null : outcome.errorKey);
  }
}
