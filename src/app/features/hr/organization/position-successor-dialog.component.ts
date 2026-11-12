import { Component, computed, inject, input, model, output } from '@angular/core';
import { HrEmployeeApiService, PositionReadinessLevel, PositionResource } from '@core';
import { TranslatePipe } from '@shared';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { tap } from 'rxjs';
import { ActionFormComponent, ActionFormConfig } from '../shared/action-form/action-form.component';
import { CrudOption } from '../shared/crud/crud.types';

const READINESS: PositionReadinessLevel[] = ['ready_now', 'ready_1_2_years', 'developing'];

/** Names the successor of a position and how ready the person is. */
@Component({
  selector: 'app-position-successor-dialog',
  styleUrl: './position-successor-dialog.component.scss',
  imports: [ActionFormComponent, NzModalModule, TranslatePipe],
  template: `
    <nz-modal
      [nzVisible]="open()"
      [nzTitle]="'hrmOrgX.successorTitle' | translate"
      [nzFooter]="null"
      (nzOnCancel)="open.set(false)"
    >
      <ng-container *nzModalContent>
        <app-action-form [config]="config()" />
      </ng-container>
    </nz-modal>
  `,
})
export class PositionSuccessorDialogComponent {
  readonly open = model(false);
  readonly positionId = input<string | null>(null);
  readonly currentSuccessor = input<string | null>(null);
  readonly employees = input<CrudOption[]>([]);
  /** The position as the server saved it. */
  readonly assigned = output<PositionResource>();

  private readonly orgApi = inject(HrEmployeeApiService);

  protected readonly config = computed<ActionFormConfig>(() => {
    const positionId = this.positionId() ?? '';
    return {
      submitLabelKey: 'hrmCommon.save',
      fields: [
        {
          key: 'successor_employee_id',
          labelKey: 'hrmOrgX.successor',
          type: 'select',
          required: true,
          defaultValue: this.currentSuccessor() ?? '',
          options: () => this.employees(),
        },
        {
          key: 'readiness_level',
          labelKey: 'hrmOrgX.readiness',
          type: 'select',
          defaultValue: 'ready_1_2_years',
          options: () =>
            READINESS.map((value) => ({ value, labelKey: `hrmOrgX.readinessLevels.${value}` })),
        },
      ],
      submit: (payload) =>
        this.orgApi
          .assignPositionSuccessor(
            positionId,
            payload as { successor_employee_id: string; readiness_level?: PositionReadinessLevel },
          )
          .pipe(
            tap((res) => {
              this.open.set(false);
              this.assigned.emit(res.data);
            }),
          ),
    };
  });
}
