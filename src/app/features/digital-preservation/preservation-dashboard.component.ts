import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { TranslateService } from '@core';
import { TranslatePipe } from '@shared';
import { CreateBatchModalComponent } from './create-batch-modal.component';
import { BatchVerification } from './digital-preservation.models';
import { DigitalPreservationStore } from './digital-preservation.store';
import { VerificationResultComponent } from './verification-result.component';

/** Compliance overview: KPI cards of the WORM vault and the quick actions. */
@Component({
  selector: 'app-preservation-dashboard',
  styleUrl: './digital-preservation.scss',
  imports: [
    DatePipe,
    DecimalPipe,
    RouterLink,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzModalModule,
    NzStatisticModule,
    NzTagModule,
    CreateBatchModalComponent,
    VerificationResultComponent,
  ],
  template: `
    @if (store.dashboard(); as d) {
      <div class="kpi-grid" data-testid="preservation-kpis">
        <nz-card>
          <nz-statistic
            [nzTitle]="'PRESERVATION.KPI_DOCUMENTS' | translate"
            [nzValue]="(d.preserved_documents | number: '1.0-0') ?? ''"
          ></nz-statistic>
        </nz-card>
        <nz-card>
          <nz-statistic
            [nzTitle]="'PRESERVATION.KPI_VAULT_SIZE' | translate"
            [nzValue]="(d.worm_size_bytes / 1048576 | number: '1.0-2') ?? ''"
            nzSuffix="MB"
          ></nz-statistic>
        </nz-card>
        <nz-card>
          <div class="ant-statistic-title">{{ 'PRESERVATION.KPI_CHAIN' | translate }}</div>
          <nz-tag
            data-testid="chain-badge"
            [nzColor]="
              d.chain_status === 'verified'
                ? 'green'
                : d.chain_status === 'alert'
                  ? 'red'
                  : 'default'
            "
          >
            {{ 'PRESERVATION.CHAIN_' + d.chain_status.toUpperCase() | translate }}
          </nz-tag>
          @if (d.last_verification_at) {
            <div class="muted">{{ d.last_verification_at | date: 'short' }}</div>
          }
        </nz-card>
        <nz-card>
          <nz-statistic
            [nzTitle]="'PRESERVATION.KPI_PENDING' | translate"
            [nzValue]="(d.pending_unpreserved_documents | number: '1.0-0') ?? ''"
          ></nz-statistic>
        </nz-card>
        <nz-card>
          <nz-statistic
            [nzTitle]="'PRESERVATION.KPI_RETENTION' | translate"
            [nzValue]="d.retention_years + ' ' + ('PRESERVATION.YEARS' | translate)"
          ></nz-statistic>
          <div class="muted">{{ 'PRESERVATION.STATUTORY_LOCK' | translate }}</div>
        </nz-card>
      </div>

      @if (d.last_sealed_batch; as last) {
        <p class="muted">
          {{ 'PRESERVATION.LAST_SEALED' | translate }}:
          <a routerLink="../batches">{{ last.batch_number }}</a> ·
          {{ last.sealed_at | date: 'medium' }}
        </p>
      }
    }

    <div class="quick-actions">
      <button
        nz-button
        nzType="primary"
        type="button"
        data-testid="run-batch"
        (click)="newBatch.set(true)"
      >
        {{ 'PRESERVATION.RUN_BATCH' | translate }}
      </button>
      <button
        nz-button
        type="button"
        data-testid="verify-vault"
        [disabled]="!store.dashboard()?.last_sealed_batch"
        [nzLoading]="store.busy()"
        (click)="verifyVault()"
      >
        {{ 'PRESERVATION.VERIFY_VAULT' | translate }}
      </button>
      <a nz-button routerLink="../configuration" data-testid="configure-conservator">{{
        'PRESERVATION.CONFIGURE_CONSERVATOR' | translate
      }}</a>
    </div>

    <app-create-batch-modal [(visible)]="newBatch" (created)="onCreated()"></app-create-batch-modal>

    <nz-modal
      [nzVisible]="verification() !== null"
      [nzTitle]="'PRESERVATION.VERIFY_VAULT' | translate"
      [nzFooter]="null"
      (nzOnCancel)="verification.set(null)"
    >
      <ng-container *nzModalContent>
        @if (verification(); as v) {
          <app-verification-result [result]="v"></app-verification-result>
        }
      </ng-container>
    </nz-modal>
  `,
})
export class PreservationDashboardComponent implements OnInit {
  protected readonly store = inject(DigitalPreservationStore);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly newBatch = signal(false);
  protected readonly verification = signal<BatchVerification | null>(null);

  ngOnInit(): void {
    this.store.loadDashboard().subscribe();
  }

  protected onCreated(): void {
    this.store.loadDashboard().subscribe();
    void this.router.navigate(['/digital-preservation/batches']);
  }

  /** Re-verifies the most recently sealed batch (the vault is a hash chain, so it vouches for the earlier ones). */
  protected verifyVault(): void {
    const last = this.store.dashboard()?.last_sealed_batch;
    if (!last) {
      return;
    }
    this.store.verifyBatch(last.id).subscribe({
      next: (res) => {
        this.verification.set(res.data);
        this.store.loadDashboard().subscribe();
      },
      error: () => this.message.error(this.i18n.instant('PRESERVATION.VERIFY_ERROR')),
    });
  }
}
