import { DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { AbstractControl, FormsModule, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  BUDGET_REFORECAST_MODES,
  BUDGET_VERSION_STATUSES,
  BUDGET_VERSION_TYPES,
  BudgetingApiService,
  BudgetReforecastMode,
  BudgetVersion,
  BudgetVersionStatus,
  BudgetVersionType,
  TranslateService,
} from '@core';
import { IconActionDirective, ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText, blankToNull, parseWeights, validWeights, VERSION_STATUS_COLORS } from './budgeting.util';

function weightsValidator(control: AbstractControl): ValidationErrors | null {
  return validWeights(control.value as string) ? null : { weights: true };
}

/** Budget versions of the fiscal years, with creation, copy as forecast and rolling re-forecast. */
@Component({
  selector: 'app-budgeting-versions',
  styleUrl: './budgeting.scss',
  imports: [
    DecimalPipe,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    IconActionDirective,
    ModalActionsDirective,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'BUDGETING.VERSIONS_TITLE' | translate" [subtitle]="'BUDGETING.VERSIONS_SUBTITLE' | translate">
      <button nz-button nzType="primary" (click)="openCreate()" appIconAction="create"></button>
    </app-page-header>

    <div class="toolbar">
      <input nz-input style="width: 140px" type="number" min="2000" max="2100" [ngModel]="fiscalYear()" (ngModelChange)="fiscalYear.set($event); load()" [placeholder]="'BUDGETING.FISCAL_YEAR' | translate" [attr.aria-label]="'BUDGETING.FISCAL_YEAR' | translate" />
      <nz-select style="width: 200px" nzAllowClear [ngModel]="status()" (ngModelChange)="status.set($event); load()" [nzPlaceHolder]="'BUDGETING.STATUS' | translate" [attr.aria-label]="'BUDGETING.STATUS' | translate">
        @for (value of statuses; track value) {
          <nz-option [nzValue]="value" [nzLabel]="('BUDGETING.STATUS_' + value.toUpperCase()) | translate"></nz-option>
        }
      </nz-select>
      <nz-select style="width: 220px" nzAllowClear [ngModel]="type()" (ngModelChange)="type.set($event); load()" [nzPlaceHolder]="'BUDGETING.TYPE' | translate" [attr.aria-label]="'BUDGETING.TYPE' | translate">
        @for (value of types; track value) {
          <nz-option [nzValue]="value" [nzLabel]="('BUDGETING.TYPE_' + value.toUpperCase()) | translate"></nz-option>
        }
      </nz-select>
    </div>

    <nz-card class="main-card">
      <nz-table #table [nzData]="versions()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="25">
        <thead>
          <tr>
            <th>{{ 'BUDGETING.NAME' | translate }}</th>
            <th>{{ 'BUDGETING.FISCAL_YEAR' | translate }}</th>
            <th>{{ 'BUDGETING.TYPE' | translate }}</th>
            <th>{{ 'BUDGETING.STATUS' | translate }}</th>
            <th class="num">{{ 'BUDGETING.LINES' | translate }}</th>
            <th class="num">{{ 'BUDGETING.TOTAL_AMOUNT' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <td><a [routerLink]="['/budgeting/versions', row.id]">{{ row.name }}</a></td>
              <td>{{ row.fiscal_year }}</td>
              <td>{{ ('BUDGETING.TYPE_' + row.version_type.toUpperCase()) | translate }}</td>
              <td><nz-tag [nzColor]="statusColor(row.status)">{{ ('BUDGETING.STATUS_' + row.status.toUpperCase()) | translate }}</nz-tag></td>
              <td class="num">{{ row.lines_count ?? 0 }}</td>
              <td class="num">{{ (row.total_amount ?? '0') | number: '1.2-2' }} {{ row.currency }}</td>
              <td>
                <div class="row-actions">
                  <button nz-button nzType="text" (click)="openCopy(row)">{{ 'BUDGETING.COPY' | translate }}</button>
                  @if (row.status === 'approved' || row.status === 'locked') {
                    <button nz-button nzType="text" (click)="openReforecast(row)">{{ 'BUDGETING.REFORECAST' | translate }}</button>
                  }
                  @if (row.status === 'draft') {
                    <button nz-button nzType="text" nzDanger appIconAction="delete" nz-popconfirm [nzPopconfirmTitle]="'BUDGETING.DELETE_CONFIRM' | translate" (nzOnConfirm)="remove(row)"></button>
                  }
                </div>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && versions().length === 0) {
        <nz-empty [nzNotFoundContent]="'BUDGETING.NO_VERSIONS' | translate"></nz-empty>
      }
    </nz-card>

    <nz-modal [(nzVisible)]="createVisible" [nzTitle]="'BUDGETING.NEW_VERSION' | translate" (nzOnCancel)="createVisible.set(false)" (nzOnOk)="saveCreate()" okAction="save" [nzOkDisabled]="createForm.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="createForm" nzLayout="vertical">
          <nz-form-item>
            <nz-form-label nzRequired nzFor="version-name">{{ 'BUDGETING.NAME' | translate }}</nz-form-label>
            <nz-form-control><input nz-input id="version-name" formControlName="name" maxlength="160" /></nz-form-control>
          </nz-form-item>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="version-year">{{ 'BUDGETING.FISCAL_YEAR' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="version-year" type="number" min="2000" max="2100" formControlName="fiscal_year" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="version-start">{{ 'BUDGETING.YEAR_START' | translate }}</nz-form-label>
              <nz-form-control [nzExtra]="'BUDGETING.YEAR_START_HINT' | translate"><input nz-input id="version-start" type="date" formControlName="year_start" /></nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'BUDGETING.TYPE' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="version_type">
                  @for (value of types; track value) {
                    <nz-option [nzValue]="value" [nzLabel]="('BUDGETING.TYPE_' + value.toUpperCase()) | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="version-currency">{{ 'BUDGETING.CURRENCY' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="version-currency" formControlName="currency" maxlength="3" /></nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-label nzFor="version-weights">{{ 'BUDGETING.SEASONAL_WEIGHTS' | translate }}</nz-form-label>
            <nz-form-control [nzExtra]="'BUDGETING.SEASONAL_WEIGHTS_HINT' | translate" [nzErrorTip]="'BUDGETING.SEASONAL_WEIGHTS_INVALID' | translate">
              <input nz-input id="version-weights" formControlName="seasonal_weights" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="version-description">{{ 'BUDGETING.DESCRIPTION' | translate }}</nz-form-label>
            <nz-form-control><textarea nz-input id="version-description" rows="2" formControlName="description" maxlength="2000"></textarea></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal [(nzVisible)]="copyVisible" [nzTitle]="'BUDGETING.COPY_VERSION' | translate" (nzOnCancel)="copyVisible.set(false)" (nzOnOk)="saveCopy()" okAction="save" [nzOkDisabled]="copyForm.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="copyForm" nzLayout="vertical">
          <nz-form-item>
            <nz-form-label nzRequired nzFor="copy-name">{{ 'BUDGETING.NAME' | translate }}</nz-form-label>
            <nz-form-control><input nz-input id="copy-name" formControlName="name" maxlength="160" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'BUDGETING.TYPE' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="version_type">
                <nz-option nzValue="forecast" [nzLabel]="'BUDGETING.TYPE_FORECAST' | translate"></nz-option>
                <nz-option nzValue="budget" [nzLabel]="'BUDGETING.TYPE_BUDGET' | translate"></nz-option>
              </nz-select>
            </nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal [(nzVisible)]="reforecastVisible" [nzTitle]="'BUDGETING.REFORECAST' | translate" (nzOnCancel)="reforecastVisible.set(false)" (nzOnOk)="saveReforecast()" okAction="save" [nzOkDisabled]="reforecastForm.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="reforecastForm" nzLayout="vertical">
          <nz-form-item>
            <nz-form-label nzRequired nzFor="reforecast-name">{{ 'BUDGETING.NAME' | translate }}</nz-form-label>
            <nz-form-control><input nz-input id="reforecast-name" formControlName="name" maxlength="160" /></nz-form-control>
          </nz-form-item>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="reforecast-from">{{ 'BUDGETING.FROM_PERIOD' | translate }}</nz-form-label>
              <nz-form-control [nzExtra]="'BUDGETING.FROM_PERIOD_HINT' | translate"><input nz-input id="reforecast-from" type="number" min="1" max="12" formControlName="from_period" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="reforecast-adjustment">{{ 'BUDGETING.ADJUSTMENT_PERCENT' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="reforecast-adjustment" type="number" min="-100" max="1000" step="any" formControlName="adjustment_percent" /></nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'BUDGETING.REFORECAST_MODE' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="mode">
                @for (value of modes; track value) {
                  <nz-option [nzValue]="value" [nzLabel]="('BUDGETING.MODE_' + value.toUpperCase()) | translate"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class BudgetingVersionsComponent implements OnInit {
  private readonly api = inject(BudgetingApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly statuses = BUDGET_VERSION_STATUSES;
  readonly types = BUDGET_VERSION_TYPES;
  readonly modes = BUDGET_REFORECAST_MODES;
  readonly versions = signal<BudgetVersion[]>([]);
  readonly loading = signal(false);
  readonly fiscalYear = signal<number | null>(null);
  readonly status = signal<BudgetVersionStatus | null>(null);
  readonly type = signal<BudgetVersionType | null>(null);
  readonly createVisible = signal(false);
  readonly copyVisible = signal(false);
  readonly reforecastVisible = signal(false);
  readonly source = signal<BudgetVersion | null>(null);

  readonly createForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(160)]],
    fiscal_year: [new Date().getFullYear() + 1, [Validators.required, Validators.min(2000), Validators.max(2100)]],
    year_start: [''],
    version_type: ['budget' as BudgetVersionType, [Validators.required]],
    currency: ['EUR', [Validators.required, Validators.minLength(3), Validators.maxLength(3)]],
    seasonal_weights: ['', [weightsValidator]],
    description: [''],
  });

  readonly copyForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(160)]],
    version_type: ['forecast' as 'budget' | 'forecast', [Validators.required]],
  });

  readonly reforecastForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(160)]],
    from_period: [2, [Validators.required, Validators.min(1), Validators.max(12)]],
    mode: ['keep_annual_target' as BudgetReforecastMode, [Validators.required]],
    adjustment_percent: this.fb.control<number | null>(null, [Validators.min(-100), Validators.max(1000)]),
  });

  ngOnInit(): void {
    this.load();
  }

  statusColor(status: BudgetVersionStatus): string {
    return VERSION_STATUS_COLORS[status];
  }

  load(): void {
    this.loading.set(true);
    this.api.getVersions({ fiscal_year: this.fiscalYear() ?? undefined, status: this.status() ?? undefined, version_type: this.type() ?? undefined, per_page: 100 }).subscribe({
      next: (response) => {
        this.versions.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('BUDGETING.ACTION_ERROR'));
      },
    });
  }

  openCreate(): void {
    this.createForm.reset({ name: '', fiscal_year: new Date().getFullYear() + 1, year_start: '', version_type: 'budget', currency: 'EUR', seasonal_weights: '', description: '' });
    this.createVisible.set(true);
  }

  saveCreate(): void {
    const value = this.createForm.getRawValue();
    this.api
      .createVersion({
        name: value.name,
        description: blankToNull(value.description),
        fiscal_year: value.fiscal_year,
        year_start: blankToNull(value.year_start),
        version_type: value.version_type,
        currency: value.currency.toUpperCase(),
        seasonal_weights: parseWeights(value.seasonal_weights),
      })
      .subscribe({
        next: () => {
          this.message.success(this.translate.instant('BUDGETING.VERSION_SAVED'));
          this.createVisible.set(false);
          this.load();
        },
        error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('BUDGETING.ACTION_ERROR')),
      });
  }

  openCopy(version: BudgetVersion): void {
    this.source.set(version);
    this.copyForm.reset({ name: '', version_type: 'forecast' });
    this.copyVisible.set(true);
  }

  saveCopy(): void {
    const source = this.source();
    if (!source) {
      return;
    }

    const value = this.copyForm.getRawValue();
    this.api.copyVersion(source.id, { name: value.name, version_type: value.version_type }).subscribe({
      next: () => {
        this.message.success(this.translate.instant('BUDGETING.VERSION_COPIED'));
        this.copyVisible.set(false);
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('BUDGETING.ACTION_ERROR')),
    });
  }

  openReforecast(version: BudgetVersion): void {
    this.source.set(version);
    this.reforecastForm.reset({ name: '', from_period: 2, mode: 'keep_annual_target', adjustment_percent: null });
    this.reforecastVisible.set(true);
  }

  saveReforecast(): void {
    const source = this.source();
    if (!source) {
      return;
    }

    const value = this.reforecastForm.getRawValue();
    this.api.reforecastVersion(source.id, { name: value.name, from_period: value.from_period, mode: value.mode, adjustment_percent: value.adjustment_percent }).subscribe({
      next: () => {
        this.message.success(this.translate.instant('BUDGETING.REFORECAST_DONE'));
        this.reforecastVisible.set(false);
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('BUDGETING.ACTION_ERROR')),
    });
  }

  remove(version: BudgetVersion): void {
    this.api.deleteVersion(version.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('BUDGETING.DELETED'));
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('BUDGETING.ACTION_ERROR')),
    });
  }
}
