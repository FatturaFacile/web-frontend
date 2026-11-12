import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EmployeeResource, HrTimeApiService, I18nService, TimeReport } from '@core';
import { TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { reportHttpError } from '../shared/hr-http.util';

/** Time report of an employee for a period (minutes are server-computed; balance is a decimal string). */
@Component({
  selector: 'app-time-report',
  imports: [FormsModule, NzButtonModule, NzDescriptionsModule, NzInputModule, NzSelectModule, TranslatePipe],
  template: `
    <div class="flex items-end gap-2 mb-3 flex-wrap">
      <div>
        <label for="rep-emp">{{ 'hrmCommon.employee' | translate }}</label>
        <nz-select id="rep-emp" nzAllowClear nzShowSearch [ngModel]="employeeId()" (ngModelChange)="employeeId.set($event)">
          @for (e of employees(); track e.id) {
            <nz-option [nzValue]="e.id" [nzLabel]="e.employee_number + ' - ' + e.full_name" />
          }
        </nz-select>
      </div>
      <div>
        <label for="rep-from">{{ 'hrmCommon.from' | translate }}</label>
        <input nz-input id="rep-from" type="date" [ngModel]="from()" (ngModelChange)="from.set($event)" />
      </div>
      <div>
        <label for="rep-to">{{ 'hrmCommon.to' | translate }}</label>
        <input nz-input id="rep-to" type="date" [ngModel]="to()" (ngModelChange)="to.set($event)" />
      </div>
      <button nz-button nzType="primary" type="button" [disabled]="!canSearch()" [nzLoading]="loading()" (click)="search()">
        {{ 'hrmLeave.show' | translate }}
      </button>
    </div>
    @if (report(); as r) {
      <nz-descriptions nzBordered [nzColumn]="{ xs: 1, md: 2 }">
        <nz-descriptions-item [nzTitle]="'hrmCommon.employee' | translate">{{ r.employee_name }}</nz-descriptions-item>
        <nz-descriptions-item [nzTitle]="'hrmTime.recordingMode' | translate">{{ r.recording_mode }}</nz-descriptions-item>
        <nz-descriptions-item [nzTitle]="'hrmTime.workedMinutes' | translate">{{ r.worked_minutes }}</nz-descriptions-item>
        <nz-descriptions-item [nzTitle]="'hrmTime.targetMinutes' | translate">{{ r.target_minutes }}</nz-descriptions-item>
        <nz-descriptions-item [nzTitle]="'hrmTime.creditedMinutes' | translate">{{ r.credited_minutes }}</nz-descriptions-item>
        <nz-descriptions-item [nzTitle]="'hrmTime.balance' | translate">{{ r.balance }}</nz-descriptions-item>
        <nz-descriptions-item [nzTitle]="'hrmTime.statutoryOvertime' | translate">{{ r.statutory_overtime_minutes }}</nz-descriptions-item>
        <nz-descriptions-item [nzTitle]="'hrmTime.statutoryOvertimeYear' | translate">
          {{ r.statutory_overtime_year_minutes }} / {{ r.statutory_overtime_cap_minutes }}
        </nz-descriptions-item>
        <nz-descriptions-item [nzTitle]="'hrmTime.daysWithIssues' | translate" [nzSpan]="2">
          {{ r.days_with_issues }}
          @if (r.issues.length) {
            <ul>
              @for (issue of r.issues; track issue) {
                <li>{{ issue }}</li>
              }
            </ul>
          }
        </nz-descriptions-item>
      </nz-descriptions>
    }
  `,
})
export class TimeReportComponent {
  readonly employees = input<EmployeeResource[]>([]);

  private readonly api = inject(HrTimeApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly employeeId = signal<string | null>(null);
  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly report = signal<TimeReport | null>(null);
  protected readonly loading = signal(false);
  protected readonly canSearch = computed(() => this.from() !== '' && this.to() !== '' && this.from() <= this.to());

  protected search(): void {
    this.loading.set(true);
    this.api
      .getReport({ employee_id: this.employeeId() ?? undefined, from: this.from(), to: this.to() })
      .subscribe({
        next: (res) => {
          this.report.set(res.data);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          reportHttpError(err, this.message, this.i18n);
          this.loading.set(false);
        },
      });
  }
}
