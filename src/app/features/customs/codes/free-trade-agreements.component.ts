import { Component, computed, inject, OnInit, signal } from '@angular/core';
import {
  AbstractControl,
  FormsModule,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  applyServerErrors,
  AuthStore,
  canManageCustoms,
  CatalogLocale,
  countryOptions,
  CustomsCodesApiService,
  FreeTradeAgreement,
  FreeTradeAgreementPayload,
  LocalizedText,
  pickLocalized,
  TranslateService,
} from '@core';
import { IconActionDirective, ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';

const LOCALES: readonly CatalogLocale[] = ['it', 'de', 'fr', 'en'];

/** The API needs at least two partner countries. */
export function minTwoCountries(control: AbstractControl): ValidationErrors | null {
  const value = control.value as string[] | null;
  return Array.isArray(value) && value.length >= 2 ? null : { minCountries: true };
}

/** Keeps the locales that have a text (the API stores whatever object it gets). */
export function compactLocalized(value: Record<CatalogLocale, string>): LocalizedText {
  const result: LocalizedText = {};
  for (const locale of LOCALES) {
    const text = value[locale]?.trim();
    if (text) {
      result[locale] = text;
    }
  }
  return result;
}

function localizedGroup(fb: NonNullableFormBuilder) {
  return fb.group({ it: fb.control(''), de: fb.control(''), fr: fb.control(''), en: fb.control('') });
}

function localizedValue(text: LocalizedText | undefined): Record<CatalogLocale, string> {
  return { it: text?.it ?? '', de: text?.de ?? '', fr: text?.fr ?? '', en: text?.en ?? '' };
}

/** Free trade agreements: partner countries, value thresholds, proof types and origin declaration templates. */
@Component({
  selector: 'app-free-trade-agreements',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    IconActionDirective,
    ModalActionsDirective,
    NzButtonModule,
    NzCardModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSwitchModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  template: `
    <app-page-header
      [title]="'CUSTOMS_CODES.FTA.TITLE' | translate"
      [subtitle]="'CUSTOMS_CODES.FTA.SUBTITLE' | translate"
    />

    <nz-card>
      <div class="toolbar">
        <input
          nz-input
          type="search"
          class="search-input"
          [placeholder]="'COMMON.SEARCH' | translate"
          [ngModel]="search()"
          (ngModelChange)="search.set($event)"
        />
        <div class="spacer"></div>
        @if (canManage()) {
          <button nz-button nzType="primary" appIconAction="add" (click)="openCreate()"></button>
        }
      </div>

      <nz-table
        nzSize="small"
        nzShowSizeChanger
        [nzData]="filtered()"
        [nzLoading]="loading()"
        [nzPageSize]="20"
        [nzPageSizeOptions]="[10, 20, 50, 100]"
      >
        <thead>
          <tr>
            <th nzWidth="140px">{{ 'CUSTOMS_CODES.FTA.CODE' | translate }}</th>
            <th>{{ 'CUSTOMS_CODES.FTA.NAME' | translate }}</th>
            <th>{{ 'CUSTOMS_CODES.FTA.PARTNERS' | translate }}</th>
            <th nzAlign="right">{{ 'CUSTOMS_CODES.FTA.THRESHOLD_EUR' | translate }}</th>
            <th nzAlign="right">{{ 'CUSTOMS_CODES.FTA.THRESHOLD_CHF' | translate }}</th>
            <th>{{ 'CUSTOMS_CODES.FTA.PROOF_TYPES' | translate }}</th>
            <th nzWidth="100px">{{ 'COMMON.STATUS' | translate }}</th>
            <th nzWidth="110px" nzAlign="right">{{ 'COMMON.ACTIONS' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of filtered(); track row.id) {
            <tr>
              <td>
                <code>{{ row.code }}</code>
              </td>
              <td>{{ nameOf(row) }}</td>
              <td>{{ row.partner_countries.join(', ') }}</td>
              <td nzAlign="right">{{ row.value_threshold_eur ?? '-' }}</td>
              <td nzAlign="right">{{ row.value_threshold_chf ?? '-' }}</td>
              <td>
                @for (proof of row.proof_types; track proof) {
                  <nz-tag>{{ proof }}</nz-tag>
                }
                @if (row.supports_rex) {
                  <nz-tag nzColor="geekblue">REX</nz-tag>
                }
                @if (row.supports_approved_exporter) {
                  <nz-tag nzColor="purple">{{ 'CUSTOMS_CODES.FTA.APPROVED_EXPORTER_SHORT' | translate }}</nz-tag>
                }
              </td>
              <td>
                <nz-tag [nzColor]="row.is_active ? 'green' : 'default'">
                  {{ (row.is_active ? 'COMMON.ACTIVE' : 'CUSTOMS_CODES.COMMON.INACTIVE') | translate }}
                </nz-tag>
              </td>
              <td nzAlign="right">
                @if (canManage()) {
                  <button nz-button nzType="text" nzSize="small" appIconAction="edit" (click)="openEdit(row)"></button>
                  <button
                    nz-button
                    nzType="text"
                    nzDanger
                    nzSize="small"
                    appIconAction="delete"
                    nz-popconfirm
                    [nzPopconfirmTitle]="'COMMON.CONFIRM_DELETE' | translate"
                    (nzOnConfirm)="remove(row)"
                  ></button>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    <nz-modal
      [nzVisible]="modalVisible()"
      [nzTitle]="(editing() ? 'CUSTOMS_CODES.FTA.EDIT' : 'CUSTOMS_CODES.FTA.ADD') | translate"
      [nzOkLoading]="saving()"
      nzWidth="760px"
      okAction="save"
      (nzOnCancel)="modalVisible.set(false)"
      (nzOnOk)="save()"
    >
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="form">
          <nz-tabs>
            <nz-tab [nzTitle]="'CUSTOMS_CODES.FTA.TAB_GENERAL' | translate">
              <nz-form-item>
                <nz-form-label nzRequired>{{ 'CUSTOMS_CODES.FTA.CODE' | translate }}</nz-form-label>
                <nz-form-control [nzErrorTip]="requiredTip(form.controls.code)">
                  <input nz-input formControlName="code" maxlength="255" />
                </nz-form-control>
              </nz-form-item>

              @for (locale of locales; track locale) {
                <nz-form-item [formGroup]="form.controls.name">
                  <nz-form-label>{{ 'CUSTOMS_CODES.FTA.NAME' | translate }} ({{ locale.toUpperCase() }})</nz-form-label>
                  <nz-form-control>
                    <input nz-input [formControlName]="locale" />
                  </nz-form-control>
                </nz-form-item>
              }

              <nz-form-item>
                <nz-form-label nzRequired>{{ 'CUSTOMS_CODES.FTA.PARTNERS' | translate }}</nz-form-label>
                <nz-form-control [nzErrorTip]="'CUSTOMS_CODES.VALIDATION.MIN_COUNTRIES' | translate">
                  <nz-select formControlName="partner_countries" nzMode="multiple" nzShowSearch nzAllowClear>
                    @for (country of countries; track country.code) {
                      <nz-option [nzValue]="country.code" [nzLabel]="country.name + ' (' + country.code + ')'"></nz-option>
                    }
                  </nz-select>
                </nz-form-control>
              </nz-form-item>

              <div class="two-cols">
                <nz-form-item>
                  <nz-form-label>{{ 'CUSTOMS_CODES.FTA.THRESHOLD_EUR' | translate }}</nz-form-label>
                  <nz-form-control>
                    <nz-input-number class="w-full" formControlName="value_threshold_eur" [nzMin]="0" [nzStep]="100"></nz-input-number>
                  </nz-form-control>
                </nz-form-item>
                <nz-form-item>
                  <nz-form-label>{{ 'CUSTOMS_CODES.FTA.THRESHOLD_CHF' | translate }}</nz-form-label>
                  <nz-form-control>
                    <nz-input-number class="w-full" formControlName="value_threshold_chf" [nzMin]="0" [nzStep]="100"></nz-input-number>
                  </nz-form-control>
                </nz-form-item>
              </div>

              <nz-form-item>
                <nz-form-label>{{ 'CUSTOMS_CODES.FTA.PROOF_TYPES' | translate }}</nz-form-label>
                <nz-form-control>
                  <nz-select formControlName="proof_types" nzMode="tags" [nzTokenSeparators]="[',']"></nz-select>
                </nz-form-control>
              </nz-form-item>

              <div class="two-cols">
                <nz-form-item>
                  <nz-form-label>{{ 'CUSTOMS_CODES.FTA.SUPPORTS_APPROVED_EXPORTER' | translate }}</nz-form-label>
                  <nz-form-control><nz-switch formControlName="supports_approved_exporter"></nz-switch></nz-form-control>
                </nz-form-item>
                <nz-form-item>
                  <nz-form-label>{{ 'CUSTOMS_CODES.FTA.SUPPORTS_REX' | translate }}</nz-form-label>
                  <nz-form-control><nz-switch formControlName="supports_rex"></nz-switch></nz-form-control>
                </nz-form-item>
              </div>

              <nz-form-item>
                <nz-form-label>{{ 'CUSTOMS_CODES.FTA.NOTES' | translate }}</nz-form-label>
                <nz-form-control><textarea nz-input formControlName="notes" rows="2"></textarea></nz-form-control>
              </nz-form-item>

              <nz-form-item>
                <nz-form-label>{{ 'COMMON.ACTIVE' | translate }}</nz-form-label>
                <nz-form-control><nz-switch formControlName="is_active"></nz-switch></nz-form-control>
              </nz-form-item>
            </nz-tab>

            <nz-tab [nzTitle]="'CUSTOMS_CODES.FTA.TAB_DECLARATIONS' | translate">
              <p class="hint">{{ 'CUSTOMS_CODES.FTA.TEMPLATE_HINT' | translate }}</p>
              @for (locale of locales; track locale) {
                <nz-form-item [formGroup]="form.controls.declaration_templates">
                  <nz-form-label>
                    {{ 'CUSTOMS_CODES.FTA.TEMPLATE_AUTH' | translate }} ({{ locale.toUpperCase() }})
                  </nz-form-label>
                  <nz-form-control><textarea nz-input [formControlName]="locale" rows="3"></textarea></nz-form-control>
                </nz-form-item>
              }
              @for (locale of locales; track locale) {
                <nz-form-item [formGroup]="form.controls.declaration_templates_no_auth">
                  <nz-form-label>
                    {{ 'CUSTOMS_CODES.FTA.TEMPLATE_NO_AUTH' | translate }} ({{ locale.toUpperCase() }})
                  </nz-form-label>
                  <nz-form-control><textarea nz-input [formControlName]="locale" rows="3"></textarea></nz-form-control>
                </nz-form-item>
              }
            </nz-tab>
          </nz-tabs>
        </form>
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .toolbar {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }
    .search-input {
      max-width: 320px;
    }
    .spacer {
      flex: 1;
    }
    .two-cols {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    .hint {
      opacity: 0.7;
    }
    nz-select,
    nz-input-number {
      width: 100%;
    }
  `,
})
export class FreeTradeAgreementsComponent implements OnInit {
  private readonly api = inject(CustomsCodesApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly authStore = inject(AuthStore);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly locales = LOCALES;
  protected readonly countries = countryOptions();

  /** Writes are hidden for members without `customs.manage` (the API answers 403 anyway). */
  protected readonly canManage = computed(() =>
    canManageCustoms(this.authStore.activeRoles(), this.authStore.userPermissions()),
  );

  protected readonly items = signal<FreeTradeAgreement[]>([]);
  protected readonly loading = signal(false);
  protected readonly search = signal('');

  /** The list endpoint has no text search: the (at most 100) agreements are filtered here by code and name. */
  protected readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    if (!term) {
      return this.items();
    }
    return this.items().filter((row) =>
      [row.code, ...Object.values(row.name ?? {})].some((text) => (text ?? '').toLowerCase().includes(term)),
    );
  });

  protected readonly modalVisible = signal(false);
  protected readonly saving = signal(false);
  protected readonly editing = signal<FreeTradeAgreement | null>(null);

  protected readonly form = this.fb.group({
    code: this.fb.control('', [Validators.required, Validators.maxLength(255)]),
    name: localizedGroup(this.fb),
    partner_countries: this.fb.control<string[]>([], [minTwoCountries]),
    value_threshold_eur: this.fb.control<number | null>(null),
    value_threshold_chf: this.fb.control<number | null>(null),
    proof_types: this.fb.control<string[]>([]),
    supports_approved_exporter: this.fb.control(false),
    supports_rex: this.fb.control(false),
    declaration_templates: localizedGroup(this.fb),
    declaration_templates_no_auth: localizedGroup(this.fb),
    notes: this.fb.control(''),
    is_active: this.fb.control(true),
  });

  ngOnInit(): void {
    this.load();
  }

  protected nameOf(row: FreeTradeAgreement): string {
    return pickLocalized(row.name, this.translate.currentLanguage());
  }

  protected requiredTip(control: AbstractControl): string {
    const server = control.errors?.['serverError'];
    return typeof server === 'string' ? server : this.translate.instant('COMMON.VALIDATION.REQUIRED');
  }

  protected load(): void {
    this.loading.set(true);
    this.api
      .getFreeTradeAgreements({
        per_page: 100,
      })
      .subscribe({
        next: (res) => {
          this.items.set(res.data);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.form.reset();
    this.form.controls.is_active.setValue(true);
    this.modalVisible.set(true);
  }

  protected openEdit(row: FreeTradeAgreement): void {
    this.editing.set(row);
    this.form.reset({
      code: row.code,
      name: localizedValue(row.name),
      partner_countries: [...row.partner_countries],
      value_threshold_eur: row.value_threshold_eur,
      value_threshold_chf: row.value_threshold_chf,
      proof_types: [...row.proof_types],
      supports_approved_exporter: row.supports_approved_exporter,
      supports_rex: row.supports_rex,
      declaration_templates: localizedValue(row.declaration_templates),
      declaration_templates_no_auth: localizedValue(row.declaration_templates_no_auth),
      notes: row.notes ?? '',
      is_active: row.is_active,
    });
    this.modalVisible.set(true);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const payload: FreeTradeAgreementPayload = {
      code: value.code.trim(),
      name: compactLocalized(value.name),
      partner_countries: value.partner_countries.map((c) => c.toUpperCase()),
      value_threshold_eur: value.value_threshold_eur,
      value_threshold_chf: value.value_threshold_chf,
      proof_types: value.proof_types,
      supports_approved_exporter: value.supports_approved_exporter,
      supports_rex: value.supports_rex,
      declaration_templates: compactLocalized(value.declaration_templates),
      declaration_templates_no_auth: compactLocalized(value.declaration_templates_no_auth),
      notes: value.notes.trim() || null,
      is_active: value.is_active,
    };

    const current = this.editing();
    this.saving.set(true);
    (current
      ? this.api.updateFreeTradeAgreement(current.id, payload)
      : this.api.createFreeTradeAgreement(payload)
    ).subscribe({
      next: () => {
        this.saving.set(false);
        this.modalVisible.set(false);
        this.message.success(this.translate.instant('CUSTOMS_CODES.MESSAGES.SAVED'));
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        applyServerErrors(this.form, err);
      },
    });
  }

  protected remove(row: FreeTradeAgreement): void {
    this.api.deleteFreeTradeAgreement(row.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('CUSTOMS_CODES.MESSAGES.DELETED'));
        this.load();
      },
    });
  }
}
