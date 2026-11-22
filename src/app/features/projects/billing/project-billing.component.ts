import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { catchError, map, of } from 'rxjs';
import { PermissionsService } from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { BillingContractFormComponent } from './billing-contract-form.component';
import { BillingWizardComponent } from './billing-wizard.component';
import { ProjectBillingApiService } from './project-billing-api.service';
import {
  BillingContract,
  RetainerState,
  RetentionBalance,
  SalCertificate,
  UnbilledSummary,
} from './project-billing.models';
import { modelSupports, WIP_NATURE_KEYS, wipNature } from './project-billing.utils';
import { RetainerRetentionComponent } from './retainer-retention.component';
import { SalCertificatesComponent } from './sal-certificates.component';

/**
 * Project billing workspace (Mod 081): what is unbilled, the billing contract, the billing wizard (time and materials,
 * milestones, SAL), the SAL certificates, and the prepaid retainer and guarantee retention.
 */
@Component({
  selector: 'app-project-billing',
  styles: `
    :host {
      display: block;
    }
    .bf-summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }
    .bf-kpi {
      font-size: 20px;
      font-weight: 600;
      line-height: 1.3;
    }
    .bf-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 12px;
      margin-bottom: 12px;
    }
    .bf-field {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-bottom: 8px;
    }
    .bf-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      margin: 12px 0;
    }
    .bf-muted {
      color: var(--ant-color-text-secondary, rgba(0, 0, 0, 0.45));
    }
    .bf-num {
      text-align: right;
      white-space: nowrap;
    }
    .bf-card {
      margin-bottom: 12px;
    }
    .bf-steps {
      margin-bottom: 16px;
    }
  `,
  imports: [
    RouterLink,
    NzAlertModule,
    NzCardModule,
    NzSpinModule,
    NzTabsModule,
    BillingContractFormComponent,
    BillingWizardComponent,
    MoneyPipe,
    PageHeaderComponent,
    RetainerRetentionComponent,
    SalCertificatesComponent,
    TranslatePipe,
  ],
  template: `
    <app-page-header
      [title]="'PROJECT_BILLING.TITLE' | translate"
      [subtitle]="'PROJECT_BILLING.SUBTITLE' | translate"
    />
    <p>
      <a routerLink="/projects">{{ 'PRJ.BACK_TO_PROJECTS' | translate }}</a>
    </p>

    @if (error()) {
      <nz-alert
        class="mb-4"
        nzType="error"
        nzShowIcon
        [nzMessage]="'PROJECT_BILLING.LOAD_ERROR' | translate"
      />
    }

    <nz-spin [nzSpinning]="loading()">
      @if (summary(); as s) {
        <div class="bf-summary" data-testid="billing-summary">
          <nz-card nzSize="small" [nzTitle]="'PROJECT_BILLING.SUM_CONTRACT' | translate">
            <div class="bf-kpi">{{ s.contract_value | money: currency() }}</div>
          </nz-card>
          <nz-card nzSize="small" [nzTitle]="'PROJECT_BILLING.SUM_BILLED' | translate">
            <div class="bf-kpi">{{ s.billed_to_date | money: currency() }}</div>
            <span class="bf-muted"
              >{{ 'PROJECT_BILLING.SUM_DRAFTS' | translate }}:
              {{ s.draft_billing | money: currency() }}</span
            >
          </nz-card>
          <nz-card nzSize="small" [nzTitle]="'PROJECT_BILLING.SUM_UNBILLED_TM' | translate">
            <div class="bf-kpi" data-testid="sum-unbilled">
              {{ s.unbilled_time_and_materials | money: currency() }}
            </div>
            <span class="bf-muted">{{
              'PROJECT_BILLING.SUM_MILESTONES' | translate: { count: s.unbilled_milestones }
            }}</span>
          </nz-card>
          <nz-card nzSize="small" [nzTitle]="'PROJECT_BILLING.SUM_OPEN_SAL' | translate">
            <div class="bf-kpi">{{ s.open_sal_invoice_amount | money: currency() }}</div>
            <span class="bf-muted">{{ s.open_sal_certificates }}</span>
          </nz-card>
          <nz-card nzSize="small" [nzTitle]="'PROJECT_BILLING.SUM_RETENTION' | translate">
            <div class="bf-kpi" data-testid="sum-retention">
              {{ s.retention?.balance ?? '0.00' | money: currency() }}
            </div>
          </nz-card>
          @if (s.latest_wip_run; as run) {
            <nz-card nzSize="small" [nzTitle]="'PROJECT_BILLING.SUM_WIP' | translate">
              <div class="bf-kpi" data-testid="sum-wip">
                {{ run.wip_asset_or_deferred_revenue_diff | money: currency() }}
              </div>
              <span class="bf-muted"
                >{{ nature(run.wip_asset_or_deferred_revenue_diff) | translate }} ·
                {{ run.period_end_date }}</span
              >
            </nz-card>
          }
        </div>
      }

      <nz-tabs>
        <nz-tab [nzTitle]="'PROJECT_BILLING.TAB_CONTRACT' | translate">
          <app-billing-contract-form
            [projectId]="projectId()"
            [contract]="contract()"
            [currency]="currency()"
            [canWrite]="canWrite"
            (changed)="reload()"
          />
        </nz-tab>
        <nz-tab [nzTitle]="'PROJECT_BILLING.TAB_WIZARD' | translate">
          <app-billing-wizard
            [projectId]="projectId()"
            [contract]="contract()"
            [sals]="sals()"
            [currency]="currency()"
            (billed)="reload()"
          />
        </nz-tab>
        @if (showSal()) {
          <nz-tab [nzTitle]="'PROJECT_BILLING.TAB_SAL' | translate">
            <app-sal-certificates
              [projectId]="projectId()"
              [sals]="sals()"
              [currency]="currency()"
              [canWrite]="canWrite"
              (changed)="reload()"
            />
          </nz-tab>
        }
        <nz-tab [nzTitle]="'PROJECT_BILLING.TAB_RETAINER' | translate">
          <app-retainer-retention
            [projectId]="projectId()"
            [contract]="contract()"
            [retainer]="retainer()"
            [retention]="retention()"
            [currency]="currency()"
            [canWrite]="canWrite"
            (changed)="reload()"
          />
        </nz-tab>
      </nz-tabs>
    </nz-spin>
  `,
})
export class ProjectBillingComponent implements OnInit {
  private readonly api = inject(ProjectBillingApiService);
  private readonly route = inject(ActivatedRoute);
  protected readonly canWrite = inject(PermissionsService).canWrite('projects');

  protected readonly projectId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('id') ?? '')),
    { initialValue: '' },
  );
  protected readonly contract = signal<BillingContract | null>(null);
  protected readonly summary = signal<UnbilledSummary | null>(null);
  protected readonly sals = signal<SalCertificate[]>([]);
  protected readonly retainer = signal<RetainerState | null>(null);
  protected readonly retention = signal<RetentionBalance | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal(false);

  protected readonly currency = computed(
    () => this.contract()?.currency_code ?? this.summary()?.currency ?? 'EUR',
  );
  protected readonly showSal = computed(
    () =>
      this.sals().length > 0 || modelSupports(this.contract()?.billing_model ?? null, 'progress'),
  );

  ngOnInit(): void {
    this.reload();
  }

  protected nature(diff: string): string {
    return WIP_NATURE_KEYS[wipNature(diff)];
  }

  protected reload(): void {
    const id = this.projectId();
    this.loading.set(true);
    this.error.set(false);

    this.api.contract(id).subscribe({
      next: (response) => {
        this.contract.set(response.data);
        this.loading.set(false);
        this.loadDependents(id, response.data);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
    this.api.unbilledSummary(id).subscribe({
      next: (response) => this.summary.set(response.data),
      error: () => this.error.set(true),
    });
  }

  private loadDependents(id: string, contract: BillingContract | null): void {
    if (contract === null) {
      this.sals.set([]);
      this.retainer.set(null);
      this.retention.set(null);

      return;
    }

    this.api.salCertificates(id).subscribe({
      next: (response) => this.sals.set(response.data),
      error: () => this.sals.set([]),
    });
    this.api
      .retention(id)
      .pipe(catchError(() => of(null)))
      .subscribe((response) => this.retention.set(response?.data ?? null));

    if (modelSupports(contract.billing_model, 'retainer')) {
      this.api
        .retainer(id)
        .pipe(catchError(() => of(null)))
        .subscribe((response) => this.retainer.set(response?.data ?? null));
    } else {
      this.retainer.set(null);
    }
  }
}
