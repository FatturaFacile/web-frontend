import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AssetApiService,
  AssetLedgerType,
  AuthStore,
  DepreciationRunResource,
  EamOpsApiService,
  I18nService,
  YearEndBatchResponse,
} from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';

interface SimulatedRow {
  asset_number?: string;
  name?: string;
  period_code?: string;
  depreciation_method?: string;
  depreciation_amount?: string | number;
  closing_book_value?: string | number;
}

@Component({
  selector: 'app-depreciation-batch',
  styleUrl: './depreciation-batch.component.scss',
  imports: [
    RouterLink,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzCheckboxModule,
    NzDividerModule,
    NzIconModule,
    NzInputNumberModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
    MoneyPipe,
  ],
  templateUrl: './depreciation-batch.component.html',
})
export class DepreciationBatchComponent implements OnInit {
  private readonly assetApi = inject(AssetApiService);
  private readonly opsApi = inject(EamOpsApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService, { optional: true });
  protected readonly authStore = inject(AuthStore);

  readonly fiscalYear = signal(new Date().getFullYear());
  readonly simulationLedger = signal<AssetLedgerType>('statutory');
  readonly autoPostToGl = signal(true);

  readonly simulating = signal(false);
  readonly executingBatch = signal(false);
  readonly loadingRuns = signal(false);
  readonly postingRunId = signal<string | null>(null);

  readonly simulationRows = signal<SimulatedRow[]>([]);
  readonly lastBatchResult = signal<YearEndBatchResponse | null>(null);
  readonly runs = signal<DepreciationRunResource[]>([]);

  readonly currency = computed(() => this.authStore.activeCurrency() || 'CHF');

  ngOnInit(): void {
    this.loadRuns();
  }

  label(key: string): string {
    return this.i18n?.translate(key) ?? key;
  }

  loadRuns(): void {
    this.loadingRuns.set(true);
    this.opsApi.getDepreciationRuns({ per_page: 25 }).subscribe({
      next: (res) => {
        this.runs.set(res.data || []);
        this.loadingRuns.set(false);
      },
      error: () => {
        this.runs.set([]);
        this.loadingRuns.set(false);
      },
    });
  }

  simulateYearEnd(): void {
    this.simulating.set(true);
    this.assetApi
      .simulateDepreciation({
        period_code: String(this.fiscalYear()),
        period_type: 'yearly',
        ledger_type: this.simulationLedger(),
        auto_post_to_gl: false,
      })
      .subscribe({
        next: (res) => {
          const payload = res.data as { items?: SimulatedRow[]; entries?: SimulatedRow[] } | SimulatedRow[] | null;
          if (Array.isArray(payload)) {
            this.simulationRows.set(payload);
          } else {
            this.simulationRows.set(payload?.entries || payload?.items || []);
          }
          this.simulating.set(false);
        },
        error: () => {
          this.simulationRows.set([]);
          this.simulating.set(false);
        },
      });
  }

  executeBatch(): void {
    this.executingBatch.set(true);
    this.assetApi
      .executeYearEndBatch({
        year: this.fiscalYear(),
        auto_post_to_gl: this.autoPostToGl(),
      })
      .subscribe({
        next: (res) => {
          this.lastBatchResult.set(res.data ?? null);
          this.executingBatch.set(false);
          this.message.success(this.label('eam.batch.executeAndPost'));
          this.loadRuns();
        },
        error: () => {
          this.executingBatch.set(false);
        },
      });
  }

  postRunToGl(run: DepreciationRunResource): void {
    this.postingRunId.set(run.id);
    this.assetApi.postDepreciationRunToGl(run.id).subscribe({
      next: () => {
        this.postingRunId.set(null);
        this.message.success(this.label('eam.batch.postRunToGl'));
        this.loadRuns();
      },
      error: () => {
        this.postingRunId.set(null);
      },
    });
  }
}
