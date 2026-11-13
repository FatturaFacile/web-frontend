import { HttpErrorResponse } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AbsencePlanEntry,
  HrShiftApiService,
  I18nService,
  PlannedShift,
  ShiftBoard,
  ShiftPeriodPayload,
} from '@core';
import { TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { reportHttpError } from '../shared/hr-http.util';

/** A working time finding that blocks the publication until HR acknowledges it with a reason. */
interface ShiftViolation {
  employee_id: string;
  employee_name: string;
  date: string;
  message: string;
  is_blocking: boolean;
}

/** The blocking findings of a 422 answer of the publication, empty for any other error. */
function blockingViolations(err: unknown): ShiftViolation[] {
  if (!(err instanceof HttpErrorResponse) || err.status !== 422) {
    return [];
  }
  const body = err.error as { errors?: { violations?: ShiftViolation[] } } | null;
  return body?.errors?.violations ?? [];
}

/** Planning board of a period, with draft generation, publication, absence plan and the user's own shifts. */
@Component({
  selector: 'app-shift-board',
  styleUrl: './shift-board.component.scss',
  imports: [DatePipe, FormsModule, NzButtonModule, NzInputModule, NzPopconfirmModule, NzTableModule, NzTagModule, TranslatePipe],
  template: `
    <div class="filter-bar">
      <div>
        <label for="board-from">{{ 'hrmCommon.from' | translate }}</label>
        <input nz-input id="board-from" type="date" [ngModel]="from()" (ngModelChange)="from.set($event)" />
      </div>
      <div>
        <label for="board-to">{{ 'hrmCommon.to' | translate }}</label>
        <input nz-input id="board-to" type="date" [ngModel]="to()" (ngModelChange)="to.set($event)" />
      </div>
      <button nz-button nzType="primary" type="button" [disabled]="!canSearch()" [nzLoading]="loading()" (click)="load()">
        {{ 'hrmLeave.show' | translate }}
      </button>
      @if (canWrite()) {
        <button nz-button type="button" [disabled]="!canSearch()" [nzLoading]="busy()" (click)="generate()">
          {{ 'hrmShift.generate' | translate }}
        </button>
        <button nz-button type="button" [disabled]="!canSearch()" [nzLoading]="busy()" (click)="publish()">
          {{ 'hrmShift.publish' | translate }}
        </button>
      }
      <button nz-button type="button" [disabled]="!canSearch()" (click)="loadMine()">{{ 'hrmShift.myShifts' | translate }}</button>
      <button nz-button type="button" [disabled]="!canSearch()" (click)="loadAbsences()">{{ 'hrmShift.absencePlan' | translate }}</button>
    </div>

    @if (violations().length) {
      <section class="mt-3" role="alert">
        <h3>{{ 'hrmShift.violationsTitle' | translate }}</h3>
        <ul>
          @for (violation of violations(); track $index) {
            <li>{{ violation.employee_name }} - {{ violation.date | date: 'mediumDate' }}: {{ violation.message }}</li>
          }
        </ul>
        <label for="board-ack-reason">{{ 'hrmShift.ackReason' | translate }}</label>
        <input nz-input id="board-ack-reason" type="text" maxlength="1000" [ngModel]="acknowledgementReason()" (ngModelChange)="acknowledgementReason.set($event)" />
        <button nz-button nzType="primary" type="button" [disabled]="acknowledgementReason().trim().length < 3" [nzLoading]="busy()" (click)="publishAnyway()">
          {{ 'hrmShift.publishAnyway' | translate }}
        </button>
      </section>
    }

    @if (board(); as b) {
      <nz-table #table [nzData]="b.rows" [nzFrontPagination]="false" nzSize="small">
        <thead>
          <tr>
            <th>{{ 'hrmCommon.employee' | translate }}</th>
            <th>{{ 'hrmShift.shifts' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.employee_id) {
            <tr>
              <td>{{ row.employee_name }}</td>
              <td>
                @for (shift of row.shifts; track shift.id) {
                  <nz-tag [nzColor]="shift.status === 'published' ? 'green' : 'default'">
                    {{ shift.work_date | date: 'dd/MM' }} {{ shift.code }}
                    @if (canWrite()) {
                      <button
                        type="button"
                        class="ant-btn-link"
                        nz-popconfirm
                        [nzPopconfirmTitle]="'hrmShared.confirmDelete' | translate"
                        [attr.aria-label]="('hrmCommon.delete' | translate) + ' ' + shift.code"
                        (nzOnConfirm)="removeShift(shift.id)"
                      >
                        x
                      </button>
                    }
                  </nz-tag>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    }

    @if (mine().length) {
      <h3 class="mt-3">{{ 'hrmShift.myShifts' | translate }}</h3>
      <ul>
        @for (shift of mine(); track shift.id) {
          <li>{{ shift.work_date | date: 'mediumDate' }} - {{ shift.name }} ({{ shift.planned_minutes }} min)</li>
        }
      </ul>
    }

    @if (absences().length) {
      <h3 class="mt-3">{{ 'hrmShift.absencePlan' | translate }}</h3>
      <nz-table #abs [nzData]="absences()" [nzFrontPagination]="false" nzSize="small">
        <thead>
          <tr>
            <th>{{ 'hrmCommon.employee' | translate }}</th>
            <th>{{ 'hrmCommon.date' | translate }}</th>
            <th>{{ 'hrmCommon.type' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (entry of abs.data; track $index) {
            <tr>
              <td>{{ entry.employee_name }}</td>
              <td>{{ entry.date | date: 'mediumDate' }}</td>
              <td>{{ entry.type }}</td>
            </tr>
          }
        </tbody>
      </nz-table>
    }
  `,
})
export class ShiftBoardComponent {
  readonly canWrite = input(false);

  private readonly api = inject(HrShiftApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly board = signal<ShiftBoard | null>(null);
  protected readonly mine = signal<PlannedShift[]>([]);
  protected readonly absences = signal<AbsencePlanEntry[]>([]);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly violations = signal<ShiftViolation[]>([]);
  protected readonly acknowledgementReason = signal('');
  protected readonly canSearch = computed(() => this.from() !== '' && this.to() !== '' && this.from() <= this.to());

  protected load(): void {
    this.loading.set(true);
    this.api.getBoard({ from: this.from(), to: this.to() }).subscribe({
      next: (res) => {
        this.board.set(res.data);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        reportHttpError(err, this.message, this.i18n);
        this.loading.set(false);
      },
    });
  }

  protected loadMine(): void {
    this.api.getMyShifts({ from: this.from(), to: this.to() }).subscribe({
      next: (res) => this.mine.set(res.data),
      error: (err: unknown) => reportHttpError(err, this.message, this.i18n),
    });
  }

  protected loadAbsences(): void {
    this.api.getAbsencePlan({ from: this.from(), to: this.to() }).subscribe({
      next: (res) => this.absences.set(res.data),
      error: (err: unknown) => reportHttpError(err, this.message, this.i18n),
    });
  }

  protected generate(): void {
    this.run(this.api.generateShifts(this.period()), 'hrmShift.generated');
  }

  protected publish(): void {
    this.violations.set([]);
    this.acknowledgementReason.set('');
    this.runPublish(this.period());
  }

  /** Publishes again with the reason that acknowledges the blocking working time findings. */
  protected publishAnyway(): void {
    this.runPublish({ ...this.period(), acknowledgement_reason: this.acknowledgementReason().trim() });
  }

  private runPublish(payload: ShiftPeriodPayload): void {
    this.busy.set(true);
    this.api.publishShifts(payload).subscribe({
      next: () => {
        this.busy.set(false);
        this.violations.set([]);
        this.acknowledgementReason.set('');
        this.message.success(this.i18n.translate('hrmShift.published'));
        this.load();
      },
      error: (err: unknown) => {
        this.busy.set(false);
        const found = blockingViolations(err);
        if (found.length) {
          this.violations.set(found);
        } else {
          reportHttpError(err, this.message, this.i18n);
        }
      },
    });
  }

  protected removeShift(id: string): void {
    this.api.deleteShift(id).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('hrmCommon.deleted'));
        this.load();
      },
      error: (err: unknown) => reportHttpError(err, this.message, this.i18n),
    });
  }

  private period(): ShiftPeriodPayload {
    return { from: this.from(), to: this.to() };
  }

  private run(request: ReturnType<HrShiftApiService['publishShifts']>, successKey: string): void {
    this.busy.set(true);
    request.subscribe({
      next: () => {
        this.busy.set(false);
        this.message.success(this.i18n.translate(successKey));
        this.load();
      },
      error: (err: unknown) => {
        this.busy.set(false);
        reportHttpError(err, this.message, this.i18n);
      },
    });
  }
}
