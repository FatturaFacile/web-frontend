import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  CS_CHANNELS,
  CS_FOLLOW_UP_KEYS,
  CS_LOCALES,
  CS_SURVEY_TYPES,
  CS_TRIGGER_EVENTS,
  CsChannel,
  CsFollowUpKey,
  CsLocale,
  CsMessageText,
  CsSurveyType,
  CsTemplate,
  CsTemplatePayload,
  CsTriggerEvent,
  PermissionsService,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { CsOutcome, CUSTOMER_SATISFACTION_MODULE, scaleOf } from './customer-satisfaction.util';
import { TemplatesStore } from './templates.store';

interface TemplateForm {
  code: string;
  name: string;
  description: string;
  survey_type: CsSurveyType;
  trigger_event: CsTriggerEvent;
  channels: CsChannel[];
  delay_hours: number;
  cooldown_days: number;
  detractor_threshold: number | null;
  sla_hours: number;
  priority: number;
  allow_voice_comment: boolean;
  is_active: boolean;
  min_amount: number | null;
  department_codes: string;
  branch_codes: string;
  product_line_codes: string;
  customer_tiers: string;
  department_code: string;
  product_line_code: string;
  branch_code: string;
  messages: Record<string, CsMessageText>;
  follow_up: Record<CsFollowUpKey, Record<string, string>>;
}

const split = (value: string): string[] =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '');

function emptyForm(): TemplateForm {
  const messages: Record<string, CsMessageText> = {};
  const followUp = { low: {}, mid: {}, high: {} } as Record<CsFollowUpKey, Record<string, string>>;
  for (const locale of CS_LOCALES) {
    messages[locale] = { subject: '', body: '', one_click_label: '' };
    for (const key of CS_FOLLOW_UP_KEYS) {
      followUp[key][locale] = '';
    }
  }
  return {
    code: '',
    name: '',
    description: '',
    survey_type: 'nps',
    trigger_event: 'ticket_closed',
    channels: ['email'],
    delay_hours: 2,
    cooldown_days: 60,
    detractor_threshold: null,
    sla_hours: 24,
    priority: 100,
    allow_voice_comment: false,
    is_active: true,
    min_amount: null,
    department_codes: '',
    branch_codes: '',
    product_line_codes: '',
    customer_tiers: '',
    department_code: '',
    product_line_code: '',
    branch_code: '',
    messages,
    follow_up: followUp,
  };
}

/**
 * NPS / CSAT / CES templates and their ERP trigger rules: event and filters, channels, the delay, the survey fatigue cooldown
 * (60 days by default), the detractor threshold with its SLA, the dimensions and the localized texts and follow-up questions of
 * the five locales (it-CH, de-CH, fr-CH, en, it-IT).
 */
@Component({
  selector: 'app-cs-templates',
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCheckboxModule,
    NzDrawerModule,
    NzEmptyModule,
    NzInputModule,
    NzInputNumberModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSpinModule,
    NzSwitchModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  providers: [TemplatesStore],
  styleUrl: './customer-satisfaction.scss',
  template: `
    <app-page-header
      [title]="'PAGE_TITLE.CUSTOMER_SATISFACTION_TEMPLATES' | translate"
      [subtitle]="'customerSatisfaction.templates.subtitle' | translate"
    ></app-page-header>

    <div class="toolbar">
      <span class="spacer"></span>
      @if (canWrite) {
        <button nz-button type="button" data-test="install-defaults" (click)="installDefaults()">
          {{ 'customerSatisfaction.action.installDefaults' | translate }}
        </button>
        <button
          nz-button
          nzType="primary"
          type="button"
          data-test="new-template"
          (click)="openCreate()"
        >
          {{ 'customerSatisfaction.action.newTemplate' | translate }}
        </button>
      }
    </div>

    @if (store.error(); as error) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        [nzMessage]="error | translate"
      ></nz-alert>
    }
    @if (feedback(); as failure) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        nzCloseable
        [nzMessage]="
          failure.errorKey ?? 'customerSatisfaction.error.generic' | translate: failure.params
        "
        [nzDescription]="failure.detail ?? undefined"
        (nzOnClose)="feedback.set(null)"
      ></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      <nz-table
        #table
        nzSize="small"
        [nzData]="store.templates()"
        [nzShowPagination]="false"
        [nzScroll]="{ x: '1000px' }"
      >
        <thead>
          <tr>
            <th scope="col">{{ 'customerSatisfaction.field.code' | translate }}</th>
            <th scope="col">{{ 'customerSatisfaction.field.surveyType' | translate }}</th>
            <th scope="col">{{ 'customerSatisfaction.field.triggerEvent' | translate }}</th>
            <th scope="col">{{ 'customerSatisfaction.field.channels' | translate }}</th>
            <th scope="col" class="num">
              {{ 'customerSatisfaction.field.delayHours' | translate }}
            </th>
            <th scope="col" class="num">
              {{ 'customerSatisfaction.field.cooldownDays' | translate }}
            </th>
            <th scope="col" class="num">{{ 'customerSatisfaction.field.slaHours' | translate }}</th>
            <th scope="col">{{ 'customerSatisfaction.field.active' | translate }}</th>
            <th scope="col">{{ 'customerSatisfaction.field.actions' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (template of table.data; track template.id) {
            <tr [attr.data-test]="'template-' + template.code">
              <th scope="row">
                {{ template.code }}
                <small class="muted">{{ template.name }}</small>
              </th>
              <td>
                <nz-tag nzColor="blue">{{
                  'customerSatisfaction.surveyType.' + template.survey_type | translate
                }}</nz-tag>
                <small class="muted">{{ template.scale.min }}–{{ template.scale.max }}</small>
              </td>
              <td>{{ 'customerSatisfaction.trigger.' + template.trigger_event | translate }}</td>
              <td>
                @for (channel of template.channels; track channel) {
                  <nz-tag>{{ 'customerSatisfaction.channel.' + channel | translate }}</nz-tag>
                }
              </td>
              <td class="num">{{ template.delay_hours }}</td>
              <td class="num">{{ template.cooldown_days }}</td>
              <td class="num">{{ template.sla_hours }}</td>
              <td>
                <nz-switch
                  nzSize="small"
                  [ngModel]="template.is_active"
                  [nzDisabled]="!canWrite"
                  [attr.aria-label]="'customerSatisfaction.field.active' | translate"
                  (ngModelChange)="toggle(template)"
                ></nz-switch>
              </td>
              <td class="row-actions">
                @if (canWrite) {
                  <button nz-button nzSize="small" type="button" (click)="openEdit(template)">
                    {{ 'customerSatisfaction.action.edit' | translate }}
                  </button>
                  <button
                    nz-button
                    nzSize="small"
                    nzDanger
                    type="button"
                    nz-popconfirm
                    [nzPopconfirmTitle]="'customerSatisfaction.confirm.deleteTemplate' | translate"
                    (nzOnConfirm)="remove(template)"
                  >
                    {{ 'customerSatisfaction.action.delete' | translate }}
                  </button>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!store.loading() && store.templates().length === 0) {
        <nz-empty
          [nzNotFoundContent]="'customerSatisfaction.empty.templates' | translate"
        ></nz-empty>
      }
    </nz-spin>

    <nz-drawer
      [nzVisible]="drawerOpen()"
      [nzWidth]="720"
      [nzTitle]="
        (editingId()
          ? 'customerSatisfaction.templates.editTitle'
          : 'customerSatisfaction.templates.newTitle'
        ) | translate
      "
      (nzOnClose)="drawerOpen.set(false)"
    >
      <ng-container *nzDrawerContent>
        <div class="form-grid">
          <label class="field" for="cs-t-code">
            <span>{{ 'customerSatisfaction.field.code' | translate }}</span>
            <input
              nz-input
              id="cs-t-code"
              maxlength="60"
              [disabled]="editingId() !== null"
              [(ngModel)]="form.code"
            />
          </label>
          <label class="field" for="cs-t-name">
            <span>{{ 'customerSatisfaction.field.name' | translate }}</span>
            <input nz-input id="cs-t-name" maxlength="160" [(ngModel)]="form.name" />
          </label>
          <label class="field" for="cs-t-type">
            <span>{{ 'customerSatisfaction.field.surveyType' | translate }}</span>
            <nz-select nzId="cs-t-type" [(ngModel)]="form.survey_type">
              @for (type of surveyTypes; track type) {
                <nz-option
                  [nzValue]="type"
                  [nzLabel]="
                    ('customerSatisfaction.surveyType.' + type | translate) +
                    ' (' +
                    scaleLabel(type) +
                    ')'
                  "
                ></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="cs-t-trigger">
            <span>{{ 'customerSatisfaction.field.triggerEvent' | translate }}</span>
            <nz-select nzId="cs-t-trigger" [(ngModel)]="form.trigger_event">
              @for (event of triggerEvents; track event) {
                <nz-option
                  [nzValue]="event"
                  [nzLabel]="'customerSatisfaction.trigger.' + event | translate"
                ></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="cs-t-channels">
            <span>{{ 'customerSatisfaction.field.channels' | translate }}</span>
            <nz-select nzId="cs-t-channels" nzMode="multiple" [(ngModel)]="form.channels">
              @for (channel of channels; track channel) {
                <nz-option
                  [nzValue]="channel"
                  [nzLabel]="'customerSatisfaction.channel.' + channel | translate"
                ></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="cs-t-priority">
            <span>{{ 'customerSatisfaction.field.priority' | translate }}</span>
            <nz-input-number
              nzId="cs-t-priority"
              [nzMin]="0"
              [nzMax]="1000"
              [(ngModel)]="form.priority"
            ></nz-input-number>
          </label>
        </div>
        <label class="field" for="cs-t-description">
          <span>{{ 'customerSatisfaction.field.description' | translate }}</span>
          <textarea
            nz-input
            id="cs-t-description"
            rows="2"
            maxlength="2000"
            [(ngModel)]="form.description"
          ></textarea>
        </label>

        <h4 class="section-title">{{ 'customerSatisfaction.section.throttling' | translate }}</h4>
        <div class="form-grid">
          <label class="field" for="cs-t-delay">
            <span>{{ 'customerSatisfaction.field.delayHours' | translate }}</span>
            <nz-input-number
              nzId="cs-t-delay"
              [nzMin]="0"
              [nzMax]="720"
              [(ngModel)]="form.delay_hours"
            ></nz-input-number>
          </label>
          <label class="field" for="cs-t-cooldown">
            <span>{{ 'customerSatisfaction.field.cooldownDays' | translate }}</span>
            <nz-input-number
              nzId="cs-t-cooldown"
              [nzMin]="0"
              [nzMax]="730"
              [(ngModel)]="form.cooldown_days"
            ></nz-input-number>
          </label>
          <label class="field" for="cs-t-threshold">
            <span>{{ 'customerSatisfaction.field.detractorThreshold' | translate }}</span>
            <nz-input-number
              nzId="cs-t-threshold"
              [nzMin]="0"
              [nzMax]="10"
              [(ngModel)]="form.detractor_threshold"
            ></nz-input-number>
          </label>
          <label class="field" for="cs-t-sla">
            <span>{{ 'customerSatisfaction.field.slaHours' | translate }}</span>
            <nz-input-number
              nzId="cs-t-sla"
              [nzMin]="1"
              [nzMax]="720"
              [(ngModel)]="form.sla_hours"
            ></nz-input-number>
          </label>
        </div>
        <label
          nz-checkbox
          for="cs-t-voice"
          nzId="cs-t-voice"
          [(ngModel)]="form.allow_voice_comment"
          >{{ 'customerSatisfaction.field.allowVoice' | translate }}</label
        >
        <label nz-checkbox for="cs-t-active" nzId="cs-t-active" [(ngModel)]="form.is_active">{{
          'customerSatisfaction.field.active' | translate
        }}</label>

        <h4 class="section-title">{{ 'customerSatisfaction.section.filters' | translate }}</h4>
        <div class="form-grid">
          <label class="field" for="cs-t-f-dep">
            <span>{{ 'customerSatisfaction.dimension.department' | translate }}</span>
            <input nz-input id="cs-t-f-dep" [(ngModel)]="form.department_codes" />
          </label>
          <label class="field" for="cs-t-f-branch">
            <span>{{ 'customerSatisfaction.dimension.branch' | translate }}</span>
            <input nz-input id="cs-t-f-branch" [(ngModel)]="form.branch_codes" />
          </label>
          <label class="field" for="cs-t-f-line">
            <span>{{ 'customerSatisfaction.dimension.product_line' | translate }}</span>
            <input nz-input id="cs-t-f-line" [(ngModel)]="form.product_line_codes" />
          </label>
          <label class="field" for="cs-t-f-tier">
            <span>{{ 'customerSatisfaction.field.customerTier' | translate }}</span>
            <input nz-input id="cs-t-f-tier" [(ngModel)]="form.customer_tiers" />
          </label>
          <label class="field" for="cs-t-f-amount">
            <span>{{ 'customerSatisfaction.field.minAmount' | translate }}</span>
            <nz-input-number
              nzId="cs-t-f-amount"
              [nzMin]="0"
              [(ngModel)]="form.min_amount"
            ></nz-input-number>
          </label>
        </div>
        <small class="muted">{{ 'customerSatisfaction.hint.filters' | translate }}</small>

        <h4 class="section-title">{{ 'customerSatisfaction.section.dimensions' | translate }}</h4>
        <div class="form-grid">
          <label class="field" for="cs-t-d-dep">
            <span>{{ 'customerSatisfaction.dimension.department' | translate }}</span>
            <input nz-input id="cs-t-d-dep" maxlength="60" [(ngModel)]="form.department_code" />
          </label>
          <label class="field" for="cs-t-d-line">
            <span>{{ 'customerSatisfaction.dimension.product_line' | translate }}</span>
            <input nz-input id="cs-t-d-line" maxlength="60" [(ngModel)]="form.product_line_code" />
          </label>
          <label class="field" for="cs-t-d-branch">
            <span>{{ 'customerSatisfaction.dimension.branch' | translate }}</span>
            <input nz-input id="cs-t-d-branch" maxlength="60" [(ngModel)]="form.branch_code" />
          </label>
        </div>

        <h4 class="section-title">{{ 'customerSatisfaction.section.texts' | translate }}</h4>
        <nz-tabs nzSize="small">
          @for (locale of locales; track locale) {
            <nz-tab [nzTitle]="locale">
              <label class="field" [attr.for]="'cs-t-subject-' + locale">
                <span>{{ 'customerSatisfaction.field.subject' | translate }}</span>
                <input
                  nz-input
                  [id]="'cs-t-subject-' + locale"
                  maxlength="200"
                  [(ngModel)]="form.messages[locale].subject"
                />
              </label>
              <label class="field" [attr.for]="'cs-t-body-' + locale">
                <span>{{ 'customerSatisfaction.field.body' | translate }}</span>
                <textarea
                  nz-input
                  [id]="'cs-t-body-' + locale"
                  rows="4"
                  maxlength="4000"
                  [(ngModel)]="form.messages[locale].body"
                ></textarea>
              </label>
              <label class="field" [attr.for]="'cs-t-label-' + locale">
                <span>{{ 'customerSatisfaction.field.oneClickLabel' | translate }}</span>
                <input
                  nz-input
                  [id]="'cs-t-label-' + locale"
                  maxlength="200"
                  [(ngModel)]="form.messages[locale].one_click_label"
                />
              </label>
              @for (key of followUpKeys; track key) {
                <label class="field" [attr.for]="'cs-t-fu-' + key + '-' + locale">
                  <span>{{ 'customerSatisfaction.followUp.' + key | translate }}</span>
                  <textarea
                    nz-input
                    [id]="'cs-t-fu-' + key + '-' + locale"
                    rows="2"
                    maxlength="500"
                    [(ngModel)]="form.follow_up[key][locale]"
                  ></textarea>
                </label>
              }
            </nz-tab>
          }
        </nz-tabs>
        <small class="muted">{{ 'customerSatisfaction.hint.placeholder' | translate }}</small>

        <p class="section-title">
          <button
            nz-button
            nzType="primary"
            type="button"
            data-test="save-template"
            [nzLoading]="store.saving()"
            (click)="save()"
          >
            {{ 'customerSatisfaction.action.save' | translate }}
          </button>
        </p>
      </ng-container>
    </nz-drawer>
  `,
})
export class TemplatesComponent implements OnInit {
  protected readonly store = inject(TemplatesStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly canWrite = inject(PermissionsService).canWrite(CUSTOMER_SATISFACTION_MODULE);
  protected readonly surveyTypes = CS_SURVEY_TYPES;
  protected readonly triggerEvents = CS_TRIGGER_EVENTS;
  protected readonly channels = CS_CHANNELS;
  protected readonly locales: readonly CsLocale[] = CS_LOCALES;
  protected readonly followUpKeys = CS_FOLLOW_UP_KEYS;

  protected readonly drawerOpen = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly feedback = signal<CsOutcome | null>(null);
  protected form: TemplateForm = emptyForm();

  ngOnInit(): void {
    void this.store.load();
  }

  protected scaleLabel(type: CsSurveyType): string {
    const { min, max } = scaleOf(type);
    return `${min}–${max}`;
  }

  protected openCreate(): void {
    this.form = emptyForm();
    this.editingId.set(null);
    this.feedback.set(null);
    this.drawerOpen.set(true);
  }

  protected openEdit(template: CsTemplate): void {
    const form = emptyForm();
    Object.assign(form, {
      code: template.code,
      name: template.name,
      description: template.description ?? '',
      survey_type: template.survey_type,
      trigger_event: template.trigger_event,
      channels: [...template.channels],
      delay_hours: template.delay_hours,
      cooldown_days: template.cooldown_days,
      detractor_threshold: template.detractor_threshold,
      sla_hours: template.sla_hours,
      priority: template.priority,
      allow_voice_comment: template.allow_voice_comment,
      is_active: template.is_active,
      min_amount: template.trigger_filters.min_amount ?? null,
      department_codes: (template.trigger_filters.department_code ?? []).join(', '),
      branch_codes: (template.trigger_filters.branch_code ?? []).join(', '),
      product_line_codes: (template.trigger_filters.product_line_code ?? []).join(', '),
      customer_tiers: (template.trigger_filters.customer_tier ?? []).join(', '),
      department_code: template.dimensions.department_code ?? '',
      product_line_code: template.dimensions.product_line_code ?? '',
      branch_code: template.dimensions.branch_code ?? '',
    });
    for (const locale of CS_LOCALES) {
      const text = template.messages[locale];
      if (text) {
        form.messages[locale] = {
          subject: text.subject,
          body: text.body,
          one_click_label: text.one_click_label ?? '',
        };
      }
      for (const key of CS_FOLLOW_UP_KEYS) {
        form.follow_up[key][locale] = template.follow_up_config[key]?.[locale] ?? '';
      }
    }
    this.form = form;
    this.editingId.set(template.id);
    this.feedback.set(null);
    this.drawerOpen.set(true);
  }

  protected payload(): CsTemplatePayload {
    const form = this.form;
    const messages: Record<string, CsMessageText> = {};
    for (const locale of CS_LOCALES) {
      const text = form.messages[locale];
      if (text.subject.trim() !== '' && text.body.trim() !== '') {
        messages[locale] = {
          subject: text.subject.trim(),
          body: text.body.trim(),
          one_click_label: text.one_click_label?.trim() || null,
        };
      }
    }
    const followUp: Partial<Record<CsFollowUpKey, Record<string, string>>> = {};
    for (const key of CS_FOLLOW_UP_KEYS) {
      const prompts: Record<string, string> = {};
      for (const locale of CS_LOCALES) {
        const prompt = form.follow_up[key][locale]?.trim();
        if (prompt) {
          prompts[locale] = prompt;
        }
      }
      followUp[key] = prompts;
    }

    return {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      description: form.description.trim() || null,
      survey_type: form.survey_type,
      trigger_event: form.trigger_event,
      trigger_filters: {
        department_code: split(form.department_codes),
        branch_code: split(form.branch_codes),
        product_line_code: split(form.product_line_codes),
        customer_tier: split(form.customer_tiers),
        min_amount: form.min_amount,
      },
      priority: form.priority,
      channels: form.channels,
      delay_hours: form.delay_hours,
      cooldown_days: form.cooldown_days,
      detractor_threshold: form.detractor_threshold,
      sla_hours: form.sla_hours,
      allow_voice_comment: form.allow_voice_comment,
      messages,
      follow_up_config: followUp,
      dimensions: {
        department_code: form.department_code.trim() || null,
        product_line_code: form.product_line_code.trim() || null,
        branch_code: form.branch_code.trim() || null,
      },
      is_active: form.is_active,
    };
  }

  protected async save(): Promise<void> {
    const outcome = await this.store.save(this.payload(), this.editingId() ?? undefined);
    this.report(outcome, () => this.drawerOpen.set(false));
  }

  protected async toggle(template: CsTemplate): Promise<void> {
    this.report(await this.store.toggleActive(template));
  }

  protected async remove(template: CsTemplate): Promise<void> {
    this.report(await this.store.remove(template.id));
  }

  protected async installDefaults(): Promise<void> {
    this.report(await this.store.installDefaults());
  }

  private report(outcome: CsOutcome, onSuccess?: () => void): void {
    if (outcome.ok) {
      this.feedback.set(null);
      this.message.success(this.i18n.instant('customerSatisfaction.message.saved'));
      onSuccess?.();
    } else {
      this.feedback.set(outcome);
    }
  }
}
