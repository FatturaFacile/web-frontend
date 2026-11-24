import { Component, computed, inject, OnInit, signal, TemplateRef, viewChild } from '@angular/core';
import { AbstractControl, FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AuthStore,
  CrmApiService,
  CrmDuplicateMatch,
  CrmOpportunityFilterParams,
  FetchGridModel,
  I18nService,
  OpportunityResource,
  PipelineStageResource,
  StoreOpportunityPayload,
  TranslateService,
} from '@core';
import { BaseTableComponent, MoneyPipe, PageHeaderComponent, TableColumnDef, IconActionDirective, ModalActionsDirective } from '@shared';
import { TranslatePipe } from '@shared';

@Component({
  selector: 'app-crm-pipeline',
  styleUrl: './pipeline.component.scss',
  imports: [
    BaseTableComponent,
    ModalActionsDirective,
    IconActionDirective,
    TranslatePipe,
    FormsModule,
    ReactiveFormsModule,
    NzCardModule,
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
})
export class PipelineComponent implements OnInit {
  private readonly translate = inject(TranslateService);
  private readonly crmApi = inject(CrmApiService);
  private readonly message = inject(NzMessageService);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly authStore = inject(AuthStore);
  protected readonly i18n = inject(I18nService);

  readonly saving = signal(false);
  readonly grid = new FetchGridModel<OpportunityResource, CrmOpportunityFilterParams>((query) =>
    this.crmApi.getOpportunities(query),
  );
  readonly stages = signal<PipelineStageResource[]>([]);

  private readonly nameTpl = viewChild<TemplateRef<unknown>>('nameTpl');
  private readonly amountTpl = viewChild<TemplateRef<unknown>>('amountTpl');
  private readonly stageTpl = viewChild<TemplateRef<unknown>>('stageTpl');
  private readonly categoryTpl = viewChild<TemplateRef<unknown>>('categoryTpl');

  readonly columns = computed<TableColumnDef<OpportunityResource>[]>(() => {
    this.i18n.currentLanguage();
    return [
      { key: 'name', header: this.i18n.translate('CRMX.LBL_OPPORTUNITY'), customCellTemplate: this.nameTpl() },
      {
        key: 'account',
        serverKey: 'account.name',
        header: this.i18n.translate('CRMX.LBL_ACCOUNT'),
        valueGetter: (opp) => opp.account?.name ?? '',
      },
      { key: 'amount', header: this.i18n.translate('CRMX.LBL_AMOUNT'), customCellTemplate: this.amountTpl() },
      {
        key: 'stage',
        serverKey: 'stage.name',
        header: this.i18n.translate('CRMX.LBL_STAGE'),
        valueGetter: (opp) => opp.stage?.name ?? '',
        customCellTemplate: this.stageTpl(),
      },
      {
        key: 'forecast_category',
        header: this.i18n.translate('CRMX.LBL_FORECAST_CATEGORY'),
        customCellTemplate: this.categoryTpl(),
      },
      { key: 'expected_close_date', header: this.i18n.translate('CRMX.LBL_EXPECTED_CLOSE') },
    ];
  });

  // Filters
  readonly searchTerm = signal('');
  readonly stageFilter = signal<string | null>(null);

  // Modals
  readonly createModalVisible = signal(false);
  readonly duplicateModalVisible = signal(false);
  readonly duplicateResult = signal<CrmDuplicateMatch | null>(null);
  readonly checkingDuplicates = signal(false);

  readonly oppForm = this.fb.group({
    name: this.fb.control('', [Validators.required, Validators.maxLength(200)]),
    account_id: this.fb.control('', [Validators.required]),
    amount: this.fb.control<number>(0, [Validators.required, Validators.min(0)]),
    stage_code: this.fb.control('discovery', [Validators.maxLength(50)]),
    forecast_category: this.fb.control<'pipeline' | 'best_case' | 'commit' | 'closed' | 'omitted'>('pipeline'),
  });

  ngOnInit(): void {
    this.loadStages();
  }

  loadStages(): void {
    this.crmApi.getPipelineStages().subscribe({
      next: (res) => this.stages.set(res.data || []),
      error: () => this.stages.set([]),
    });
  }

  onSearch(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.searchTerm.set(val);
    this.grid.setFilter({ search: val || undefined });
  }

  onStageFilterChange(stage: string | null): void {
    this.stageFilter.set(stage);
    this.grid.setFilter({ stage_code: stage || undefined });
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

  /** The error text of a control of the opportunity form. */
  errorTip(control: AbstractControl): string {
    if (control.hasError('required')) {
      return this.i18n.translate('COMMON.VALIDATION.REQUIRED');
    }
    return control.invalid ? this.i18n.translate('COMMON.VALIDATION.INVALID_VALUE') : '';
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
        this.message.success(this.translate.instant('CRMX.MSG_OPPORTUNITY_CREATED'));
        this.grid.reload();
      },
      error: () => {
        this.saving.set(false);
      },
    });
  }

  changeStage(opp: OpportunityResource, newStageCode: string): void {
    this.crmApi.updateOpportunityStage(opp.id, newStageCode).subscribe({
      next: () => {
        this.message.success(this.translate.instant('CRMX.MSG_STAGE_UPDATED'));
        this.grid.reload();
      },
      error: () => undefined,
    });
  }

  createQuote(opp: OpportunityResource): void {
    this.crmApi.createQuoteFromOpportunity(opp.id).subscribe({
      next: () => this.message.success(this.i18n.translate('CRMX.PIPELINE.QUOTE_CREATED')),
      error: () => undefined,
    });
  }

  createProject(opp: OpportunityResource): void {
    this.crmApi.createProjectFromOpportunity(opp.id).subscribe({
      next: () => this.message.success(this.i18n.translate('CRMX.PIPELINE.PROJECT_CREATED')),
      error: () => undefined,
    });
  }

  deleteOpportunity(opp: OpportunityResource): void {
    this.crmApi.deleteOpportunity(opp.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('CRMX.MSG_OPPORTUNITY_DELETED'));
        this.grid.reload();
      },
      error: () => undefined,
    });
  }

  checkDuplicates(): void {
    this.checkingDuplicates.set(true);
    this.crmApi.getDuplicates({ entity: 'contacts' }).subscribe({
      next: (res) => {
        this.duplicateResult.set(res);
        this.duplicateModalVisible.set(true);
        this.checkingDuplicates.set(false);
      },
      error: () => {
        this.checkingDuplicates.set(false);
        this.message.info(this.translate.instant('CRMX.MSG_NO_DUPLICATES_DETECTED'));
      },
    });
  }
}
