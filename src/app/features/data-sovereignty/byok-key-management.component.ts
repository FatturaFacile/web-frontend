import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  FormControl,
  FormRecord,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe, RadioControlDirective } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { interval, startWith } from 'rxjs';
import {
  ApiProblem,
  ByokConfiguration,
  Handshake,
  KillSwitchAction,
  KMS_PROVIDERS,
  KmsProviderType,
} from './data-sovereignty.models';
import { DataSovereigntyStore } from './data-sovereignty.store';
import {
  canConfirmKillSwitch,
  confirmationPhrase,
  healthColor,
  healthKey,
  operationKey,
  outcomeColor,
  PROVIDER_CREDENTIAL_FIELDS,
  providerKey,
  SECRET_CREDENTIAL_FIELDS,
  statusColor,
  statusKey,
} from './data-sovereignty.utils';
import { SovereigntyNavComponent } from './sovereignty-nav.component';

const AUDIT_POLL_MS = 15_000;
const OPERATIONS = [
  'UNWRAP_DEK',
  'WRAP_DEK',
  'ROTATE_KEK',
  'CACHE_HIT',
  'KILL_SWITCH_SUSPEND',
  'KILL_SWITCH_SHRED',
  'KMS_HEALTH_CHECK',
  'ACCESS_DENIED_REVOKED',
];

/**
 * Customer-managed keys: the external HSM/KMS wizard (BYOK or HYOK) with its live handshake, the rotation of the key-encryption
 * key, the emergency kill-switch behind a typed phrase and a step-up code, and the live, hash-chained KMS access log.
 */
@Component({
  selector: 'app-byok-key-management',
  imports: [
    RadioControlDirective,
    DatePipe,
    FormsModule,
    ReactiveFormsModule,
    PageHeaderComponent,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzDrawerModule,
    NzInputModule,
    NzModalModule,
    NzRadioModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
    SovereigntyNavComponent,
  ],
  template: `
    <app-page-header
      [title]="'DATA_SOVEREIGNTY.KEYS_TITLE' | translate"
      [subtitle]="'DATA_SOVEREIGNTY.KEYS_SUBTITLE' | translate"
    ></app-page-header>
    <app-sovereignty-nav></app-sovereignty-nav>

    <nz-card [nzTitle]="'DATA_SOVEREIGNTY.KEY_STATUS' | translate" data-testid="envelope-card">
      @if (store.primaryEnvelope(); as envelope) {
        <p>
          <nz-tag [nzColor]="statusColor(envelope.status)" data-testid="envelope-status">{{
            statusKey(envelope.status) | translate
          }}</nz-tag>
          <nz-tag [nzColor]="healthColor(envelope.kms_health)">{{
            healthKey(envelope.kms_health) | translate
          }}</nz-tag>
          <nz-tag>{{ envelope.mode }}</nz-tag>
          <nz-tag>{{ providerLabel(envelope.provider) | translate }}</nz-tag>
        </p>
        <p>
          {{ 'DATA_SOVEREIGNTY.KEY_VERSION' | translate }}:
          <strong>{{ envelope.key_version }}</strong> ·
          {{ 'DATA_SOVEREIGNTY.CACHE_TTL' | translate }}: {{ envelope.dek_cache_ttl_seconds }} s
        </p>
        <p>
          {{ 'DATA_SOVEREIGNTY.LAST_ROTATED' | translate }}:
          {{ envelope.last_rotated_at | date: 'medium' }} ·
          {{ 'DATA_SOVEREIGNTY.NEXT_ROTATION' | translate }}:
          {{ envelope.next_rotation_due_at | date: 'mediumDate' }}
          @if (envelope.rotation_due) {
            <nz-tag nzColor="warning" data-testid="rotation-due">{{
              'DATA_SOVEREIGNTY.ROTATION_DUE' | translate
            }}</nz-tag>
          }
        </p>
        <button
          nz-button
          nzType="primary"
          data-testid="rotate"
          [nzLoading]="store.busy()"
          [disabled]="locked() || store.busy()"
          (click)="rotate(envelope.id)"
        >
          {{ 'DATA_SOVEREIGNTY.ROTATE_NOW' | translate }}
        </button>
      } @else {
        <p data-testid="no-envelope">{{ 'DATA_SOVEREIGNTY.NO_ENVELOPE' | translate }}</p>
      }
      <button nz-button data-testid="open-wizard" (click)="openWizard()">
        {{ 'DATA_SOVEREIGNTY.CONFIGURE_KMS' | translate }}
      </button>
    </nz-card>

    @if (store.primaryEnvelope(); as envelope) {
      <nz-card
        class="danger-zone"
        data-testid="kill-switch-card"
        [nzTitle]="'DATA_SOVEREIGNTY.KILL_SWITCH' | translate"
      >
        <nz-alert
          nzType="error"
          nzShowIcon
          [nzMessage]="'DATA_SOVEREIGNTY.KILL_SWITCH_WARNING' | translate"
        ></nz-alert>
        <div class="danger-actions">
          <button
            nz-button
            nzDanger
            nzType="primary"
            data-testid="open-suspend"
            [disabled]="locked()"
            (click)="openKillSwitch('SUSPEND', envelope.id)"
          >
            {{ 'DATA_SOVEREIGNTY.SUSPEND_ACCESS' | translate }}
          </button>
          <button
            nz-button
            nzDanger
            data-testid="open-shred"
            [disabled]="envelope.status === 'REVOKED_CRYPTO_SHREDDED'"
            (click)="openKillSwitch('CRYPTO_SHRED', envelope.id)"
          >
            {{ 'DATA_SOVEREIGNTY.CRYPTO_SHRED' | translate }}
          </button>
        </div>
      </nz-card>
    }

    <nz-card [nzTitle]="'DATA_SOVEREIGNTY.AUDIT_STREAM' | translate" data-testid="audit-card">
      <div class="audit-toolbar">
        <nz-select
          class="operation-filter"
          data-testid="operation-filter"
          nzAllowClear
          [nzPlaceHolder]="'DATA_SOVEREIGNTY.FILTER_OPERATION' | translate"
          [ngModel]="store.auditOperation()"
          (ngModelChange)="filterAudit($event)"
        >
          @for (operation of operations; track operation) {
            <nz-option
              [nzValue]="operation"
              [nzLabel]="operationLabel(operation) | translate"
            ></nz-option>
          }
        </nz-select>
        @if (store.auditChain(); as chain) {
          <nz-tag [nzColor]="chain.valid ? 'success' : 'error'" data-testid="chain-status">
            {{
              (chain.valid ? 'DATA_SOVEREIGNTY.CHAIN_VALID' : 'DATA_SOVEREIGNTY.CHAIN_BROKEN')
                | translate
            }}
          </nz-tag>
        }
      </div>
      <nz-table #audit [nzData]="store.auditEntries()" [nzShowPagination]="false" nzSize="small">
        <thead>
          <tr>
            <th>{{ 'DATA_SOVEREIGNTY.COL_TIME' | translate }}</th>
            <th>{{ 'DATA_SOVEREIGNTY.COL_OPERATION' | translate }}</th>
            <th>{{ 'DATA_SOVEREIGNTY.KEY_VERSION' | translate }}</th>
            <th>{{ 'DATA_SOVEREIGNTY.COL_OUTCOME' | translate }}</th>
            <th>{{ 'DATA_SOVEREIGNTY.COL_LATENCY' | translate }}</th>
            <th>{{ 'DATA_SOVEREIGNTY.COL_NODE' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (entry of audit.data; track entry.id) {
            <tr data-testid="audit-row">
              <td>{{ entry.occurred_at | date: 'medium' }}</td>
              <td>{{ operationLabel(entry.operation) | translate }}</td>
              <td>{{ entry.key_version }}</td>
              <td>
                <nz-tag [nzColor]="outcomeColor(entry.outcome)">{{ entry.outcome }}</nz-tag>
              </td>
              <td>{{ entry.latency_ms }} ms</td>
              <td>{{ entry.source_node_code }}</td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    <nz-drawer
      [nzVisible]="wizardOpen()"
      nzPlacement="right"
      [nzWidth]="520"
      [nzTitle]="'DATA_SOVEREIGNTY.CONFIGURE_KMS' | translate"
      (nzOnClose)="wizardOpen.set(false)"
    >
      <ng-container *nzDrawerContent>
        <form [formGroup]="wizard" (ngSubmit)="save()" data-testid="wizard">
          <span class="field-label" id="mode-label">{{ 'DATA_SOVEREIGNTY.MODE' | translate }}</span>
          <nz-radio-group formControlName="mode" data-testid="mode" aria-labelledby="mode-label">
            <label for="byok-key-management-byok" appRadioControl nz-radio nzValue="BYOK">{{ 'DATA_SOVEREIGNTY.MODE_BYOK' | translate }}</label>
            <label for="byok-key-management-hyok" appRadioControl nz-radio nzValue="HYOK">{{ 'DATA_SOVEREIGNTY.MODE_HYOK' | translate }}</label>
          </nz-radio-group>
          <p class="hint">
            {{
              (isHyok() ? 'DATA_SOVEREIGNTY.HYOK_HINT' : 'DATA_SOVEREIGNTY.BYOK_HINT') | translate
            }}
          </p>

          <span class="field-label" id="provider-label">{{
            'DATA_SOVEREIGNTY.PROVIDER' | translate
          }}</span>
          <nz-select
            formControlName="provider"
            data-testid="provider"
            aria-labelledby="provider-label"
          >
            @for (provider of providers; track provider) {
              <nz-option
                [nzValue]="provider"
                [nzLabel]="providerLabel(provider) | translate"
              ></nz-option>
            }
          </nz-select>

          <label for="keyUri">{{ 'DATA_SOVEREIGNTY.KEY_URI' | translate }}</label>
          <input
            nz-input
            id="keyUri"
            formControlName="keyUri"
            data-testid="key-uri"
            autocomplete="off"
          />

          @if (wizard.controls.provider.value === 'KMIP_GENERIC') {
            <label for="kmip">{{ 'DATA_SOVEREIGNTY.KMIP_ENDPOINT' | translate }}</label>
            <input nz-input id="kmip" formControlName="kmipEndpoint" autocomplete="off" />
          }

          <fieldset [formGroup]="wizard.controls.credentials">
            <legend>{{ 'DATA_SOVEREIGNTY.CREDENTIALS' | translate }}</legend>
            @for (field of credentialFields(); track field) {
              <label [for]="'cred-' + field">{{ field }}</label>
              <input
                nz-input
                [id]="'cred-' + field"
                [formControlName]="field"
                [type]="secret(field) ? 'password' : 'text'"
                autocomplete="off"
              />
            }
          </fieldset>

          @if (!isHyok()) {
            <label for="ttl">{{ 'DATA_SOVEREIGNTY.CACHE_TTL' | translate }} (s)</label>
            <input
              nz-input
              id="ttl"
              type="number"
              min="0"
              max="900"
              formControlName="ttl"
              data-testid="ttl"
            />
          }
          <label for="rotation">{{ 'DATA_SOVEREIGNTY.ROTATION_DAYS' | translate }}</label>
          <input
            nz-input
            id="rotation"
            type="number"
            min="1"
            max="730"
            formControlName="rotationDays"
          />

          @if (handshake(); as result) {
            <nz-alert
              data-testid="handshake-result"
              [nzType]="result.wrap && result.unwrap ? 'success' : 'error'"
              nzShowIcon
              [nzMessage]="
                (result.wrap && result.unwrap
                  ? 'DATA_SOVEREIGNTY.HANDSHAKE_OK'
                  : 'DATA_SOVEREIGNTY.HANDSHAKE_FAILED'
                ) | translate
              "
            ></nz-alert>
          }
          @if (wizardError(); as problem) {
            <nz-alert
              nzType="error"
              nzShowIcon
              data-testid="wizard-error"
              [nzMessage]="problem"
            ></nz-alert>
          }

          <div class="wizard-actions">
            <button
              nz-button
              type="button"
              data-testid="test-handshake"
              [nzLoading]="store.busy()"
              [disabled]="wizard.invalid || store.busy()"
              (click)="testHandshake()"
            >
              {{ 'DATA_SOVEREIGNTY.TEST_HANDSHAKE' | translate }}
            </button>
            <button
              nz-button
              nzType="primary"
              type="submit"
              data-testid="save-wizard"
              [nzLoading]="store.busy()"
              [disabled]="wizard.invalid || store.busy()"
            >
              {{ 'DATA_SOVEREIGNTY.SAVE' | translate }}
            </button>
          </div>
        </form>
      </ng-container>
    </nz-drawer>

    <nz-modal
      [nzVisible]="killAction() !== null"
      [nzMaskClosable]="false"
      [nzTitle]="
        (killAction() === 'CRYPTO_SHRED'
          ? 'DATA_SOVEREIGNTY.CRYPTO_SHRED'
          : 'DATA_SOVEREIGNTY.SUSPEND_ACCESS'
        ) | translate
      "
      [nzFooter]="null"
      (nzOnCancel)="closeKillSwitch()"
    >
      <ng-container *nzModalContent>
        <nz-alert
          nzType="error"
          nzShowIcon
          [nzMessage]="
            (killAction() === 'CRYPTO_SHRED'
              ? 'DATA_SOVEREIGNTY.SHRED_WARNING'
              : 'DATA_SOVEREIGNTY.KILL_SWITCH_WARNING'
            ) | translate
          "
        ></nz-alert>
        <form [formGroup]="killForm" (ngSubmit)="confirmKillSwitch()" data-testid="kill-form">
          <label for="reason">{{ 'DATA_SOVEREIGNTY.REASON' | translate }}</label>
          <textarea
            nz-input
            id="reason"
            rows="3"
            formControlName="reason"
            data-testid="kill-reason"
          ></textarea>
          <label for="phrase">
            {{ 'DATA_SOVEREIGNTY.TYPE_PHRASE' | translate }}:
            <code data-testid="required-phrase">{{ requiredPhrase() }}</code>
          </label>
          <input
            nz-input
            id="phrase"
            formControlName="phrase"
            data-testid="kill-phrase"
            autocomplete="off"
          />
          <label for="mfa">{{ 'DATA_SOVEREIGNTY.MFA_CODE' | translate }}</label>
          <input
            nz-input
            id="mfa"
            formControlName="mfaCode"
            data-testid="kill-mfa"
            inputmode="numeric"
            maxlength="6"
            autocomplete="one-time-code"
          />
          @if (killError(); as problem) {
            <nz-alert
              nzType="error"
              nzShowIcon
              data-testid="kill-error"
              [nzMessage]="problem"
            ></nz-alert>
          }
          <div class="wizard-actions">
            <button nz-button type="button" data-testid="kill-cancel" (click)="closeKillSwitch()">
              {{ 'DATA_SOVEREIGNTY.CANCEL' | translate }}
            </button>
            <button
              nz-button
              nzDanger
              nzType="primary"
              type="submit"
              data-testid="kill-confirm"
              [nzLoading]="store.busy()"
              [disabled]="!killReady() || store.busy()"
            >
              {{ 'DATA_SOVEREIGNTY.CONFIRM_KILL_SWITCH' | translate }}
            </button>
          </div>
        </form>
      </ng-container>
    </nz-modal>
  `,
  styles: `
    nz-card {
      margin-bottom: 16px;
    }
    .danger-zone {
      border-color: var(--ant-color-error, #ff4d4f);
    }
    .danger-actions,
    .wizard-actions,
    .audit-toolbar {
      display: flex;
      gap: 12px;
      margin-top: 12px;
      align-items: center;
    }
    .operation-filter {
      min-width: 240px;
    }
    form label,
    .field-label {
      display: block;
      margin: 12px 0 4px;
    }
    fieldset {
      border: 0;
      padding: 0;
    }
  `,
})
export class ByokKeyManagementComponent implements OnInit {
  protected readonly store = inject(DataSovereigntyStore);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly operations = OPERATIONS;
  protected readonly providers = KMS_PROVIDERS;
  protected readonly statusColor = statusColor;
  protected readonly statusKey = statusKey;
  protected readonly healthColor = healthColor;
  protected readonly healthKey = healthKey;
  protected readonly outcomeColor = outcomeColor;

  protected readonly wizardOpen = signal(false);
  protected readonly handshake = signal<Handshake | null>(null);
  protected readonly wizardError = signal<string | null>(null);
  protected readonly killAction = signal<KillSwitchAction | null>(null);
  protected readonly killError = signal<string | null>(null);
  private readonly killEnvelopeId = signal<string | null>(null);

  private readonly credentialRecord = new FormRecord<FormControl<string>>({});

  protected readonly wizard = this.fb.group({
    mode: this.fb.control<'BYOK' | 'HYOK'>('BYOK'),
    provider: this.fb.control<Exclude<KmsProviderType, 'PLATFORM'>>('SECUROSYS_PRIMUS_HSM'),
    keyUri: this.fb.control('', [Validators.required, Validators.maxLength(512)]),
    kmipEndpoint: this.fb.control(''),
    credentials: this.credentialRecord,
    ttl: this.fb.control(300, [Validators.min(0), Validators.max(900)]),
    rotationDays: this.fb.control(90, [Validators.min(1), Validators.max(730)]),
  });

  protected readonly killForm = this.fb.group({
    reason: this.fb.control('', [Validators.required, Validators.minLength(10)]),
    phrase: this.fb.control('', Validators.required),
    mfaCode: this.fb.control('', [Validators.required, Validators.pattern(/^\d{6}$/)]),
  });

  private readonly wizardValue = toSignal(
    this.wizard.valueChanges.pipe(startWith(this.wizard.getRawValue())),
    { requireSync: true },
  );
  private readonly killValue = toSignal(
    this.killForm.valueChanges.pipe(startWith(this.killForm.getRawValue())),
    { requireSync: true },
  );

  protected readonly isHyok = computed(() => this.wizardValue().mode === 'HYOK');
  protected readonly locked = computed(() => this.store.isLocked());
  protected readonly credentialFields = computed(
    () => PROVIDER_CREDENTIAL_FIELDS[this.wizardValue().provider ?? 'SECUROSYS_PRIMUS_HSM'],
  );
  protected readonly requiredPhrase = computed(() =>
    confirmationPhrase(this.killAction() ?? 'SUSPEND'),
  );
  /** The confirmation guard: the exact typed phrase, a six-digit step-up code and a reason of substance. */
  protected readonly killReady = computed(() => {
    const value = this.killValue();

    return canConfirmKillSwitch(
      this.killAction() ?? 'SUSPEND',
      value.phrase ?? '',
      value.mfaCode ?? '',
      value.reason ?? '',
    );
  });

  constructor() {
    this.rebuildCredentials('SECUROSYS_PRIMUS_HSM');
    this.wizard.controls.provider.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((provider) => this.rebuildCredentials(provider));
    this.wizard.controls.mode.valueChanges.pipe(takeUntilDestroyed()).subscribe((mode) => {
      this.wizard.controls.ttl.setValue(mode === 'HYOK' ? 0 : 300);
    });
  }

  ngOnInit(): void {
    this.store.loadDashboard().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    interval(AUDIT_POLL_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.store.loadAudit(this.store.auditOperation()).subscribe());
  }

  protected providerLabel(provider: KmsProviderType): string {
    return providerKey(provider);
  }

  protected operationLabel(operation: string): string {
    return operationKey(operation);
  }

  protected secret(field: string): boolean {
    return SECRET_CREDENTIAL_FIELDS.has(field);
  }

  protected filterAudit(operation: string | null): void {
    this.store.loadAudit(operation).pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }

  protected openWizard(): void {
    this.handshake.set(null);
    this.wizardError.set(null);
    this.wizardOpen.set(true);
  }

  protected testHandshake(): void {
    this.wizardError.set(null);
    this.store
      .testHandshake(this.configuration())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => this.handshake.set(result),
        error: (error: unknown) => {
          this.handshake.set({ wrap: false, unwrap: false });
          this.wizardError.set(this.problem(error));
        },
      });
  }

  protected save(): void {
    if (this.wizard.invalid) {
      return;
    }

    this.wizardError.set(null);
    this.store
      .configure(this.configuration())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.wizardOpen.set(false);
          this.message.success(this.translate.translate('DATA_SOVEREIGNTY.CONFIGURED'));
          this.store.loadDashboard().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
        },
        error: (error: unknown) => this.wizardError.set(this.problem(error)),
      });
  }

  protected rotate(envelopeId: string): void {
    this.store
      .rotate(envelopeId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.message.success(this.translate.translate('DATA_SOVEREIGNTY.ROTATED'));
          this.store
            .loadAudit(this.store.auditOperation())
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe();
        },
        error: (error: unknown) => this.message.error(this.problem(error)),
      });
  }

  protected openKillSwitch(action: KillSwitchAction, envelopeId: string): void {
    this.killForm.reset({ reason: '', phrase: '', mfaCode: '' });
    this.killError.set(null);
    this.killEnvelopeId.set(envelopeId);
    this.killAction.set(action);
  }

  protected closeKillSwitch(): void {
    this.killAction.set(null);
    this.killEnvelopeId.set(null);
  }

  protected confirmKillSwitch(): void {
    const action = this.killAction();
    const envelopeId = this.killEnvelopeId();

    // The guard is also enforced here: a disabled button is not the only way to submit a form.
    if (action === null || envelopeId === null || !this.killReady()) {
      return;
    }

    const value = this.killForm.getRawValue();
    this.store
      .killSwitch(envelopeId, {
        action,
        reason: value.reason,
        confirmation_phrase: value.phrase,
        mfa_code: value.mfaCode,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.closeKillSwitch();
          this.message.warning(this.translate.translate('DATA_SOVEREIGNTY.KEY_LOCKED'));
          this.store.loadAudit(null).pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
        },
        error: (error: unknown) => this.killError.set(this.problem(error)),
      });
  }

  private configuration(): ByokConfiguration {
    const value = this.wizard.getRawValue();
    const credentials = Object.fromEntries(
      Object.entries(value.credentials).filter(([, secret]) => secret !== ''),
    );

    return {
      key_management_mode: value.mode,
      provider_type: value.provider,
      external_key_uri: value.keyUri,
      kmip_endpoint:
        value.provider === 'KMIP_GENERIC' && value.kmipEndpoint !== '' ? value.kmipEndpoint : null,
      credentials,
      dek_cache_ttl_seconds: value.mode === 'HYOK' ? 0 : value.ttl,
      rotation_interval_days: value.rotationDays,
    };
  }

  private rebuildCredentials(provider: Exclude<KmsProviderType, 'PLATFORM'>): void {
    const group = this.credentialRecord;

    for (const name of Object.keys(group.controls)) {
      group.removeControl(name);
    }

    for (const field of PROVIDER_CREDENTIAL_FIELDS[provider]) {
      group.addControl(field, this.fb.control(''));
    }
  }

  private problem(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const body = error.error as ApiProblem | null;

      return (
        body?.detail ?? body?.title ?? this.translate.translate('DATA_SOVEREIGNTY.GENERIC_ERROR')
      );
    }

    return this.translate.translate('DATA_SOVEREIGNTY.GENERIC_ERROR');
  }
}
