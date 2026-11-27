import { Component, computed, inject, input, output } from '@angular/core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { I18nService } from '@core/i18n/i18n.service';
import { ObsSlowQuery } from '../../core/models/observability.model';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import { ToastService } from '@shared/ui/toast/toast.service';
import { copyText, flattenPlan, formatMs } from './observability.util';

/**
 * Detail of a slow query: the sanitized SQL, where it came from (route or job, tenant, trace id), the EXPLAIN plan as an indented
 * list with the sequential scans highlighted, the N+1 warning and the CREATE INDEX CONCURRENTLY suggestions with a copy button.
 */
@Component({
  selector: 'app-slow-query-drawer',
  imports: [NzAlertModule, NzButtonModule, NzDrawerModule, NzTagModule, TranslatePipe],
  styleUrl: './observability.scss',
  template: `
    <nz-drawer
      [nzVisible]="query() !== null"
      [nzWidth]="760"
      [nzTitle]="'OBSERVABILITY.DRAWER.TITLE' | translate"
      (nzOnClose)="closed.emit()"
    >
      <ng-container *nzDrawerContent>
        @if (query(); as q) {
          <div>
            @if (q.n_plus_one) {
              <nz-tag nzColor="volcano" data-test="n-plus-one-tag">{{
                'OBSERVABILITY.TAG.N_PLUS_ONE' | translate: { count: q.n_plus_one_count }
              }}</nz-tag>
            }
            <nz-tag>{{ 'OBSERVABILITY.KIND.' + q.kind.toUpperCase() | translate }}</nz-tag>
          </div>

          @if (q.n_plus_one) {
            <nz-alert
              class="feedback"
              nzType="warning"
              nzShowIcon
              [nzMessage]="'OBSERVABILITY.DRAWER.N_PLUS_ONE_HINT' | translate"
            ></nz-alert>
          }

          <div class="section-title">{{ 'OBSERVABILITY.DRAWER.SQL' | translate }}</div>
          <pre class="code-block" data-test="sql">{{ q.sql }}</pre>
          <button nz-button nzSize="small" type="button" data-test="copy-sql" (click)="copy(q.sql)">
            {{ 'OBSERVABILITY.ACTION.COPY' | translate }}
          </button>

          <ul class="plan-list">
            <li>
              <span>{{ 'OBSERVABILITY.COL.AVG_MS' | translate }}</span>
              <strong>{{ ms(q.avg_ms) }}</strong>
            </li>
            <li>
              <span>{{ 'OBSERVABILITY.COL.MAX_MS' | translate }}</span>
              <strong>{{ ms(q.max_ms) }}</strong>
            </li>
            <li>
              <span>{{ 'OBSERVABILITY.COL.EXECUTIONS' | translate }}</span>
              <strong>{{ q.executions }}</strong>
            </li>
            @if (q.origin) {
              <li>
                <span>{{ 'OBSERVABILITY.COL.ORIGIN' | translate }}</span>
                <strong>{{ q.origin }}</strong>
              </li>
            }
            @if (q.tenant_id) {
              <li>
                <span>{{ 'OBSERVABILITY.COL.TENANT' | translate }}</span>
                <strong>{{ q.tenant_id }}</strong>
              </li>
            }
            @if (q.trace_id) {
              <li>
                <span>{{ 'OBSERVABILITY.COL.TRACE_ID' | translate }}</span>
                <strong data-test="trace-id">{{ q.trace_id }}</strong>
                <button
                  nz-button
                  nzSize="small"
                  type="button"
                  data-test="copy-trace"
                  (click)="copy(q.trace_id)"
                >
                  {{ 'OBSERVABILITY.ACTION.COPY_TRACE' | translate }}
                </button>
              </li>
            }
          </ul>

          <div class="section-title">{{ 'OBSERVABILITY.DRAWER.PLAN' | translate }}</div>
          @if (q.plan_status !== 'available') {
            <nz-alert
              class="feedback"
              nzType="info"
              nzShowIcon
              data-test="plan-unavailable"
              [nzMessage]="'OBSERVABILITY.PLAN_STATUS.' + q.plan_status.toUpperCase() | translate"
            ></nz-alert>
          } @else {
            <ol class="plan-list" data-test="plan">
              @for (row of plan(); track row.id) {
                <li [class.seq-scan]="row.seqScan" [style.padding-left.px]="row.depth * 18">
                  <span class="node-type">{{ row.nodeType }}</span>
                  @if (row.target) {
                    <span>{{ 'OBSERVABILITY.PLAN.ON' | translate }} {{ row.target }}</span>
                  }
                  @if (row.cost !== null) {
                    <span class="muted"
                      >{{ 'OBSERVABILITY.PLAN.COST' | translate }} {{ row.cost }}</span
                    >
                  }
                  @if (row.rows !== null) {
                    <span class="muted"
                      >{{ 'OBSERVABILITY.PLAN.ROWS' | translate }} {{ row.rows }}</span
                    >
                  }
                  @if (row.filter) {
                    <code>{{ row.filter }}</code>
                  }
                </li>
              }
            </ol>
          }

          <div class="section-title">{{ 'OBSERVABILITY.DRAWER.INDEXES' | translate }}</div>
          @for (index of q.suggested_indexes; track index.sql) {
            <div class="index-card" data-test="suggested-index">
              <pre class="code-block">{{ index.sql }}</pre>
              <p class="muted">{{ index.reason }}</p>
              <button nz-button nzSize="small" type="button" (click)="copy(index.sql)">
                {{ 'OBSERVABILITY.ACTION.COPY_SQL' | translate }}
              </button>
            </div>
          } @empty {
            <p class="muted">{{ 'OBSERVABILITY.DRAWER.NO_INDEXES' | translate }}</p>
          }
        }
      </ng-container>
    </nz-drawer>
  `,
})
export class SlowQueryDrawerComponent {
  readonly query = input<ObsSlowQuery | null>(null);
  readonly closed = output<void>();

  private readonly toasts = inject(ToastService);
  private readonly i18n = inject(I18nService);

  protected readonly ms = formatMs;
  protected readonly plan = computed(() => flattenPlan(this.query()?.plan ?? null));

  protected async copy(text: string): Promise<void> {
    const ok = await copyText(text);
    if (ok) {
      this.toasts.success(this.i18n.translate('OBSERVABILITY.COPIED'));
    } else {
      this.toasts.error(this.i18n.translate('OBSERVABILITY.COPY_FAILED'));
    }
  }
}
