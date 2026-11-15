import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  ESG_ESRS_STANDARDS,
  EsgEsrsCompleteness,
  EsgEsrsPackage,
  EsgEsrsPackageRow,
  EsgEsrsValueLine,
  EsgEsrsValueStatus,
  EsgReportingPeriod,
  SustainabilityApiService,
  TranslateService,
} from '@core';
import { ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText } from './sustainability.util';

const STATUS_COLORS: Readonly<Record<EsgEsrsValueStatus, string>> = {
  draft: 'default',
  reviewed: 'blue',
  approved: 'green',
  not_applicable: 'orange',
};

const STATUSES: readonly EsgEsrsValueStatus[] = ['draft', 'reviewed', 'approved', 'not_applicable'];

/** CSRD/ESRS reporting package of a period: data points by standard, review status and completeness check. */
@Component({
  selector: 'app-sustainability-esrs',
  styleUrl: './sustainability.scss',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    ModalActionsDirective,
    PageHeaderComponent,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzProgressModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'SUSTAINABILITY.ESRS_TITLE' | translate" [subtitle]="'SUSTAINABILITY.ESRS_SUBTITLE' | translate">
      <nz-select class="period-select" [ngModel]="periodId()" (ngModelChange)="selectPeriod($event)" [nzPlaceHolder]="'SUSTAINABILITY.SELECT_PERIOD' | translate">
        @for (period of periods(); track period.id) {
          <nz-option [nzValue]="period.id" [nzLabel]="period.name"></nz-option>
        }
      </nz-select>
      <button nz-button (click)="installCatalog()">{{ 'SUSTAINABILITY.ESRS_INSTALL_CATALOG' | translate }}</button>
      <button nz-button nzType="primary" [disabled]="!periodId()" (click)="syncInventory()">{{ 'SUSTAINABILITY.ESRS_SYNC_INVENTORY' | translate }}</button>
    </app-page-header>

    @if (completeness(); as report) {
      <nz-card class="main-card" [nzTitle]="'SUSTAINABILITY.ESRS_COMPLETENESS' | translate">
        <div class="kpi-row">
          <nz-progress [nzPercent]="percentOf(report)" [nzStatus]="report.is_complete ? 'success' : 'active'"></nz-progress>
          <p class="muted">{{ report.complete }} / {{ report.required }} {{ 'SUSTAINABILITY.ESRS_REQUIRED_DONE' | translate }}</p>
        </div>
        @for (issue of report.issues; track issue) {
          <nz-alert nzType="error" nzShowIcon [nzMessage]="issueText(issue)"></nz-alert>
        }
        @for (warning of report.warnings; track warning) {
          <nz-alert nzType="warning" nzShowIcon [nzMessage]="('SUSTAINABILITY.ESRS_WARNING_' + warning.toUpperCase()) | translate"></nz-alert>
        }
        <nz-table #standardsTable [nzData]="report.standards" nzSize="small" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>{{ 'SUSTAINABILITY.ESRS_STANDARD' | translate }}</th>
              <th>{{ 'SUSTAINABILITY.MATERIALITY' | translate }}</th>
              <th class="num">{{ 'SUSTAINABILITY.ESRS_REQUIRED' | translate }}</th>
              <th class="num">{{ 'SUSTAINABILITY.ESRS_COMPLETE' | translate }}</th>
              <th class="num">%</th>
            </tr>
          </thead>
          <tbody>
            @for (row of standardsTable.data; track row.standard) {
              <tr>
                <td>{{ row.standard }}</td>
                <td><nz-tag [nzColor]="row.is_material ? 'red' : 'default'">{{ (row.is_material ? 'SUSTAINABILITY.ESRS_REQUIRED_STANDARD' : 'SUSTAINABILITY.ESRS_NOT_MATERIAL') | translate }}</nz-tag></td>
                <td class="num">{{ row.required }}</td>
                <td class="num">{{ row.complete }}</td>
                <td class="num">{{ row.percent }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-card>
    }

    <nz-card class="main-card" [nzTitle]="'SUSTAINABILITY.ESRS_DATAPOINTS' | translate" [nzExtra]="filter">
      <ng-template #filter>
        <nz-select class="standard-select" nzAllowClear [ngModel]="standard()" (ngModelChange)="standard.set($event ?? '')" [nzPlaceHolder]="'SUSTAINABILITY.ESRS_STANDARD' | translate">
          @for (code of standards; track code) {
            <nz-option [nzValue]="code" [nzLabel]="code"></nz-option>
          }
        </nz-select>
      </ng-template>
      <nz-table #table [nzData]="rows()" nzSize="small" [nzPageSize]="25">
        <thead>
          <tr>
            <th>{{ 'SUSTAINABILITY.ESRS_CODE' | translate }}</th>
            <th>{{ 'SUSTAINABILITY.NAME' | translate }}</th>
            <th>{{ 'SUSTAINABILITY.ESRS_REQUIRED' | translate }}</th>
            <th>{{ 'SUSTAINABILITY.ESRS_VALUE' | translate }}</th>
            <th>{{ 'SUSTAINABILITY.STATUS' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <td>{{ row.code }}</td>
              <td>{{ row.name }}</td>
              <td><nz-tag [nzColor]="row.is_required ? 'red' : 'default'">{{ (row.is_required ? 'SUSTAINABILITY.ESRS_YES' : 'SUSTAINABILITY.ESRS_NO') | translate }}</nz-tag></td>
              <td>{{ displayValue(row) }} {{ row.unit }}</td>
              <td>
                @if (row.value; as value) {
                  <nz-tag [nzColor]="statusColor(value.status)">{{ ('SUSTAINABILITY.ESRS_STATUS_' + value.status.toUpperCase()) | translate }}</nz-tag>
                }
              </td>
              <td><button nz-button nzSize="small" (click)="edit(row)">{{ 'SUSTAINABILITY.ESRS_EDIT_VALUE' | translate }}</button></td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    @if (!periodId() && !loading()) {
      <nz-empty [nzNotFoundContent]="'SUSTAINABILITY.ESRS_NO_PERIOD' | translate"></nz-empty>
    }

    <nz-modal
      [nzVisible]="editing() !== null"
      [nzTitle]="editing()?.code ?? ''"
      (nzOnCancel)="editing.set(null)"
      (nzOnOk)="save()"
      okAction="save"
    >
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="form" nzLayout="vertical">
          <nz-form-item>
            <nz-form-label>{{ 'SUSTAINABILITY.STATUS' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="status">
                @for (status of statuses; track status) {
                  <nz-option [nzValue]="status" [nzLabel]="('SUSTAINABILITY.ESRS_STATUS_' + status.toUpperCase()) | translate"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          @if (form.controls.status.value === 'not_applicable') {
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'SUSTAINABILITY.ESRS_OMISSION_REASON' | translate }}</nz-form-label>
              <nz-form-control><textarea nz-input rows="3" formControlName="omission_reason"></textarea></nz-form-control>
            </nz-form-item>
          } @else {
            <nz-form-item>
              <nz-form-label>{{ 'SUSTAINABILITY.ESRS_VALUE' | translate }} {{ editing()?.unit }}</nz-form-label>
              <nz-form-control>
                @switch (editing()?.data_type) {
                  @case ('number') {
                    <input nz-input type="number" formControlName="value_number" />
                  }
                  @case ('boolean') {
                    <nz-select formControlName="value_boolean">
                      <nz-option nzValue="true" [nzLabel]="'SUSTAINABILITY.ESRS_YES' | translate"></nz-option>
                      <nz-option nzValue="false" [nzLabel]="'SUSTAINABILITY.ESRS_NO' | translate"></nz-option>
                    </nz-select>
                  }
                  @default {
                    <textarea nz-input rows="5" formControlName="value_text"></textarea>
                  }
                }
              </nz-form-control>
            </nz-form-item>
          }
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class SustainabilityEsrsComponent implements OnInit {
  private readonly api = inject(SustainabilityApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly standards = ESG_ESRS_STANDARDS;
  readonly statuses = STATUSES;
  readonly periods = signal<EsgReportingPeriod[]>([]);
  readonly periodId = signal('');
  readonly standard = signal('');
  readonly pack = signal<EsgEsrsPackage | null>(null);
  readonly completeness = signal<EsgEsrsCompleteness | null>(null);
  readonly loading = signal(false);
  readonly editing = signal<EsgEsrsPackageRow | null>(null);

  readonly rows = computed<EsgEsrsPackageRow[]>(() => {
    const standard = this.standard();
    return (this.pack()?.datapoints ?? []).filter((row) => standard === '' || row.standard === standard);
  });

  readonly form = this.fb.group({
    status: ['draft' as EsgEsrsValueStatus],
    value_number: [''],
    value_text: [''],
    value_boolean: [''],
    omission_reason: [''],
  });

  ngOnInit(): void {
    this.loading.set(true);
    this.api.getPeriods().subscribe({
      next: (response) => {
        this.periods.set(response.data);
        this.loading.set(false);
        if (response.data.length > 0) {
          this.selectPeriod(response.data[0].id);
        }
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('SUSTAINABILITY.ACTION_ERROR'));
      },
    });
  }

  statusColor(status: EsgEsrsValueStatus): string {
    return STATUS_COLORS[status];
  }

  percentOf(report: EsgEsrsCompleteness): number {
    return Math.round(Number(report.percent) || 0);
  }

  issueText(issue: string): string {
    const [code, argument] = issue.split(':');
    const text = this.translate.instant('SUSTAINABILITY.ESRS_ISSUE_' + code.toUpperCase());
    return argument === undefined ? text : `${text} (${argument})`;
  }

  displayValue(row: EsgEsrsPackageRow): string {
    const value = row.value;
    if (value === null) {
      return '';
    }
    if (value.status === 'not_applicable') {
      return value.omission_reason ?? '';
    }
    if (value.value_number !== null) {
      return value.value_number;
    }
    if (value.value_boolean !== null) {
      return this.translate.instant(value.value_boolean ? 'SUSTAINABILITY.ESRS_YES' : 'SUSTAINABILITY.ESRS_NO');
    }
    return (value.value_text ?? '').slice(0, 60);
  }

  selectPeriod(periodId: string): void {
    this.periodId.set(periodId);
    this.reload();
  }

  reload(): void {
    const periodId = this.periodId();
    if (periodId === '') {
      return;
    }
    this.api.getEsrsPackage(periodId).subscribe({ next: (response) => this.pack.set(response.data) });
    this.api.getEsrsCompleteness(periodId).subscribe({ next: (response) => this.completeness.set(response.data) });
  }

  installCatalog(): void {
    this.api.installEsrsCatalog().subscribe({
      next: (response) => {
        this.message.success(this.translate.instant('SUSTAINABILITY.ESRS_CATALOG_INSTALLED', { count: response.created }));
        this.reload();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('SUSTAINABILITY.ACTION_ERROR')),
    });
  }

  syncInventory(): void {
    this.api.syncEsrsFromInventory(this.periodId()).subscribe({
      next: (response) => {
        this.message.success(this.translate.instant('SUSTAINABILITY.ESRS_SYNCED', { count: response.updated }));
        this.reload();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('SUSTAINABILITY.ACTION_ERROR')),
    });
  }

  edit(row: EsgEsrsPackageRow): void {
    const value = row.value;
    this.form.reset({
      status: value?.status ?? 'draft',
      value_number: value?.value_number ?? '',
      value_text: value?.value_text ?? '',
      value_boolean: value?.value_boolean === null || value?.value_boolean === undefined ? '' : String(value.value_boolean),
      omission_reason: value?.omission_reason ?? '',
    });
    this.editing.set(row);
  }

  save(): void {
    const row = this.editing();
    if (row === null) {
      return;
    }

    const raw = this.form.getRawValue();
    const line: EsgEsrsValueLine = {
      datapoint_id: row.id,
      status: raw.status,
      value_number: raw.value_number === '' ? null : raw.value_number,
      value_text: raw.value_text === '' ? null : raw.value_text,
      value_boolean: raw.value_boolean === '' ? null : raw.value_boolean === 'true',
      omission_reason: raw.status === 'not_applicable' ? raw.omission_reason : null,
    };

    this.api.recordEsrsValues(this.periodId(), [line]).subscribe({
      next: () => {
        this.message.success(this.translate.instant('SUSTAINABILITY.ESRS_VALUE_SAVED'));
        this.editing.set(null);
        this.reload();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('SUSTAINABILITY.ACTION_ERROR')),
    });
  }
}
