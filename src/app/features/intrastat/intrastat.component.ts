import { UpperCasePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
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
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpaceModule } from 'ng-zorro-antd/space';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  IntrastatApiService,
  IntrastatCodeList,
  IntrastatDeclaration,
  IntrastatDeclarationLine,
  IntrastatDeclarationRequest,
  IntrastatFlow,
  IntrastatGenerateRequest,
  IntrastatLineRequest,
  IntrastatPeriodicity,
  IntrastatPeriodicityThresholds,
  IntrastatProductProfile,
  IntrastatProductProfileRequest,
  IntrastatSubmitRequest,
  TranslateService,
} from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';

/** Used until the code lists of the server arrive (or when they cannot be loaded). */
const FALLBACK_DELIVERY_TERM_GROUPS: Record<string, string[]> = {
  C: ['CFR', 'CIF', 'CPT', 'CIP'],
  D: ['DAP', 'DPU'],
  F: ['FCA', 'FAS', 'FOB'],
  E: ['EXW'],
};
const FALLBACK_TRANSPORT_MODES: Record<string, string> = {
  '3': 'Trasporto stradale',
  '1': 'Trasporto marittimo',
  '4': 'Trasporto aereo',
  '2': 'Trasporto ferroviario',
};

@Component({
  selector: 'app-intrastat',
  imports: [
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
    NzRadioModule,
    NzSwitchModule,
    NzAlertModule,
    NzIconModule,
    NzEmptyModule,
    PageHeaderComponent,
    MoneyPipe,
    TranslatePipe,
  ],
  templateUrl: './intrastat.component.html',
})
export class IntrastatComponent implements OnInit {
  private readonly api = inject(IntrastatApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly selectedTabIndex = signal<number>(0);
  readonly selectedYear = signal<number>(2026);
  readonly filterFlow = signal<string>('');

  // --- TAB 0: DECLARATIONS ---
  readonly declarations = signal<IntrastatDeclaration[]>([]);
  readonly declarationsLoading = signal<boolean>(false);
  readonly selectedDeclaration = signal<IntrastatDeclaration | null>(null);
  readonly drawerVisible = signal<boolean>(false);
  readonly createModalVisible = signal<boolean>(false);
  readonly submitModalVisible = signal<boolean>(false);
  readonly lineModalVisible = signal<boolean>(false);
  readonly selectedLine = signal<IntrastatDeclarationLine | null>(null);

  // --- TAB 1: GENERATION ---
  readonly generateLoading = signal<boolean>(false);

  // --- TAB 2: PERIODICITY & THRESHOLDS ---
  readonly periodicity = signal<IntrastatPeriodicityThresholds | null>(null);
  readonly periodicityLoading = signal<boolean>(false);

  // --- TAB 3: PRODUCT PROFILES ---
  readonly productProfiles = signal<IntrastatProductProfile[]>([]);
  readonly productProfilesLoading = signal<boolean>(false);
  readonly profileModalVisible = signal<boolean>(false);
  readonly selectedProductProfile = signal<IntrastatProductProfile | null>(null);

  // Code lists of the forms (Table C transport modes, Table D delivery term groups): the server owns them
  readonly codes = signal<IntrastatCodeList | null>(null);
  readonly deliveryTermOptions = computed(() =>
    Object.entries(this.codes()?.delivery_term_groups ?? FALLBACK_DELIVERY_TERM_GROUPS).map(([group, terms]) => ({
      value: group,
      label: `${group} - ${terms.join(' / ')}`,
    })),
  );
  readonly transportModeOptions = computed(() =>
    Object.entries(this.codes()?.transport_modes ?? FALLBACK_TRANSPORT_MODES).map(([code, label]) => ({
      value: code,
      label: `${code} - ${label}`,
    })),
  );

  // Export Dialog
  readonly exportModalVisible = signal<boolean>(false);
  readonly exportResult = signal<{ file_name: string; content?: string } | null>(null);

  // Derived metrics
  readonly totalSalesEur = computed(() =>
    this.declarations()
      .filter((d) => d.flow === 'sales')
      .reduce((sum, d) => sum + (d.sections?.reduce((s, sec) => s + (sec.total_eur || 0), 0) || 0), 0),
  );
  readonly totalPurchasesEur = computed(() =>
    this.declarations()
      .filter((d) => d.flow === 'purchases')
      .reduce((sum, d) => sum + (d.sections?.reduce((s, sec) => s + (sec.total_eur || 0), 0) || 0), 0),
  );
  readonly totalDraftCount = computed(
    () => this.declarations().filter((d) => d.status === 'draft').length,
  );
  readonly totalSubmittedCount = computed(
    () => this.declarations().filter((d) => d.status === 'submitted').length,
  );

  // Forms
  readonly createForm = this.fb.group({
    flow: ['sales' as IntrastatFlow, [Validators.required]],
    year: [2026, [Validators.required]],
    periodicity: ['M' as IntrastatPeriodicity, [Validators.required]],
    period: [3, [Validators.required]],
    reference_number: [1],
    content_code: [0],
    special_case_code: [0],
    includes_statistical_data: [false],
    has_annual_flows_above_20_million: [false],
    notes: [''],
  });

  readonly generateForm = this.fb.group({
    flow: ['sales' as IntrastatFlow, [Validators.required]],
    year: [2026, [Validators.required]],
    periodicity: ['M' as IntrastatPeriodicity, [Validators.required]],
    period: [3, [Validators.required]],
    unclassified_as: ['goods' as 'goods' | 'services'],
    transaction_nature_a: ['1'],
    delivery_terms: ['C'],
    transport_mode: ['3'],
    province_code: ['MI'],
  });

  readonly submitForm = this.fb.group({
    protocol_number: ['', [Validators.required]],
  });

  readonly lineForm = this.fb.group({
    section: [1, [Validators.required]],
    partner_country_code: ['DE', [Validators.required]],
    partner_vat_number: ['123456789'],
    amount_eur: [1000, [Validators.required]],
    cn8_code: ['84212100'],
    net_mass_kg: [50],
    delivery_terms: ['C'],
    transport_mode: ['3'],
  });

  readonly profileForm = this.fb.group({
    product_id: ['', [Validators.required]],
    cn8_code: ['', [Validators.required]],
    cpa_code: [''],
    origin_country_code: ['IT'],
    unit_of_measure: ['kg'],
  });

  ngOnInit(): void {
    this.loadDeclarations();
    this.loadPeriodicity();
    this.loadProductProfiles();
    this.api.getCodes().subscribe({ next: (res) => this.codes.set(res.data), error: () => this.codes.set(null) });
  }

  // --- TAB 0: DECLARATIONS ---
  loadDeclarations(): void {
    this.declarationsLoading.set(true);
    this.api
      .getDeclarations({
        flow: this.filterFlow() || undefined,
        year: this.selectedYear(),
      })
      .subscribe({
        next: (res) => {
          this.declarations.set(res?.data || []);
          this.declarationsLoading.set(false);
        },
        error: () => {
          this.declarationsLoading.set(false);
        },
      });
  }

  openCreateModal(): void {
    this.createForm.reset({
      flow: 'sales',
      year: this.selectedYear(),
      periodicity: 'M',
      period: 1,
      reference_number: 1,
      content_code: 0,
      special_case_code: 0,
      includes_statistical_data: false,
      has_annual_flows_above_20_million: false,
      notes: '',
    });
    this.createModalVisible.set(true);
  }

  submitCreateDeclaration(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }
    const val = this.createForm.getRawValue();
    const payload: IntrastatDeclarationRequest = {
      flow: val.flow,
      year: val.year,
      periodicity: val.periodicity,
      period: val.period,
      reference_number: val.reference_number || undefined,
      content_code: val.content_code,
      special_case_code: val.special_case_code,
      includes_statistical_data: val.includes_statistical_data,
      has_annual_flows_above_20_million: val.has_annual_flows_above_20_million,
      notes: val.notes || undefined,
    };

    this.api.createDeclaration(payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('INTRASTAT.DECLARATION_CREATED'));
        this.createModalVisible.set(false);
        this.loadDeclarations();
      },
      error: () => {
        this.message.error(this.translate.instant('INTRASTAT.ACTION_ERROR'));
      },
    });
  }

  validateDeclaration(d: IntrastatDeclaration): void {
    this.api.validateDeclaration(d.id).subscribe({
      next: (res) => {
        if (res.data?.is_valid) {
          this.message.success(this.translate.instant('INTRASTAT.VALIDATION_SUCCESS'));
        } else {
          this.message.warning(this.translate.instant('INTRASTAT.VALIDATION_WARNINGS'));
        }
        this.loadDeclarations();
      },
      error: () => {
        this.message.error(this.translate.instant('INTRASTAT.ACTION_ERROR'));
      },
    });
  }

  openSubmitModal(d: IntrastatDeclaration): void {
    this.selectedDeclaration.set(d);
    this.submitForm.reset({ protocol_number: 'PROT-DOGANE-' + Date.now().toString().slice(-6) });
    this.submitModalVisible.set(true);
  }

  confirmSubmit(): void {
    const d = this.selectedDeclaration();
    if (!d || this.submitForm.invalid) {
      this.submitForm.markAllAsTouched();
      return;
    }
    const val = this.submitForm.getRawValue();
    const payload: IntrastatSubmitRequest = { protocol_number: val.protocol_number };

    this.api.submitDeclaration(d.id, payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('INTRASTAT.SUBMITTED_SUCCESS'));
        this.submitModalVisible.set(false);
        this.loadDeclarations();
      },
      error: () => {
        this.message.error(this.translate.instant('INTRASTAT.ACTION_ERROR'));
      },
    });
  }

  exportScdata(d: IntrastatDeclaration): void {
    this.api.exportDeclaration({ declaration_id: d.id, format: 'scdata' }).subscribe({
      next: (res) => {
        this.exportResult.set(res?.data || null);
        this.exportModalVisible.set(true);
      },
      error: () => {
        this.message.error(this.translate.instant('INTRASTAT.ACTION_ERROR'));
      },
    });
  }

  deleteDeclaration(id: string): void {
    this.api.deleteDeclaration(id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('INTRASTAT.DECLARATION_DELETED'));
        this.loadDeclarations();
      },
      error: () => {
        this.message.error(this.translate.instant('INTRASTAT.ACTION_ERROR'));
      },
    });
  }

  openDeclarationDrawer(d: IntrastatDeclaration): void {
    this.api.getDeclaration(d.id).subscribe({
      next: (res) => {
        this.selectedDeclaration.set(res?.data || d);
        this.drawerVisible.set(true);
      },
      error: () => {
        this.selectedDeclaration.set(d);
        this.drawerVisible.set(true);
      },
    });
  }

  closeDeclarationDrawer(): void {
    this.drawerVisible.set(false);
    this.selectedDeclaration.set(null);
  }

  // Lines
  openAddLineModal(): void {
    this.selectedLine.set(null);
    this.lineForm.reset({
      section: 1,
      partner_country_code: 'DE',
      partner_vat_number: '',
      amount_eur: 1000,
      cn8_code: '84212100',
      net_mass_kg: 50,
      delivery_terms: 'C',
      transport_mode: '3',
    });
    this.lineModalVisible.set(true);
  }

  saveLine(): void {
    const d = this.selectedDeclaration();
    if (!d || this.lineForm.invalid) {
      this.lineForm.markAllAsTouched();
      return;
    }
    const val = this.lineForm.getRawValue();
    const payload: IntrastatLineRequest = {
      section: val.section,
      partner_country_code: val.partner_country_code,
      partner_vat_number: val.partner_vat_number || undefined,
      amount_eur: val.amount_eur,
      cn8_code: val.cn8_code || undefined,
      net_mass_kg: val.net_mass_kg || undefined,
      delivery_terms: val.delivery_terms || undefined,
      transport_mode: val.transport_mode || undefined,
    };

    this.api.addLine(d.id, payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('INTRASTAT.LINE_SAVED'));
        this.lineModalVisible.set(false);
        this.openDeclarationDrawer(d);
        this.loadDeclarations();
      },
      error: () => {
        this.message.error(this.translate.instant('INTRASTAT.ACTION_ERROR'));
      },
    });
  }

  deleteLine(lineId: string): void {
    const d = this.selectedDeclaration();
    if (!d) return;

    this.api.deleteLine(d.id, lineId).subscribe({
      next: () => {
        this.message.success(this.translate.instant('INTRASTAT.LINE_DELETED'));
        this.openDeclarationDrawer(d);
        this.loadDeclarations();
      },
      error: () => {
        this.message.error(this.translate.instant('INTRASTAT.ACTION_ERROR'));
      },
    });
  }

  // --- TAB 1: AUTO GENERATE ---
  executeAutoGenerate(): void {
    if (this.generateForm.invalid) {
      this.generateForm.markAllAsTouched();
      return;
    }
    this.generateLoading.set(true);
    const val = this.generateForm.getRawValue();

    const payload: IntrastatGenerateRequest = {
      flow: val.flow,
      year: val.year,
      periodicity: val.periodicity,
      period: val.period,
      unclassified_as: val.unclassified_as,
      defaults: {
        transaction_nature_a: val.transaction_nature_a,
        delivery_terms: val.delivery_terms,
        transport_mode: val.transport_mode,
        province_code: val.province_code,
      },
    };

    this.api.generateDeclaration(payload).subscribe({
      next: () => {
        this.generateLoading.set(false);
        this.message.success(this.translate.instant('INTRASTAT.GENERATE_SUCCESS'));
        this.selectedTabIndex.set(0);
        this.loadDeclarations();
      },
      error: () => {
        this.generateLoading.set(false);
        this.message.error(this.translate.instant('INTRASTAT.ACTION_ERROR'));
      },
    });
  }

  // --- TAB 2: PERIODICITY ---
  loadPeriodicity(): void {
    this.periodicityLoading.set(true);
    this.api.getPeriodicity(this.selectedYear()).subscribe({
      next: (res) => {
        this.periodicity.set(res?.data || null);
        this.periodicityLoading.set(false);
      },
      error: () => {
        this.periodicityLoading.set(false);
      },
    });
  }

  // --- TAB 3: PRODUCT PROFILES ---
  loadProductProfiles(): void {
    this.productProfilesLoading.set(true);
    this.api.getProductProfiles().subscribe({
      next: (res) => {
        this.productProfiles.set(res?.data || []);
        this.productProfilesLoading.set(false);
      },
      error: () => {
        this.productProfilesLoading.set(false);
      },
    });
  }

  openCreateProfileModal(): void {
    this.selectedProductProfile.set(null);
    this.profileForm.reset({
      product_id: '',
      cn8_code: '',
      cpa_code: '',
      origin_country_code: 'IT',
      unit_of_measure: 'kg',
    });
    this.profileModalVisible.set(true);
  }

  saveProductProfile(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }
    const val = this.profileForm.getRawValue();
    const payload: IntrastatProductProfileRequest = {
      cn8_code: val.cn8_code,
      cpa_code: val.cpa_code || undefined,
      origin_country_code: val.origin_country_code || undefined,
      unit_of_measure: val.unit_of_measure || undefined,
    };

    this.api.setProductProfile(val.product_id, payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('INTRASTAT.PROFILE_SAVED'));
        this.profileModalVisible.set(false);
        this.loadProductProfiles();
      },
      error: () => {
        this.message.error(this.translate.instant('INTRASTAT.ACTION_ERROR'));
      },
    });
  }

  deleteProductProfile(productId: string): void {
    this.api.deleteProductProfile(productId).subscribe({
      next: () => {
        this.message.success(this.translate.instant('INTRASTAT.PROFILE_DELETED'));
        this.loadProductProfiles();
      },
      error: () => {
        this.message.error(this.translate.instant('INTRASTAT.ACTION_ERROR'));
      },
    });
  }

  getStatusBadgeColor(status: string): string {
    switch (status) {
      case 'submitted':
        return 'success';
      case 'validated':
        return 'blue';
      case 'draft':
        return 'warning';
      default:
        return 'default';
    }
  }

  getFlowColor(flow: string): string {
    return flow === 'sales' ? 'blue' : 'orange';
  }
}
