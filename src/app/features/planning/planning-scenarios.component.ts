import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
  PLANNING_SCENARIO_STATUSES,
  PLANNING_SCENARIO_TYPES,
  PlanningApiService,
  PlanningScenario,
  PlanningScenarioStatus,
  PlanningScenarioType,
  TranslateService,
} from '@core';
import { IconActionDirective, ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText, blankToNull, monthStartIso, SCENARIO_STATUS_COLORS } from './planning.util';

/** The baseline and the what-if scenarios of the company, with creation and copy. */
@Component({
  selector: 'app-planning-scenarios',
  styleUrl: './planning.scss',
  imports: [
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
    <app-page-header [title]="'PLANNING.SCENARIOS_TITLE' | translate" [subtitle]="'PLANNING.SCENARIOS_SUBTITLE' | translate">
      <a nz-button routerLink="/planning/compare">{{ 'PLANNING.COMPARE' | translate }}</a>
      <button nz-button nzType="primary" (click)="openCreate()" appIconAction="create"></button>
    </app-page-header>

    <div class="toolbar">
      <nz-select style="width: 200px" nzAllowClear [ngModel]="status()" (ngModelChange)="status.set($event); load()" [nzPlaceHolder]="'PLANNING.STATUS' | translate" [attr.aria-label]="'PLANNING.STATUS' | translate">
        @for (value of statuses; track value) {
          <nz-option [nzValue]="value" [nzLabel]="('PLANNING.STATUS_' + value.toUpperCase()) | translate"></nz-option>
        }
      </nz-select>
      <nz-select style="width: 200px" nzAllowClear [ngModel]="type()" (ngModelChange)="type.set($event); load()" [nzPlaceHolder]="'PLANNING.TYPE' | translate" [attr.aria-label]="'PLANNING.TYPE' | translate">
        @for (value of types; track value) {
          <nz-option [nzValue]="value" [nzLabel]="('PLANNING.TYPE_' + value.toUpperCase()) | translate"></nz-option>
        }
      </nz-select>
    </div>

    <nz-card class="main-card">
      <nz-table #table [nzData]="scenarios()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="25">
        <thead>
          <tr>
            <th>{{ 'PLANNING.NAME' | translate }}</th>
            <th>{{ 'PLANNING.TYPE' | translate }}</th>
            <th>{{ 'PLANNING.STATUS' | translate }}</th>
            <th>{{ 'PLANNING.HORIZON' | translate }}</th>
            <th class="num">{{ 'PLANNING.LINES' | translate }}</th>
            <th class="num">{{ 'PLANNING.PUBLISHED_VERSION' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <td><a [routerLink]="['/planning/scenarios', row.id]">{{ row.name }}</a></td>
              <td>{{ ('PLANNING.TYPE_' + row.scenario_type.toUpperCase()) | translate }}</td>
              <td><nz-tag [nzColor]="statusColor(row.status)">{{ ('PLANNING.STATUS_' + row.status.toUpperCase()) | translate }}</nz-tag></td>
              <td>{{ row.horizon_start }} - {{ row.horizon_end }}</td>
              <td class="num">{{ row.lines_count ?? 0 }}</td>
              <td class="num">{{ row.published_version > 0 ? 'v' + row.published_version : '' }}</td>
              <td>
                <div class="row-actions">
                  <button nz-button nzType="text" (click)="openCopy(row)" [attr.aria-label]="'PLANNING.COPY' | translate"><span>{{ 'PLANNING.COPY' | translate }}</span></button>
                  @if (row.status === 'draft' && row.published_version === 0) {
                    <button nz-button nzType="text" nzDanger appIconAction="delete" nz-popconfirm [nzPopconfirmTitle]="'PLANNING.DELETE_CONFIRM' | translate" (nzOnConfirm)="remove(row)"></button>
                  }
                </div>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && scenarios().length === 0) {
        <nz-empty [nzNotFoundContent]="'PLANNING.NO_SCENARIOS' | translate"></nz-empty>
      }
    </nz-card>

    <nz-modal appModalActions [(nzVisible)]="createVisible" [nzTitle]="'PLANNING.NEW_SCENARIO' | translate" (nzOnCancel)="createVisible.set(false)" (nzOnOk)="saveCreate()" okAction="save" [nzOkDisabled]="createForm.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="createForm" nzLayout="vertical">
          <nz-form-item>
            <nz-form-label nzRequired nzFor="scenario-name">{{ 'PLANNING.NAME' | translate }}</nz-form-label>
            <nz-form-control><input nz-input id="scenario-name" formControlName="name" maxlength="160" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'PLANNING.TYPE' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="scenario_type">
                @for (value of types; track value) {
                  <nz-option [nzValue]="value" [nzLabel]="('PLANNING.TYPE_' + value.toUpperCase()) | translate"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="scenario-start">{{ 'PLANNING.HORIZON_START' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="scenario-start" type="date" formControlName="horizon_start" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="scenario-end">{{ 'PLANNING.HORIZON_END' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="scenario-end" type="date" formControlName="horizon_end" /></nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-label nzFor="scenario-description">{{ 'PLANNING.DESCRIPTION' | translate }}</nz-form-label>
            <nz-form-control><textarea nz-input id="scenario-description" rows="2" formControlName="description" maxlength="2000"></textarea></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal appModalActions [(nzVisible)]="copyVisible" [nzTitle]="'PLANNING.COPY_SCENARIO' | translate" (nzOnCancel)="copyVisible.set(false)" (nzOnOk)="saveCopy()" okAction="save" [nzOkDisabled]="copyForm.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="copyForm" nzLayout="vertical">
          <nz-form-item>
            <nz-form-label nzRequired nzFor="copy-name">{{ 'PLANNING.NAME' | translate }}</nz-form-label>
            <nz-form-control><input nz-input id="copy-name" formControlName="name" maxlength="160" /></nz-form-control>
          </nz-form-item>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzFor="copy-demand">{{ 'PLANNING.DEMAND_ADJUSTMENT' | translate }}</nz-form-label>
              <nz-form-control [nzExtra]="'PLANNING.ADJUSTMENT_HINT' | translate"><input nz-input id="copy-demand" type="number" min="-100" max="1000" step="any" formControlName="demand_adjustment_percent" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="copy-supply">{{ 'PLANNING.SUPPLY_ADJUSTMENT' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="copy-supply" type="number" min="-100" max="1000" step="any" formControlName="supply_adjustment_percent" /></nz-form-control>
            </nz-form-item>
          </div>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class PlanningScenariosComponent implements OnInit {
  private readonly api = inject(PlanningApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly statuses = PLANNING_SCENARIO_STATUSES;
  readonly types = PLANNING_SCENARIO_TYPES;
  readonly scenarios = signal<PlanningScenario[]>([]);
  readonly loading = signal(false);
  readonly status = signal<PlanningScenarioStatus | null>(null);
  readonly type = signal<PlanningScenarioType | null>(null);
  readonly createVisible = signal(false);
  readonly copyVisible = signal(false);
  readonly copySource = signal<PlanningScenario | null>(null);

  readonly createForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(160)]],
    scenario_type: ['what_if' as PlanningScenarioType, [Validators.required]],
    horizon_start: [monthStartIso(), [Validators.required]],
    horizon_end: [monthStartIso(11), [Validators.required]],
    description: [''],
  });

  readonly copyForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(160)]],
    demand_adjustment_percent: this.fb.control<number | null>(null, [Validators.min(-100), Validators.max(1000)]),
    supply_adjustment_percent: this.fb.control<number | null>(null, [Validators.min(-100), Validators.max(1000)]),
  });

  ngOnInit(): void {
    this.load();
  }

  statusColor(status: PlanningScenarioStatus): string {
    return SCENARIO_STATUS_COLORS[status];
  }

  load(): void {
    this.loading.set(true);
    this.api.getScenarios({ status: this.status() ?? undefined, scenario_type: this.type() ?? undefined, per_page: 100 }).subscribe({
      next: (response) => {
        this.scenarios.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('PLANNING.ACTION_ERROR'));
      },
    });
  }

  openCreate(): void {
    this.createForm.reset({ name: '', scenario_type: this.scenarios().some((scenario) => scenario.scenario_type === 'baseline') ? 'what_if' : 'baseline', horizon_start: monthStartIso(), horizon_end: monthStartIso(11), description: '' });
    this.createVisible.set(true);
  }

  saveCreate(): void {
    const value = this.createForm.getRawValue();
    this.api
      .createScenario({ name: value.name, description: blankToNull(value.description), scenario_type: value.scenario_type, horizon_start: value.horizon_start, horizon_end: value.horizon_end })
      .subscribe({
        next: () => {
          this.message.success(this.translate.instant('PLANNING.SCENARIO_SAVED'));
          this.createVisible.set(false);
          this.load();
        },
        error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('PLANNING.ACTION_ERROR')),
      });
  }

  openCopy(scenario: PlanningScenario): void {
    this.copySource.set(scenario);
    this.copyForm.reset({ name: '', demand_adjustment_percent: null, supply_adjustment_percent: null });
    this.copyVisible.set(true);
  }

  saveCopy(): void {
    const source = this.copySource();
    if (!source) {
      return;
    }

    const value = this.copyForm.getRawValue();
    this.api
      .copyScenario(source.id, { name: value.name, demand_adjustment_percent: value.demand_adjustment_percent, supply_adjustment_percent: value.supply_adjustment_percent })
      .subscribe({
        next: () => {
          this.message.success(this.translate.instant('PLANNING.SCENARIO_COPIED'));
          this.copyVisible.set(false);
          this.load();
        },
        error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('PLANNING.ACTION_ERROR')),
      });
  }

  remove(scenario: PlanningScenario): void {
    this.api.deleteScenario(scenario.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('PLANNING.DELETED'));
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('PLANNING.ACTION_ERROR')),
    });
  }
}
