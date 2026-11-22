import { Component, computed, effect, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { ConvertToHardPayload, RebalancePayload, ResourceAllocation } from '@core';
import { TranslatePipe } from '@shared';
import { ProjectWbsPickerComponent } from './project-wbs-picker.component';
import { canSplitAt, needsProjectToConvert } from './resource-planning.util';

export type DialogMode = 'edit' | 'split' | 'convert';

export interface DialogRequest {
  mode: DialogMode;
  allocation: ResourceAllocation;
}

/** What the planner has to run once the dialog is confirmed. */
export interface DialogResult {
  mode: DialogMode;
  allocation: ResourceAllocation;
  rebalance?: RebalancePayload;
  convert?: ConvertToHardPayload;
}

export interface EmployeeOption {
  id: string;
  name: string;
}

/**
 * The three forms behind the menu of a booking bar: edit the period and the hours (resize), split at a date (the second
 * part can go to a colleague) and convert a soft booking to a hard one (project and WBS when it has none).
 */
@Component({
  selector: 'app-allocation-dialog',
  imports: [
    FormsModule,
    ProjectWbsPickerComponent,
    TranslatePipe,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
  ],
  template: `
    <nz-modal
      [nzVisible]="request() !== null"
      [nzTitle]="titleKey() | translate"
      [nzOkText]="okKey() | translate"
      [nzOkDisabled]="!valid()"
      (nzOnCancel)="closed.emit()"
      (nzOnOk)="submit()"
    >
      <ng-container *nzModalContent>
        @if (request(); as current) {
          <p class="subject">
            <strong>{{ current.allocation.employee_name }}</strong>
            · {{ current.allocation.start_date }} – {{ current.allocation.end_date }}
          </p>
          @switch (current.mode) {
            @case ('edit') {
              <nz-form-item>
                <nz-form-label nzRequired nzFor="rp-edit-start">{{
                  'resourcePlanning.edit.startDate' | translate
                }}</nz-form-label>
                <nz-form-control
                  ><input
                    nz-input
                    id="rp-edit-start"
                    type="date"
                    [ngModel]="startDate()"
                    (ngModelChange)="startDate.set($event)"
                /></nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label nzRequired nzFor="rp-edit-end">{{
                  'resourcePlanning.edit.endDate' | translate
                }}</nz-form-label>
                <nz-form-control
                  ><input
                    nz-input
                    id="rp-edit-end"
                    type="date"
                    [ngModel]="endDate()"
                    (ngModelChange)="endDate.set($event)"
                /></nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label nzRequired nzFor="rp-edit-hours">{{
                  'resourcePlanning.edit.hoursPerDay' | translate
                }}</nz-form-label>
                <nz-form-control
                  ><input
                    nz-input
                    id="rp-edit-hours"
                    type="number"
                    min="0.25"
                    max="24"
                    step="0.25"
                    [ngModel]="hoursPerDay()"
                    (ngModelChange)="hoursPerDay.set(+$event)"
                /></nz-form-control>
              </nz-form-item>
            }
            @case ('split') {
              <nz-form-item>
                <nz-form-label nzRequired nzFor="rp-split-date">{{
                  'resourcePlanning.split.date' | translate
                }}</nz-form-label>
                <nz-form-control [nzErrorTip]="'resourcePlanning.split.invalidDate' | translate"
                  ><input
                    nz-input
                    id="rp-split-date"
                    type="date"
                    [ngModel]="splitDate()"
                    (ngModelChange)="splitDate.set($event)"
                /></nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label nzFor="rp-split-employee">{{
                  'resourcePlanning.split.employee' | translate
                }}</nz-form-label>
                <nz-form-control>
                  <nz-select
                    nzId="rp-split-employee"
                    nzShowSearch
                    nzAllowClear
                    [nzPlaceHolder]="'resourcePlanning.split.sameEmployee' | translate"
                    [ngModel]="splitEmployeeId()"
                    (ngModelChange)="splitEmployeeId.set($event ?? null)"
                  >
                    @for (employee of employees(); track employee.id) {
                      <nz-option [nzValue]="employee.id" [nzLabel]="employee.name"></nz-option>
                    }
                  </nz-select>
                </nz-form-control>
              </nz-form-item>
            }
            @case ('convert') {
              @if (needsProject()) {
                <p class="hint">{{ 'resourcePlanning.convert.needsProject' | translate }}</p>
              }
              <app-project-wbs-picker
                idPrefix="rp-convert"
                [projectRequired]="needsProject()"
                [(projectId)]="projectId"
                [(wbsNodeId)]="wbsNodeId"
              />
            }
          }
        }
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .subject {
      margin-bottom: 16px;
    }

    .hint {
      color: var(--ant-text-color-secondary, #595959);
    }
  `,
})
export class AllocationDialogComponent {
  readonly request = input<DialogRequest | null>(null);
  readonly employees = input<EmployeeOption[]>([]);
  readonly submitted = output<DialogResult>();
  readonly closed = output<void>();

  readonly startDate = signal('');
  readonly endDate = signal('');
  readonly hoursPerDay = signal(0);
  readonly splitDate = signal('');
  readonly splitEmployeeId = signal<string | null>(null);
  readonly projectId = signal<string | null>(null);
  readonly wbsNodeId = signal<string | null>(null);

  readonly titleKey = computed(() => `resourcePlanning.${this.request()?.mode ?? 'edit'}.title`);
  readonly okKey = computed(() => `resourcePlanning.${this.request()?.mode ?? 'edit'}.confirm`);
  readonly needsProject = computed(() => {
    const request = this.request();
    return request !== null && needsProjectToConvert(request.allocation);
  });

  readonly valid = computed(() => {
    const request = this.request();
    if (request === null) {
      return false;
    }
    switch (request.mode) {
      case 'edit':
        return (
          this.startDate() !== '' &&
          this.endDate() >= this.startDate() &&
          this.hoursPerDay() > 0 &&
          this.hoursPerDay() <= 24
        );
      case 'split':
        return canSplitAt(request.allocation, this.splitDate());
      case 'convert':
        return !this.needsProject() || this.projectId() !== null;
    }
  });

  constructor() {
    effect(() => {
      const request = this.request();
      if (request === null) {
        return;
      }
      untracked(() => {
        const { allocation } = request;
        this.startDate.set(allocation.start_date);
        this.endDate.set(allocation.end_date);
        this.hoursPerDay.set(allocation.allocated_hours_per_day);
        this.splitDate.set(allocation.start_date);
        this.splitEmployeeId.set(null);
        this.projectId.set(allocation.project_id);
        this.wbsNodeId.set(allocation.wbs_node_id);
      });
    });
  }

  submit(): void {
    const request = this.request();
    if (request === null || !this.valid()) {
      return;
    }
    const { allocation, mode } = request;

    if (mode === 'edit') {
      this.submitted.emit({
        mode,
        allocation,
        rebalance: {
          strategy: 'resize',
          start_date: this.startDate(),
          end_date: this.endDate(),
          allocated_hours_per_day: this.hoursPerDay(),
        },
      });
    } else if (mode === 'split') {
      const employeeId = this.splitEmployeeId();
      this.submitted.emit({
        mode,
        allocation,
        rebalance: {
          strategy: 'split',
          split_date: this.splitDate(),
          ...(employeeId && employeeId !== allocation.employee_id
            ? { employee_id: employeeId }
            : {}),
        },
      });
    } else {
      const projectId = this.projectId();
      const wbsNodeId = this.wbsNodeId();
      this.submitted.emit({
        mode,
        allocation,
        convert: {
          ...(projectId ? { project_id: projectId } : {}),
          ...(projectId && wbsNodeId ? { wbs_node_id: wbsNodeId } : {}),
        },
      });
    }
  }
}
