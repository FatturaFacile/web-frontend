import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStepsModule } from 'ng-zorro-antd/steps';
import {
  applyServerErrors,
  I18nService,
  PgDsar,
  PgDsarRequestType,
  PgDsarSubjectType,
  PgErasurePreview,
  PrivacyGovernanceApiService,
} from '@core';
import { downloadBlob, TranslatePipe } from '@shared';
import { ErasurePreviewComponent } from '../../privacy-governance/erasure-preview.component';
import { pollDsarPackage } from '../../privacy-governance/dsar-package-poll';
import { pgErrorMessage } from '../../privacy-governance/privacy-governance.helpers';

export const WIZARD_SUBJECT_TYPES: readonly PgDsarSubjectType[] = [
  'customer_contact',
  'employee',
  'candidate',
  'lead',
  'supplier_contact',
];
export const WIZARD_REQUEST_TYPES: readonly PgDsarRequestType[] = [
  'access_portability',
  'erasure',
  'rectification',
  'restriction',
  'objection',
];
export const WIZARD_IDENTITY_METHODS: readonly string[] = [
  'id_document',
  'email_confirmation',
  'in_person',
  'strong_authentication',
];

/**
 * DSAR wizard: (1) record the request, (2) verify the identity and either export the data (access / portability) or
 * evaluate the erasure against the legal holds (dry run) and execute it after an explicit acknowledgement.
 */
@Component({
  selector: 'app-security-dsar-wizard',
  styleUrl: './security-center.scss',
  imports: [
    ReactiveFormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzFormModule,
    NzInputModule,
    NzSelectModule,
    NzStepsModule,
    TranslatePipe,
    ErasurePreviewComponent,
  ],
  template: `
    <nz-card class="wizard">
      <nz-steps [nzCurrent]="step()" nzSize="small">
        <nz-step [nzTitle]="'SECURITY_CENTER.DSAR.STEP_REQUEST' | translate"></nz-step>
        <nz-step [nzTitle]="'SECURITY_CENTER.DSAR.STEP_FULFIL' | translate"></nz-step>
        <nz-step [nzTitle]="'SECURITY_CENTER.DSAR.STEP_DONE' | translate"></nz-step>
      </nz-steps>

      @if (error()) {
        <nz-alert class="banner" nzType="error" nzShowIcon role="alert" [nzMessage]="error()" />
      }

      @if (step() === 0) {
        <form
          nz-form
          nzLayout="vertical"
          [formGroup]="form"
          (ngSubmit)="create()"
          data-testid="request-form"
        >
          <nz-form-item>
            <nz-form-label nzRequired nzFor="dsarSubjectType">{{
              'SECURITY_CENTER.DSAR.SUBJECT_TYPE' | translate
            }}</nz-form-label>
            <nz-form-control>
              <nz-select nzId="dsarSubjectType" formControlName="subject_type">
                @for (type of subjectTypes; track type) {
                  <nz-option
                    [nzValue]="type"
                    [nzLabel]="'PRIVACY.SUBJECT_TYPE.' + type | translate"
                  />
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="dsarName">{{
              'SECURITY_CENTER.DSAR.FULL_NAME' | translate
            }}</nz-form-label>
            <nz-form-control [nzErrorTip]="'SECURITY_CENTER.DSAR.NAME_INVALID' | translate">
              <input nz-input id="dsarName" formControlName="subject_full_name" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="dsarEmail">{{
              'SECURITY_CENTER.DSAR.EMAIL' | translate
            }}</nz-form-label>
            <nz-form-control [nzErrorTip]="'SECURITY_CENTER.DSAR.EMAIL_INVALID' | translate">
              <input nz-input id="dsarEmail" type="email" formControlName="subject_email" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="dsarRequestType">{{
              'SECURITY_CENTER.DSAR.REQUEST_TYPE' | translate
            }}</nz-form-label>
            <nz-form-control>
              <nz-select nzId="dsarRequestType" formControlName="request_type">
                @for (type of requestTypes; track type) {
                  <nz-option [nzValue]="type" [nzLabel]="'PRIVACY.DSAR_TYPE.' + type | translate" />
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="dsarNotes">{{
              'SECURITY_CENTER.DSAR.NOTES' | translate
            }}</nz-form-label>
            <nz-form-control>
              <textarea nz-input id="dsarNotes" rows="2" formControlName="audit_notes"></textarea>
            </nz-form-control>
          </nz-form-item>
          <div class="wizard-actions">
            <button
              nz-button
              nzType="primary"
              type="submit"
              data-testid="create-request"
              [disabled]="busy()"
            >
              {{ 'SECURITY_CENTER.DSAR.CREATE' | translate }}
            </button>
          </div>
        </form>
      }

      @if (step() === 1 && dsar(); as request) {
        <p>
          <strong>{{ request.request_number }}</strong> ·
          {{ 'PRIVACY.DSAR_TYPE.' + request.request_type | translate }}
        </p>

        @if (!request.identity_verified_at) {
          <div class="toolbar">
            <nz-select
              style="min-width: 220px"
              [formControl]="identityMethod"
              [attr.aria-label]="'SECURITY_CENTER.DSAR.IDENTITY_METHOD' | translate"
            >
              @for (method of identityMethods; track method) {
                <nz-option
                  [nzValue]="method"
                  [nzLabel]="'PRIVACY.IDENTITY_METHOD.' + method | translate"
                />
              }
            </nz-select>
            <button
              nz-button
              nzType="primary"
              type="button"
              data-testid="verify-identity"
              [disabled]="busy()"
              (click)="verifyIdentity()"
            >
              {{ 'SECURITY_CENTER.DSAR.VERIFY_IDENTITY' | translate }}
            </button>
          </div>
        } @else {
          @switch (request.request_type) {
            @case ('access_portability') {
              <div class="toolbar">
                <button
                  nz-button
                  nzType="primary"
                  type="button"
                  data-testid="generate-package"
                  [disabled]="busy()"
                  (click)="generatePackage()"
                >
                  {{ 'SECURITY_CENTER.DSAR.GENERATE_EXPORT' | translate }}
                </button>
                @if (request.package_status === 'ready') {
                  <button
                    nz-button
                    type="button"
                    data-testid="download-package"
                    (click)="download()"
                  >
                    {{ 'SECURITY_CENTER.DSAR.DOWNLOAD' | translate }}
                  </button>
                } @else if (request.package_status) {
                  <span>{{
                    'SECURITY_CENTER.DSAR.PACKAGE_' + request.package_status.toUpperCase()
                      | translate
                  }}</span>
                }
              </div>
            }
            @case ('erasure') {
              <nz-alert
                class="banner"
                nzType="warning"
                nzShowIcon
                [nzMessage]="'SECURITY_CENTER.DSAR.LEGAL_HOLD_NOTICE' | translate"
              />
              <div class="toolbar">
                <button
                  nz-button
                  type="button"
                  data-testid="evaluate-erasure"
                  [disabled]="busy()"
                  (click)="evaluateErasure()"
                >
                  {{ 'SECURITY_CENTER.DSAR.EVALUATE_ERASURE' | translate }}
                </button>
              </div>
              @if (preview(); as result) {
                <app-erasure-preview [preview]="result" />
                <form [formGroup]="erasureForm" (ngSubmit)="executeErasure()">
                  <input
                    type="checkbox"
                    id="erasureAck"
                    formControlName="acknowledged"
                    data-testid="erasure-ack"
                  />
                  <label for="erasureAck">{{
                    'SECURITY_CENTER.DSAR.ACK_ERASURE' | translate
                  }}</label>
                  <div class="wizard-actions">
                    <button
                      nz-button
                      nzType="primary"
                      nzDanger
                      type="submit"
                      data-testid="execute-erasure"
                      [disabled]="erasureForm.invalid || busy()"
                    >
                      {{ 'SECURITY_CENTER.DSAR.EXECUTE_ERASURE' | translate }}
                    </button>
                  </div>
                </form>
              }
            }
            @default {
              <nz-alert
                nzType="info"
                nzShowIcon
                [nzMessage]="'SECURITY_CENTER.DSAR.USE_WORKBENCH' | translate"
              />
            }
          }
        }
      }

      @if (step() === 2) {
        <nz-alert
          nzType="success"
          nzShowIcon
          data-testid="wizard-done"
          [nzMessage]="'SECURITY_CENTER.DSAR.DONE' | translate"
        />
        <div class="wizard-actions">
          <button nz-button type="button" (click)="restart()">
            {{ 'SECURITY_CENTER.DSAR.NEW_REQUEST' | translate }}
          </button>
        </div>
      }
    </nz-card>
  `,
})
export class DsarWizardComponent {
  private readonly api = inject(PrivacyGovernanceApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly i18n = inject(I18nService);

  protected readonly subjectTypes = WIZARD_SUBJECT_TYPES;
  protected readonly requestTypes = WIZARD_REQUEST_TYPES;
  protected readonly identityMethods = WIZARD_IDENTITY_METHODS;

  readonly form = this.fb.group({
    subject_type: this.fb.control<PgDsarSubjectType>('customer_contact', Validators.required),
    subject_full_name: [
      '',
      [Validators.required, Validators.minLength(2), Validators.maxLength(255)],
    ],
    subject_email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
    request_type: this.fb.control<PgDsarRequestType>('access_portability', Validators.required),
    audit_notes: ['', Validators.maxLength(2000)],
  });

  /** The erasure is irreversible: it needs an explicit acknowledgement of the legal-hold evaluation. */
  readonly erasureForm = this.fb.group({
    acknowledged: [false, Validators.requiredTrue],
  });

  readonly step = signal(0);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly dsar = signal<PgDsar | null>(null);
  readonly preview = signal<PgErasurePreview | null>(null);
  readonly identityMethod = this.fb.control(WIZARD_IDENTITY_METHODS[0], Validators.required);

  readonly hasLegalHold = computed(() => this.preview()?.fiscal_lock.is_locked ?? false);

  create(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) {
      return;
    }
    const value = this.form.getRawValue();
    this.run(
      this.api.createDsar({
        subject_type: value.subject_type,
        subject_full_name: value.subject_full_name.trim(),
        subject_email: value.subject_email.trim(),
        request_type: value.request_type,
        audit_notes: value.audit_notes.trim() || null,
      }),
      ({ data }) => {
        this.dsar.set(data);
        this.step.set(1);
      },
      true,
    );
  }

  verifyIdentity(): void {
    const current = this.dsar();
    if (current) {
      this.run(this.api.verifyIdentity(current.id, this.identityMethod.value), ({ data }) =>
        this.dsar.set(data),
      );
    }
  }

  generatePackage(): void {
    const current = this.dsar();
    if (!current) {
      return;
    }
    this.run(this.api.generatePackage(current.id), ({ data }) => {
      this.dsar.set(data);
      pollDsarPackage(() => this.api.getDsar(current.id))
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((latest) => this.dsar.set(latest));
    });
  }

  download(): void {
    const current = this.dsar();
    if (!current) {
      return;
    }
    this.api.downloadPackage(current.id).subscribe({
      next: (blob) => {
        downloadBlob(blob, `${current.request_number}.zip`);
        this.step.set(2);
      },
      error: (err: unknown) =>
        this.error.set(pgErrorMessage(err, this.i18n.translate('SECURITY_CENTER.DSAR.ERROR'))),
    });
  }

  evaluateErasure(): void {
    const current = this.dsar();
    if (current) {
      this.run(this.api.executeErasure(current.id, true), ({ data }) => this.preview.set(data));
    }
  }

  executeErasure(): void {
    const current = this.dsar();
    if (!current || this.erasureForm.invalid) {
      return;
    }
    this.run(this.api.executeErasure(current.id, false), ({ data }) => {
      this.preview.set(data);
      this.step.set(2);
    });
  }

  restart(): void {
    this.form.reset();
    this.erasureForm.reset();
    this.dsar.set(null);
    this.preview.set(null);
    this.error.set(null);
    this.step.set(0);
  }

  private run<T>(request: Observable<T>, onSuccess: (value: T) => void, mapToForm = false): void {
    this.busy.set(true);
    this.error.set(null);
    request.subscribe({
      next: (value) => {
        this.busy.set(false);
        onSuccess(value);
      },
      error: (err: unknown) => {
        this.busy.set(false);
        const unmapped = mapToForm ? applyServerErrors(this.form, err) : [];
        this.error.set(
          unmapped[0] ?? pgErrorMessage(err, this.i18n.translate('SECURITY_CENTER.DSAR.ERROR')),
        );
      },
    });
  }
}
