import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  ESIG_JURISDICTIONS,
  ESIG_LEVELS,
  ESIG_PROVIDERS,
  ESIG_PROVIDER_JURISDICTIONS,
  ESIG_ROUTING_MODES,
  ESIG_SIGNABLE_TYPES,
  EsigProviderConfig,
  EsigTemplate,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import {
  ESIG_CREDENTIAL_FIELDS,
  EsigOutcome,
  isProviderFormValid,
  isTemplateFormValid,
  levelColor,
  providerFormOf,
  ProviderFormValue,
  providerPayloadOf,
  templateFormOf,
  TemplateFormValue,
  templatePayloadOf,
} from './e-signature.util';
import { SignatureSettingsStore } from './signature-settings.store';

/**
 * Signature settings: the configurations of Swisscom Trust Services, InfoCert, Namirial and the built-in engine (credentials
 * are write-only: they are stored encrypted and never shown again), a connection test for each, and the compliance rules
 * that decide the tier of a document by type and amount (for example quotes FES, purchase orders from 5,000 FEA, employment
 * contracts FEQ).
 */
@Component({
  selector: 'app-signature-settings',
  imports: [
    FormsModule,
    PageHeaderComponent,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzEmptyModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSpinModule,
    NzSwitchModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
  ],
  providers: [SignatureSettingsStore],
  template: `
    <app-page-header [title]="'PAGE_TITLE.SIGNATURES_SETTINGS' | translate"></app-page-header>

    @if (store.error(); as error) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        [nzMessage]="error | translate"
      ></nz-alert>
    }
    @if (actionError(); as error) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        nzCloseable
        [nzMessage]="error | translate"
        (nzOnClose)="actionError.set(null)"
      ></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      <nz-tabs>
        <nz-tab [nzTitle]="'signatures.settings.providersTab' | translate">
          <div class="toolbar">
            <button nz-button nzType="primary" type="button" (click)="openProvider(null)">
              {{ 'signatures.settings.addProvider' | translate }}
            </button>
          </div>
          <nz-table
            #providers
            nzSize="small"
            [nzData]="store.providers()"
            [nzShowPagination]="false"
          >
            <thead>
              <tr>
                <th scope="col">{{ 'signatures.field.name' | translate }}</th>
                <th scope="col">{{ 'signatures.field.provider' | translate }}</th>
                <th scope="col">{{ 'signatures.field.jurisdiction' | translate }}</th>
                <th scope="col">{{ 'signatures.field.status' | translate }}</th>
                <th scope="col">{{ 'signatures.settings.lastTest' | translate }}</th>
                <th scope="col">
                  <span class="sr-only">{{ 'signatures.field.actions' | translate }}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              @for (config of providers.data; track config.id) {
                <tr>
                  <th scope="row">
                    {{ config.name }}
                    @if (config.is_default) {
                      <nz-tag nzColor="blue">{{ 'signatures.field.default' | translate }}</nz-tag>
                    }
                  </th>
                  <td>{{ 'signatures.provider.' + config.provider | translate }}</td>
                  <td>
                    {{ 'signatures.providerJurisdiction.' + config.jurisdiction | translate }}
                  </td>
                  <td>
                    <nz-tag [nzColor]="config.is_active ? 'green' : 'default'">{{
                      (config.is_active ? 'signatures.field.active' : 'signatures.field.inactive')
                        | translate
                    }}</nz-tag>
                    @if (config.is_sandbox) {
                      <nz-tag nzColor="orange">{{ 'signatures.field.sandbox' | translate }}</nz-tag>
                    }
                  </td>
                  <td>
                    @if (config.last_test_status) {
                      <nz-tag [nzColor]="config.last_test_status === 'ok' ? 'green' : 'red'">
                        {{ 'signatures.test.' + config.last_test_message | translate }}
                      </nz-tag>
                    }
                  </td>
                  <td class="actions">
                    <button
                      nz-button
                      nzSize="small"
                      type="button"
                      [nzLoading]="store.testing() === config.id"
                      (click)="test(config)"
                    >
                      {{ 'signatures.settings.testConnection' | translate }}
                    </button>
                    <button nz-button nzSize="small" type="button" (click)="openProvider(config)">
                      {{ 'signatures.action.edit' | translate }}
                    </button>
                    <button
                      nz-button
                      nzSize="small"
                      nzDanger
                      type="button"
                      nz-popconfirm
                      [nzPopconfirmTitle]="'signatures.settings.confirmDelete' | translate"
                      (nzOnConfirm)="removeProvider(config)"
                    >
                      {{ 'signatures.action.delete' | translate }}
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
          @if (!store.loading() && store.providers().length === 0) {
            <nz-empty
              [nzNotFoundContent]="'signatures.settings.noProviders' | translate"
            ></nz-empty>
          }
        </nz-tab>

        <nz-tab [nzTitle]="'signatures.settings.rulesTab' | translate">
          <nz-alert
            class="feedback"
            nzType="info"
            nzShowIcon
            [nzMessage]="'signatures.settings.rulesHint' | translate"
          ></nz-alert>
          <h3>{{ 'signatures.settings.baseRules' | translate }}</h3>
          <ul class="base-rules">
            @for (type of signableTypes; track type) {
              <li>
                <strong>{{ 'signatures.signableType.' + type | translate }}</strong>:
                @for (rule of rulesOf(type); track rule.min_amount) {
                  <nz-tag [nzColor]="levelColor(rule.level)">
                    {{ rule.level }}
                    @if (rule.min_amount > 0) {
                      ≥ {{ rule.min_amount }}
                    }
                  </nz-tag>
                }
              </li>
            }
          </ul>
          <div class="toolbar">
            <button nz-button nzType="primary" type="button" (click)="openTemplate(null)">
              {{ 'signatures.settings.addTemplate' | translate }}
            </button>
          </div>
          <nz-table
            #templates
            nzSize="small"
            [nzData]="store.templates()"
            [nzShowPagination]="false"
          >
            <thead>
              <tr>
                <th scope="col">{{ 'signatures.field.name' | translate }}</th>
                <th scope="col">{{ 'signatures.field.documentType' | translate }}</th>
                <th scope="col">{{ 'signatures.field.level' | translate }}</th>
                <th scope="col">{{ 'signatures.field.minAmount' | translate }}</th>
                <th scope="col">{{ 'signatures.field.routing' | translate }}</th>
                <th scope="col">
                  <span class="sr-only">{{ 'signatures.field.actions' | translate }}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              @for (template of templates.data; track template.id) {
                <tr>
                  <th scope="row">
                    {{ template.name }}
                    @if (!template.is_active) {
                      <nz-tag>{{ 'signatures.field.inactive' | translate }}</nz-tag>
                    }
                  </th>
                  <td>{{ 'signatures.signableType.' + template.document_type | translate }}</td>
                  <td>
                    <nz-tag [nzColor]="levelColor(template.required_level)">{{
                      template.required_level
                    }}</nz-tag>
                    {{ 'signatures.jurisdictionBadge.' + template.jurisdiction | translate }}
                  </td>
                  <td>
                    @if (template.min_amount !== null) {
                      {{ template.min_amount }} {{ template.amount_currency }}
                    }
                  </td>
                  <td>{{ 'signatures.routing.' + template.routing_mode | translate }}</td>
                  <td class="actions">
                    <button nz-button nzSize="small" type="button" (click)="openTemplate(template)">
                      {{ 'signatures.action.edit' | translate }}
                    </button>
                    <button
                      nz-button
                      nzSize="small"
                      nzDanger
                      type="button"
                      nz-popconfirm
                      [nzPopconfirmTitle]="'signatures.settings.confirmDelete' | translate"
                      (nzOnConfirm)="removeTemplate(template)"
                    >
                      {{ 'signatures.action.delete' | translate }}
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-tab>
      </nz-tabs>
    </nz-spin>

    <nz-modal
      [nzVisible]="providerOpen()"
      [nzTitle]="'signatures.settings.providerForm' | translate"
      [nzOkText]="'signatures.action.save' | translate"
      [nzCancelText]="'signatures.action.cancel' | translate"
      [nzOkDisabled]="!providerValid()"
      [nzOkLoading]="store.saving()"
      [nzWidth]="640"
      (nzOnOk)="saveProvider()"
      (nzOnCancel)="providerOpen.set(false)"
    >
      <ng-container *nzModalContent>
        @if (formError(); as failure) {
          <nz-alert
            class="feedback"
            nzType="error"
            nzShowIcon
            [nzMessage]="failure | translate"
          ></nz-alert>
        }
        <div class="grid">
          <label class="field" for="esig-p-provider">
            <span>{{ 'signatures.field.provider' | translate }}</span>
            <nz-select
              nzId="esig-p-provider"
              [nzDisabled]="editingProviderId() !== null"
              [ngModel]="providerForm().provider"
              (ngModelChange)="patchProvider({ provider: $event, credentials: {} })"
            >
              @for (provider of providerTypes; track provider) {
                <nz-option
                  [nzValue]="provider"
                  [nzLabel]="'signatures.provider.' + provider | translate"
                ></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="esig-p-name">
            <span>{{ 'signatures.field.name' | translate }}</span>
            <input
              nz-input
              id="esig-p-name"
              maxlength="160"
              [ngModel]="providerForm().name"
              (ngModelChange)="patchProvider({ name: $event })"
            />
          </label>
          <label class="field" for="esig-p-jurisdiction">
            <span>{{ 'signatures.field.jurisdiction' | translate }}</span>
            <nz-select
              nzId="esig-p-jurisdiction"
              [ngModel]="providerForm().jurisdiction"
              (ngModelChange)="patchProvider({ jurisdiction: $event })"
            >
              @for (option of providerJurisdictions; track option) {
                <nz-option
                  [nzValue]="option"
                  [nzLabel]="'signatures.providerJurisdiction.' + option | translate"
                ></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="esig-p-base">
            <span>{{ 'signatures.settings.baseUrl' | translate }}</span>
            <input
              nz-input
              id="esig-p-base"
              type="url"
              placeholder="https://"
              [ngModel]="providerForm().base_url"
              (ngModelChange)="patchProvider({ base_url: $event })"
            />
          </label>
        </div>

        @for (field of credentialFields(); track field.key) {
          <label class="field" [attr.for]="'esig-c-' + field.key">
            <span>
              {{ 'signatures.credential.' + field.key | translate }}
              @if (isConfigured(field.key)) {
                <nz-tag nzColor="green">{{
                  'signatures.settings.credentialSet' | translate
                }}</nz-tag>
              }
            </span>
            @if (field.multiline) {
              <textarea
                nz-input
                rows="4"
                [id]="'esig-c-' + field.key"
                autocomplete="off"
                [placeholder]="
                  isConfigured(field.key) ? ('signatures.settings.keepSecret' | translate) : ''
                "
                [ngModel]="providerForm().credentials[field.key] ?? ''"
                (ngModelChange)="patchCredential(field.key, $event)"
              ></textarea>
            } @else {
              <input
                nz-input
                [id]="'esig-c-' + field.key"
                [type]="field.secret ? 'password' : 'text'"
                autocomplete="off"
                [placeholder]="
                  isConfigured(field.key) ? ('signatures.settings.keepSecret' | translate) : ''
                "
                [ngModel]="providerForm().credentials[field.key] ?? ''"
                (ngModelChange)="patchCredential(field.key, $event)"
              />
            }
          </label>
        }

        @if (providerForm().provider === 'native') {
          <label class="field" for="esig-p-cert">
            <span>{{ 'signatures.settings.certificate' | translate }}</span>
            <input
              id="esig-p-cert"
              type="file"
              accept=".p12,.pfx"
              (change)="onCertificate($event)"
            />
            <span class="hint">{{
              (editingHasCertificate()
                ? 'signatures.settings.certificateSet'
                : 'signatures.settings.certificateHint'
              ) | translate
            }}</span>
          </label>
          @if (providerForm().certificate) {
            <label class="field" for="esig-p-certpass">
              <span>{{ 'signatures.settings.certificatePassword' | translate }}</span>
              <input
                nz-input
                id="esig-p-certpass"
                type="password"
                autocomplete="off"
                [ngModel]="providerForm().certificate_password"
                (ngModelChange)="patchProvider({ certificate_password: $event })"
              />
            </label>
          }
        }

        <div class="switches">
          <label for="esig-provider-sandbox"
            ><nz-switch
              nzId="esig-provider-sandbox"
              [ngModel]="providerForm().is_sandbox"
              (ngModelChange)="patchProvider({ is_sandbox: $event })"
            ></nz-switch>
            {{ 'signatures.field.sandbox' | translate }}</label
          >
          <label for="esig-provider-active"
            ><nz-switch
              nzId="esig-provider-active"
              [ngModel]="providerForm().is_active"
              (ngModelChange)="patchProvider({ is_active: $event })"
            ></nz-switch>
            {{ 'signatures.field.active' | translate }}</label
          >
          <label for="esig-provider-default"
            ><nz-switch
              nzId="esig-provider-default"
              [ngModel]="providerForm().is_default"
              (ngModelChange)="patchProvider({ is_default: $event })"
            ></nz-switch>
            {{ 'signatures.field.default' | translate }}</label
          >
        </div>
        @if (providerForm().is_sandbox) {
          <p class="hint">{{ 'signatures.settings.sandboxHint' | translate }}</p>
        }
      </ng-container>
    </nz-modal>

    <nz-modal
      [nzVisible]="templateOpen()"
      [nzTitle]="'signatures.settings.templateForm' | translate"
      [nzOkText]="'signatures.action.save' | translate"
      [nzCancelText]="'signatures.action.cancel' | translate"
      [nzOkDisabled]="!templateValid()"
      [nzOkLoading]="store.saving()"
      [nzWidth]="640"
      (nzOnOk)="saveTemplate()"
      (nzOnCancel)="templateOpen.set(false)"
    >
      <ng-container *nzModalContent>
        @if (formError(); as failure) {
          <nz-alert
            class="feedback"
            nzType="error"
            nzShowIcon
            [nzMessage]="failure | translate"
          ></nz-alert>
        }
        <div class="grid">
          <label class="field" for="esig-t-name">
            <span>{{ 'signatures.field.name' | translate }}</span>
            <input
              nz-input
              id="esig-t-name"
              maxlength="160"
              [ngModel]="templateForm().name"
              (ngModelChange)="patchTemplate({ name: $event })"
            />
          </label>
          <label class="field" for="esig-t-type">
            <span>{{ 'signatures.field.documentType' | translate }}</span>
            <nz-select
              nzId="esig-t-type"
              [ngModel]="templateForm().document_type"
              (ngModelChange)="patchTemplate({ document_type: $event })"
            >
              @for (type of signableTypes; track type) {
                <nz-option
                  [nzValue]="type"
                  [nzLabel]="'signatures.signableType.' + type | translate"
                ></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="esig-t-level">
            <span>{{ 'signatures.field.level' | translate }}</span>
            <nz-select
              nzId="esig-t-level"
              [ngModel]="templateForm().required_level"
              (ngModelChange)="patchTemplate({ required_level: $event })"
            >
              @for (level of levels; track level) {
                <nz-option
                  [nzValue]="level"
                  [nzLabel]="level + ' · ' + ('signatures.levelLong.' + level | translate)"
                ></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="esig-t-jurisdiction">
            <span>{{ 'signatures.field.jurisdiction' | translate }}</span>
            <nz-select
              nzId="esig-t-jurisdiction"
              [ngModel]="templateForm().jurisdiction"
              (ngModelChange)="patchTemplate({ jurisdiction: $event })"
            >
              @for (jurisdiction of jurisdictions; track jurisdiction) {
                <nz-option
                  [nzValue]="jurisdiction"
                  [nzLabel]="'signatures.jurisdictionBadge.' + jurisdiction | translate"
                ></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="esig-t-provider">
            <span>{{ 'signatures.field.provider' | translate }}</span>
            <nz-select
              nzId="esig-t-provider"
              nzAllowClear
              [ngModel]="templateForm().provider_config_id"
              (ngModelChange)="patchTemplate({ provider_config_id: $event ?? null })"
            >
              @for (config of store.providers(); track config.id) {
                <nz-option [nzValue]="config.id" [nzLabel]="config.name"></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="esig-t-routing">
            <span>{{ 'signatures.field.routing' | translate }}</span>
            <nz-select
              nzId="esig-t-routing"
              [ngModel]="templateForm().routing_mode"
              (ngModelChange)="patchTemplate({ routing_mode: $event })"
            >
              @for (mode of routingModes; track mode) {
                <nz-option
                  [nzValue]="mode"
                  [nzLabel]="'signatures.routing.' + mode | translate"
                ></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="esig-t-days">
            <span>{{ 'signatures.field.expirationDays' | translate }}</span>
            <nz-input-number
              nzId="esig-t-days"
              [nzMin]="1"
              [nzMax]="90"
              [ngModel]="templateForm().expiration_days"
              (ngModelChange)="patchTemplate({ expiration_days: $event ?? 14 })"
            ></nz-input-number>
          </label>
          <label class="field" for="esig-t-reminders">
            <span>{{ 'signatures.field.reminderDays' | translate }}</span>
            <nz-select
              nzId="esig-t-reminders"
              nzMode="tags"
              [ngModel]="reminderTags()"
              (ngModelChange)="setReminders($event)"
            ></nz-select>
          </label>
          <label class="field" for="esig-t-amount">
            <span>{{ 'signatures.field.minAmount' | translate }}</span>
            <nz-input-number
              nzId="esig-t-amount"
              [nzMin]="0"
              [nzStep]="500"
              [ngModel]="templateForm().min_amount"
              (ngModelChange)="patchTemplate({ min_amount: $event ?? null })"
            ></nz-input-number>
          </label>
          <label class="field" for="esig-t-currency">
            <span>{{ 'signatures.field.currency' | translate }}</span>
            <nz-select
              nzId="esig-t-currency"
              [ngModel]="templateForm().amount_currency"
              (ngModelChange)="patchTemplate({ amount_currency: $event })"
            >
              <nz-option nzValue="CHF" nzLabel="CHF"></nz-option>
              <nz-option nzValue="EUR" nzLabel="EUR"></nz-option>
            </nz-select>
          </label>
        </div>
        <p class="hint">{{ 'signatures.settings.thresholdHint' | translate }}</p>
        <label for="esig-template-active"
          ><nz-switch
            nzId="esig-template-active"
            [ngModel]="templateForm().is_active"
            (ngModelChange)="patchTemplate({ is_active: $event })"
          ></nz-switch>
          {{ 'signatures.field.active' | translate }}</label
        >
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .feedback {
      margin-bottom: 16px;
    }

    .toolbar {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 12px;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0 16px;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-bottom: 12px;
    }

    .switches {
      display: flex;
      flex-wrap: wrap;
      gap: 24px;
      margin-top: 8px;
    }

    .hint {
      color: var(--ant-color-text-secondary, #6b7280);
      font-size: 12px;
    }

    .base-rules {
      list-style: none;
      padding: 0;
      margin: 0 0 16px;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
    }
  `,
})
export class SignatureSettingsComponent implements OnInit {
  protected readonly store = inject(SignatureSettingsStore);
  private readonly toast = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly providerTypes = ESIG_PROVIDERS;
  protected readonly providerJurisdictions = ESIG_PROVIDER_JURISDICTIONS;
  protected readonly jurisdictions = ESIG_JURISDICTIONS;
  protected readonly levels = ESIG_LEVELS;
  protected readonly routingModes = ESIG_ROUTING_MODES;
  protected readonly signableTypes = ESIG_SIGNABLE_TYPES;
  protected readonly levelColor = levelColor;

  protected readonly providerOpen = signal(false);
  protected readonly templateOpen = signal(false);
  protected readonly editingProviderId = signal<string | null>(null);
  protected readonly editingTemplateId = signal<string | null>(null);
  protected readonly providerForm = signal<ProviderFormValue>(providerFormOf(null));
  protected readonly templateForm = signal<TemplateFormValue>(templateFormOf(null));
  protected readonly formError = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);

  private readonly editingConfig = signal<EsigProviderConfig | null>(null);

  protected readonly credentialFields = computed(
    () => ESIG_CREDENTIAL_FIELDS[this.providerForm().provider],
  );
  protected readonly providerValid = computed(() => isProviderFormValid(this.providerForm()));
  protected readonly templateValid = computed(() => isTemplateFormValid(this.templateForm()));
  protected readonly editingHasCertificate = computed(
    () => this.editingConfig()?.has_certificate ?? false,
  );
  protected readonly reminderTags = computed(() => this.templateForm().reminder_days.map(String));

  ngOnInit(): void {
    void this.store.init();
  }

  protected rulesOf(type: string): { min_amount: number; level: (typeof ESIG_LEVELS)[number] }[] {
    return this.store.lookups()?.policies[type] ?? [];
  }

  protected isConfigured(key: string): boolean {
    return this.editingConfig()?.configured_credentials.includes(key) ?? false;
  }

  protected openProvider(config: EsigProviderConfig | null): void {
    this.formError.set(null);
    this.editingProviderId.set(config?.id ?? null);
    this.editingConfig.set(config);
    this.providerForm.set(providerFormOf(config));
    this.providerOpen.set(true);
  }

  protected openTemplate(template: EsigTemplate | null): void {
    this.formError.set(null);
    this.editingTemplateId.set(template?.id ?? null);
    this.templateForm.set(templateFormOf(template));
    this.templateOpen.set(true);
  }

  protected patchProvider(changes: Partial<ProviderFormValue>): void {
    this.providerForm.update((form) => ({ ...form, ...changes }));
  }

  protected patchCredential(key: string, value: string): void {
    this.providerForm.update((form) => ({
      ...form,
      credentials: { ...form.credentials, [key]: value },
    }));
  }

  protected patchTemplate(changes: Partial<TemplateFormValue>): void {
    this.templateForm.update((form) => ({ ...form, ...changes }));
  }

  protected setReminders(tags: string[]): void {
    const days = tags
      .map(Number)
      .filter((day) => Number.isInteger(day) && day >= 1 && day <= 60)
      .slice(0, 5);
    this.patchTemplate({ reminder_days: days });
  }

  protected onCertificate(event: Event): void {
    this.patchProvider({
      certificate: (event.target as HTMLInputElement).files?.item(0) ?? null,
      certificate_password: '',
    });
  }

  protected async saveProvider(): Promise<void> {
    const outcome = await this.store.saveProvider(
      this.editingProviderId(),
      providerPayloadOf(this.providerForm()),
    );
    this.finish(outcome, this.providerOpen);
  }

  protected async saveTemplate(): Promise<void> {
    const outcome = await this.store.saveTemplate(
      this.editingTemplateId(),
      templatePayloadOf(this.templateForm()),
    );
    this.finish(outcome, this.templateOpen);
  }

  protected async removeProvider(config: EsigProviderConfig): Promise<void> {
    this.report(await this.store.removeProvider(config.id), 'signatures.message.deleted');
  }

  protected async removeTemplate(template: EsigTemplate): Promise<void> {
    this.report(await this.store.removeTemplate(template.id), 'signatures.message.deleted');
  }

  protected async test(config: EsigProviderConfig): Promise<void> {
    const outcome = await this.store.testProvider(config.id);
    const result = this.store.tests()[config.id];
    this.report(outcome, null);
    if (outcome.ok && result) {
      if (result.ok) {
        this.toast.success(this.i18n.instant('signatures.message.testOk'));
      } else {
        this.toast.warning(this.i18n.instant('signatures.message.testFailed'));
      }
    }
  }

  private finish(outcome: EsigOutcome, modal: { set(value: boolean): void }): void {
    if (outcome.ok) {
      this.formError.set(null);
      modal.set(false);
      this.toast.success(this.i18n.instant('signatures.message.saved'));
    } else {
      this.formError.set(outcome.errorKey);
    }
  }

  private report(outcome: EsigOutcome, successKey: string | null): void {
    if (outcome.ok) {
      this.actionError.set(null);
      if (successKey !== null) {
        this.toast.success(this.i18n.instant(successKey));
      }
    } else {
      this.actionError.set(outcome.errorKey);
    }
  }
}
