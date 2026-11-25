import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { CpqConfiguratorApiService, CpqExpressionCheck, CpqRecordPayload } from '@core';
import { TranslatePipe } from '@shared';
import { CpqFailure } from './cpq-format';

export type CpqFieldType =
  'text' | 'number' | 'textarea' | 'select' | 'switch' | 'i18n' | 'json' | 'expression';

export interface CpqFieldOption {
  value: string;
  /** Translation key of the label. */
  labelKey: string;
}

/** One field of a definition form. The label is the key `CPQ_CONFIGURATOR.FIELD.<KEY>` (texts come from the API). */
export interface CpqFieldDef {
  key: string;
  type: CpqFieldType;
  required?: boolean;
  options?: CpqFieldOption[];
  max?: number;
  min?: number;
  step?: number;
  /** A long text in every language (descriptions, messages) is edited in a textarea. */
  multiline?: boolean;
  /** Fixed once created (codes, types): sent only on creation. */
  createOnly?: boolean;
}

const LOCALES = ['it', 'en', 'de', 'fr'] as const;

/**
 * Generic form of the definition of the configurator (models, characteristics, options, rules, mappings, formulas), driven
 * by a list of fields: text, number, select, switch, a text in the four languages, JSON and an expression that can be
 * checked against the characteristics of the model while it is written.
 */
@Component({
  selector: 'app-cpq-entity-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzDrawerModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzSwitchModule,
    NzTagModule,
    TranslatePipe,
  ],
  template: `
    <nz-drawer [nzVisible]="open()" [nzWidth]="640" [nzTitle]="title()" (nzOnClose)="closed.emit()">
      <ng-container *nzDrawerContent>
        <form nz-form nzLayout="vertical" (ngSubmit)="save()" id="cpq-entity-form">
          @for (field of visibleFields(); track field.key) {
            <nz-form-item>
              <nz-form-label [nzFor]="'cpq-field-' + field.key" [nzRequired]="!!field.required">{{
                'CPQ_CONFIGURATOR.FIELD.' + field.key.toUpperCase() | translate
              }}</nz-form-label>
              <nz-form-control
                [nzErrorTip]="errorOf(field.key)"
                [nzValidateStatus]="errorOf(field.key) ? 'error' : ''"
              >
                @switch (field.type) {
                  @case ('text') {
                    <input
                      nz-input
                      [id]="'cpq-field-' + field.key"
                      [ngModel]="text(field.key)"
                      (ngModelChange)="set(field.key, $event)"
                      [name]="field.key"
                      [attr.maxlength]="field.max ?? 190"
                    />
                  }
                  @case ('textarea') {
                    <textarea
                      nz-input
                      rows="3"
                      [id]="'cpq-field-' + field.key"
                      [ngModel]="text(field.key)"
                      (ngModelChange)="set(field.key, $event)"
                      [name]="field.key"
                    ></textarea>
                  }
                  @case ('number') {
                    <nz-input-number
                      [nzId]="'cpq-field-' + field.key"
                      [ngModel]="num(field.key)"
                      (ngModelChange)="set(field.key, $event)"
                      [nzMin]="field.min ?? -999999999"
                      [nzMax]="field.max ?? 999999999"
                      [nzStep]="field.step ?? 1"
                      [name]="field.key"
                    ></nz-input-number>
                  }
                  @case ('switch') {
                    <nz-switch
                      [nzId]="'cpq-field-' + field.key"
                      [ngModel]="values()[field.key] === true"
                      (ngModelChange)="set(field.key, $event)"
                      [name]="field.key"
                    ></nz-switch>
                  }
                  @case ('select') {
                    <nz-select
                      [nzId]="'cpq-field-' + field.key"
                      nzAllowClear
                      [ngModel]="values()[field.key]"
                      (ngModelChange)="set(field.key, $event)"
                      [name]="field.key"
                    >
                      @for (option of field.options ?? []; track option.value) {
                        <nz-option
                          [nzValue]="option.value"
                          [nzLabel]="option.labelKey | translate"
                        ></nz-option>
                      }
                    </nz-select>
                  }
                  @case ('i18n') {
                    @for (locale of locales; track locale) {
                      <div class="lang">
                        <nz-tag>{{ locale.toUpperCase() }}</nz-tag>
                        @if (field.multiline) {
                          <textarea
                            nz-input
                            rows="2"
                            [ngModel]="i18n(field.key, locale)"
                            (ngModelChange)="setI18n(field.key, locale, $event)"
                            [name]="field.key + '-' + locale"
                            [attr.aria-label]="locale"
                          ></textarea>
                        } @else {
                          <input
                            nz-input
                            [ngModel]="i18n(field.key, locale)"
                            (ngModelChange)="setI18n(field.key, locale, $event)"
                            [name]="field.key + '-' + locale"
                            [attr.aria-label]="locale"
                          />
                        }
                      </div>
                    }
                  }
                  @case ('json') {
                    <textarea
                      nz-input
                      rows="6"
                      class="mono"
                      [id]="'cpq-field-' + field.key"
                      [ngModel]="jsonText(field.key)"
                      (ngModelChange)="setJson(field.key, $event)"
                      [name]="field.key"
                    ></textarea>
                    @if (jsonErrors()[field.key]) {
                      <nz-alert
                        nzType="error"
                        [nzMessage]="'CPQ_CONFIGURATOR.ERR.INVALID_JSON' | translate"
                      ></nz-alert>
                    }
                  }
                  @case ('expression') {
                    <textarea
                      nz-input
                      rows="2"
                      class="mono"
                      [id]="'cpq-field-' + field.key"
                      [ngModel]="text(field.key)"
                      (ngModelChange)="set(field.key, $event); checks.set({})"
                      [name]="field.key"
                    ></textarea>
                    @if (modelId()) {
                      <button nz-button nzSize="small" type="button" (click)="check(field.key)">
                        {{ 'CPQ_CONFIGURATOR.EXPRESSION.CHECK' | translate }}
                      </button>
                    }
                    @if (checks()[field.key]; as result) {
                      @if (!result.valid) {
                        <nz-alert
                          nzType="error"
                          nzShowIcon
                          [nzMessage]="'CPQ_CONFIGURATOR.EXPRESSION.INVALID' | translate"
                          [nzDescription]="result.error ?? ''"
                        ></nz-alert>
                      } @else if (result.unknown.length > 0) {
                        <nz-alert
                          nzType="warning"
                          nzShowIcon
                          [nzMessage]="
                            'CPQ_CONFIGURATOR.EXPRESSION.UNKNOWN'
                              | translate: { names: result.unknown.join(', ') }
                          "
                        ></nz-alert>
                      } @else {
                        <nz-alert
                          nzType="success"
                          nzShowIcon
                          [nzMessage]="
                            'CPQ_CONFIGURATOR.EXPRESSION.OK'
                              | translate: { names: result.variables.join(', ') }
                          "
                        ></nz-alert>
                      }
                    }
                  }
                }
              </nz-form-control>
            </nz-form-item>
          }
        </form>
      </ng-container>
      <div *nzDrawerFooter class="footer">
        <button nz-button type="button" (click)="closed.emit()">
          {{ 'CPQ_CONFIGURATOR.CANCEL' | translate }}
        </button>
        <button
          nz-button
          nzType="primary"
          type="submit"
          form="cpq-entity-form"
          [nzLoading]="saving()"
          [disabled]="hasJsonError()"
        >
          {{ 'CPQ_CONFIGURATOR.SAVE' | translate }}
        </button>
      </div>
    </nz-drawer>
  `,
  styles: `
    .lang {
      display: grid;
      grid-template-columns: 44px 1fr;
      gap: 8px;
      align-items: start;
      margin-bottom: 6px;
    }
    .mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
    }
    .footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
  `,
})
export class CpqEntityDrawerComponent {
  private readonly api = inject(CpqConfiguratorApiService);

  readonly open = input(false);
  readonly title = input('');
  readonly fields = input<CpqFieldDef[]>([]);
  /** The record being edited; null to create. */
  readonly record = input<Record<string, unknown> | null>(null);
  readonly defaults = input<Record<string, unknown>>({});
  readonly saving = input(false);
  readonly failure = input<CpqFailure | null>(null);
  /** The model whose characteristics an expression is checked against. */
  readonly modelId = input<string | null>(null);

  readonly saved = output<CpqRecordPayload>();
  readonly closed = output<void>();

  protected readonly locales = LOCALES;
  readonly values = signal<Record<string, unknown>>({});
  readonly jsonErrors = signal<Record<string, boolean>>({});
  readonly checks = signal<Record<string, CpqExpressionCheck>>({});
  private readonly jsonTexts = signal<Record<string, string>>({});

  readonly editing = computed(() => this.record() !== null);
  readonly visibleFields = computed(() => this.fields());
  readonly hasJsonError = computed(() => Object.values(this.jsonErrors()).some(Boolean));

  constructor() {
    effect(() => {
      if (!this.open()) {
        return;
      }
      const source = { ...this.defaults(), ...(this.record() ?? {}) };
      const values: Record<string, unknown> = {};
      const jsonTexts: Record<string, string> = {};
      for (const field of this.fields()) {
        const value = source[field.key];
        if (field.type === 'json') {
          jsonTexts[field.key] =
            value === null || value === undefined ? '' : JSON.stringify(value, null, 2);
        } else if (field.type === 'i18n') {
          values[field.key] = { ...((value as Record<string, string> | null | undefined) ?? {}) };
        } else {
          values[field.key] = value ?? null;
        }
      }
      this.values.set(values);
      this.jsonTexts.set(jsonTexts);
      this.jsonErrors.set({});
      this.checks.set({});
    });
  }

  text(key: string): string {
    const value = this.values()[key];

    return value === null || value === undefined ? '' : String(value);
  }

  num(key: string): number | null {
    const value = this.values()[key];

    return value === null || value === undefined || value === '' ? null : Number(value);
  }

  i18n(key: string, locale: string): string {
    return (this.values()[key] as Record<string, string> | null)?.[locale] ?? '';
  }

  jsonText(key: string): string {
    return this.jsonTexts()[key] ?? '';
  }

  errorOf(key: string): string {
    return this.failure()?.errors[key]?.[0] ?? this.failure()?.errors[`${key}.it`]?.[0] ?? '';
  }

  set(key: string, value: unknown): void {
    this.values.update((current) => ({ ...current, [key]: value }));
  }

  setI18n(key: string, locale: string, text: string): void {
    this.values.update((current) => ({
      ...current,
      [key]: { ...((current[key] as Record<string, string> | null) ?? {}), [locale]: text },
    }));
  }

  setJson(key: string, text: string): void {
    this.jsonTexts.update((current) => ({ ...current, [key]: text }));
    let invalid = false;
    if (text.trim() !== '') {
      try {
        JSON.parse(text);
      } catch {
        invalid = true;
      }
    }
    this.jsonErrors.update((current) => ({ ...current, [key]: invalid }));
  }

  async check(key: string): Promise<void> {
    const modelId = this.modelId();
    const expression = this.text(key).trim();
    if (!modelId || expression === '') {
      return;
    }
    try {
      const response = await firstValueFrom(this.api.checkExpression(modelId, expression));
      this.checks.update((current) => ({ ...current, [key]: response.data }));
    } catch {
      this.checks.update((current) => ({
        ...current,
        [key]: { valid: false, error: null, variables: [], unknown: [] },
      }));
    }
  }

  /** The payload of a save: empty texts become null, the languages left blank are dropped, JSON is parsed. */
  payload(): CpqRecordPayload {
    const payload: CpqRecordPayload = {};
    for (const field of this.fields()) {
      if (field.createOnly && this.editing()) {
        continue;
      }
      const value = this.values()[field.key];
      switch (field.type) {
        case 'i18n': {
          const entries = Object.entries((value as Record<string, string>) ?? {}).filter(
            ([, text]) => text.trim() !== '',
          );
          payload[field.key] = entries.length > 0 ? Object.fromEntries(entries) : null;
          break;
        }
        case 'json': {
          const text = this.jsonText(field.key).trim();
          payload[field.key] = text === '' ? null : JSON.parse(text);
          break;
        }
        case 'number':
          payload[field.key] =
            value === null || value === undefined || value === '' ? null : Number(value);
          break;
        case 'switch':
          payload[field.key] = value === true;
          break;
        default:
          payload[field.key] = value === undefined || value === '' ? null : value;
      }
    }

    return payload;
  }

  save(): void {
    if (this.hasJsonError()) {
      return;
    }
    this.saved.emit(this.payload());
  }
}
