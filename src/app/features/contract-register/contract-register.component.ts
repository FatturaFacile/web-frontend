import { DatePipe, UpperCasePipe } from '@angular/common';
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
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpaceModule } from 'ng-zorro-antd/space';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule, NzTableQueryParams } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AuthStore,
  ContractAlertResource,
  ContractKind,
  ContractObligationResource,
  ContractObligationStatus,
  ContractPartyResource,
  ContractRegisterApiService,
  ContractRegisterParams,
  ContractResource,
  ContractSaveObligationRequest,
  ContractSavePartyRequest,
  ContractStatus,
  ContractStatusChangeResource,
  RenewContractRequest,
  StoreContractRequest,
  TranslateService,
} from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';

@Component({
  selector: 'app-contract-register',
  imports: [
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
    NzSwitchModule,
    NzFormModule,
    NzModalModule,
    NzDrawerModule,
    NzDescriptionsModule,
    NzSpaceModule,
    NzIconModule,
    NzEmptyModule,
    PageHeaderComponent,
    MoneyPipe,
    TranslatePipe,
  ],
  templateUrl: './contract-register.component.html',
  styleUrls: ['./contract-register.component.scss'],
})
export class ContractRegisterComponent implements OnInit {
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly contractApi = inject(ContractRegisterApiService);
  private readonly message = inject(NzMessageService);
  protected readonly authStore = inject(AuthStore);

  // Active tab index (0: Register, 1: Obligations, 2: Alerts)
  protected selectedTabIndex = signal<number>(0);

  // --- TAB 1: CONTRACTS REGISTER ---
  protected readonly contracts = signal<ContractResource[]>([]);
  protected readonly contractsLoading = signal<boolean>(false);
  protected readonly contractsTotal = signal<number>(0);
  protected readonly contractsPageIndex = signal<number>(1);
  protected readonly contractsPageSize = signal<number>(10);
  protected readonly searchKeyword = signal<string>('');
  protected readonly filterKind = signal<ContractKind | ''>('');
  protected readonly filterStatus = signal<ContractStatus | ''>('');

  // Create Contract Modal
  protected createModalVisible = signal<boolean>(false);
  protected createSubmitting = signal<boolean>(false);
  protected readonly contractForm = this.fb.group({
    kind: ['customer' as ContractKind, [Validators.required]],
    counterparty_id: ['', [Validators.required]],
    contract_number: ['', [Validators.required]],
    title: ['', [Validators.required]],
    start_date: ['', [Validators.required]],
    end_date: [''],
    notice_period_days: [30, [Validators.min(0)]],
    auto_renew: [false],
    renewal_term_months: [12],
    currency: ['CHF', [Validators.required]],
    total_value: ['0.00'],
  });

  // Renew Contract Modal
  protected renewModalVisible = signal<boolean>(false);
  protected renewContractTarget = signal<ContractResource | null>(null);
  protected renewSubmitting = signal<boolean>(false);
  protected readonly renewForm = this.fb.group({
    new_end_date: ['', [Validators.required]],
    renewal_term_months: [12, [Validators.required, Validators.min(1)]],
    revised_value: [''],
  });

  // Send Notice / Disdetta Modal
  protected noticeModalVisible = signal<boolean>(false);
  protected noticeContractTarget = signal<ContractResource | null>(null);
  protected noticeDate = signal<string>('');
  protected noticeReason = signal<string>('');
  protected noticeSubmitting = signal<boolean>(false);

  // Detail Drawer
  protected drawerVisible = signal<boolean>(false);
  protected selectedContract = signal<ContractResource | null>(null);
  protected contractParties = signal<ContractPartyResource[]>([]);
  protected contractObligations = signal<ContractObligationResource[]>([]);
  protected contractHistory = signal<ContractStatusChangeResource[]>([]);
  protected drawerLoading = signal<boolean>(false);

  // Add Party Modal inside Drawer
  protected partyModalVisible = signal<boolean>(false);
  protected readonly partyForm = this.fb.group({
    role: ['cliente', [Validators.required]],
    name: ['', [Validators.required]],
    contact_email: ['', [Validators.email]],
    vat_number: [''],
  });

  // Add Obligation Modal inside Drawer
  protected obligationModalVisible = signal<boolean>(false);
  protected readonly obligationForm = this.fb.group({
    type: ['obligation' as const, [Validators.required]],
    title: ['', [Validators.required]],
    description: [''],
    due_date: ['', [Validators.required]],
    responsible_party: [''],
    penalty_amount: ['0.00'],
  });

  // --- TAB 2: GLOBAL OBLIGATIONS ---
  protected readonly globalObligations = signal<ContractObligationResource[]>([]);
  protected readonly obligationsLoading = signal<boolean>(false);
  protected readonly obligationsTotal = signal<number>(0);
  protected readonly obligationsPageIndex = signal<number>(1);
  protected readonly obligationsPageSize = signal<number>(10);
  protected readonly obligationStatusFilter = signal<ContractObligationStatus | ''>('');

  // Complete / Waive Obligation Modal
  protected actionObligationTarget = signal<ContractObligationResource | null>(null);
  protected completeModalVisible = signal<boolean>(false);
  protected completeNotes = signal<string>('');
  protected waiveModalVisible = signal<boolean>(false);
  protected waiveReason = signal<string>('');

  // --- TAB 3: CONTRACT ALERTS ---
  protected readonly alerts = signal<ContractAlertResource[]>([]);
  protected readonly alertsLoading = signal<boolean>(false);

  ngOnInit(): void {
    this.loadContracts();
  }

  protected onTabChange(index: number): void {
    this.selectedTabIndex.set(index);
    if (index === 0) {
      this.loadContracts();
    } else if (index === 1) {
      this.loadGlobalObligations();
    } else if (index === 2) {
      this.loadAlerts();
    }
  }

  // --- CONTRACTS LOGIC ---
  protected loadContracts(): void {
    this.contractsLoading.set(true);
    const params: ContractRegisterParams = {
      kind: (this.filterKind() || undefined) as ContractKind | undefined,
      status: (this.filterStatus() || undefined) as ContractStatus | undefined,
      search: this.searchKeyword() || undefined,
      page: this.contractsPageIndex(),
      per_page: this.contractsPageSize(),
    };

    this.contractApi.getContracts(params).subscribe({
      next: (res) => {
        this.contracts.set(res.data);
        this.contractsTotal.set(res.meta?.total ?? res.data.length);
        this.contractsLoading.set(false);
      },
      error: () => {
        this.message.error(this.translate.instant('CONTRACTS.MSG_ERRORE_NEL_CARICAMENTO_DEL_REGISTRO_CONTRATTI'));
        this.contractsLoading.set(false);
      },
    });
  }

  protected onContractsTableQueryChange(params: NzTableQueryParams): void {
    this.contractsPageIndex.set(params.pageIndex);
    this.contractsPageSize.set(params.pageSize);
    this.loadContracts();
  }

  protected openCreateModal(): void {
    this.contractForm.reset({
      kind: 'customer',
      counterparty_id: '',
      contract_number: `CTR-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
      title: '',
      start_date: new Date().toISOString().slice(0, 10),
      end_date: '',
      notice_period_days: 30,
      auto_renew: false,
      renewal_term_months: 12,
      currency: 'CHF',
      total_value: '0.00',
    });
    this.createModalVisible.set(true);
  }

  protected submitCreateContract(): void {
    if (this.contractForm.invalid) {
      this.contractForm.markAllAsTouched();
      return;
    }

    const payload: StoreContractRequest = this.contractForm.getRawValue();
    this.createSubmitting.set(true);

    this.contractApi.createContract(payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('CONTRACTS.MSG_CONTRATTO_REGISTRATO_CON_SUCCESSO'));
        this.createModalVisible.set(false);
        this.createSubmitting.set(false);
        this.loadContracts();
      },
      error: () => {
        this.message.error(this.translate.instant('CONTRACTS.MSG_ERRORE_DURANTE_LA_CREAZIONE_DEL_CONTRATTO'));
        this.createSubmitting.set(false);
      },
    });
  }

  // --- RENEW CONTRACT ---
  protected openRenewModal(contract: ContractResource): void {
    this.renewContractTarget.set(contract);
    this.renewForm.reset({
      new_end_date: '',
      renewal_term_months: contract.renewal_term_months || 12,
      revised_value: contract.total_value || '',
    });
    this.renewModalVisible.set(true);
  }

  protected submitRenewContract(): void {
    const contract = this.renewContractTarget();
    if (!contract || this.renewForm.invalid) return;

    const payload: RenewContractRequest = this.renewForm.getRawValue();
    this.renewSubmitting.set(true);

    this.contractApi.renewContract(contract.kind, contract.id, payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('CONTRACTS.MSG_CONTRATTO_RINNOVATO_CON_SUCCESSO'));
        this.renewModalVisible.set(false);
        this.renewSubmitting.set(false);
        this.loadContracts();
      },
      error: () => {
        this.message.error(this.translate.instant('CONTRACTS.MSG_ERRORE_DURANTE_IL_RINNOVO_DEL_CONTRATTO'));
        this.renewSubmitting.set(false);
      },
    });
  }

  // --- SEND NOTICE / DISDETTA ---
  protected openNoticeModal(contract: ContractResource): void {
    this.noticeContractTarget.set(contract);
    this.noticeDate.set(new Date().toISOString().slice(0, 10));
    this.noticeReason.set('');
    this.noticeModalVisible.set(true);
  }

  protected submitNotice(): void {
    const contract = this.noticeContractTarget();
    if (!contract) return;

    this.noticeSubmitting.set(true);
    this.contractApi
      .sendNotice(contract.kind, contract.id, {
        notice_date: this.noticeDate(),
        reason: this.noticeReason() || undefined,
      })
      .subscribe({
        next: () => {
          this.message.success(this.translate.instant('CONTRACTS.MSG_PREAVVISO_DI_DISDETTA_REGISTRATO'));
          this.noticeModalVisible.set(false);
          this.noticeSubmitting.set(false);
          this.loadContracts();
        },
        error: () => {
          this.message.error(this.translate.instant('CONTRACTS.MSG_ERRORE_DURANTE_LA_REGISTRAZIONE_DELLA_DISDETTA'));
          this.noticeSubmitting.set(false);
        },
      });
  }

  // --- DRAWER & DETAILS ---
  protected openDrawer(contract: ContractResource): void {
    this.selectedContract.set(contract);
    this.drawerVisible.set(true);
    this.drawerLoading.set(true);

    this.contractApi.getParties(contract.kind, contract.id).subscribe({
      next: (res) => this.contractParties.set(res.data),
      error: () => this.contractParties.set([]),
    });

    this.contractApi.getContractObligations(contract.kind, contract.id).subscribe({
      next: (res) => this.contractObligations.set(res.data),
      error: () => this.contractObligations.set([]),
    });

    this.contractApi.getContractHistory(contract.kind, contract.id).subscribe({
      next: (res) => {
        this.contractHistory.set(res.data);
        this.drawerLoading.set(false);
      },
      error: () => {
        this.contractHistory.set([]);
        this.drawerLoading.set(false);
      },
    });
  }

  protected openPartyModal(): void {
    this.partyForm.reset({
      role: 'contraente',
      name: '',
      contact_email: '',
      vat_number: '',
    });
    this.partyModalVisible.set(true);
  }

  protected submitParty(): void {
    const contract = this.selectedContract();
    if (!contract || this.partyForm.invalid) return;

    const payload: ContractSavePartyRequest = this.partyForm.getRawValue();
    this.contractApi.addParty(contract.kind, contract.id, payload).subscribe({
      next: (res) => {
        this.message.success(this.translate.instant('CONTRACTS.MSG_PARTE_CONTRATTUALE_AGGIUNTA'));
        this.contractParties.update((list) => [...list, res.data]);
        this.partyModalVisible.set(false);
      },
      error: () => this.message.error(this.translate.instant('CONTRACTS.MSG_ERRORE_DURANTE_L_AGGIUNTA_DELLA_PARTE')),
    });
  }

  protected deleteParty(party: ContractPartyResource): void {
    const contract = this.selectedContract();
    if (!contract) return;

    this.contractApi.deleteParty(contract.kind, contract.id, party.id).subscribe({
      next: () => {
        this.message.info(this.translate.instant('CONTRACTS.MSG_PARTE_RIMOSSA'));
        this.contractParties.update((list) => list.filter((p) => p.id !== party.id));
      },
      error: () => this.message.error(this.translate.instant('CONTRACTS.MSG_IMPOSSIBILE_RIMUOVERE_LA_PARTE')),
    });
  }

  protected openObligationModal(): void {
    this.obligationForm.reset({
      type: 'obligation',
      title: '',
      description: '',
      due_date: new Date().toISOString().slice(0, 10),
      responsible_party: '',
      penalty_amount: '0.00',
    });
    this.obligationModalVisible.set(true);
  }

  protected submitObligation(): void {
    const contract = this.selectedContract();
    if (!contract || this.obligationForm.invalid) return;

    const payload: ContractSaveObligationRequest = this.obligationForm.getRawValue();
    this.contractApi.addObligation(contract.kind, contract.id, payload).subscribe({
      next: (res) => {
        this.message.success(this.translate.instant('CONTRACTS.MSG_OBBLIGAZIONE_CONTRATTUALE_AGGIUNTA'));
        this.contractObligations.update((list) => [...list, res.data]);
        this.obligationModalVisible.set(false);
      },
      error: () => this.message.error(this.translate.instant('CONTRACTS.MSG_ERRORE_DURANTE_L_AGGIUNTA_DELL_OBBLIGAZIONE')),
    });
  }

  // --- TAB 2: GLOBAL OBLIGATIONS LOGIC ---
  protected loadGlobalObligations(): void {
    this.obligationsLoading.set(true);
    this.contractApi
      .getAllObligations({
        status: (this.obligationStatusFilter() || undefined) as ContractObligationStatus | undefined,
        page: this.obligationsPageIndex(),
        per_page: this.obligationsPageSize(),
      })
      .subscribe({
        next: (res) => {
          this.globalObligations.set(res.data);
          this.obligationsTotal.set(res.meta?.total ?? res.data.length);
          this.obligationsLoading.set(false);
        },
        error: () => {
          this.message.error(this.translate.instant('CONTRACTS.MSG_ERRORE_NEL_CARICAMENTO_DELLE_OBBLIGAZIONI_CONTRATTUALI'));
          this.obligationsLoading.set(false);
        },
      });
  }

  protected onObligationsTableQueryChange(params: NzTableQueryParams): void {
    this.obligationsPageIndex.set(params.pageIndex);
    this.obligationsPageSize.set(params.pageSize);
    this.loadGlobalObligations();
  }

  protected openCompleteObligationModal(ob: ContractObligationResource): void {
    this.actionObligationTarget.set(ob);
    this.completeNotes.set('');
    this.completeModalVisible.set(true);
  }

  protected submitCompleteObligation(): void {
    const ob = this.actionObligationTarget();
    if (!ob) return;

    this.contractApi
      .completeObligation(ob.id, {
        completed_at: new Date().toISOString(),
        notes: this.completeNotes() || undefined,
      })
      .subscribe({
        next: () => {
          this.message.success(this.translate.instant('CONTRACTS.MSG_OBBLIGAZIONE_CONTRATTUALE_COMPLETATA'));
          this.completeModalVisible.set(false);
          this.loadGlobalObligations();
        },
        error: () => this.message.error(this.translate.instant('CONTRACTS.MSG_ERRORE_DURANTE_IL_COMPLETAMENTO_DELL_OBBLIGAZIONE')),
      });
  }

  protected openWaiveObligationModal(ob: ContractObligationResource): void {
    this.actionObligationTarget.set(ob);
    this.waiveReason.set('');
    this.waiveModalVisible.set(true);
  }

  protected submitWaiveObligation(): void {
    const ob = this.actionObligationTarget();
    if (!ob) return;

    this.contractApi.waiveObligation(ob.id, { reason: this.waiveReason() || undefined }).subscribe({
      next: () => {
        this.message.info(this.translate.instant('CONTRACTS.MSG_OBBLIGAZIONE_CONTRATTUALE_CONDONATA_WAIVED'));
        this.waiveModalVisible.set(false);
        this.loadGlobalObligations();
      },
      error: () => this.message.error(this.translate.instant('CONTRACTS.MSG_ERRORE_DURANTE_LA_RINUNCIA_ALL_OBBLIGAZIONE')),
    });
  }

  // --- TAB 3: CONTRACT ALERTS LOGIC ---
  protected loadAlerts(): void {
    this.alertsLoading.set(true);
    this.contractApi.getAlerts().subscribe({
      next: (res) => {
        this.alerts.set(res.data);
        this.alertsLoading.set(false);
      },
      error: () => {
        this.message.error(this.translate.instant('CONTRACTS.MSG_ERRORE_NEL_CARICAMENTO_DEGLI_AVVISI_CONTRATTUALI'));
        this.alertsLoading.set(false);
      },
    });
  }

  protected acknowledgeAlert(alert: ContractAlertResource): void {
    this.contractApi.acknowledgeAlert(alert.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('CONTRACTS.MSG_PRESA_VISIONE_CONFERMATA'));
        alert.is_acknowledged = true;
      },
      error: () => this.message.error(this.translate.instant('CONTRACTS.MSG_ERRORE_DURANTE_LA_CONFERMA')),
    });
  }

  // --- HELPERS ---
  protected getStatusColor(status: string): string {
    switch (status?.toLowerCase()) {
      case 'active':
      case 'completed':
        return 'success';
      case 'draft':
      case 'pending':
        return 'warning';
      case 'renewed':
        return 'processing';
      case 'expired':
      case 'terminated':
      case 'overdue':
        return 'error';
      case 'waived':
        return 'default';
      default:
        return 'default';
    }
  }
}
