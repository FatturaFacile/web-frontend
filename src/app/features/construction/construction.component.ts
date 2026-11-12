import { CurrencyPipe, DatePipe, UpperCasePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
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
  ConstructionApiService,
  ConstructionProgressBilling,
  ConstructionProgressBillingPayload,
  ConstructionSite,
  ConstructionSiteRequest,
  TradesBid,
  TradesBidPosition,
  TradesBidPositionRequest,
  TradesBidRequest,
  TradesBidStatus,
  TradesBilling,
  TradesBillingRequest,
  TradesBudgetControl,
  TradesMeasurementRequest,
  TradesSiteDiaryEntry,
  TradesSiteDiaryRequest,
  TradesSiteDocument,
  TradesSiteDocumentRequest,
  TradesSubcontract,
  TradesSubcontractor,
  TradesSubcontractorRequest,
  TradesSubcontractRequest,
  TranslateService,
} from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';

@Component({
  selector: 'app-construction',
  imports: [
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
    NzDrawerModule,
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
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly selectedTabIndex = signal<number>(0);

  // --- TAB 1: SITES & PROGRESS BILLINGS (SAL) ---
  readonly sites = signal<ConstructionSite[]>([]);
  readonly sitesLoading = signal<boolean>(false);
  readonly progressBillings = signal<ConstructionProgressBilling[]>([]);

  // --- TAB 2: TRADES BIDS (OFFERTE & APPALTI) ---
  readonly bids = signal<TradesBid[]>([]);
  readonly bidsLoading = signal<boolean>(false);
  readonly filterBidStatus = signal<string>('');
  readonly filterBidSearch = signal<string>('');

  // Bid Detail Drawer
  readonly drawerVisible = signal<boolean>(false);
  readonly selectedBid = signal<TradesBid | null>(null);
  readonly bidPositions = signal<TradesBidPosition[]>([]);
  readonly bidBillings = signal<TradesBilling[]>([]);
  readonly budgetControl = signal<TradesBudgetControl | null>(null);
  readonly drawerLoading = signal<boolean>(false);

  // --- TAB 3: SITE DIARY (GIORNALE DEI LAVORI) ---
  readonly selectedDiarySiteId = signal<string>('');
  readonly diaryEntries = signal<TradesSiteDiaryEntry[]>([]);
  readonly diaryLoading = signal<boolean>(false);

  // --- TAB 4: DOCUMENTS & SAFETY (POS / DURC) ---
  readonly siteDocuments = signal<TradesSiteDocument[]>([]);
  readonly expiringDocuments = signal<TradesSiteDocument[]>([]);
  readonly documentsLoading = signal<boolean>(false);

  // --- TAB 5: SUBCONTRACTS (SUBAPPALTI) ---
  readonly subcontractors = signal<TradesSubcontractor[]>([]);
  readonly subcontracts = signal<TradesSubcontract[]>([]);
  readonly subcontractsLoading = signal<boolean>(false);

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
    code: ['', [Validators.required]],
    client: ['', [Validators.required]],
    location: ['', [Validators.required]],
    regime: ['CH', [Validators.required]],
  });

  readonly salForm = this.fb.group({
    construction_site_id: ['', [Validators.required]],
    sal_number: ['', [Validators.required]],
    period_start: [new Date().toISOString().substring(0, 10), [Validators.required]],
    period_end: [new Date().toISOString().substring(0, 10), [Validators.required]],
    gross_certified_amount: [100000, [Validators.required, Validators.min(1)]],
    retention_percentage: [10],
  });

  readonly bidForm = this.fb.group({
    code: ['', [Validators.required]],
    title: ['', [Validators.required]],
    site_id: [''],
    client_name: [''],
    currency: ['CHF', [Validators.required]],
  });

  readonly positionForm = this.fb.group({
    code: [''],
    description: ['', [Validators.required]],
    unit: ['m²', [Validators.required]],
    quantity: [1, [Validators.required, Validators.min(0.01)]],
    unit_price: ['0.00', [Validators.required]],
  });

  readonly measurementForm = this.fb.group({
    position_id: [''],
    date: [new Date().toISOString().substring(0, 10), [Validators.required]],
    description: ['', [Validators.required]],
    quantity: [1, [Validators.required, Validators.min(0.01)]],
    notes: [''],
  });

  readonly bidBillingForm = this.fb.group({
    sal_number: ['SAL-1', [Validators.required]],
    date: [new Date().toISOString().substring(0, 10), [Validators.required]],
    amount: ['50000.00', [Validators.required]],
    retention_amount: ['5000.00'],
  });

  readonly diaryForm = this.fb.group({
    site_id: ['', [Validators.required]],
    date: [new Date().toISOString().substring(0, 10), [Validators.required]],
    weather_condition: ['Sereno 18°C', [Validators.required]],
    workers_count: [6, [Validators.required, Validators.min(1)]],
    equipment_notes: ['Gru a torre, betoniera, escavatore'],
    work_performed: ['', [Validators.required]],
    director_notes: [''],
  });

  readonly documentForm = this.fb.group({
    site_id: ['', [Validators.required]],
    title: ['', [Validators.required]],
    category: ['pos' as 'pos' | 'psc' | 'durc' | 'insurance' | 'compliance' | 'other', [Validators.required]],
    expires_at: [''],
  });

  readonly subcontractorForm = this.fb.group({
    company_name: ['', [Validators.required]],
    vat_number: ['', [Validators.required]],
    contact_email: [''],
    phone: [''],
    qualification: ['Opere di finitura e cartongesso'],
  });

  readonly subcontractForm = this.fb.group({
    site_id: ['', [Validators.required]],
    subcontractor_id: ['', [Validators.required]],
    scope_of_work: ['', [Validators.required]],
    contract_amount: ['25000.00', [Validators.required]],
  });

  readonly certifyForm = this.fb.group({
    amount: ['5000.00', [Validators.required]],
  });

  ngOnInit(): void {
    this.loadSites();
    this.loadBids();
    this.loadDocuments();
    this.loadSubcontractors();
  }

  // --- SITES & SAL METHODS ---
  loadSites(): void {
    this.sitesLoading.set(true);
    this.api.getSites().subscribe({
      next: (res) => {
        const data = res.data || [];
        this.sites.set(data);
        if (data.length > 0 && !this.selectedDiarySiteId()) {
          this.selectedDiarySiteId.set(data[0].id || '');
          this.loadDiary(data[0].id || '');
          this.loadSiteSubcontracts(data[0].id || '');
        }
        this.sitesLoading.set(false);
      },
      error: () => {
        this.sitesLoading.set(false);
        this.message.error(this.translate.instant('CONSTRUCTION.LOAD_ERROR'));
      },
    });

    this.api.getProgressBillings().subscribe({
      next: (res) => {
        this.progressBillings.set(res.data || []);
      },
    });
  }

  openCreateSiteModal(): void {
    this.siteForm.reset({
      code: '',
      client: '',
      location: '',
      regime: 'CH',
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
      code: val.code,
      client: val.client,
      location: val.location,
      regime: val.regime,
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
      period_start: new Date().toISOString().substring(0, 10),
      period_end: new Date().toISOString().substring(0, 10),
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
    this.bidsLoading.set(true);
    this.api.getBids().subscribe({
      next: (res) => {
        let list = res.data || [];
        const status = this.filterBidStatus();
        const search = this.filterBidSearch().toLowerCase().trim();
        if (status) {
          list = list.filter((b) => b.status === status);
        }
        if (search) {
          list = list.filter(
            (b) =>
              b.code.toLowerCase().includes(search) ||
              b.title.toLowerCase().includes(search) ||
              (b.client_name && b.client_name.toLowerCase().includes(search)),
          );
        }
        this.bids.set(list);
        this.bidsLoading.set(false);
      },
      error: () => {
        this.bidsLoading.set(false);
      },
    });
  }

  openCreateBidModal(): void {
    this.bidForm.reset({
      code: '',
      title: '',
      site_id: this.sites()[0]?.id || '',
      client_name: '',
      currency: 'CHF',
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
      code: val.code,
      title: val.title,
      site_id: val.site_id || undefined,
      client_name: val.client_name || undefined,
      currency: val.currency,
      status: 'submitted',
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
    this.bidPositions.set([]);
    this.bidBillings.set([]);
    this.budgetControl.set(null);
  }

  loadBidDetails(bidId: string): void {
    this.drawerLoading.set(true);
    this.api.getBid(bidId).subscribe({
      next: (res) => {
        this.selectedBid.set(res.data);
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
      code: '',
      description: '',
      unit: 'm²',
      quantity: 1,
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
    const payload: TradesBidPositionRequest = {
      code: val.code || undefined,
      description: val.description,
      unit: val.unit,
      quantity: Number(val.quantity),
      unit_price: val.unit_price,
    };

    this.api.addBidPosition(bid.id, payload).subscribe({
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
      position_id: positionId || '',
      date: new Date().toISOString().substring(0, 10),
      description: '',
      quantity: 1,
      notes: '',
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
    const payload: TradesMeasurementRequest = {
      position_id: val.position_id || undefined,
      date: val.date,
      description: val.description,
      quantity: Number(val.quantity),
      notes: val.notes || undefined,
    };

    this.api.recordMeasurement(bid.id, payload).subscribe({
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
      sal_number: `SAL-${(this.bidBillings().length || 0) + 1}`,
      date: new Date().toISOString().substring(0, 10),
      amount: '50000.00',
      retention_amount: '5000.00',
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
    const payload: TradesBillingRequest = {
      sal_number: val.sal_number,
      date: val.date,
      amount: val.amount,
      retention_amount: val.retention_amount || undefined,
    };

    this.api.issueBidBilling(bid.id, payload).subscribe({
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
  loadDiary(siteId: string): void {
    if (!siteId) return;
    this.diaryLoading.set(true);
    this.api.getSiteDiary(siteId).subscribe({
      next: (res) => {
        this.diaryEntries.set(res.data || []);
        this.diaryLoading.set(false);
      },
      error: () => {
        this.diaryLoading.set(false);
      },
    });
  }

  openCreateDiaryModal(): void {
    this.diaryForm.reset({
      site_id: this.selectedDiarySiteId() || this.sites()[0]?.id || '',
      date: new Date().toISOString().substring(0, 10),
      weather_condition: 'Sereno 18°C',
      workers_count: 6,
      equipment_notes: 'Gru a torre, betoniera, escavatore',
      work_performed: '',
      director_notes: '',
    });
    this.diaryModalVisible.set(true);
  }

  saveDiary(): void {
    if (this.diaryForm.invalid) {
      this.diaryForm.markAllAsTouched();
      return;
    }
    const val = this.diaryForm.getRawValue();
    const payload: TradesSiteDiaryRequest = {
      date: val.date,
      weather_condition: val.weather_condition,
      workers_count: Number(val.workers_count),
      equipment_notes: val.equipment_notes || undefined,
      work_performed: val.work_performed,
      director_notes: val.director_notes || undefined,
    };

    this.api.writeSiteDiary(val.site_id, payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('CONSTRUCTION.DIARY_SAVED'));
        this.diaryModalVisible.set(false);
        this.loadDiary(val.site_id);
      },
      error: () => {
        this.message.error(this.translate.instant('CONSTRUCTION.ACTION_ERROR'));
      },
    });
  }

  // --- DOCUMENTS METHODS ---
  loadDocuments(): void {
    this.documentsLoading.set(true);
    const siteId = this.selectedDiarySiteId() || this.sites()[0]?.id;
    if (siteId) {
      this.api.getSiteDocuments(siteId).subscribe({
        next: (res) => {
          this.siteDocuments.set(res.data || []);
          this.documentsLoading.set(false);
        },
        error: () => {
          this.documentsLoading.set(false);
        },
      });
    } else {
      this.documentsLoading.set(false);
    }

    this.api.getExpiringDocuments().subscribe({
      next: (res) => {
        this.expiringDocuments.set(res.data || []);
      },
    });
  }

  openCreateDocumentModal(): void {
    this.documentForm.reset({
      site_id: this.selectedDiarySiteId() || this.sites()[0]?.id || '',
      title: '',
      category: 'pos',
      expires_at: '',
    });
    this.documentModalVisible.set(true);
  }

  saveDocument(): void {
    if (this.documentForm.invalid) {
      this.documentForm.markAllAsTouched();
      return;
    }
    const val = this.documentForm.getRawValue();
    const payload: TradesSiteDocumentRequest = {
      title: val.title,
      category: val.category,
      expires_at: val.expires_at || undefined,
    };

    this.api.addSiteDocument(val.site_id, payload).subscribe({
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

  loadSiteSubcontracts(siteId: string): void {
    if (!siteId) return;
    this.subcontractsLoading.set(true);
    this.api.getSiteSubcontracts(siteId).subscribe({
      next: (res) => {
        this.subcontracts.set(res.data || []);
        this.subcontractsLoading.set(false);
      },
      error: () => {
        this.subcontractsLoading.set(false);
      },
    });
  }

  openCreateSubcontractorModal(): void {
    this.subcontractorForm.reset({
      company_name: '',
      vat_number: '',
      contact_email: '',
      phone: '',
      qualification: 'Opere da pittore e cartongessista',
    });
    this.subcontractorModalVisible.set(true);
  }

  saveSubcontractor(): void {
    if (this.subcontractorForm.invalid) {
      this.subcontractorForm.markAllAsTouched();
      return;
    }
    const val = this.subcontractorForm.getRawValue();
    const payload: TradesSubcontractorRequest = {
      company_name: val.company_name,
      vat_number: val.vat_number,
      contact_email: val.contact_email || undefined,
      phone: val.phone || undefined,
      qualification: val.qualification || undefined,
    };

    this.api.createSubcontractor(payload).subscribe({
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
      scope_of_work: '',
      contract_amount: '25000.00',
    });
    this.subcontractModalVisible.set(true);
  }

  saveSubcontract(): void {
    if (this.subcontractForm.invalid) {
      this.subcontractForm.markAllAsTouched();
      return;
    }
    const val = this.subcontractForm.getRawValue();
    const payload: TradesSubcontractRequest = {
      subcontractor_id: val.subcontractor_id,
      scope_of_work: val.scope_of_work,
      contract_amount: val.contract_amount,
    };

    this.api.createSiteSubcontract(val.site_id, payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('CONSTRUCTION.SUBCONTRACT_CREATED'));
        this.subcontractModalVisible.set(false);
        this.loadSiteSubcontracts(val.site_id);
      },
      error: () => {
        this.message.error(this.translate.instant('CONSTRUCTION.ACTION_ERROR'));
      },
    });
  }

  openCertifySubcontractModal(sub: TradesSubcontract): void {
    this.selectedSubcontract.set(sub);
    this.certifyForm.reset({
      amount: '5000.00',
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
    this.api.certifySubcontractWork(sub.id, { amount: val.amount }).subscribe({
      next: () => {
        this.message.success(this.translate.instant('CONSTRUCTION.SUBCONTRACT_CERTIFIED'));
        this.certifySubcontractModalVisible.set(false);
        this.loadSiteSubcontracts(sub.site_id);
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
      case 'awarded':
        return 'success';
      case 'rejected':
        return 'error';
      case 'closed':
        return 'geekblue';
      default:
        return 'default';
    }
  }

  getCategoryColor(cat: string): string {
    switch (cat) {
      case 'pos':
        return 'blue';
      case 'psc':
        return 'cyan';
      case 'durc':
        return 'green';
      case 'insurance':
        return 'purple';
      case 'compliance':
        return 'geekblue';
      default:
        return 'default';
    }
  }
}
