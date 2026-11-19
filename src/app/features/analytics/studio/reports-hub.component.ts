import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { I18nService } from '@core/i18n/i18n.service';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AnalyticsApiService, StudioSavedReport, StudioSchedule } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { analyticsErrorText } from '../analytics-designer.util';
import { labelKey, STATUS_KEYS, VISIBILITY_KEYS } from './studio-keys';

export type HubTab = 'mine' | 'role' | 'public' | 'scheduled';

/** The hub of the studio: the saved reports grouped by who they are for, and the scheduled deliveries. */
@Component({
  selector: 'app-reports-hub',
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzEmptyModule,
    NzInputModule,
    NzSelectModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    PageHeaderComponent,
    RouterLink,
    TranslatePipe,
  ],
  styleUrl: './reports-hub.component.scss',
  template: `
    <app-page-header
      [title]="'ANALYTICS_STUDIO.HUB_TITLE' | translate"
      [subtitle]="'ANALYTICS_STUDIO.HUB_SUBTITLE' | translate"
    />

    <div class="bar">
      <input
        nz-input
        class="search"
        [ngModel]="search()"
        (ngModelChange)="search.set($event)"
        [placeholder]="'ANALYTICS_STUDIO.HUB_SEARCH' | translate"
        [attr.aria-label]="'ANALYTICS_STUDIO.HUB_SEARCH' | translate"
        data-testid="hub-search"
      />
      <span class="spacer"></span>
      <a
        nz-button
        nzType="primary"
        routerLink="/analytics/reports/designer"
        data-testid="new-report"
        >{{ 'ANALYTICS_STUDIO.NEW_REPORT' | translate }}</a
      >
    </div>

    @if (errorText(); as text) {
      <nz-alert nzType="error" [nzMessage]="text" nzShowIcon class="block" role="alert"></nz-alert>
    }

    <nz-tabs [nzSelectedIndex]="tabIndex()" (nzSelectedIndexChange)="selectIndex($event)">
      @for (item of tabs; track item.key) {
        <nz-tab [nzTitle]="item.label | translate"></nz-tab>
      }
    </nz-tabs>

    @if (tab() !== 'scheduled') {
      @if (visibleReports().length === 0) {
        <nz-empty [nzNotFoundContent]="'ANALYTICS_STUDIO.HUB_EMPTY' | translate"></nz-empty>
      } @else {
        <div class="cards" data-testid="report-cards">
          @for (report of visibleReports(); track report.id) {
            <article class="card">
              <h3>{{ report.name }}</h3>
              @if (report.description) {
                <p>{{ report.description }}</p>
              }
              <div class="meta">
                <nz-tag>{{ report.dataset }}</nz-tag>
                <nz-tag
                  [nzColor]="
                    report.visibility === 'tenant_public'
                      ? 'blue'
                      : report.visibility === 'role_shared'
                        ? 'purple'
                        : 'default'
                  "
                  >{{ visibilityKey(report.visibility) | translate }}</nz-tag
                >
              </div>
              <a
                nz-button
                nzSize="small"
                [routerLink]="['/analytics/reports/designer', report.id]"
                >{{ 'ANALYTICS_STUDIO.OPEN' | translate }}</a
              >
            </article>
          }
        </div>
      }
    } @else {
      <nz-table
        #table
        [nzData]="visibleSchedules()"
        [nzShowPagination]="false"
        [nzLoading]="loading()"
        data-testid="schedule-table"
      >
        <thead>
          <tr>
            <th>{{ 'ANALYTICS_STUDIO.SCHEDULE_REPORT' | translate }}</th>
            <th>{{ 'ANALYTICS_STUDIO.CRON_EXPRESSION' | translate }}</th>
            <th>{{ 'ANALYTICS_STUDIO.NEXT_RUN' | translate }}</th>
            <th>{{ 'ANALYTICS_STUDIO.LAST_STATUS' | translate }}</th>
            <th>
              <span class="visually-hidden">{{ 'ANALYTICS_STUDIO.ACTIONS' | translate }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          @for (schedule of table.data; track schedule.id) {
            <tr>
              <td>{{ schedule.name ?? reportName(schedule.designed_report_id) }}</td>
              <td>
                <code>{{ schedule.cron_expression }}</code> <small>{{ schedule.timezone }}</small>
              </td>
              <td>
                {{
                  schedule.is_active
                    ? (schedule.next_run_at ?? '')
                    : ('ANALYTICS_STUDIO.PAUSED' | translate)
                }}
              </td>
              <td>
                @if (schedule.last_status; as status) {
                  <nz-tag
                    [nzColor]="status === 'ok' ? 'success' : 'error'"
                    [attr.title]="schedule.last_error ?? ''"
                    >{{ statusKey(status) | translate }}</nz-tag
                  >
                } @else {
                  <span>-</span>
                }
              </td>
              <td>
                <button
                  nz-button
                  nzSize="small"
                  type="button"
                  [nzLoading]="running() === schedule.id"
                  (click)="runNow(schedule)"
                  [attr.data-testid]="'run-now-' + schedule.id"
                >
                  {{ 'ANALYTICS_STUDIO.RUN_NOW' | translate }}
                </button>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    }
  `,
})
export class ReportsHubComponent implements OnInit {
  private readonly api = inject(AnalyticsApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly tabs: { key: HubTab; label: string }[] = [
    { key: 'mine', label: 'ANALYTICS_STUDIO.TAB_MINE' },
    { key: 'role', label: 'ANALYTICS_STUDIO.TAB_ROLE' },
    { key: 'public', label: 'ANALYTICS_STUDIO.TAB_PUBLIC' },
    { key: 'scheduled', label: 'ANALYTICS_STUDIO.TAB_SCHEDULED' },
  ];

  readonly reports = signal<StudioSavedReport[]>([]);
  readonly schedules = signal<StudioSchedule[]>([]);
  readonly tab = signal<HubTab>('mine');
  readonly search = signal('');
  readonly loading = signal(false);
  readonly running = signal<string | null>(null);
  readonly errorText = signal<string | null>(null);

  protected readonly tabIndex = computed(() =>
    this.tabs.findIndex((item) => item.key === this.tab()),
  );

  /** Reports of the tab: mine, shared with my role (or with me by name), or open to the whole company. */
  readonly visibleReports = computed(() => {
    const term = this.search().trim().toLowerCase();
    const tab = this.tab();

    return this.reports().filter((report) => {
      const inTab =
        tab === 'mine'
          ? report.is_owner
          : tab === 'role'
            ? !report.is_owner && report.visibility !== 'tenant_public'
            : report.visibility === 'tenant_public';

      return (
        inTab &&
        (term === '' ||
          report.name.toLowerCase().includes(term) ||
          report.dataset.toLowerCase().includes(term))
      );
    });
  });

  readonly visibleSchedules = computed(() => {
    const term = this.search().trim().toLowerCase();

    return this.schedules().filter(
      (schedule) =>
        schedule.frequency === 'cron' &&
        (term === '' ||
          (schedule.name ?? this.reportName(schedule.designed_report_id))
            .toLowerCase()
            .includes(term)),
    );
  });

  ngOnInit(): void {
    this.load();
  }

  selectIndex(index: number): void {
    this.tab.set(this.tabs[index]?.key ?? 'mine');
  }

  reportName(id: string): string {
    return this.reports().find((report) => report.id === id)?.name ?? '';
  }

  protected visibilityKey(value: string): string {
    return labelKey(VISIBILITY_KEYS, value);
  }

  protected statusKey(value: string): string {
    return labelKey(STATUS_KEYS, value);
  }

  runNow(schedule: StudioSchedule): void {
    this.running.set(schedule.id);
    this.api.runStudioScheduleNow(schedule.id).subscribe({
      next: () => {
        this.running.set(null);
        this.message.success(this.i18n.translate('ANALYTICS_STUDIO.RUN_QUEUED'));
      },
      error: (error: unknown) => {
        this.running.set(null);
        this.errorText.set(
          analyticsErrorText(error) ?? this.i18n.translate('ANALYTICS_STUDIO.ACTION_ERROR'),
        );
      },
    });
  }

  private load(): void {
    this.loading.set(true);
    this.api
      .getStudioReports()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.reports.set(response.data);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.errorText.set(
            analyticsErrorText(error) ?? this.i18n.translate('ANALYTICS_STUDIO.ACTION_ERROR'),
          );
        },
      });
    this.api
      .getStudioSchedules()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => this.schedules.set(response.data),
        error: () => this.schedules.set([]),
      });
  }
}
