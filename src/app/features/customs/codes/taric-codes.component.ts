import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule, NzTableQueryParams } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  applyServerErrors,
  AuthStore,
  canManageCustoms,
  CatalogLocale,
  CustomsCodesApiService,
  CustomsTaricCode,
  CustomsTaricCodePayload,
  normalizeTaricCode,
  pickLocalized,
  TARIC_CODE_PATTERN,
  TARIC_LEVEL_LABEL,
  TaricCodeLevel,
  TranslateService,
  taricLevelOf,
} from '@core';
import { IconActionDirective, ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';

const LOCALES: readonly CatalogLocale[] = ['it', 'de', 'fr', 'en'];

/** Catalog of HS (6), CN (8) and TARIC (10 digit) customs codes with localized descriptions. */
@Component({
  selector: 'app-taric-codes',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    IconActionDirective,
    ModalActionsDirective,
    NzButtonModule,
    NzCardModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSwitchModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  template: `
    <app-page-header
      [title]="'CUSTOMS_CODES.TARIC.TITLE' | translate"
      [subtitle]="'CUSTOMS_CODES.TARIC.SUBTITLE' | translate"
    />

    <nz-card>
      <div class="toolbar">
        <input
          nz-input
          type="search"
          class="search-input"
          [placeholder]="'CUSTOMS_CODES.TARIC.SEARCH_PLACEHOLDER' | translate"
          [ngModel]="search()"
          (ngModelChange)="onSearch($event)"
        />
        <nz-select
          class="level-filter"
          nzAllowClear
          [ngModel]="level()"
          [nzPlaceHolder]="'CUSTOMS_CODES.TARIC.LEVEL' | translate"
          (ngModelChange)="onLevel($event)"
        >
          @for (lvl of levels; track lvl) {
            <nz-option [nzValue]="lvl" [nzLabel]="levelLabel(lvl)"></nz-option>
          }
        </nz-select>
        <div class="spacer"></div>
        @if (canManage()) {
          <button nz-button nzType="primary" appIconAction="add" (click)="openCreate()"></button>
        }
      </div>

      <nz-table
        nzSize="small"
        nzShowSizeChanger
        [nzData]="items()"
        [nzLoading]="loading()"
        [nzFrontPagination]="false"
        [nzTotal]="total()"
        [nzPageIndex]="page()"
        [nzPageSize]="pageSize()"
        [nzPageSizeOptions]="[10, 20, 50, 100]"
        (nzQueryParams)="onQueryParams($event)"
      >
        <thead>
          <tr>
            <th nzWidth="140px">{{ 'CUSTOMS_CODES.TARIC.CODE' | translate }}</th>
            <th nzWidth="110px">{{ 'CUSTOMS_CODES.TARIC.LEVEL' | translate }}</th>
            <th nzWidth="90px">{{ 'CUSTOMS_CODES.TARIC.CHAPTER' | translate }}</th>
            <th>{{ 'CUSTOMS_CODES.TARIC.DESCRIPTION' | translate }}</th>
            <th>{{ 'CUSTOMS_CODES.TARIC.SUPPLEMENTARY_UNIT' | translate }}</th>
            <th nzWidth="100px">{{ 'COMMON.STATUS' | translate }}</th>
            <th nzWidth="110px" nzAlign="right">{{ 'COMMON.ACTIONS' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of items(); track row.id) {
            <tr>
              <td>
                <code>{{ row.code }}</code>
              </td>
              <td>
                <nz-tag nzColor="blue">{{ levelLabel(row.level) }}</nz-tag>
              </td>
              <td>{{ row.chapter }}</td>
              <td>{{ describe(row) }}</td>
              <td>{{ row.supplementary_unit || '-' }}</td>
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

    <nz-modal appModalActions
      [nzVisible]="modalVisible()"
      [nzTitle]="(editing() ? 'CUSTOMS_CODES.TARIC.EDIT' : 'CUSTOMS_CODES.TARIC.ADD') | translate"
      [nzOkLoading]="saving()"
      nzWidth="640px"
      okAction="save"
      (nzOnCancel)="modalVisible.set(false)"
      (nzOnOk)="save()"
    >
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="form">
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'CUSTOMS_CODES.TARIC.CODE' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="codeError()">
              <div class="code-row">
                <input nz-input formControlName="code" inputmode="numeric" maxlength="14" />
                @if (formLevel(); as lvl) {
                  <nz-tag nzColor="blue">{{ levelLabel(lvl) }}</nz-tag>
                }
              </div>
            </nz-form-control>
          </nz-form-item>

          @for (locale of locales; track locale) {
            <nz-form-item [formGroup]="form.controls.description">
              <nz-form-label>{{ 'CUSTOMS_CODES.TARIC.DESCRIPTION' | translate }} ({{ locale.toUpperCase() }})</nz-form-label>
              <nz-form-control>
                <textarea nz-input [formControlName]="locale" rows="2"></textarea>
              </nz-form-control>
            </nz-form-item>
          }

          <nz-form-item>
            <nz-form-label>{{ 'CUSTOMS_CODES.TARIC.SUPPLEMENTARY_UNIT' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="'COMMON.VALIDATION.INVALID_VALUE' | translate">
              <input nz-input formControlName="supplementary_unit" maxlength="255" />
            </nz-form-control>
          </nz-form-item>

          <nz-form-item>
            <nz-form-label>{{ 'CUSTOMS_CODES.TARIC.DUTY_NOTES' | translate }}</nz-form-label>
            <nz-form-control>
              <textarea nz-input formControlName="duty_rate_notes" rows="3"></textarea>
            </nz-form-control>
          </nz-form-item>

          <nz-form-item>
            <nz-form-label>{{ 'COMMON.ACTIVE' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-switch formControlName="is_active"></nz-switch>
            </nz-form-control>
          </nz-form-item>
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
    .level-filter {
      min-width: 140px;
    }
    .spacer {
      flex: 1;
    }
    .code-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
  `,
})
export class TaricCodesComponent implements OnInit {
  private readonly api = inject(CustomsCodesApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly authStore = inject(AuthStore);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly locales = LOCALES;
  protected readonly levels: readonly TaricCodeLevel[] = ['HS6', 'CN8', 'TARIC10'];

  /** Writes are hidden for members without `customs.manage` (the API answers 403 anyway). */
  protected readonly canManage = computed(() =>
    canManageCustoms(this.authStore.activeRoles(), this.authStore.userPermissions()),
  );

  protected readonly items = signal<CustomsTaricCode[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(20);
  protected readonly search = signal('');
  protected readonly level = signal<TaricCodeLevel | null>(null);

  protected readonly modalVisible = signal(false);
  protected readonly saving = signal(false);
  protected readonly editing = signal<CustomsTaricCode | null>(null);

  protected readonly form = this.fb.group({
    code: this.fb.control('', [Validators.required, Validators.pattern(TARIC_CODE_PATTERN)]),
    description: this.fb.group({
      it: this.fb.control(''),
      de: this.fb.control(''),
      fr: this.fb.control(''),
      en: this.fb.control(''),
    }),
    supplementary_unit: this.fb.control('', [Validators.maxLength(255)]),
    duty_rate_notes: this.fb.control(''),
    is_active: this.fb.control(true),
  });

  protected readonly formLevel = signal<TaricCodeLevel | null>(null);
  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.form.controls.code.valueChanges.subscribe((value) => this.formLevel.set(taricLevelOf(normalizeTaricCode(value))));
  }

  ngOnInit(): void {
    this.load();
  }

  protected levelLabel(level: TaricCodeLevel): string {
    return TARIC_LEVEL_LABEL[level];
  }

  protected describe(row: CustomsTaricCode): string {
    return pickLocalized(row.description, this.translate.currentLanguage());
  }

  protected codeError(): string {
    const control = this.form.controls.code;
    if (control.hasError('required')) {
      return this.translate.instant('COMMON.VALIDATION.REQUIRED');
    }
    const server = control.errors?.['serverError'];
    return typeof server === 'string' ? server : this.translate.instant('CUSTOMS_CODES.VALIDATION.CODE_DIGITS');
  }

  protected onSearch(value: string): void {
    this.search.set(value);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.page.set(1);
      this.load();
    }, 300);
  }

  protected onLevel(level: TaricCodeLevel | null): void {
    this.level.set(level);
    this.page.set(1);
    this.load();
  }

  protected onQueryParams(params: NzTableQueryParams): void {
    if (params.pageIndex === this.page() && params.pageSize === this.pageSize()) {
      return;
    }
    this.page.set(params.pageIndex);
    this.pageSize.set(params.pageSize);
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.api
      .getTaricCodes({
        search: this.search().trim(),
        level: this.level() ?? undefined,
        page: this.page(),
        per_page: Math.min(100, Math.max(5, this.pageSize())),
      })
      .subscribe({
        next: (res) => {
          this.items.set(res.data);
          this.total.set(res.meta?.total ?? res.data.length);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.form.reset({
      code: '',
      description: { it: '', de: '', fr: '', en: '' },
      supplementary_unit: '',
      duty_rate_notes: '',
      is_active: true,
    });
    this.form.controls.code.enable();
    this.modalVisible.set(true);
  }

  protected openEdit(row: CustomsTaricCode): void {
    this.editing.set(row);
    this.form.reset({
      code: row.code,
      description: {
        it: row.description?.it ?? '',
        de: row.description?.de ?? '',
        fr: row.description?.fr ?? '',
        en: row.description?.en ?? '',
      },
      supplementary_unit: row.supplementary_unit ?? '',
      duty_rate_notes: row.duty_rate_notes ?? '',
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
    const description: Partial<Record<CatalogLocale, string>> = {};
    for (const locale of LOCALES) {
      const text = value.description[locale].trim();
      if (text) {
        description[locale] = text;
      }
    }
    const payload: CustomsTaricCodePayload = {
      code: normalizeTaricCode(value.code),
      description,
      supplementary_unit: value.supplementary_unit.trim() || null,
      duty_rate_notes: value.duty_rate_notes.trim() || null,
      is_active: value.is_active,
    };

    const current = this.editing();
    this.saving.set(true);
    (current ? this.api.updateTaricCode(current.id, payload) : this.api.createTaricCode(payload)).subscribe({
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

  protected remove(row: CustomsTaricCode): void {
    this.api.deleteTaricCode(row.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('CUSTOMS_CODES.MESSAGES.DELETED'));
        this.load();
      },
    });
  }
}
