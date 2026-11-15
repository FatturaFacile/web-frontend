import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { HrWorkforceApiService, I18nService, OffboardingChecklistRecord } from '@core';
import { ModalActionsDirective, TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { reportHttpError } from '../shared/hr-http.util';

/** The tasks of an offboarding checklist: asset returns, access revocation, exit interview, final settlement. */
@Component({
  selector: 'app-offboarding-checklist',
  styleUrl: './offboarding-checklist.component.scss',
  imports: [ModalActionsDirective, NzButtonModule, NzModalModule, NzTableModule, NzTagModule, TranslatePipe],
  template: `
    <nz-modal
      [nzVisible]="checklistId() !== null"
      [nzWidth]="760"
      [nzFooter]="null"
      [nzTitle]="title()"
      (nzOnCancel)="closed.emit()"
    >
      <ng-container *nzModalContent>
        @if (checklist(); as current) {
          <p>
            <nz-tag [nzColor]="current.completed_at ? 'green' : 'blue'">
              {{ (current.completed_at ? 'hrmOffboarding.completed' : 'hrmOffboarding.open') | translate }}
            </nz-tag>
            @if (current.reference_date) {
              <span>{{ 'hrmOffboarding.referenceDate' | translate }}: {{ current.reference_date }}</span>
            }
          </p>
          <nz-table [nzData]="current.tasks ?? []" [nzFrontPagination]="false" nzSize="small">
            <thead>
              <tr>
                <th>{{ 'hrmCommon.title' | translate }}</th>
                <th>{{ 'hrmOffboarding.taskType' | translate }}</th>
                <th>{{ 'hrmOffboarding.dueOn' | translate }}</th>
                <th>{{ 'hrmOffboarding.completedAt' | translate }}</th>
                @if (canWrite()) {
                  <th>{{ 'hrmCommon.actions' | translate }}</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (task of current.tasks ?? []; track task.id) {
                <tr>
                  <td>{{ task.title }}</td>
                  <td>{{ 'hrmOffboarding.taskCode.' + (task.code ?? 'custom') | translate }}</td>
                  <td>{{ task.due_on }}</td>
                  <td>{{ task.completed_at }}</td>
                  @if (canWrite()) {
                    <td>
                      @if (!task.completed_at) {
                        <button nz-button nzSize="small" nzType="primary" type="button" [nzLoading]="busy()" (click)="complete(task.id)">
                          {{ 'hrmOffboarding.complete' | translate }}
                        </button>
                      }
                    </td>
                  }
                </tr>
              }
            </tbody>
          </nz-table>
        }
      </ng-container>
    </nz-modal>
  `,
})
export class OffboardingChecklistComponent {
  /** Checklist to show; null keeps the modal closed. */
  readonly checklistId = input<string | null>(null);
  readonly canWrite = input(false);
  readonly closed = output<void>();
  /** A task was completed: the list behind the modal must reload. */
  readonly changed = output<void>();

  private readonly api = inject(HrWorkforceApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly checklist = signal<OffboardingChecklistRecord | null>(null);
  protected readonly busy = signal(false);

  constructor() {
    effect(() => {
      const id = this.checklistId();
      untracked(() => {
        if (id) {
          this.load(id);
        } else {
          this.checklist.set(null);
        }
      });
    });
  }

  protected title(): string {
    const employee = this.checklist()?.employee;
    return employee ? `${employee.employee_number} - ${employee.full_name}` : this.i18n.translate('hrmOffboarding.checklist');
  }

  protected complete(taskId: string): void {
    this.busy.set(true);
    this.api.completeOffboardingTask(taskId).subscribe({
      next: () => {
        this.busy.set(false);
        this.load(this.checklistId() ?? '');
        this.changed.emit();
      },
      error: (err: unknown) => {
        this.busy.set(false);
        reportHttpError(err, this.message, this.i18n);
      },
    });
  }

  private load(id: string): void {
    this.api.getOffboardingChecklist(id).subscribe({
      next: (res) => this.checklist.set(res.data),
      error: (err: unknown) => reportHttpError(err, this.message, this.i18n),
    });
  }
}
