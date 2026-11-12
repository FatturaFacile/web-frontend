import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpaceModule } from 'ng-zorro-antd/space';
import { NzTableModule, NzTableQueryParams } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import {
  applyServerErrors,
  AuthStore,
  CrmApiService,
  CrmLeadFilterParams,
  I18nService,
  isValidationError,
  LeadResource,
  LeadScoreBreakdownItem,
  LeadScoreExplanation,
  StoreLeadPayload,
  TranslateService,
} from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';

@Component({
  selector: 'app-crm-leads',
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
    NzDrawerModule,
    NzModalModule,
    NzPopconfirmModule,
    NzIconModule,
    NzEmptyModule,
    NzSpaceModule,
    NzTooltipModule,
    PageHeaderComponent,
    MoneyPipe,
    TranslatePipe,
  ],
  templateUrl: './leads.component.html',
})
export class LeadsComponent implements OnInit {
  private readonly translate = inject(TranslateService);
  private readonly crmApi = inject(CrmApiService);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly authStore = inject(AuthStore);
  protected readonly i18n = inject(I18nService);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly leads = signal<LeadResource[]>([]);
  readonly total = signal(0);
  readonly pageIndex = signal(1);
  readonly pageSize = signal(15);

  // Filters
  readonly searchTerm = signal('');
  readonly statusFilter = signal<string | null>(null);
  readonly ratingFilter = signal<string | null>(null);

  // Drawer & Modal state
  readonly createDrawerVisible = signal(false);
  readonly selectedLeadForScore = signal<LeadResource | null>(null);
  readonly scoreModalVisible = signal(false);
  readonly scoreExplanation = signal<LeadScoreExplanation | null>(null);

  readonly leadForm = this.fb.group({
    first_name: this.fb.control(''),
    last_name: this.fb.control(''),
    company_name: this.fb.control('', [Validators.required]),
    title: this.fb.control(''),
    email: this.fb.control('', [Validators.email]),
    phone: this.fb.control(''),
    country: this.fb.control('CH', [Validators.required]),
    estimated_budget: this.fb.control<number | null>(null),
  });

  ngOnInit(): void {
    this.leadForm.patchValue({
      country: this.authStore.activeJurisdiction() || 'CH',
    });
    this.loadLeads();
  }

  loadLeads(): void {
    this.loading.set(true);
    const params: CrmLeadFilterParams = {
      page: this.pageIndex(),
      per_page: this.pageSize(),
      search: this.searchTerm() || undefined,
      status: this.statusFilter() || undefined,
      rating: this.ratingFilter() || undefined,
    };

    this.crmApi.getLeads(params).subscribe({
      next: (res) => {
        this.leads.set(res.data || []);
        this.total.set(res.meta?.total || (res.data || []).length);
        this.loading.set(false);
      },
      error: () => {
        this.leads.set([]);
        this.total.set(0);
        this.loading.set(false);
      },
    });
  }

  onQueryParamsChange(params: NzTableQueryParams): void {
    this.pageIndex.set(params.pageIndex);
    this.pageSize.set(params.pageSize);
    this.loadLeads();
  }

  onSearch(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.searchTerm.set(val);
    this.pageIndex.set(1);
    this.loadLeads();
  }

  onStatusChange(status: string | null): void {
    this.statusFilter.set(status);
    this.pageIndex.set(1);
    this.loadLeads();
  }

  onRatingChange(rating: string | null): void {
    this.ratingFilter.set(rating);
    this.pageIndex.set(1);
    this.loadLeads();
  }

  openCreateDrawer(): void {
    this.leadForm.reset({
      first_name: '',
      last_name: '',
      company_name: '',
      title: '',
      email: '',
      phone: '',
      country: this.authStore.activeJurisdiction() || 'CH',
      estimated_budget: null,
    });
    this.createDrawerVisible.set(true);
  }

  closeCreateDrawer(): void {
    this.createDrawerVisible.set(false);
  }

  submitCreateLead(): void {
    if (this.leadForm.invalid) {
      this.leadForm.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    const formVal = this.leadForm.getRawValue();
    const payload: StoreLeadPayload = {
      first_name: formVal.first_name || null,
      last_name: formVal.last_name || null,
      company_name: formVal.company_name || null,
      title: formVal.title || null,
      email: formVal.email || null,
      phone: formVal.phone || null,
      country: formVal.country || null,
      estimated_budget: formVal.estimated_budget,
    };

    this.crmApi.createLead(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.createDrawerVisible.set(false);
        this.message.success(this.translate.instant('crmLeadScore.msgLeadCreatedSuccessfully'));
        this.loadLeads();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        if (isValidationError(err)) {
          applyServerErrors(this.leadForm, err);
        }
      },
    });
  }

  recalculateScore(lead: LeadResource): void {
    this.crmApi.recalculateLeadScores(lead.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('crmLeadScore.msgScoreRecalculated'));
        this.loadLeads();
      },
      error: () => undefined,
    });
  }

  openScoreModal(lead: LeadResource): void {
    this.selectedLeadForScore.set(lead);
    this.scoreExplanation.set(null);
    this.scoreModalVisible.set(true);
    // Stored score against the score under the model in force now: the server explains both.
    this.crmApi.getLeadScore(lead.id).subscribe({
      next: (explanation) => this.scoreExplanation.set(explanation),
      error: () => this.scoreExplanation.set(null),
    });
  }

  /** The breakdown of the stored score (the server may send a plain text for old scores). */
  storedBreakdown(explanation: LeadScoreExplanation): LeadScoreBreakdownItem[] {
    return Array.isArray(explanation.breakdown) ? explanation.breakdown : [];
  }

  qualify(lead: LeadResource): void {
    this.crmApi.qualifyLead(lead.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('crmLeadScore.msgLeadMarkedAsQualified'));
        this.loadLeads();
      },
      error: () => undefined,
    });
  }

  disqualify(lead: LeadResource): void {
    this.crmApi.disqualifyLead(lead.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('crmLeadScore.msgLeadMarkedAsDisqualified'));
        this.loadLeads();
      },
      error: () => undefined,
    });
  }

  convert(lead: LeadResource): void {
    this.modal.confirm({
      nzTitle: this.translate.instant('crmLeadScore.dlgConvertLead'),
      nzContent: this.translate.instant('crmLeadScore.dlgConvertIntoAccountAndContact', { value: lead.full_name || lead.company_name || '' }),
      nzOkText: this.translate.instant('crmLeadScore.dlgConvert'),
      nzOnOk: () => {
        this.crmApi.convertLead(lead.id, { create_opportunity: true }).subscribe({
          next: () => {
            this.message.success(this.translate.instant('crmLeadScore.msgLeadSuccessfullyConverted'));
            this.loadLeads();
          },
          error: () => undefined,
        });
      },
    });
  }

  deleteLead(lead: LeadResource): void {
    this.crmApi.deleteLead(lead.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('crmLeadScore.msgLeadDeleted'));
        this.loadLeads();
      },
      error: () => undefined,
    });
  }

  getStatusColor(status: string): string {
    switch (status?.toLowerCase()) {
      case 'new':
        return 'blue';
      case 'contacted':
        return 'cyan';
      case 'qualified':
        return 'green';
      case 'converted':
        return 'gold';
      case 'disqualified':
        return 'red';
      default:
        return 'default';
    }
  }

  getRatingColor(rating: string): string {
    switch (rating?.toLowerCase()) {
      case 'hot':
        return 'volcano';
      case 'warm':
        return 'orange';
      case 'cold':
        return 'geekblue';
      default:
        return 'default';
    }
  }
}
