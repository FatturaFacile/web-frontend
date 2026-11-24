import { Clipboard } from '@angular/cdk/clipboard';
import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  GapViewsApiService,
  I18nService,
  LEAD_WEBHOOK_DUPLICATE_STRATEGIES,
  LEAD_WEBHOOK_PROVIDERS,
  LeadWebhookDuplicateStrategy,
  LeadWebhookEndpoint,
  LeadWebhookProvider,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorMessage, httpStatus } from '../leads/lead-http.utils';

/** Web-to-Lead endpoints (WordPress, Webflow, Meta, LinkedIn or generic): the secret is shown only once, on creation and rotation. */
@Component({
  selector: 'app-lead-webhooks',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  template: `
    <app-page-header
      [title]="'CRM.LEAD_WEBHOOKS.TITLE' | translate"
      [subtitle]="'CRM.LEAD_WEBHOOKS.SUBTITLE' | translate"
    >
      <div header-actions>
        <button nz-button nzType="primary" (click)="openCreate()">
          {{ 'CRM.LEAD_WEBHOOKS.NEW' | translate }}
        </button>
      </div>
    </app-page-header>

    @if (forbidden()) {
      <nz-alert nzType="info" nzShowIcon [nzMessage]="'CRM.LEADS.FORBIDDEN' | translate" />
    } @else {
      @if (loadError()) {
        <nz-alert
          nzType="error"
          nzShowIcon
          [nzMessage]="'CRM.LEAD_WEBHOOKS.LOAD_ERROR' | translate"
        />
      }
      <nz-card>
        <nz-table
          nzSize="small"
          [nzData]="endpoints()"
          [nzLoading]="loading()"
          [nzShowPagination]="false"
        >
          <thead>
            <tr>
              <th>{{ 'CRM.LEAD_WEBHOOKS.NAME' | translate }}</th>
              <th>{{ 'CRM.LEAD_WEBHOOKS.PROVIDER' | translate }}</th>
              <th>{{ 'CRM.LEAD_WEBHOOKS.URL' | translate }}</th>
              <th>{{ 'CRM.LEAD_WEBHOOKS.DUPLICATES' | translate }}</th>
              <th>{{ 'CRM.LEAD_WEBHOOKS.RECEIVED' | translate }}</th>
              <th>{{ 'CRM.LEAD_WEBHOOKS.LAST_RECEIVED' | translate }}</th>
              <th>{{ 'COMMON.ACTIONS' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (e of endpoints(); track e.id) {
              <tr>
                <td>
                  {{ e.name }}
                  @if (!e.is_active) {
                    <nz-tag>{{ 'COMMON.INACTIVE' | translate }}</nz-tag>
                  }
                </td>
                <td>{{ 'CRM.LEAD_WEBHOOKS.PROVIDERS.' + e.provider.toUpperCase() | translate }}</td>
                <td>
                  <code>{{ e.url }}</code>
                  <button nz-button nzSize="small" nzType="link" (click)="copy(e.url)">
                    {{ 'COMMON.COPY' | translate }}
                  </button>
                </td>
                <td>
                  {{
                    'CRM.LEAD_WEBHOOKS.STRATEGIES.' + e.duplicate_strategy.toUpperCase() | translate
                  }}
                </td>
                <td>{{ e.received_count }}</td>
                <td>
                  {{
                    e.last_received_at
                      ? (e.last_received_at | date: 'medium')
                      : ('CRM.LEAD_SOURCES.NEVER' | translate)
                  }}
                </td>
                <td>
                  <button
                    nz-button
                    nzSize="small"
                    nz-popconfirm
                    [nzPopconfirmTitle]="'CRM.LEAD_SOURCES.CONFIRM_ROTATE' | translate"
                    [nzOkText]="'COMMON.CONFIRM' | translate"
                    (nzOnConfirm)="rotate(e)"
                  >
                    {{ 'CRM.LEAD_SOURCES.ROTATE' | translate }}
                  </button>
                  <button
                    nz-button
                    nzSize="small"
                    nzDanger
                    nz-popconfirm
                    [nzPopconfirmTitle]="'CRM.LEAD_WEBHOOKS.CONFIRM_DELETE' | translate"
                    [nzOkText]="'COMMON.DELETE' | translate"
                    (nzOnConfirm)="remove(e)"
                  >
                    {{ 'COMMON.DELETE' | translate }}
                  </button>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="7">{{ 'CRM.LEAD_WEBHOOKS.EMPTY' | translate }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-card>
    }

    <nz-modal
      [nzVisible]="modalOpen()"
      [nzTitle]="'CRM.LEAD_WEBHOOKS.NEW' | translate"
      [nzOkText]="'COMMON.SAVE' | translate"
      [nzCancelText]="'COMMON.CANCEL' | translate"
      [nzOkLoading]="saving()"
      [nzOkDisabled]="form.invalid"
      [nzMaskClosable]="false"
      (nzOnOk)="create()"
      (nzOnCancel)="modalOpen.set(false)"
    >
      <ng-container *nzModalContent>
        @if (formError()) {
          <nz-alert nzType="error" nzShowIcon [nzMessage]="formError()" />
        }
        <form nz-form nzLayout="vertical" [formGroup]="form">
          <nz-form-item>
            <nz-form-label nzRequired nzFor="hook_name">{{
              'CRM.LEAD_WEBHOOKS.NAME' | translate
            }}</nz-form-label>
            <nz-form-control [nzErrorTip]="'COMMON.REQUIRED' | translate">
              <input nz-input id="hook_name" formControlName="name" maxlength="150" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="hook_provider">{{
              'CRM.LEAD_WEBHOOKS.PROVIDER' | translate
            }}</nz-form-label>
            <nz-form-control>
              <nz-select nzId="hook_provider" formControlName="provider">
                @for (p of providers; track p) {
                  <nz-option
                    [nzValue]="p"
                    [nzLabel]="'CRM.LEAD_WEBHOOKS.PROVIDERS.' + p.toUpperCase() | translate"
                  />
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="hook_strategy">{{
              'CRM.LEAD_WEBHOOKS.DUPLICATES' | translate
            }}</nz-form-label>
            <nz-form-control>
              <nz-select nzId="hook_strategy" formControlName="duplicate_strategy">
                @for (s of strategies; track s) {
                  <nz-option
                    [nzValue]="s"
                    [nzLabel]="'CRM.LEAD_WEBHOOKS.STRATEGIES.' + s.toUpperCase() | translate"
                  />
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal
      [nzVisible]="!!secret()"
      [nzTitle]="'CRM.LEAD_SOURCES.SECRETS.TITLE' | translate"
      [nzMaskClosable]="false"
      [nzOkText]="'CRM.LEAD_SOURCES.SECRETS.DONE' | translate"
      [nzCancelText]="'COMMON.COPY' | translate"
      (nzOnOk)="secret.set(null)"
      (nzOnCancel)="copySecret()"
    >
      <ng-container *nzModalContent>
        <nz-alert
          nzType="warning"
          nzShowIcon
          [nzMessage]="'CRM.LEAD_SOURCES.SECRETS.WARNING' | translate"
        />
        <p>
          <strong>{{ 'CRM.LEAD_SOURCES.WEBHOOK_SECRET' | translate }}</strong>
        </p>
        <code>{{ secret() }}</code>
      </ng-container>
    </nz-modal>
  `,
})
export class LeadWebhooksComponent implements OnInit {
  private readonly api = inject(GapViewsApiService);
  private readonly fb = inject(FormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly clipboard = inject(Clipboard);
  private readonly i18n = inject(I18nService);

  protected readonly providers = LEAD_WEBHOOK_PROVIDERS;
  protected readonly strategies = LEAD_WEBHOOK_DUPLICATE_STRATEGIES;
  protected readonly endpoints = signal<LeadWebhookEndpoint[]>([]);
  protected readonly loading = signal(false);
  protected readonly loadError = signal(false);
  protected readonly forbidden = signal(false);
  protected readonly saving = signal(false);
  protected readonly modalOpen = signal(false);
  protected readonly formError = signal<string | null>(null);
  /** Shown once after create / rotate, never persisted. */
  protected readonly secret = signal<string | null>(null);

  protected readonly form = this.fb.group({
    name: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(150)]),
    provider: this.fb.nonNullable.control<LeadWebhookProvider>('generic'),
    duplicate_strategy: this.fb.nonNullable.control<LeadWebhookDuplicateStrategy>('notify'),
  });

  ngOnInit(): void {
    this.load();
  }

  protected openCreate(): void {
    this.form.reset({ name: '', provider: 'generic', duplicate_strategy: 'notify' });
    this.formError.set(null);
    this.modalOpen.set(true);
  }

  protected create(): void {
    if (this.form.invalid || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.formError.set(null);
    this.api.createLeadWebhook(this.form.getRawValue()).subscribe({
      next: (endpoint) => {
        this.saving.set(false);
        this.modalOpen.set(false);
        this.secret.set(endpoint.secret ?? null);
        this.message.success(this.i18n.translate('CRM.LEAD_WEBHOOKS.SAVED'));
        this.load();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.formError.set(
          apiErrorMessage(error) ?? this.i18n.translate('CRM.LEAD_WEBHOOKS.SAVE_FAILED'),
        );
      },
    });
  }

  protected rotate(endpoint: LeadWebhookEndpoint): void {
    this.api.rotateLeadWebhookSecret(endpoint.id).subscribe({
      next: (rotated) => this.secret.set(rotated.secret ?? null),
      error: (error: unknown) =>
        this.message.error(
          apiErrorMessage(error) ?? this.i18n.translate('CRM.LEAD_WEBHOOKS.SAVE_FAILED'),
        ),
    });
  }

  protected remove(endpoint: LeadWebhookEndpoint): void {
    this.api.deleteLeadWebhook(endpoint.id).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('CRM.LEAD_WEBHOOKS.DELETED'));
        this.load();
      },
      error: (error: unknown) =>
        this.message.error(
          apiErrorMessage(error) ?? this.i18n.translate('CRM.LEAD_WEBHOOKS.SAVE_FAILED'),
        ),
    });
  }

  protected copy(text: string): void {
    this.clipboard.copy(text);
    this.message.success(this.i18n.translate('COMMON.COPIED'));
  }

  protected copySecret(): void {
    const value = this.secret();
    if (value) {
      this.copy(value);
    }
  }

  private load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.api.listLeadWebhooks().subscribe({
      next: (response) => {
        this.endpoints.set(response.data);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        if (httpStatus(error) === 403) {
          this.forbidden.set(true);
        } else {
          this.loadError.set(true);
        }
      },
    });
  }
}
