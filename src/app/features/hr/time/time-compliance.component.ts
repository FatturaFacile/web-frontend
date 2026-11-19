import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ComplianceAlerts,
  EmployeeResource,
  HrTimeApiService,
  I18nService,
  IntegrityResult,
  LegalExportParams,
} from '@core';
import { TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { reportHttpError, saveBlob } from '../shared/hr-http.util';

/** The export format follows the jurisdiction: LUL CSV for Italy, SECO CSV for Switzerland. */
export function legalExportParams(
  jurisdiction: 'IT' | 'CH',
  from: string,
  to: string,
  employeeId: string | null,
): LegalExportParams {
  return {
    jurisdiction,
    from,
    to,
    format: jurisdiction === 'IT' ? 'lul_csv' : 'seco_csv',
    ...(employeeId ? { employee_id: employeeId } : {}),
  };
}

/** Legal compliance of the time recording: LUL / SECO export, tamper-evidence check and rest/break alerts. */
@Component({
  selector: 'app-time-compliance',
  imports: [FormsModule, NzAlertModule, NzButtonModule, NzInputModule, NzSelectModule, NzTableModule, TranslatePipe],
  template: `
    <div class="filter-bar">
      <div>
        <label for="cmp-j">{{ 'hrmTimeLegal.jurisdiction' | translate }}</label>
        <nz-select id="cmp-j" class="w-field-sm" [ngModel]="jurisdiction()" (ngModelChange)="jurisdiction.set($event)">
          <nz-option nzValue="IT" nzLabel="IT" />
          <nz-option nzValue="CH" nzLabel="CH" />
        </nz-select>
      </div>
      <div>
        <label for="cmp-emp">{{ 'hrmCommon.employee' | translate }}</label>
        <nz-select id="cmp-emp" class="w-field-md" nzAllowClear nzShowSearch [ngModel]="employeeId()" (ngModelChange)="employeeId.set($event)">
          @for (e of employees(); track e.id) {
            <nz-option [nzValue]="e.id" [nzLabel]="e.employee_number + ' - ' + e.full_name" />
          }
        </nz-select>
      </div>
      <div>
        <label for="cmp-from">{{ 'hrmCommon.from' | translate }}</label>
        <input nz-input id="cmp-from" type="date" [ngModel]="from()" (ngModelChange)="from.set($event)" />
      </div>
      <div>
        <label for="cmp-to">{{ 'hrmCommon.to' | translate }}</label>
        <input nz-input id="cmp-to" type="date" [ngModel]="to()" (ngModelChange)="to.set($event)" />
      </div>
    </div>
    <div class="filter-bar">
      <button nz-button nzType="primary" type="button" [disabled]="!periodValid()" [nzLoading]="busy()" (click)="exportLegal()">
        {{ 'hrmTimeLegal.export' | translate }}
      </button>
      <button nz-button type="button" [nzLoading]="busy()" (click)="verify()">{{ 'hrmTimeLegal.verifyIntegrity' | translate }}</button>
      <button nz-button type="button" [disabled]="!periodValid()" [nzLoading]="busy()" (click)="checkAlerts()">
        {{ 'hrmTimeLegal.checkAlerts' | translate }}
      </button>
    </div>

    @if (integrity(); as i) {
      <nz-alert
        class="mb-3"
        [nzType]="i.verified ? 'success' : 'error'"
        nzShowIcon
        [nzMessage]="(i.verified ? 'hrmTimeLegal.integrityOk' : 'hrmTimeLegal.integrityBroken') | translate"
        [nzDescription]="i.entries_checked + ' ' + ('hrmTimeLegal.entriesChecked' | translate) + (i.broken_at_id ? ' - ' + i.broken_at_id : '')"
      />
    }

    @if (alerts(); as a) {
      <nz-table nzSize="small" [nzData]="a.alerts" [nzShowPagination]="false" [nzNoResult]="'hrmTimeLegal.noAlerts' | translate">
        <thead>
          <tr>
            <th>{{ 'hrmCommon.employee' | translate }}</th>
            <th>{{ 'hrmTimeLegal.date' | translate }}</th>
            <th>{{ 'hrmTimeLegal.alertType' | translate }}</th>
            <th>{{ 'hrmTimeLegal.details' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of a.alerts; track $index) {
            <tr>
              <td>{{ row.employee_name }}</td>
              <td>{{ row.date }}</td>
              <td>{{ 'hrmTimeLegal.alert.' + row.type | translate }}</td>
              <td>{{ row.details }}</td>
            </tr>
          }
        </tbody>
      </nz-table>
    }
  `,
})
export class TimeComplianceComponent {
  readonly employees = input<EmployeeResource[]>([]);

  private readonly api = inject(HrTimeApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly jurisdiction = signal<'IT' | 'CH'>('CH');
  protected readonly employeeId = signal<string | null>(null);
  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly busy = signal(false);
  protected readonly integrity = signal<IntegrityResult | null>(null);
  protected readonly alerts = signal<ComplianceAlerts | null>(null);
  protected readonly periodValid = computed(() => this.from() !== '' && this.to() !== '' && this.from() <= this.to());

  private fail = (err: unknown): void => {
    this.busy.set(false);
    reportHttpError(err, this.message, this.i18n);
  };

  protected exportLegal(): void {
    const params = legalExportParams(this.jurisdiction(), this.from(), this.to(), this.employeeId());
    this.busy.set(true);
    this.api.exportLegal(params).subscribe({
      next: (blob) => {
        this.busy.set(false);
        saveBlob(blob, `${params.format}-${params.from}-${params.to}.csv`);
      },
      error: this.fail,
    });
  }

  protected verify(): void {
    this.busy.set(true);
    this.api
      .verifyIntegrity({
        from: this.from() || undefined,
        to: this.to() || undefined,
        employee_id: this.employeeId() ?? undefined,
      })
      .subscribe({
        next: (res) => {
          this.busy.set(false);
          this.integrity.set(res.data);
        },
        error: this.fail,
      });
  }

  protected checkAlerts(): void {
    this.busy.set(true);
    this.api
      .getComplianceAlerts({
        jurisdiction: this.jurisdiction(),
        from: this.from(),
        to: this.to(),
        employee_id: this.employeeId() ?? undefined,
      })
      .subscribe({
        next: (res) => {
          this.busy.set(false);
          this.alerts.set(res.data);
        },
        error: this.fail,
      });
  }
}
