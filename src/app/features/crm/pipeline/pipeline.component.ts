import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpaceModule } from 'ng-zorro-antd/space';
import { NzTableModule, NzTableQueryParams } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AuthStore,
  CrmApiService,
  CrmDuplicateMatch,
  I18nService,
  OpportunityResource,
  PipelineStageResource,
  StoreOpportunityPayload,
} from '@core';
import { MoneyPipe, PageHeaderComponent } from '@shared';

@Component({
  selector: 'app-crm-pipeline',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    NzCardModule,
    NzTableModule,
    NzTagModule,
    NzButtonModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzFormModule,
    NzModalModule,
    NzPopconfirmModule,
    NzIconModule,
    NzEmptyModule,
    NzSpaceModule,
    PageHeaderComponent,
    MoneyPipe,
  ],
  templateUrl: './pipeline.component.html',
  styleUrl: './pipeline.component.scss',
})
export class PipelineComponent implements OnInit {
  private readonly crmApi = inject(CrmApiService);
  private readonly message = inject(NzMessageService);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly authStore = inject(AuthStore);
  protected readonly i18n = inject(I18nService);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly opportunities = signal<OpportunityResource[]>([]);
  readonly stages = signal<PipelineStageResource[]>([]);
  readonly total = signal(0);
  readonly pageIndex = signal(1);
  readonly pageSize = signal(15);

  // Filters
  readonly searchTerm = signal('');
  readonly stageFilter = signal<string | null>(null);

  // Modals
  readonly createModalVisible = signal(false);
  readonly duplicateModalVisible = signal(false);
  readonly duplicateResult = signal<CrmDuplicateMatch | null>(null);
  readonly checkingDuplicates = signal(false);

  readonly oppForm = this.fb.group({
    name: this.fb.control('', [Validators.required]),
    account_id: this.fb.control('', [Validators.required]),
    amount: this.fb.control<number>(0, [Validators.required, Validators.min(0)]),
    stage_code: this.fb.control('discovery', [Validators.required]),
    forecast_category: this.fb.control<'pipeline' | 'best_case' | 'commit' | 'closed' | 'omitted'>('pipeline'),
  });

  ngOnInit(): void {
    this.loadStages();
    this.loadOpportunities();
  }

  loadStages(): void {
    this.crmApi.getPipelineStages().subscribe({
      next: (res) => this.stages.set(res.data || []),
      error: () => this.stages.set([]),
    });
  }

  loadOpportunities(): void {
    this.loading.set(true);
    this.crmApi
      .getOpportunities({
        page: this.pageIndex(),
        per_page: this.pageSize(),
        search: this.searchTerm() || undefined,
        stage_code: this.stageFilter() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.opportunities.set(res.data || []);
          this.total.set(res.meta?.total || (res.data || []).length);
          this.loading.set(false);
        },
        error: () => {
          this.opportunities.set([]);
          this.total.set(0);
          this.loading.set(false);
        },
      });
  }

  onQueryParamsChange(params: NzTableQueryParams): void {
    this.pageIndex.set(params.pageIndex);
    this.pageSize.set(params.pageSize);
    this.loadOpportunities();
  }

  onSearch(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.searchTerm.set(val);
    this.pageIndex.set(1);
    this.loadOpportunities();
  }

  onStageFilterChange(stage: string | null): void {
    this.stageFilter.set(stage);
    this.pageIndex.set(1);
    this.loadOpportunities();
  }

  openCreateModal(): void {
    this.oppForm.reset({
      name: '',
      account_id: '',
      amount: 0,
      stage_code: this.stages()[0]?.code || 'discovery',
      forecast_category: 'pipeline',
    });
    this.createModalVisible.set(true);
  }

  submitCreateOpportunity(): void {
    if (this.oppForm.invalid) {
      this.oppForm.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    const formVal = this.oppForm.getRawValue();
    const payload: StoreOpportunityPayload = {
      account_id: formVal.account_id,
      name: formVal.name,
      amount: formVal.amount,
      currency: this.authStore.activeCurrency(),
      stage_code: formVal.stage_code,
      forecast_category: formVal.forecast_category,
    };

    this.crmApi.createOpportunity(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.createModalVisible.set(false);
        this.message.success('Opportunity created');
        this.loadOpportunities();
      },
      error: () => {
        this.saving.set(false);
      },
    });
  }

  changeStage(opp: OpportunityResource, newStageCode: string): void {
    this.crmApi.updateOpportunityStage(opp.id, newStageCode).subscribe({
      next: () => {
        this.message.success('Stage updated');
        this.loadOpportunities();
      },
      error: () => undefined,
    });
  }

  deleteOpportunity(opp: OpportunityResource): void {
    this.crmApi.deleteOpportunity(opp.id).subscribe({
      next: () => {
        this.message.success('Opportunity deleted');
        this.loadOpportunities();
      },
      error: () => undefined,
    });
  }

  checkDuplicates(): void {
    this.checkingDuplicates.set(true);
    this.crmApi.getDuplicates({ entity: 'contacts' }).subscribe({
      next: (res) => {
        this.duplicateResult.set(res.data);
        this.duplicateModalVisible.set(true);
        this.checkingDuplicates.set(false);
      },
      error: () => {
        this.checkingDuplicates.set(false);
        this.message.info('No duplicates detected');
      },
    });
  }
}
