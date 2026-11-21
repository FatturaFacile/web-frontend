import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { HsePpeDrawerComponent } from './hse-ppe-drawer.component';
import { Jurisdiction, MatrixRow, TrafficLight } from './hse.models';
import { HseStore } from './hse.store';
import { certificateKey, FITNESS_KEYS, lightColor, lightKey } from './hse.utils';

const LIGHTS: TrafficLight[] = ['GREEN', 'YELLOW', 'RED'];
const JURISDICTIONS: Jurisdiction[] = ['IT', 'CH'];

/**
 * RSPP / SiBe traffic-light matrix (`/hse/compliance-matrix`): the employees against their mandatory trainings, medical
 * surveillance and PPE, each cell a green, yellow or red tag whose tooltip gives the exact date or prescription. The
 * employee column stays in view while the requirement columns scroll. The KPI cards above count the hard-blocked workers.
 */
@Component({
  selector: 'app-hse-compliance-matrix',
  styleUrl: './hse.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzSelectModule,
    NzSpinModule,
    NzStatisticModule,
    NzTableModule,
    NzTagModule,
    NzTooltipModule,
    HsePpeDrawerComponent,
  ],
  template: `
    <app-page-header
      [title]="'HSE.MATRIX_TITLE' | translate"
      [subtitle]="'HSE.NAV' | translate"
    ></app-page-header>

    <div class="kpi-row" data-testid="kpis">
      <nz-card nzSize="small">
        <nz-statistic
          [nzTitle]="'HSE.KPI_COMPLIANCE' | translate"
          [nzValue]="store.kpis().overall_compliance_percent"
          nzSuffix="%"
        ></nz-statistic>
      </nz-card>
      <nz-card nzSize="small">
        <nz-statistic
          data-testid="kpi-blocked"
          [nzTitle]="'HSE.KPI_BLOCKED' | translate"
          [nzValue]="store.kpis().hard_blocked_workers"
        ></nz-statistic>
      </nz-card>
      <nz-card nzSize="small">
        <nz-statistic
          [nzTitle]="'HSE.KPI_EXPIRING' | translate"
          [nzValue]="store.kpis().expiring_in_30_days"
        ></nz-statistic>
      </nz-card>
      <nz-card nzSize="small">
        <nz-statistic
          [nzTitle]="'HSE.KPI_OPEN_CAPA' | translate"
          [nzValue]="store.kpis().open_near_miss_and_capas"
        ></nz-statistic>
      </nz-card>
    </div>

    <div class="filter-row">
      <nz-select
        class="filter"
        nzAllowClear
        data-testid="filter-status"
        [ngModel]="store.filters().status ?? null"
        [nzPlaceHolder]="'HSE.FILTER_STATUS' | translate"
        (ngModelChange)="filterStatus($event)"
      >
        @for (light of lights; track light) {
          <nz-option [nzValue]="light" [nzLabel]="lightLabel(light) | translate"></nz-option>
        }
      </nz-select>
      <nz-select
        class="filter"
        nzAllowClear
        data-testid="filter-jurisdiction"
        [ngModel]="store.filters().jurisdiction ?? null"
        [nzPlaceHolder]="'HSE.FILTER_JURISDICTION' | translate"
        (ngModelChange)="filterJurisdiction($event)"
      >
        @for (jurisdiction of jurisdictions; track jurisdiction) {
          <nz-option [nzValue]="jurisdiction" [nzLabel]="jurisdiction"></nz-option>
        }
      </nz-select>
    </div>

    <nz-spin [nzSpinning]="store.loading()">
      <nz-table
        #table
        nzSize="small"
        nzBordered
        [nzData]="store.rows()"
        [nzScroll]="{ x: '960px' }"
        [nzShowPagination]="false"
        [nzFrontPagination]="false"
      >
        <thead>
          <tr>
            <th nzLeft rowspan="2">{{ 'HSE.EMPLOYEE' | translate }}</th>
            <th [attr.colspan]="store.trainingColumns().length || 1">{{ 'HSE.GROUP_TRAININGS' | translate }}</th>
            <th>{{ 'HSE.GROUP_MEDICAL' | translate }}</th>
            <th [attr.colspan]="store.ppeColumns().length || 1">{{ 'HSE.GROUP_PPE' | translate }}</th>
            <th nzRight rowspan="2">{{ 'HSE.OVERALL' | translate }}</th>
          </tr>
          <tr>
            @for (type of store.trainingColumns(); track type) {
              <th>{{ certificateLabel(type) | translate }}</th>
            } @empty {
              <th>{{ 'HSE.NO_REQUIREMENTS' | translate }}</th>
            }
            <th></th>
            @for (product of store.ppeColumns(); track product) {
              <th>{{ product }}</th>
            } @empty {
              <th>{{ 'HSE.NO_REQUIREMENTS' | translate }}</th>
            }
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.employee_id) {
            <tr [attr.data-testid]="'row-' + row.employee_id">
              <td nzLeft>{{ row.employee_name }}</td>
              @for (type of store.trainingColumns(); track type) {
                <td>
                  @if (row.trainings[type]; as cell) {
                    <nz-tag
                      [nzColor]="color(cell.light)"
                      nz-tooltip
                      [nzTooltipTitle]="cell.missing ? ('HSE.MISSING' | translate) : ('HSE.EXPIRES_ON' | translate: { date: cell.expires_at ?? '-' })"
                    >
                      {{ lightLabel(cell.light) | translate }}
                    </nz-tag>
                  }
                </td>
              } @empty {
                <td></td>
              }
              <td>
                <nz-tag
                  [nzColor]="color(row.medical.light)"
                  nz-tooltip
                  [nzTooltipTitle]="medicalTip(row)"
                >
                  {{ lightLabel(row.medical.light) | translate }}
                </nz-tag>
              </td>
              @for (product of store.ppeColumns(); track product) {
                <td>
                  @if (row.ppe[product]; as cell) {
                    <nz-tag
                      [nzColor]="color(cell.light)"
                      nz-tooltip
                      [nzTooltipTitle]="cell.missing ? ('HSE.MISSING' | translate) : ('HSE.EXPIRES_ON' | translate: { date: cell.replacement_due_at ?? '-' })"
                    >
                      {{ lightLabel(cell.light) | translate }}
                    </nz-tag>
                  }
                </td>
              } @empty {
                <td></td>
              }
              <td nzRight>
                <nz-tag [nzColor]="color(row.overall)" [attr.data-testid]="'overall-' + row.employee_id">
                  {{ lightLabel(row.overall) | translate }}
                </nz-tag>
                <button nz-button nzSize="small" type="button" (click)="issuePpe(row)">
                  {{ 'HSE.ACTION_ISSUE_PPE' | translate }}
                </button>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-spin>

    @if (drawerRow(); as row) {
      <app-hse-ppe-drawer
        [open]="true"
        [employeeId]="row.employee_id"
        [employeeName]="row.employee_name"
        (closed)="drawerRow.set(null)"
        (issued)="reload()"
      ></app-hse-ppe-drawer>
    }
  `,
})
export class HseComplianceMatrixComponent implements OnInit {
  protected readonly store = inject(HseStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly lights = LIGHTS;
  protected readonly jurisdictions = JURISDICTIONS;
  protected readonly drawerRow = signal<MatrixRow | null>(null);

  protected readonly color = lightColor;
  protected readonly lightLabel = lightKey;
  protected readonly certificateLabel = certificateKey;

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    this.store
      .loadMatrix()
      .subscribe({ error: () => this.message.error(this.i18n.instant('HSE.LOAD_ERROR')) });
  }

  protected filterStatus(status: TrafficLight | null): void {
    this.store.setFilters({ status });
    this.reload();
  }

  protected filterJurisdiction(jurisdiction: Jurisdiction | null): void {
    this.store.setFilters({ jurisdiction });
    this.reload();
  }

  protected issuePpe(row: MatrixRow): void {
    this.drawerRow.set(row);
  }

  /** The judgment and its prescriptions only: the matrix never carries a diagnosis. */
  protected medicalTip(row: MatrixRow): string {
    const medical = row.medical;

    if (medical.fitness_outcome === null) {
      return this.i18n.instant('HSE.MISSING');
    }

    const parts = [this.i18n.instant(FITNESS_KEYS[medical.fitness_outcome])];

    if (medical.restrictions_summary !== null) {
      parts.push(medical.restrictions_summary);
    }

    if (medical.next_visit_due_date !== null) {
      parts.push(this.i18n.instant('HSE.EXPIRES_ON', { date: medical.next_visit_due_date }));
    }

    return parts.join(' · ');
  }
}
