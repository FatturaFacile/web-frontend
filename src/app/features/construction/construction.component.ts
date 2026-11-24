import { CurrencyPipe, DatePipe, UpperCasePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal, TemplateRef, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormsModule, NonNullableFormBuilder, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { endsNotBefore, revalidateOnStartChange } from '@shared/utils/date-validators';
import { decimalPattern, positiveNumber } from '@shared/utils/decimal-validators';
import { of } from 'rxjs';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
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
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  ClientApiService,
  ConstructionApiService,
  ConstructionProgressBilling,
  ConstructionProgressBillingPayload,
  ConstructionSite,
  ConstructionSiteRequest,
  ConstructionSiteStatus,
  FetchGridModel,
  PaginatedResponse,
  QueryFilterParams,
  ContactResource,
  TradesBid,
  TradesBidPosition,
  TradesBidRequest,
  TradesBidStatus,
  TradesBilling,
  TradesBillingBasis,
  TradesBillingKind,
  TradesBudgetControl,
  TradesDocumentKind,
  TradesLanguage,
  TradesSiteDiaryEntry,
  TradesSiteDocument,
  TradesSubcontract,
  TradesSubcontractor,
  TradesSubcontractorStatus,
  TranslateService,
} from '@core';
import { BaseTableComponent, MoneyPipe, PageHeaderComponent, TableColumnDef, TranslatePipe, ModalActionsDirective, IconActionDirective, GridExportDirective, GridSortPipe, GridFilterListPipe, GridFilterFnPipe } from '@shared';

/** Page-level filters of the bids grid, sent next to the grid query. */
interface BidListFilter extends QueryFilterParams {
  status?: string;
}

/** Page returned for a site-scoped grid while no site is selected. */
function emptyPage<T>(): PaginatedResponse<T> {
  return {
    success: true,
    message: '',
    data: [],
    meta: { current_page: 1, from: null, to: null, last_page: 1, per_page: 0, total: 0 },
  } as PaginatedResponse<T>;
}

const today = (): string => new Date().toISOString().substring(0, 10);

/** Mirrors `required_if`: the control is required while `isRequired()` holds. */
function requiredWhen(isRequired: (group: AbstractControl) => boolean): ValidatorFn {
  return (control: AbstractControl) =>
    control.parent && isRequired(control.parent) && (control.value === null || control.value === '') ? { required: true } : null;
}

/** Mirrors `decimal:0,4` with `max:100` for a percentage. */
function percentageUpTo(limit: number): ValidatorFn {
  return (control: AbstractControl) => {
    const value = control.value;
    if (value === null || value === undefined || value === '') {
      return null;
    }
    return Number(value) <= limit ? null : { invalid: true };
  };
}

/** Mirrors `not_in:0`. */
const notZero: ValidatorFn = (control: AbstractControl) => {
  const value = control.value;
  return value === null || value === undefined || value === '' || Number(value) !== 0 ? null : { invalid: true };
};

@Component({
  selector: 'app-construction',
  styleUrl: './construction.component.scss',
  imports: [
    BaseTableComponent,
    GridExportDirective,
    GridSortPipe, GridFilterListPipe, GridFilterFnPipe,
    ModalActionsDirective,
    IconActionDirective,
    CurrencyPipe,
    DatePipe,
    UpperCasePipe,
    FormsModule,
    ReactiveFormsModule,
    NzCardModule,
    NzTabsModule,
    NzTableModule,
    NzTagModule,
    NzButtonModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzFormModule,
    NzModalModule,
    NzDescriptionsModule,
    NzSpaceModule,
    NzStatisticModule,
    NzPopconfirmModule,
    NzIconModule,
    NzEmptyModule,
    PageHeaderComponent,
    TranslatePipe,
    MoneyPipe,
  ],
  templateUrl: './construction.component.html',
})
export class ConstructionComponent implements OnInit {
  private readonly api = inject(ConstructionApiService);
  private readonly clientApi = inject(ClientApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly siteStatuses: readonly ConstructionSiteStatus[] = ['planning', 'active', 'paused', 'completed'];
  readonly languages: readonly TradesLanguage[] = ['it', 'de', 'fr', 'en'];
  readonly documentKinds: readonly TradesDocumentKind[] = [
    'safety_plan',
    'risk_assessment',
    'insurance',
    'compliance_certificate',
    'training_certificate',
    'permit',
    'other',
  ];
  readonly subcontractorStatuses: readonly TradesSubcontractorStatus[] = ['active', 'suspended'];

  readonly selectedTabIndex = signal<number>(0);

  /** Customers of the company: the committer of a site, the customer of a bid, the contact of a subcontractor. */
  readonly contacts = signal<ContactResource[]>([]);

  // --- TAB 1: SITES & PROGRESS BILLINGS (SAL) ---
  readonly sites = signal<ConstructionSite[]>([]);
  /** Every site, for the site selectors; the sites table pages on the server through `sitesGrid`. */
  readonly sitesGrid = new FetchGridModel<ConstructionSite>((query) => this.api.getSites(query));
  readonly salGrid = new FetchGridModel<ConstructionProgressBilling>((query) => this.api.getProgressBillings(query));

  // --- TAB 2: TRADES BIDS (OFFERTE & APPALTI) ---
  readonly bids = signal<TradesBid[]>([]);
  readonly bidsGrid = new FetchGridModel<TradesBid, BidListFilter>((query) => this.api.getBids(query));
  readonly filterBidStatus = signal<string>('');
  readonly filterBidSearch = signal<string>('');

  // Bid Detail Drawer
  readonly drawerVisible = signal<boolean>(false);
  readonly selectedBid = signal<TradesBid | null>(null);
  readonly bidNetTotal = signal<string | null>(null);
  readonly bidPositions = signal<TradesBidPosition[]>([]);
  readonly bidBillings = signal<TradesBilling[]>([]);
  readonly budgetControl = signal<TradesBudgetControl | null>(null);
  readonly drawerLoading = signal<boolean>(false);

  // --- TAB 3: SITE DIARY (GIORNALE DEI LAVORI) ---
  readonly selectedDiarySiteId = signal<string>('');
  readonly diaryGrid = new FetchGridModel<TradesSiteDiaryEntry>((query) => {
    const siteId = this.activeSiteId();
    return siteId ? this.api.getSiteDiary(siteId, query) : of(emptyPage<TradesSiteDiaryEntry>());
  });

  // --- TAB 4: DOCUMENTS & SAFETY (POS / DURC) ---
  readonly documentsGrid = new FetchGridModel<TradesSiteDocument>((query) => {
    const siteId = this.activeSiteId();
    return siteId ? this.api.getSiteDocuments(siteId, query) : of(emptyPage<TradesSiteDocument>());
  });
  readonly expiringDocuments = signal<TradesSiteDocument[]>([]);

  // --- TAB 5: SUBCONTRACTS (SUBAPPALTI) ---
  readonly subcontractors = signal<TradesSubcontractor[]>([]);
  readonly subcontractsGrid = new FetchGridModel<TradesSubcontract>((query) => {
    const siteId = this.activeSiteId();
    return siteId ? this.api.getSiteSubcontracts(siteId, query) : of(emptyPage<TradesSubcontract>());
  });

  // Modals visibility
  readonly siteModalVisible = signal<boolean>(false);
  readonly salModalVisible = signal<boolean>(false);
  readonly bidModalVisible = signal<boolean>(false);
  readonly positionModalVisible = signal<boolean>(false);
  readonly measurementModalVisible = signal<boolean>(false);
  readonly bidBillingModalVisible = signal<boolean>(false);
  readonly diaryModalVisible = signal<boolean>(false);
  readonly documentModalVisible = signal<boolean>(false);
  readonly subcontractorModalVisible = signal<boolean>(false);
  readonly subcontractModalVisible = signal<boolean>(false);
  readonly certifySubcontractModalVisible = signal<boolean>(false);
  readonly selectedSubcontract = signal<TradesSubcontract | null>(null);

  // --- FORMS ---
  readonly siteForm = this.fb.group({
    code: ['', [Validators.required, Validators.maxLength(50)]],
    name: ['', [Validators.required, Validators.maxLength(255)]],
    client_id: ['', [Validators.required]],
    address: ['', [Validators.required, Validators.maxLength(255)]],
    sia_norm_reference: ['', [Validators.maxLength(50)]],
    npk_code: ['', [Validators.maxLength(50)]],
    start_date: [''],
    estimated_end_date: ['', [endsNotBefore('start_date')]],
    status: ['planning' as ConstructionSiteStatus],
  });

  readonly salForm = this.fb.group({
    construction_site_id: ['', [Validators.required]],
    sal_number: ['', [Validators.required]],
    period_start: [today(), [Validators.required]],
    period_end: [today(), [Validators.required, endsNotBefore('period_start')]],
    gross_certified_amount: [100000, [Validators.required, Validators.min(0)]],
    retention_percentage: [10, [Validators.min(0), Validators.max(50)]],
  });

  readonly bidForm = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    construction_site_id: [''],
    contact_id: ['', [Validators.required]],
    language: ['it' as TradesLanguage, [Validators.required]],
    currency: ['CHF', [Validators.required, Validators.pattern(/^[A-Za-z]{3}$/)]],
    tax_rate: ['8.10', [Validators.required, decimalPattern(2), percentageUpTo(100)]],
    valid_until: [''],
    notes: ['', [Validators.maxLength(5000)]],
  });

  readonly positionForm = this.fb.group({
    position_code: ['', [Validators.required, Validators.maxLength(40)]],
    description: ['', [Validators.required, Validators.maxLength(4000)]],
    unit: ['m²', [Validators.required, Validators.maxLength(10)]],
    quantity: ['1', [Validators.required, decimalPattern(4), positiveNumber]],
    unit_price: ['0.00', [Validators.required, decimalPattern(4)]],
  });

  readonly measurementForm = this.fb.group({
    bid_position_id: ['', [Validators.required]],
    measured_on: [today(), [Validators.required]],
    quantity: ['1', [Validators.required, notZero]],
    note: ['', [Validators.maxLength(500)]],
  });

  readonly bidBillingForm = this.fb.group({
    kind: ['partial' as TradesBillingKind, [Validators.required]],
    basis: ['percentage' as TradesBillingBasis | '', [requiredWhen((group) => group.get('kind')?.value === 'partial')]],
    percentage: [
      '',
      [
        requiredWhen(
          (group) => group.get('kind')?.value === 'partial' && group.get('basis')?.value === 'percentage',
        ),
        decimalPattern(4),
        positiveNumber,
        percentageUpTo(100),
      ],
    ],
    date: [today(), [Validators.required]],
  });

  readonly diaryForm = this.fb.group({
    site_id: ['', [Validators.required]],
    entry_date: [today(), [Validators.required]],
    weather: ['', [Validators.maxLength(100)]],
    workers_present: [6, [Validators.required, Validators.min(0), Validators.max(5000)]],
    work_performed: ['', [Validators.required, Validators.maxLength(5000)]],
    incidents: ['', [Validators.maxLength(5000)]],
  });

  readonly documentForm = this.fb.group({
    site_id: ['', [Validators.required]],
    kind: ['safety_plan' as TradesDocumentKind, [Validators.required]],
    title: ['', [Validators.required, Validators.maxLength(255)]],
    subcontractor_id: [''],
    issued_on: [''],
    expires_on: ['', [endsNotBefore('issued_on')]],
    notes: ['', [Validators.maxLength(500)]],
  });

  readonly subcontractorForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(190)]],
    contact_id: [''],
    tax_id: ['', [Validators.maxLength(40)]],
    trade: ['', [Validators.maxLength(100)]],
    status: ['active' as TradesSubcontractorStatus],
    notes: ['', [Validators.maxLength(500)]],
  });

  readonly subcontractForm = this.fb.group({
    site_id: ['', [Validators.required]],
    subcontractor_id: ['', [Validators.required]],
    bid_id: [''],
    description: ['', [Validators.required, Validators.maxLength(500)]],
    contract_amount: ['25000.00', [Validators.required, decimalPattern(2), positiveNumber]],
    starts_on: [''],
    ends_on: ['', [endsNotBefore('starts_on')]],
  });

  readonly certifyForm = this.fb.group({
    certified_on: [today(), [Validators.required]],
    amount: ['5000.00', [Validators.required, decimalPattern(2), positiveNumber]],
    description: ['', [Validators.required, Validators.maxLength(500)]],
  });

  constructor() {
    revalidateOnStartChange(this.siteForm, 'start_date', 'estimated_end_date', this.destroyRef);
    revalidateOnStartChange(this.salForm, 'period_start', 'period_end', this.destroyRef);
    revalidateOnStartChange(this.documentForm, 'issued_on', 'expires_on', this.destroyRef);
    revalidateOnStartChange(this.subcontractForm, 'starts_on', 'ends_on', this.destroyRef);
    this.bidBillingForm.controls.kind.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.bidBillingForm.controls.basis.updateValueAndValidity();
      this.bidBillingForm.controls.percentage.updateValueAndValidity();
    });
    this.bidBillingForm.controls.basis.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.bidBillingForm.controls.percentage.updateValueAndValidity();
    });
  }

  ngOnInit(): void {
    this.loadContacts();
    this.loadSites();
    this.loadBids();
    this.loadDocuments();
    this.loadSubcontractors();
  }

  // --- TABLE COLUMNS (server-driven grids) ---
  private readonly codeTpl = viewChild<TemplateRef<unknown>>('codeTpl');
  private readonly siteStatusTpl = viewChild<TemplateRef<unknown>>('siteStatusTpl');
  private readonly siteClientTpl = viewChild<TemplateRef<unknown>>('siteClientTpl');
  private readonly bidClientTpl = viewChild<TemplateRef<unknown>>('bidClientTpl');
  private readonly subNameTpl = viewChild<TemplateRef<unknown>>('subNameTpl');
  private readonly normTpl = viewChild<TemplateRef<unknown>>('normTpl');
  private readonly dateTpl = viewChild<TemplateRef<unknown>>('dateTpl');
  private readonly eurTpl = viewChild<TemplateRef<unknown>>('eurTpl');
  private readonly percentTpl = viewChild<TemplateRef<unknown>>('percentTpl');
  private readonly salStatusTpl = viewChild<TemplateRef<unknown>>('salStatusTpl');
  private readonly bidStatusTpl = viewChild<TemplateRef<unknown>>('bidStatusTpl');
  private readonly weatherTpl = viewChild<TemplateRef<unknown>>('weatherTpl');
  private readonly workersTpl = viewChild<TemplateRef<unknown>>('workersTpl');
  private readonly incidentsTpl = viewChild<TemplateRef<unknown>>('incidentsTpl');
  private readonly docKindTpl = viewChild<TemplateRef<unknown>>('docKindTpl');
  private readonly docExpiryTpl = viewChild<TemplateRef<unknown>>('docExpiryTpl');
  private readonly subPeriodTpl = viewChild<TemplateRef<unknown>>('subPeriodTpl');
  private readonly subStatusTpl = viewChild<TemplateRef<unknown>>('subStatusTpl');

  readonly bidActionsTemplate = viewChild<TemplateRef<{ $implicit: TradesBid }>>('bidActionsTpl');
  readonly subcontractActionsTemplate = viewChild<TemplateRef<{ $implicit: TradesSubcontract }>>('subActionsTpl');

  private upper(value: unknown): string {
    return String(value ?? '').toUpperCase();
  }

  readonly siteColumns = computed<TableColumnDef<ConstructionSite>[]>(() => [
    { key: 'code', header: 'CONSTRUCTION.COL_CODE', customCellTemplate: this.codeTpl() },
    { key: 'name', header: 'CONSTRUCTION.FIELD_NAME' },
    {
      key: 'client_id',
      serverKey: 'client.name',
      header: 'CONSTRUCTION.COL_CLIENT',
      valueGetter: (site) => this.contactNameOf(site.client_id),
      customCellTemplate: this.siteClientTpl(),
    },
    { key: 'address', header: 'CONSTRUCTION.COL_LOCATION' },
    {
      key: 'status',
      header: 'CONSTRUCTION.COL_STATUS',
      valueGetter: (site) => this.siteStatusLabel(site.status),
      valueLabel: (value) => this.siteStatusLabel(value),
      customCellTemplate: this.siteStatusTpl(),
    },
    { key: 'sia_norm_reference', header: 'CONSTRUCTION.COL_NORM', customCellTemplate: this.normTpl() },
  ]);

  readonly salColumns = computed<TableColumnDef<ConstructionProgressBilling>[]>(() => [
    { key: 'sal_number', header: 'CONSTRUCTION.COL_SAL_NUMBER', customCellTemplate: this.codeTpl() },
    { key: 'period_start', header: 'CONSTRUCTION.COL_PERIOD_START', customCellTemplate: this.dateTpl() },
    { key: 'period_end', header: 'CONSTRUCTION.COL_PERIOD_END', customCellTemplate: this.dateTpl() },
    { key: 'gross_certified_amount', header: 'CONSTRUCTION.COL_GROSS_CERTIFIED', customCellTemplate: this.eurTpl() },
    { key: 'retention_percentage', header: 'CONSTRUCTION.COL_RETENTION', customCellTemplate: this.percentTpl() },
    { key: 'net_amount', header: 'CONSTRUCTION.COL_NET_AMOUNT', customCellTemplate: this.eurTpl() },
    {
      key: 'status',
      header: 'CONSTRUCTION.COL_STATUS',
      valueGetter: (sal) => this.upper(sal.status),
      valueLabel: (value) => this.upper(value),
      customCellTemplate: this.salStatusTpl(),
    },
  ]);

  readonly bidColumns = computed<TableColumnDef<TradesBid>[]>(() => [
    { key: 'bid_number', header: 'CONSTRUCTION.COL_BID_CODE', customCellTemplate: this.codeTpl() },
    { key: 'title', header: 'CONSTRUCTION.COL_BID_TITLE' },
    {
      key: 'contact_id',
      serverKey: 'contact.name',
      header: 'CONSTRUCTION.COL_CLIENT',
      valueGetter: (bid) => this.contactNameOf(bid.contact_id),
      customCellTemplate: this.bidClientTpl(),
    },
    { key: 'currency', header: 'CONSTRUCTION.FIELD_CURRENCY' },
    {
      key: 'status',
      header: 'CONSTRUCTION.COL_STATUS',
      valueGetter: (bid) => this.upper(bid.status),
      valueLabel: (value) => this.upper(value),
      customCellTemplate: this.bidStatusTpl(),
    },
  ]);

  readonly diaryColumns = computed<TableColumnDef<TradesSiteDiaryEntry>[]>(() => [
    { key: 'entry_date', header: 'CONSTRUCTION.COL_DATE', customCellTemplate: this.dateTpl() },
    { key: 'weather', header: 'CONSTRUCTION.COL_WEATHER', customCellTemplate: this.weatherTpl() },
    { key: 'workers_present', header: 'CONSTRUCTION.COL_WORKERS', customCellTemplate: this.workersTpl() },
    { key: 'incidents', header: 'CONSTRUCTION.FIELD_INCIDENTS', customCellTemplate: this.incidentsTpl() },
    { key: 'work_performed', header: 'CONSTRUCTION.COL_WORK_PERFORMED' },
  ]);

  readonly documentColumns = computed<TableColumnDef<TradesSiteDocument>[]>(() => [
    { key: 'title', header: 'CONSTRUCTION.COL_DOCUMENT_TITLE', customCellTemplate: this.codeTpl() },
    {
      key: 'kind',
      header: 'CONSTRUCTION.COL_CATEGORY',
      valueGetter: (doc) => this.documentKindLabel(doc.kind),
      valueLabel: (value) => this.documentKindLabel(value),
      customCellTemplate: this.docKindTpl(),
    },
    { key: 'expires_on', header: 'CONSTRUCTION.COL_EXPIRES_AT', customCellTemplate: this.docExpiryTpl() },
  ]);

  readonly subcontractColumns = computed<TableColumnDef<TradesSubcontract>[]>(() => [
    {
      key: 'subcontractor_id',
      serverKey: 'subcontractor.name',
      header: 'CONSTRUCTION.COL_SUBCONTRACTOR',
      valueGetter: (sub) => this.subcontractorNameOf(sub.subcontractor_id),
      customCellTemplate: this.subNameTpl(),
    },
    { key: 'description', header: 'CONSTRUCTION.COL_SCOPE' },
    { key: 'contract_amount', header: 'CONSTRUCTION.COL_CONTRACT_AMOUNT', customCellTemplate: this.eurTpl() },
    { key: 'starts_on', header: 'CONSTRUCTION.COL_PERIOD', customCellTemplate: this.subPeriodTpl() },
    {
      key: 'status',
      header: 'CONSTRUCTION.COL_STATUS',
      valueGetter: (sub) => this.upper(sub.status),
      valueLabel: (value) => this.upper(value),
      customCellTemplate: this.subStatusTpl(),
    },
  ]);

  siteStatusLabel(status: string | null | undefined): string {
    return status ? this.translate.instant('CONSTRUCTION.SITE_STATUS_' + status.toUpperCase()) : '';
  }

  documentKindLabel(kind: string | null | undefined): string {
    return kind ? this.translate.instant('CONSTRUCTION.DOC_KIND_' + kind.toUpperCase()) : '';
  }

  // --- CONTACTS ---
  loadContacts(): void {
    this.clientApi.list({ per_page: 200 }).subscribe({
      next: (res) => this.contacts.set(res.data),
      error: () => this.contacts.set([]),
    });
  }

  contactLabel(contact: ContactResource): string {
    return contact.company_name || `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim() || contact.id;
  }

  contactNameOf(contactId: string | null | undefined): string {
    const contact = this.contacts().find((candidate) => candidate.id === contactId);
    return contact ? this.contactLabel(contact) : '-';
  }

  siteLabel(site: ConstructionSite): string {
    return `${site.code} - ${site.name}`;
  }

  positionLabel(position: TradesBidPosition): string {
    return `${position.position_code} - ${position.description}`;
  }

  // --- SITES & SAL METHODS ---
  loadSites(): void {
    this.sitesGrid.reload();
    this.salGrid.reload();
    this.api.getSites({ per_page: 200 }).subscribe({
      next: (res) => {
        const data = res.data || [];
        this.sites.set(data);
        if (data.length > 0 && !this.selectedDiarySiteId()) {
          this.selectedDiarySiteId.set(data[0].id || '');
        }
        this.reloadSiteScopedGrids();
      },
      error: () => {
        this.message.error(this.translate.instant('CONSTRUCTION.LOAD_ERROR'));
      },
    });
  }

  /** Site the diary, the documents and the subcontracts show: the selected one, else the first. */
  activeSiteId(): string {
    return this.selectedDiarySiteId() || this.sites()[0]?.id || '';
  }

  /** The site selector changed: the three site-scoped tables follow it. */
  onSiteChange(siteId: string): void {
    this.selectedDiarySiteId.set(siteId);
    this.reloadSiteScopedGrids();
  }

  private reloadSiteScopedGrids(): void {
    this.diaryGrid.reload();
    this.documentsGrid.reload();
    this.subcontractsGrid.reload();
  }

  openCreateSiteModal(): void {
    this.siteForm.reset({
      code: '',
      name: '',
      client_id: '',
      address: '',
      sia_norm_reference: '',
      npk_code: '',
      start_date: '',
      estimated_end_date: '',
      status: 'planning',
    });
    this.siteModalVisible.set(true);
  }

  saveSite(): void {
    if (this.siteForm.invalid) {
      this.siteForm.markAllAsTouched();
      return;
    }
    const val = this.siteForm.getRawValue();
    const payload: ConstructionSiteRequest = {
      client_id: val.client_id,
      code: val.code,
      name: val.name,
      address: val.address,
      sia_norm_reference: val.sia_norm_reference || null,
      npk_code: val.npk_code || null,
      start_date: val.start_date || null,
      estimated_end_date: val.estimated_end_date || null,
      status: val.status,
    };

    this.api.createSite(payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('CONSTRUCTION.SITE_CREATED'));
        this.siteModalVisible.set(false);
        this.loadSites();
      },
      error: () => {
        this.message.error(this.translate.instant('CONSTRUCTION.ACTION_ERROR'));
      },
    });
  }

  openCreateSalModal(): void {
    this.salForm.reset({
      construction_site_id: this.sites()[0]?.id || '',
      sal_number: 'SAL 1',
      period_start: today(),
      period_end: today(),
      gross_certified_amount: 100000,
      retention_percentage: 10,
    });
    this.salModalVisible.set(true);
  }

  saveSal(): void {
    if (this.salForm.invalid) {
      this.salForm.markAllAsTouched();
      return;
    }
    const val = this.salForm.getRawValue();
    const payload: ConstructionProgressBillingPayload = {
      construction_site_id: val.construction_site_id,
      sal_number: val.sal_number,
      period_start: val.period_start,
      period_end: val.period_end,
      gross_certified_amount: Number(val.gross_certified_amount),
      retention_percentage: Number(val.retention_percentage),
    };

    this.api.createProgressBilling(payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('CONSTRUCTION.SAL_CREATED'));
        this.salModalVisible.set(false);
        this.loadSites();
      },
      error: () => {
        this.message.error(this.translate.instant('CONSTRUCTION.ACTION_ERROR'));
      },
    });
  }

  // --- TRADES BIDS METHODS ---
  loadBids(): void {
    this.bidsGrid.reload();
    this.api.getBids({ per_page: 200 }).subscribe({ next: (res) => this.bids.set(res.data || []) });
  }

  /** Page-level filters of the bids grid: the search box and the status select. */
  applyBidFilters(): void {
    this.bidsGrid.setFilter({ search: this.filterBidSearch().trim(), status: this.filterBidStatus() });
  }

  openCreateBidModal(): void {
    this.bidForm.reset({
      title: '',
      construction_site_id: this.sites()[0]?.id || '',
      contact_id: '',
      language: 'it',
      currency: 'CHF',
      tax_rate: '8.10',
      valid_until: '',
      notes: '',
    });
    this.bidModalVisible.set(true);
  }

  saveBid(): void {
    if (this.bidForm.invalid) {
      this.bidForm.markAllAsTouched();
      return;
    }
    const val = this.bidForm.getRawValue();
    const payload: TradesBidRequest = {
      construction_site_id: val.construction_site_id || null,
      contact_id: val.contact_id,
      title: val.title,
      language: val.language,
      currency: val.currency.toUpperCase(),
      tax_rate: val.tax_rate,
      valid_until: val.valid_until || null,
      notes: val.notes || null,
    };

    this.api.createBid(payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('CONSTRUCTION.BID_CREATED'));
        this.bidModalVisible.set(false);
        this.loadBids();
      },
      error: () => {
        this.message.error(this.translate.instant('CONSTRUCTION.ACTION_ERROR'));
      },
    });
  }

  changeBidStatus(bid: TradesBid, newStatus: TradesBidStatus): void {
    this.api.changeBidStatus(bid.id, { status: newStatus }).subscribe({
      next: () => {
        this.message.success(this.translate.instant('CONSTRUCTION.STATUS_UPDATED'));
        this.loadBids();
        if (this.selectedBid()?.id === bid.id) {
          this.loadBidDetails(bid.id);
        }
      },
      error: () => {
        this.message.error(this.translate.instant('CONSTRUCTION.ACTION_ERROR'));
      },
    });
  }

  // --- BID DRAWER DETAILS ---
  openBidDrawer(bid: TradesBid): void {
    this.selectedBid.set(bid);
    this.drawerVisible.set(true);
    this.loadBidDetails(bid.id);
  }

  closeBidDrawer(): void {
    this.drawerVisible.set(false);
    this.selectedBid.set(null);
    this.bidNetTotal.set(null);
    this.bidPositions.set([]);
    this.bidBillings.set([]);
    this.budgetControl.set(null);
  }

  loadBidDetails(bidId: string): void {
    this.drawerLoading.set(true);
    this.api.getBid(bidId).subscribe({
      next: (res) => {
        this.selectedBid.set(res.data);
        this.bidNetTotal.set(res.meta?.net_total ?? null);
        this.bidPositions.set(res.data.positions || []);
        this.drawerLoading.set(false);
      },
      error: () => {
        this.drawerLoading.set(false);
      },
    });

    this.api.getBidBillings(bidId).subscribe({
      next: (res) => {
        this.bidBillings.set(res.data || []);
      },
    });

    this.api.getBudgetControl(bidId).subscribe({
      next: (res) => {
        this.budgetControl.set(res.data);
      },
    });
  }

  openAddPositionModal(): void {
    this.positionForm.reset({
      position_code: '',
      description: '',
      unit: 'm²',
      quantity: '1',
      unit_price: '0.00',
    });
    this.positionModalVisible.set(true);
  }

  savePosition(): void {
    const bid = this.selectedBid();
    if (!bid || this.positionForm.invalid) {
      this.positionForm.markAllAsTouched();
      return;
    }
    const val = this.positionForm.getRawValue();

    this.api
      .addBidPosition(bid.id, {
        position_code: val.position_code,
        description: val.description,
        unit: val.unit,
        quantity: val.quantity,
        unit_price: val.unit_price,
      })
      .subscribe({
        next: () => {
          this.message.success(this.translate.instant('CONSTRUCTION.POSITION_ADDED'));
          this.positionModalVisible.set(false);
          this.loadBidDetails(bid.id);
          this.loadBids();
        },
        error: () => {
          this.message.error(this.translate.instant('CONSTRUCTION.ACTION_ERROR'));
        },
      });
  }

  openAddMeasurementModal(positionId?: string): void {
    this.measurementForm.reset({
      bid_position_id: positionId || '',
      measured_on: today(),
      quantity: '1',
      note: '',
    });
    this.measurementModalVisible.set(true);
  }

  saveMeasurement(): void {
    const bid = this.selectedBid();
    if (!bid || this.measurementForm.invalid) {
      this.measurementForm.markAllAsTouched();
      return;
    }
    const val = this.measurementForm.getRawValue();

    this.api
      .recordMeasurement(bid.id, {
        bid_position_id: val.bid_position_id,
        measured_on: val.measured_on,
        quantity: val.quantity,
        note: val.note || null,
      })
      .subscribe({
        next: () => {
          this.message.success(this.translate.instant('CONSTRUCTION.MEASUREMENT_RECORDED'));
          this.measurementModalVisible.set(false);
        },
        error: () => {
          this.message.error(this.translate.instant('CONSTRUCTION.ACTION_ERROR'));
        },
      });
  }

  openIssueBidBillingModal(bid?: TradesBid): void {
    if (bid) {
      this.selectedBid.set(bid);
    }
    this.bidBillingForm.reset({
      kind: 'partial',
      basis: 'percentage',
      percentage: '',
      date: today(),
    });
    this.bidBillingModalVisible.set(true);
  }

  saveBidBilling(): void {
    const bid = this.selectedBid();
    if (!bid || this.bidBillingForm.invalid) {
      this.bidBillingForm.markAllAsTouched();
      return;
    }
    const val = this.bidBillingForm.getRawValue();
    const isPartial = val.kind === 'partial';
    const hasPercentage = isPartial && val.basis === 'percentage';

    this.api
      .issueBidBilling(bid.id, {
        kind: val.kind,
        basis: isPartial && val.basis !== '' ? val.basis : null,
        percentage: hasPercentage ? val.percentage : null,
        date: val.date,
      })
      .subscribe({
        next: () => {
          this.message.success(this.translate.instant('CONSTRUCTION.BILLING_ISSUED'));
          this.bidBillingModalVisible.set(false);
          this.loadBidDetails(bid.id);
          this.loadBids();
        },
        error: () => {
          this.message.error(this.translate.instant('CONSTRUCTION.ACTION_ERROR'));
        },
      });
  }

  // --- DIARY METHODS ---
  loadDiary(): void {
    this.diaryGrid.reload();
  }

  openCreateDiaryModal(): void {
    this.diaryForm.reset({
      site_id: this.selectedDiarySiteId() || this.sites()[0]?.id || '',
      entry_date: today(),
      weather: '',
      workers_present: 6,
      work_performed: '',
      incidents: '',
    });
    this.diaryModalVisible.set(true);
  }

  saveDiary(): void {
    if (this.diaryForm.invalid) {
      this.diaryForm.markAllAsTouched();
      return;
    }
    const val = this.diaryForm.getRawValue();

    this.api
      .writeSiteDiary(val.site_id, {
        entry_date: val.entry_date,
        weather: val.weather || null,
        workers_present: Number(val.workers_present),
        work_performed: val.work_performed,
        incidents: val.incidents || null,
      })
      .subscribe({
        next: () => {
          this.message.success(this.translate.instant('CONSTRUCTION.DIARY_SAVED'));
          this.diaryModalVisible.set(false);
          this.loadDiary();
        },
        error: () => {
          this.message.error(this.translate.instant('CONSTRUCTION.ACTION_ERROR'));
        },
      });
  }

  // --- DOCUMENTS METHODS ---
  loadDocuments(): void {
    this.documentsGrid.reload();
    this.api.getExpiringDocuments().subscribe({
      next: (res) => {
        this.expiringDocuments.set(res.data || []);
      },
    });
  }

  openCreateDocumentModal(): void {
    this.documentForm.reset({
      site_id: this.selectedDiarySiteId() || this.sites()[0]?.id || '',
      kind: 'safety_plan',
      title: '',
      subcontractor_id: '',
      issued_on: '',
      expires_on: '',
      notes: '',
    });
    this.documentModalVisible.set(true);
  }

  saveDocument(): void {
    if (this.documentForm.invalid) {
      this.documentForm.markAllAsTouched();
      return;
    }
    const val = this.documentForm.getRawValue();

    this.api
      .addSiteDocument(val.site_id, {
        kind: val.kind,
        title: val.title,
        subcontractor_id: val.subcontractor_id || null,
        issued_on: val.issued_on || null,
        expires_on: val.expires_on || null,
        notes: val.notes || null,
      })
      .subscribe({
        next: () => {
          this.message.success(this.translate.instant('CONSTRUCTION.DOCUMENT_ADDED'));
          this.documentModalVisible.set(false);
          this.loadDocuments();
        },
        error: () => {
          this.message.error(this.translate.instant('CONSTRUCTION.ACTION_ERROR'));
        },
      });
  }

  // --- SUBCONTRACTS METHODS ---
  loadSubcontractors(): void {
    this.api.getSubcontractors().subscribe({
      next: (res) => {
        this.subcontractors.set(res.data || []);
      },
    });
  }

  subcontractorNameOf(subcontractorId: string): string {
    return this.subcontractors().find((candidate) => candidate.id === subcontractorId)?.name ?? subcontractorId;
  }

  loadSiteSubcontracts(): void {
    this.subcontractsGrid.reload();
  }

  openCreateSubcontractorModal(): void {
    this.subcontractorForm.reset({
      name: '',
      contact_id: '',
      tax_id: '',
      trade: '',
      status: 'active',
      notes: '',
    });
    this.subcontractorModalVisible.set(true);
  }

  saveSubcontractor(): void {
    if (this.subcontractorForm.invalid) {
      this.subcontractorForm.markAllAsTouched();
      return;
    }
    const val = this.subcontractorForm.getRawValue();

    this.api
      .createSubcontractor({
        name: val.name,
        contact_id: val.contact_id || null,
        tax_id: val.tax_id || null,
        trade: val.trade || null,
        status: val.status,
        notes: val.notes || null,
      })
      .subscribe({
        next: () => {
          this.message.success(this.translate.instant('CONSTRUCTION.SUBCONTRACTOR_CREATED'));
          this.subcontractorModalVisible.set(false);
          this.loadSubcontractors();
        },
        error: () => {
          this.message.error(this.translate.instant('CONSTRUCTION.ACTION_ERROR'));
        },
      });
  }

  openCreateSubcontractModal(): void {
    this.subcontractForm.reset({
      site_id: this.selectedDiarySiteId() || this.sites()[0]?.id || '',
      subcontractor_id: this.subcontractors()[0]?.id || '',
      bid_id: '',
      description: '',
      contract_amount: '25000.00',
      starts_on: '',
      ends_on: '',
    });
    this.subcontractModalVisible.set(true);
  }

  saveSubcontract(): void {
    if (this.subcontractForm.invalid) {
      this.subcontractForm.markAllAsTouched();
      return;
    }
    const val = this.subcontractForm.getRawValue();

    this.api
      .createSiteSubcontract(val.site_id, {
        subcontractor_id: val.subcontractor_id,
        bid_id: val.bid_id || null,
        description: val.description,
        contract_amount: val.contract_amount,
        starts_on: val.starts_on || null,
        ends_on: val.ends_on || null,
      })
      .subscribe({
        next: () => {
          this.message.success(this.translate.instant('CONSTRUCTION.SUBCONTRACT_CREATED'));
          this.subcontractModalVisible.set(false);
          this.loadSiteSubcontracts();
        },
        error: () => {
          this.message.error(this.translate.instant('CONSTRUCTION.ACTION_ERROR'));
        },
      });
  }

  openCertifySubcontractModal(sub: TradesSubcontract): void {
    this.selectedSubcontract.set(sub);
    this.certifyForm.reset({
      certified_on: today(),
      amount: '5000.00',
      description: '',
    });
    this.certifySubcontractModalVisible.set(true);
  }

  saveCertifySubcontract(): void {
    const sub = this.selectedSubcontract();
    if (!sub || this.certifyForm.invalid) {
      this.certifyForm.markAllAsTouched();
      return;
    }
    const val = this.certifyForm.getRawValue();
    this.api
      .certifySubcontractWork(sub.id, {
        certified_on: val.certified_on,
        amount: val.amount,
        description: val.description,
      })
      .subscribe({
        next: () => {
          this.message.success(this.translate.instant('CONSTRUCTION.SUBCONTRACT_CERTIFIED'));
          this.certifySubcontractModalVisible.set(false);
          this.loadSiteSubcontracts();
        },
        error: () => {
          this.message.error(this.translate.instant('CONSTRUCTION.ACTION_ERROR'));
        },
      });
  }

  getBidStatusColor(status: TradesBidStatus): string {
    switch (status) {
      case 'draft':
        return 'default';
      case 'submitted':
        return 'processing';
      case 'accepted':
        return 'success';
      case 'rejected':
        return 'error';
      default:
        return 'default';
    }
  }

  getCategoryColor(kind: string): string {
    switch (kind) {
      case 'safety_plan':
        return 'blue';
      case 'risk_assessment':
        return 'cyan';
      case 'compliance_certificate':
        return 'green';
      case 'insurance':
        return 'purple';
      case 'training_certificate':
        return 'geekblue';
      default:
        return 'default';
    }
  }
}
