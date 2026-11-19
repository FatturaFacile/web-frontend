import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { I18nService, PgBreach, PgDsar, PrivacyGovernanceApiService } from '@core';
import { downloadBlob, PageHeaderComponent, TranslatePipe } from '@shared';
import { RouterLink } from '@angular/router';
import {
  createBreachCountdown,
  dsarCountdown,
  dsarIsUrgent,
  pgErrorMessage,
} from './privacy-governance.helpers';

/** KPI overview of the privacy programme: RoPA, open DSARs, consent opt-in rate and the 72 hours breach clock. */
@Component({
  selector: 'app-privacy-dashboard',
  imports: [
    RouterLink,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzSpinModule,
    NzStatisticModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  styles: `
    .kpis {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }
    .urgent {
      color: var(--ff-color-danger, #cf1322);
      font-weight: 600;
    }
    .banner-clock {
      font-variant-numeric: tabular-nums;
      font-size: 20px;
      font-weight: 700;
    }
    .exports {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
  `,
  template: `
    <app-page-header
      [title]="'PRIVACY.DASHBOARD.TITLE' | translate"
      [subtitle]="'PRIVACY.DASHBOARD.SUBTITLE' | translate"
    >
      <div class="exports">
        <button nz-button [nzLoading]="exporting() === 'pdf'" (click)="export('pdf')">
          <i class="fa-solid fa-file-pdf" aria-hidden="true"></i>
          {{ 'PRIVACY.DASHBOARD.EXPORT_PDF' | translate }}
        </button>
        <button nz-button [nzLoading]="exporting() === 'xlsx'" (click)="export('xlsx')">
          <i class="fa-solid fa-file-excel" aria-hidden="true"></i>
          {{ 'PRIVACY.DASHBOARD.EXPORT_XLSX' | translate }}
        </button>
      </div>
    </app-page-header>

    @if (urgentBreach(); as breach) {
      <nz-alert
        class="breach-banner"
        nzType="error"
        nzShowIcon
        [nzMessage]="
          'PRIVACY.DASHBOARD.BREACH_BANNER_TITLE' | translate: { code: breach.incident_code }
        "
        [nzDescription]="bannerBody"
      />
      <ng-template #bannerBody>
        <span>{{
          (countdown.overdue()
            ? 'PRIVACY.DASHBOARD.BREACH_OVERDUE'
            : 'PRIVACY.DASHBOARD.BREACH_REMAINING'
          ) | translate
        }}</span>
        <span class="banner-clock" data-testid="breach-clock"> {{ countdown.label() }}</span>
        <a routerLink="/privacy-governance/breaches">{{
          'PRIVACY.DASHBOARD.BREACH_OPEN' | translate
        }}</a>
      </ng-template>
    }

    <nz-spin [nzSpinning]="loading()">
      <div class="kpis">
        <nz-card>
          <nz-statistic
            [nzTitle]="'PRIVACY.DASHBOARD.KPI_ROPA' | translate"
            [nzValue]="activeRopa()"
          />
          <a routerLink="/privacy-governance/ropa">{{ 'PRIVACY.DASHBOARD.GO_ROPA' | translate }}</a>
        </nz-card>
        <nz-card>
          <nz-statistic
            [nzTitle]="'PRIVACY.DASHBOARD.KPI_DSAR' | translate"
            [nzValue]="openDsars().length"
          />
          @if (urgentDsars().length > 0) {
            <nz-tag nzColor="red" data-testid="urgent-dsar">
              {{ 'PRIVACY.DASHBOARD.DSAR_URGENT' | translate: { count: urgentDsars().length } }}
            </nz-tag>
          }
          <a routerLink="/privacy-governance/dsar">{{ 'PRIVACY.DASHBOARD.GO_DSAR' | translate }}</a>
        </nz-card>
        <nz-card>
          <nz-statistic
            [nzTitle]="'PRIVACY.DASHBOARD.KPI_CONSENT' | translate"
            [nzValue]="optInRate() === null ? '-' : optInRate() + '%'"
          />
          <small>{{
            'PRIVACY.DASHBOARD.CONSENT_COUNTS'
              | translate: { granted: consentGranted(), total: consentTotal() }
          }}</small>
        </nz-card>
        <nz-card>
          <nz-statistic
            [nzTitle]="'PRIVACY.DASHBOARD.KPI_BREACH' | translate"
            [nzValue]="unnotifiedBreaches().length"
          />
          <a routerLink="/privacy-governance/breaches">{{
            'PRIVACY.DASHBOARD.GO_BREACH' | translate
          }}</a>
        </nz-card>
      </div>

      @if (openDsars().length > 0) {
        <nz-card [nzTitle]="'PRIVACY.DASHBOARD.NEXT_DSAR' | translate">
          @for (item of nextDsars(); track item.dsar.id) {
            <p>
              <strong>{{ item.dsar.request_number }}</strong> - {{ item.dsar.subject_full_name }}
              <span [class.urgent]="item.urgent">
                {{ 'PRIVACY.DSAR.DAYS_LEFT' | translate: { days: item.days ?? 0 } }}
              </span>
            </p>
          }
        </nz-card>
      }
    </nz-spin>
  `,
})
export class PrivacyDashboardComponent implements OnInit {
  private readonly api = inject(PrivacyGovernanceApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  readonly loading = signal(false);
  readonly exporting = signal<'pdf' | 'xlsx' | null>(null);
  readonly activeRopa = signal(0);
  readonly dsars = signal<PgDsar[]>([]);
  readonly consentGranted = signal(0);
  readonly consentTotal = signal(0);
  readonly breaches = signal<PgBreach[]>([]);

  readonly openDsars = computed(() => this.dsars().filter((dsar) => dsarCountdown(dsar) !== null));
  readonly nextDsars = computed(() =>
    this.openDsars()
      .map((dsar) => {
        const days = dsarCountdown(dsar);
        return { dsar, days, urgent: dsarIsUrgent(days) };
      })
      .sort((a, b) => (a.days ?? 0) - (b.days ?? 0))
      .slice(0, 5),
  );
  readonly urgentDsars = computed(() => this.nextDsars().filter((item) => item.urgent));
  readonly optInRate = computed(() =>
    this.consentTotal() === 0
      ? null
      : Math.round((this.consentGranted() / this.consentTotal()) * 1000) / 10,
  );
  readonly unnotifiedBreaches = computed(() =>
    this.breaches().filter((breach) => !breach.authority_notified_at),
  );
  /** The unnotified breach whose deadline comes first. */
  readonly urgentBreach = computed(
    () =>
      [...this.unnotifiedBreaches()].sort(
        (a, b) =>
          new Date(a.notification_deadline_72h).getTime() -
          new Date(b.notification_deadline_72h).getTime(),
      )[0] ?? null,
  );

  readonly countdown = createBreachCountdown(
    computed(() => this.urgentBreach()?.notification_deadline_72h ?? null),
  );

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    forkJoin({
      ropa: this.api.getRopa({ is_active: 1, per_page: 1 }),
      dsars: this.api.getDsars({ per_page: 100 }),
      consentAll: this.api.getConsents({ per_page: 1 }),
      consentGranted: this.api.getConsents({ consent_granted: 1, per_page: 1 }),
      breaches: this.api.getActiveCountdowns(),
    }).subscribe({
      next: (result) => {
        this.activeRopa.set(result.ropa.meta?.total ?? result.ropa.data.length);
        this.dsars.set(result.dsars.data);
        this.consentTotal.set(result.consentAll.meta?.total ?? result.consentAll.data.length);
        this.consentGranted.set(
          result.consentGranted.meta?.total ?? result.consentGranted.data.length,
        );
        this.breaches.set(result.breaches.data);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.message.error(pgErrorMessage(err, this.i18n.translate('PRIVACY.COMMON.LOAD_FAILED')));
      },
    });
  }

  export(format: 'pdf' | 'xlsx'): void {
    this.exporting.set(format);
    this.api.exportRopa(format).subscribe({
      next: (blob) => {
        downloadBlob(blob, `ropa.${format}`);
        this.exporting.set(null);
      },
      error: (err: unknown) => {
        this.exporting.set(null);
        this.message.error(
          pgErrorMessage(err, this.i18n.translate('PRIVACY.COMMON.EXPORT_FAILED')),
        );
      },
    });
  }
}
