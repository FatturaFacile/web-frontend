import { UpperCasePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpaceModule } from 'ng-zorro-antd/space';
import { NzTableModule, NzTableQueryParams } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AuthStore,
  CustomsApiService,
  CustomsAssessmentDecisionResource,
  CustomsDeclarationRequest,
  CustomsDeclarationResource,
  CustomsDeclarationStatus,
  CustomsDirection,
  CustomsDossierRequest,
  CustomsDossierResource,
  CustomsDossierStatus,
  CustomsProfitabilityResource,
  CustomsShipmentRequestResource,
  CustomsSignatureStatus,
  CustomsTariffGridResource,
  ShipmentRequestStatus,
  TranslateService,
} from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';

@Component({
  selector: 'app-customs',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    UpperCasePipe,
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
    NzIconModule,
    NzEmptyModule,
    NzSpaceModule,
    NzDescriptionsModule,
    MoneyPipe,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './customs.component.html',
  styleUrl: './customs.component.scss',
})
export class CustomsComponent implements OnInit {
  private readonly translate = inject(TranslateService);
  private readonly customsApi = inject(CustomsApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly message = inject(NzMessageService);
  readonly authStore = inject(AuthStore);

  readonly activeTabIndex = signal(0);

  // --- DOSSIERS STATE ---
  readonly loadingDossiers = signal(false);
  readonly dossiers = signal<CustomsDossierResource[]>([]);
  readonly totalDossiers = signal(0);
  readonly dossierPage = signal(1);
  readonly dossierPageSize = signal(10);
  readonly dossierSearch = signal('');
  readonly dossierStatusFilter = signal<CustomsDossierStatus | undefined>(undefined);

  // --- DECLARATIONS STATE ---
  readonly loadingDeclarations = signal(false);
  readonly declarations = signal<CustomsDeclarationResource[]>([]);
  readonly totalDeclarations = signal(0);
  readonly declarationPage = signal(1);
  readonly declarationPageSize = signal(10);
  readonly declarationSearch = signal('');

  // --- ASSESSMENTS STATE ---
  readonly loadingAssessments = signal(false);
  readonly retrievingAssessments = signal(false);
  readonly assessments = signal<CustomsAssessmentDecisionResource[]>([]);
  readonly totalAssessments = signal(0);
  readonly assessmentPage = signal(1);
  readonly assessmentPageSize = signal(10);
  readonly assessmentSearch = signal('');

  // --- TARIFF GRIDS & SHIPMENTS STATE ---
  readonly loadingGrids = signal(false);
  readonly tariffGrids = signal<CustomsTariffGridResource[]>([]);
  readonly loadingShipments = signal(false);
  readonly shipmentRequests = signal<CustomsShipmentRequestResource[]>([]);

  // --- MODALS & FORMS ---
  readonly createDossierModalVisible = signal(false);
  readonly submittingDossier = signal(false);
  readonly dossierForm = this.fb.group({
    customer_contact_id: this.fb.control('', [Validators.required]),
    direction: this.fb.control<CustomsDirection>('import', [Validators.required]),
    service_type: this.fb.control('standard_customs', [Validators.required]),
    currency: this.fb.control('CHF', [Validators.required]),
    origin_country: this.fb.control('IT'),
    destination_country: this.fb.control('CH'),
    incoterms: this.fb.control('DAP'),
    gross_weight_kg: this.fb.control(0),
    volume_m3: this.fb.control(0),
    packages: this.fb.control(1),
    notes: this.fb.control(''),
  });

  readonly createDeclarationModalVisible = signal(false);
  readonly submittingDeclaration = signal(false);
  readonly declarationForm = this.fb.group({
    declaration_type: this.fb.control<CustomsDirection>('import', [Validators.required]),
    trader_declaration_number: this.fb.control(''),
    trader_reference: this.fb.control(''),
    customs_office_number: this.fb.control('CH001234'),
    dispatch_country: this.fb.control('IT'),
    destination_country: this.fb.control('CH'),
  });

  readonly profitabilityModalVisible = signal(false);
  readonly profitabilityData = signal<CustomsProfitabilityResource | null>(null);

  ngOnInit(): void {
    this.loadDossiers();
  }

  onTabChange(index: number): void {
    this.activeTabIndex.set(index);
    if (index === 0 && this.dossiers().length === 0) {
      this.loadDossiers();
    } else if (index === 1 && this.declarations().length === 0) {
      this.loadDeclarations();
    } else if (index === 2 && this.assessments().length === 0) {
      this.loadAssessments();
    } else if (index === 3 && this.tariffGrids().length === 0) {
      this.loadGridsAndShipments();
    }
  }

  // --- DOSSIERS ACTIONS ---
  loadDossiers(page = this.dossierPage()): void {
    this.dossierPage.set(page);
    this.loadingDossiers.set(true);
    this.customsApi
      .getDossiers({
        page,
        per_page: this.dossierPageSize(),
        search: this.dossierSearch() || undefined,
        status: this.dossierStatusFilter() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.dossiers.set(res.data);
          this.totalDossiers.set(res.meta?.total ?? res.data.length);
          this.loadingDossiers.set(false);
        },
        error: () => this.loadingDossiers.set(false),
      });
  }

  onDossierTableQueryParams(params: NzTableQueryParams): void {
    const { pageIndex, pageSize } = params;
    this.dossierPageSize.set(pageSize);
    this.loadDossiers(pageIndex);
  }

  onDossierSearch(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.dossierSearch.set(val);
    this.loadDossiers(1);
  }

  openCreateDossierModal(): void {
    this.dossierForm.reset({
      customer_contact_id: '',
      direction: 'import',
      service_type: 'standard_customs',
      currency: this.authStore.activeCurrency() || 'CHF',
      origin_country: 'IT',
      destination_country: 'CH',
      incoterms: 'DAP',
      gross_weight_kg: 0,
      volume_m3: 0,
      packages: 1,
      notes: '',
    });
    this.createDossierModalVisible.set(true);
  }

  submitDossierForm(): void {
    if (this.dossierForm.invalid) {
      Object.values(this.dossierForm.controls).forEach((ctrl) => {
        if (ctrl.invalid) {
          ctrl.markAsDirty();
          ctrl.updateValueAndValidity({ onlySelf: true });
        }
      });
      return;
    }

    this.submittingDossier.set(true);
    const val = this.dossierForm.getRawValue();
    const payload: CustomsDossierRequest = {
      customer_contact_id: val.customer_contact_id,
      direction: val.direction,
      service_type: val.service_type,
      currency: val.currency,
      origin_country: val.origin_country,
      destination_country: val.destination_country,
      incoterms: val.incoterms,
      gross_weight_kg: Number(val.gross_weight_kg) || undefined,
      volume_m3: Number(val.volume_m3) || undefined,
      packages: Number(val.packages) || undefined,
      notes: val.notes,
    };

    this.customsApi.createDossier(payload).subscribe({
      next: () => {
        this.submittingDossier.set(false);
        this.createDossierModalVisible.set(false);
        this.message.success(this.translate.instant('CUSTOMS.MSG_PRATICA_DOGANALE_CREATA_CON_SUCCESSO'));
        this.loadDossiers(1);
      },
      error: () => this.submittingDossier.set(false),
    });
  }

  openProfitabilityModal(dossierId: string): void {
    this.customsApi.getDossierProfitability(dossierId).subscribe({
      next: (res) => {
        this.profitabilityData.set(res.data);
        this.profitabilityModalVisible.set(true);
      },
    });
  }

  invoiceDossier(dossierId: string): void {
    this.customsApi.invoiceDossier(dossierId).subscribe({
      next: () => {
        this.message.success(this.translate.instant('CUSTOMS.MSG_PRATICA_FATTURATA_CON_SUCCESSO'));
        this.loadDossiers();
      },
    });
  }

  // --- DECLARATIONS ACTIONS ---
  loadDeclarations(page = this.declarationPage()): void {
    this.declarationPage.set(page);
    this.loadingDeclarations.set(true);
    this.customsApi
      .getDeclarations({
        page,
        per_page: this.declarationPageSize(),
        search: this.declarationSearch() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.declarations.set(res.data);
          this.totalDeclarations.set(res.meta?.total ?? res.data.length);
          this.loadingDeclarations.set(false);
        },
        error: () => this.loadingDeclarations.set(false),
      });
  }

  onDeclarationTableQueryParams(params: NzTableQueryParams): void {
    const { pageIndex, pageSize } = params;
    this.declarationPageSize.set(pageSize);
    this.loadDeclarations(pageIndex);
  }

  onDeclarationSearch(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.declarationSearch.set(val);
    this.loadDeclarations(1);
  }

  openCreateDeclarationModal(): void {
    this.declarationForm.reset({
      declaration_type: 'import',
      trader_declaration_number: `DEC-${Date.now().toString().slice(-6)}`,
      trader_reference: '',
      customs_office_number: 'CH001234',
      dispatch_country: 'IT',
      destination_country: 'CH',
    });
    this.createDeclarationModalVisible.set(true);
  }

  submitDeclarationForm(): void {
    if (this.declarationForm.invalid) {
      return;
    }

    this.submittingDeclaration.set(true);
    const val = this.declarationForm.getRawValue();
    const payload: CustomsDeclarationRequest = {
      declaration_type: val.declaration_type,
      trader_declaration_number: val.trader_declaration_number,
      trader_reference: val.trader_reference,
      customs_office_number: val.customs_office_number,
      dispatch_country: val.dispatch_country,
      destination_country: val.destination_country,
    };

    this.customsApi.createDeclaration(payload).subscribe({
      next: () => {
        this.submittingDeclaration.set(false);
        this.createDeclarationModalVisible.set(false);
        this.message.success(this.translate.instant('CUSTOMS.MSG_DICHIARAZIONE_DOGANALE_CREATA_CON_SUCCESSO'));
        this.loadDeclarations(1);
      },
      error: () => this.submittingDeclaration.set(false),
    });
  }

  validateDeclaration(id: string): void {
    this.customsApi.validateDeclaration(id).subscribe({
      next: (res) => {
        this.message.success(this.translate.instant('CUSTOMS.MSG_DICHIARAZIONE_VALIDATA', { status: res.data.status }));
        this.loadDeclarations();
      },
    });
  }

  submitDeclaration(id: string): void {
    this.customsApi.submitDeclaration(id).subscribe({
      next: (res) => {
        this.message.success(this.translate.instant('CUSTOMS.MSG_DICHIARAZIONE_INVIATA_CON_SUCCESSO_MRN', { mrn: res.data.mrn }));
        this.loadDeclarations();
      },
    });
  }

  cancelDeclaration(id: string): void {
    this.customsApi.cancelDeclaration(id).subscribe({
      next: () => {
        this.message.info(this.translate.instant('CUSTOMS.MSG_DICHIARAZIONE_ANNULLATA'));
        this.loadDeclarations();
      },
    });
  }

  downloadDeclarationPdf(id: string): void {
    this.customsApi.downloadDeclarationPdf(id).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `customs_declaration_${id}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
    });
  }

  // --- ASSESSMENTS ACTIONS ---
  loadAssessments(page = this.assessmentPage()): void {
    this.assessmentPage.set(page);
    this.loadingAssessments.set(true);
    this.customsApi
      .getAssessmentDecisions({
        page,
        per_page: this.assessmentPageSize(),
        mrn: this.assessmentSearch() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.assessments.set(res.data);
          this.totalAssessments.set(res.meta?.total ?? res.data.length);
          this.loadingAssessments.set(false);
        },
        error: () => this.loadingAssessments.set(false),
      });
  }

  onAssessmentTableQueryParams(params: NzTableQueryParams): void {
    const { pageIndex, pageSize } = params;
    this.assessmentPageSize.set(pageSize);
    this.loadAssessments(pageIndex);
  }

  onAssessmentSearch(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.assessmentSearch.set(val);
    this.loadAssessments(1);
  }

  retrieveAssessments(): void {
    this.retrievingAssessments.set(true);
    this.customsApi.retrieveAssessmentDecisions().subscribe({
      next: (res) => {
        this.retrievingAssessments.set(false);
        this.message.success(this.translate.instant('CUSTOMS.MSG_RECUPERATE_DECISIONI_D_IMPOSIZIONE_EVV', { retrieved_count: res.data.retrieved_count }));
        this.loadAssessments(1);
      },
      error: () => this.retrievingAssessments.set(false),
    });
  }

  downloadAssessmentPdf(id: string): void {
    this.customsApi.downloadAssessmentPdf(id).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `assessment_eVV_${id}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
    });
  }

  // --- TARIFF GRIDS & SHIPMENTS ACTIONS ---
  loadGridsAndShipments(): void {
    this.loadingGrids.set(true);
    this.customsApi.getTariffGrids().subscribe({
      next: (res) => {
        this.tariffGrids.set(res.data);
        this.loadingGrids.set(false);
      },
      error: () => this.loadingGrids.set(false),
    });

    this.loadingShipments.set(true);
    this.customsApi.getShipmentRequests().subscribe({
      next: (res) => {
        this.shipmentRequests.set(res.data);
        this.loadingShipments.set(false);
      },
      error: () => this.loadingShipments.set(false),
    });
  }

  openCreateGridModal(): void {
    this.customsApi
      .createTariffGrid({
        name: `Grid ${this.authStore.activeCurrency() || 'CHF'} Standard`,
        service_type: 'freight_customs',
        currency: this.authStore.activeCurrency() || 'CHF',
        is_active: true,
      })
      .subscribe({
        next: () => {
          this.message.success(this.translate.instant('CUSTOMS.MSG_GRIGLIA_TARIFFARIA_CREATA'));
          this.loadGridsAndShipments();
        },
      });
  }

  deleteTariffGrid(id: string): void {
    this.customsApi.deleteTariffGrid(id).subscribe({
      next: () => {
        this.message.info(this.translate.instant('CUSTOMS.MSG_GRIGLIA_TARIFFARIA_ELIMINATA'));
        this.loadGridsAndShipments();
      },
    });
  }

  acceptShipmentRequest(id: string): void {
    this.customsApi.acceptShipmentRequest(id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('CUSTOMS.MSG_RICHIESTA_DI_SPEDIZIONE_ACCETTATA'));
        this.loadGridsAndShipments();
      },
    });
  }

  refuseShipmentRequest(id: string): void {
    this.customsApi.refuseShipmentRequest(id).subscribe({
      next: () => {
        this.message.info(this.translate.instant('CUSTOMS.MSG_RICHIESTA_DI_SPEDIZIONE_RIFIUTATA'));
        this.loadGridsAndShipments();
      },
    });
  }

  // --- COLOR HELPERS ---
  getDirectionColor(direction: CustomsDirection): string {
    switch (direction) {
      case 'import':
        return 'blue';
      case 'export':
        return 'green';
      case 'transit':
        return 'purple';
      default:
        return 'default';
    }
  }

  getDossierStatusColor(status: CustomsDossierStatus): string {
    switch (status) {
      case 'open':
        return 'cyan';
      case 'quoted':
        return 'gold';
      case 'in_transit':
        return 'blue';
      case 'delivered':
        return 'geekblue';
      case 'invoiced':
        return 'green';
      case 'closed':
        return 'default';
      case 'cancelled':
        return 'red';
      default:
        return 'default';
    }
  }

  getDeclarationStatusColor(status: CustomsDeclarationStatus): string {
    switch (status) {
      case 'draft':
        return 'default';
      case 'validated':
        return 'processing';
      case 'submitted':
        return 'orange';
      case 'accepted':
        return 'success';
      case 'rejected':
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  }

  getSignatureStatusColor(status: CustomsSignatureStatus): string {
    switch (status) {
      case 'verified':
        return 'green';
      case 'invalid':
        return 'red';
      case 'not_signed':
        return 'orange';
      default:
        return 'default';
    }
  }

  getShipmentStatusColor(status: ShipmentRequestStatus): string {
    switch (status) {
      case 'pending':
        return 'gold';
      case 'accepted':
        return 'green';
      case 'refused':
        return 'red';
      default:
        return 'default';
    }
  }
}
