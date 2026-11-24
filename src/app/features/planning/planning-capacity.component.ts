import { DecimalPipe } from '@angular/common';
import { Component, effect, inject, input, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { PlanningApiService, PlanningCapacity, PlanningConstraint, PlanningResource, TranslateService } from '@core';
import { IconActionDirective, ModalActionsDirective, TranslatePipe } from '@shared';
import { apiErrorText, blankToNull, monthLabel } from './planning.util';

/** Finite capacity check of a scenario and the capacity constraints that override the default capacity of a month. */
@Component({
  selector: 'app-planning-capacity',
  styleUrl: './planning.scss',
  imports: [
    DecimalPipe,
    ReactiveFormsModule,
    IconActionDirective,
    ModalActionsDirective,
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
    @if (capacity(); as data) {
      <div class="toolbar">
        <nz-tag [nzColor]="data.summary.feasible ? 'green' : 'red'">{{ (data.summary.feasible ? 'PLANNING.CAPACITY_FEASIBLE' : 'PLANNING.CAPACITY_OVERLOADED') | translate }}</nz-tag>
        <span class="muted">{{ 'PLANNING.OVERLOADED_MONTHS' | translate }}: {{ data.summary.overloaded_count }}</span>
      </div>

      <nz-card class="main-card" [nzTitle]="'PLANNING.CAPACITY_LOAD' | translate">
        <nz-table #loadTable [nzData]="data.rows" nzSize="small" [nzPageSize]="50">
          <thead>
            <tr>
              <th>{{ 'PLANNING.RESOURCE' | translate }}</th>
              <th>{{ 'PLANNING.PERIOD' | translate }}</th>
              <th class="num">{{ 'PLANNING.LOAD' | translate }}</th>
              <th class="num">{{ 'PLANNING.AVAILABLE' | translate }}</th>
              <th class="num">{{ 'PLANNING.UTILIZATION' | translate }}</th>
              <th class="num">{{ 'PLANNING.OVERLOAD' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of loadTable.data; track row.resource_id + row.period) {
              <tr>
                <td>{{ row.resource_code }} <span class="muted">{{ row.unit }}</span></td>
                <td>{{ monthLabel(row.period) }}</td>
                <td class="num">{{ row.load | number: '1.0-3' }}</td>
                <td class="num">{{ row.available | number: '1.0-3' }} <span class="muted">({{ ('PLANNING.CAPACITY_' + row.source.toUpperCase()) | translate }})</span></td>
                <td class="num" [class.row-overdue]="row.is_overloaded">{{ row.utilization_percent !== null ? (row.utilization_percent | number: '1.1-1') + '%' : '' }}</td>
                <td class="num" [class.row-overdue]="row.is_overloaded">{{ row.overload | number: '1.0-3' }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
        @if (data.rows.length === 0) {
          <nz-empty [nzNotFoundContent]="'PLANNING.NO_CAPACITY_DATA' | translate"></nz-empty>
        }
      </nz-card>
    }

    <nz-card class="main-card" [nzTitle]="'PLANNING.CONSTRAINTS' | translate">
      @if (editable()) {
        <div class="toolbar"><span class="spacer"></span><button nz-button nzType="primary" (click)="openModal()" appIconAction="create"></button></div>
      }
      <nz-table #constraintTable [nzData]="constraints()" nzSize="small" [nzShowPagination]="false">
        <thead>
          <tr>
            <th>{{ 'PLANNING.RESOURCE' | translate }}</th>
            <th>{{ 'PLANNING.PERIOD' | translate }}</th>
            <th class="num">{{ 'PLANNING.AVAILABLE' | translate }}</th>
            <th>{{ 'PLANNING.NOTES' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of constraintTable.data; track row.id) {
            <tr>
              <td>{{ row.resource_code }}</td>
              <td>{{ monthLabel(row.period) }}</td>
              <td class="num">{{ row.available_capacity | number: '1.0-3' }}</td>
              <td>{{ row.notes }}</td>
              <td>
                @if (editable()) {
                  <div class="row-actions">
                    <button nz-button nzType="text" nzDanger appIconAction="delete" nz-popconfirm [nzPopconfirmTitle]="'PLANNING.DELETE_CONFIRM' | translate" (nzOnConfirm)="remove(row)"></button>
                  </div>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (constraints().length === 0) {
        <nz-empty [nzNotFoundContent]="'PLANNING.NO_CONSTRAINTS' | translate"></nz-empty>
      }
    </nz-card>

    <nz-modal appModalActions [(nzVisible)]="modalVisible" [nzTitle]="'PLANNING.NEW_CONSTRAINT' | translate" (nzOnCancel)="modalVisible.set(false)" (nzOnOk)="save()" okAction="save" [nzOkDisabled]="form.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="form" nzLayout="vertical">
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'PLANNING.RESOURCE' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="resource_id" nzShowSearch>
                @for (resource of resources(); track resource.id) {
                  <nz-option [nzValue]="resource.id" [nzLabel]="resource.code + ' - ' + resource.name"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="constraint-period">{{ 'PLANNING.PERIOD' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="constraint-period" type="date" formControlName="period" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="constraint-capacity">{{ 'PLANNING.AVAILABLE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="constraint-capacity" type="number" min="0" step="any" formControlName="available_capacity" /></nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-label nzFor="constraint-notes">{{ 'PLANNING.NOTES' | translate }}</nz-form-label>
            <nz-form-control><input nz-input id="constraint-notes" formControlName="notes" maxlength="500" /></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class PlanningCapacityComponent implements OnInit {
  private readonly api = inject(PlanningApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly scenarioId = input.required<string>();
  readonly editable = input(false);
  /** Bumped by the parent when the lines changed. */
  readonly refresh = input(0);

  readonly monthLabel = monthLabel;
  readonly capacity = signal<PlanningCapacity | null>(null);
  readonly constraints = signal<PlanningConstraint[]>([]);
  readonly resources = signal<PlanningResource[]>([]);
  readonly modalVisible = signal(false);

  readonly form = this.fb.group({
    resource_id: ['', [Validators.required]],
    period: ['', [Validators.required]],
    available_capacity: this.fb.control<number | null>(null, [Validators.required, Validators.min(0)]),
    notes: [''],
  });

  constructor() {
    effect(() => {
      this.scenarioId();
      this.refresh();
      this.load();
    });
  }

  ngOnInit(): void {
    this.api.getResources().subscribe({
      next: (response) => this.resources.set(response.data),
      error: () => this.resources.set([]),
    });
  }

  load(): void {
    this.api.getCapacity(this.scenarioId()).subscribe({
      next: (response) => this.capacity.set(response.data),
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('PLANNING.ACTION_ERROR')),
    });
    this.api.getConstraints(this.scenarioId()).subscribe({
      next: (response) => this.constraints.set(response.data),
      error: () => this.constraints.set([]),
    });
  }

  openModal(): void {
    this.form.reset({ resource_id: '', period: '', available_capacity: null, notes: '' });
    this.modalVisible.set(true);
  }

  save(): void {
    const value = this.form.getRawValue();
    this.api
      .saveConstraint(this.scenarioId(), { resource_id: value.resource_id, period: value.period, available_capacity: String(value.available_capacity), notes: blankToNull(value.notes) })
      .subscribe({
        next: () => {
          this.message.success(this.translate.instant('PLANNING.CONSTRAINT_SAVED'));
          this.modalVisible.set(false);
          this.load();
        },
        error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('PLANNING.ACTION_ERROR')),
      });
  }

  remove(constraint: PlanningConstraint): void {
    this.api.deleteConstraint(constraint.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('PLANNING.DELETED'));
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('PLANNING.ACTION_ERROR')),
    });
  }
}
