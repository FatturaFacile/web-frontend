import { Component, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { ConsolidationGroup, ConsolidationRun, GeneralLedgerConsolidationApiService, I18nService, PermissionsService } from '@core';
import { IconActionDirective, TranslatePipe } from '@shared';
import { GlErrorAlertComponent } from '../shared/gl-error-alert.component';
import { GlConsolidationPeriodStore } from './gl-consolidation-period.store';

/** Runs of a group: execute the consolidation for a fiscal period and open, lock or delete the results. */
@Component({
  selector: 'app-gl-consolidation-runs',
  styleUrl: './gl-consolidation.scss',
  imports: [
    FormsModule,
    RouterLink,
    IconActionDirective,
    NzButtonModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    GlErrorAlertComponent,
    TranslatePipe,
  ],
  template: `
    <app-gl-error-alert [error]="error()" />
    <div class="toolbar">
      <label for="cons-run-period">{{ 'GL.PERIOD' | translate }}</label>
      <nz-select id="cons-run-period" class="select-md" nzShowSearch nzAllowClear [(ngModel)]="periodId" [nzPlaceHolder]="'GL.PERIOD' | translate" (ngModelChange)="load()">
        @for (period of periods.periods(); track period.id) {
          <nz-option [nzValue]="period.id" [nzLabel]="period.label" />
        }
      </nz-select>
      <span class="spacer"></span>
      @if (canWrite) {
        <button nz-button nzType="primary" type="button" [disabled]="!periodId || running()" [nzLoading]="running()" (click)="run()">
          {{ 'GL.CONS_RUN' | translate }}
        </button>
      }
    </div>
    <nz-table #table nzSize="small" [nzData]="runs()" [nzLoading]="loading()" [nzShowPagination]="false">
      <thead>
        <tr>
          <th>{{ 'GL.PERIOD' | translate }}</th>
          <th>{{ 'GL.CONS_VERSION' | translate }}</th>
          <th>{{ 'GL.STATUS' | translate }}</th>
          <th>{{ 'GL.CONS_WARNINGS' | translate }}</th>
          <th>{{ 'GL.COL_DATE' | translate }}</th>
          <th>{{ 'GL.COL_ACTIONS' | translate }}</th>
        </tr>
      </thead>
      <tbody>
        @for (item of table.data; track item.id) {
          <tr>
            <td>{{ item.period_start }} / {{ item.period_end }}</td>
            <td>v{{ item.version }}</td>
            <td>
              <nz-tag [nzColor]="item.status === 'locked' ? 'blue' : 'green'">{{ 'GL.CONS_RUN_' + item.status.toUpperCase() | translate }}</nz-tag>
            </td>
            <td>{{ item.warnings?.length ?? 0 }}</td>
            <td>{{ item.created_at?.slice(0, 10) }}</td>
            <td>
              <div class="actions">
                <a nz-button nzSize="small" [routerLink]="['/general-ledger/consolidation/runs', item.id]">{{ 'GL.CONS_OPEN' | translate }}</a>
                @if (canWrite && item.status !== 'locked') {
                  <button
                    nz-button
                    nzSize="small"
                    nzDanger
                    type="button"
                    appIconAction="delete"
                    nz-popconfirm
                    [nzPopconfirmTitle]="'GL.CONFIRM_DELETE' | translate"
                    (nzOnConfirm)="remove(item)"
                  ></button>
                }
              </div>
            </td>
          </tr>
        }
      </tbody>
    </nz-table>
  `,
})
export class GlConsolidationRunsComponent implements OnInit {
  private readonly api = inject(GeneralLedgerConsolidationApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  protected readonly periods = inject(GlConsolidationPeriodStore);
  protected readonly canWrite = inject(PermissionsService).canWrite('ledger');

  readonly group = input.required<ConsolidationGroup>();

  protected periodId: string | null = null;
  protected readonly runs = signal<ConsolidationRun[]>([]);
  protected readonly loading = signal(false);
  protected readonly running = signal(false);
  protected readonly error = signal<unknown>(null);

  ngOnInit(): void {
    this.periods.load();
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.api.getRuns(this.group().id, this.periodId).subscribe({
      next: (res) => {
        this.runs.set(res.data ?? []);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(err);
        this.loading.set(false);
      },
    });
  }

  protected run(): void {
    if (!this.periodId) {
      return;
    }
    this.running.set(true);
    this.error.set(null);
    this.api.runConsolidation(this.group().id, this.periodId).subscribe({
      next: () => {
        this.running.set(false);
        this.message.success(this.i18n.translate('GL.CONS_RUN_CREATED'));
        this.load();
      },
      error: (err: unknown) => {
        this.running.set(false);
        this.error.set(err);
      },
    });
  }

  protected remove(item: ConsolidationRun): void {
    this.api.deleteRun(item.id).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('GL.CONS_DELETED'));
        this.load();
      },
      error: (err: unknown) => this.error.set(err),
    });
  }
}
