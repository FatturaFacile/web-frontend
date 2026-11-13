import { DatePipe, UpperCasePipe } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormGroup, FormsModule, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
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
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule, NzTableQueryParams } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AuthStore,
  I18nService,
  serverErrorMessage,
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
import { MoneyPipe, PageHeaderComponent, TranslatePipe, ModalActionsDirective, IconActionDirective } from '@shared';
import { decimalPattern } from '@shared/utils/decimal-validators';
import { endsNotBefore, revalidateOnStartChange } from '@shared/utils/date-validators';
import { uuidFormat } from '@shared/utils/uuid-validator';
import { validationTipKey } from '@shared/utils/validation-tip';

/** Roles of a party accepted by the API (ContractParty::Roles). */
const PARTY_ROLES = ['signatory', 'guarantor', 'subcontractor', 'witness', 'beneficiary', 'representative', 'other'] as const;

/** Kinds of party accepted by the API (ContractParty::Types). */
const PARTY_TYPES = ['contact', 'supplier', 'user', 'external'] as const;

/** Mirrors `required_with:<other>`: the control is required when the other control of the group is filled. */
function requiredWith(otherKey: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const other = control.parent?.get(otherKey)?.value;
    const filled = (value: unknown): boolean => value !== null && value !== undefined && String(value).trim() !== '';
    return filled(other) && !filled(control.value) ? { required: true } : null;
  };
}

@Component({
  selector: 'app-contract-register',
  styleUrl: './contract-register.component.scss',
  imports: [
    IconActionDirective,
    ModalActionsDirective,
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
    NzDescriptionsModule,
    NzSpaceModule,
    NzIconModule,
    NzEmptyModule,
    PageHeaderComponent,
    MoneyPipe,
    TranslatePipe,
  ],
  templateUrl: './contract-register.component.html',
})
export class ContractRegisterComponent implements OnInit {
  private readonly translate = inject(TranslateService);
  private readonly i18n = inject(I18nService);
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
    counterparty_id: ['', [Validators.required, uuidFormat]],
    contract_number: ['', [Validators.required, Validators.maxLength(60)]],
    title: ['', [Validators.required, Validators.maxLength(180)]],
    start_date: ['', [Validators.required]],
    end_date: ['', [endsNotBefore('start_date')]],
    notice_period_days: [30, [Validators.min(0), Validators.max(3650)]],
    auto_renew: [false],
    renewal_term_months: [12, [Validators.min(1), Validators.max(600)]],
    currency: ['CHF', [Validators.required, Validators.minLength(3), Validators.maxLength(3)]],
    contract_value: ['0.00', [decimalPattern(2)]],
  });

  // Renew Contract Modal
  protected renewModalVisible = signal<boolean>(false);
  protected renewContractTarget = signal<ContractResource | null>(null);
  protected renewSubmitting = signal<boolean>(false);
  protected readonly renewForm = this.fb.group({
    new_end_date: ['', [(control: AbstractControl<string>) => this.afterCurrentEnd(control)]],
  });

  // Send Notice / Disdetta Modal
  protected noticeModalVisible = signal<boolean>(false);
  protected noticeContractTarget = signal<ContractResource | null>(null);
  protected noticeDate = signal<string>('');
  /** Today (YYYY-MM-DD, local day): a notice cannot be dated in the future. */
  protected readonly today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
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
  protected readonly partyRoles = PARTY_ROLES;
  protected readonly partyTypes = PARTY_TYPES;
  protected readonly partyForm = this.fb.group({
    party_type: ['external' as (typeof PARTY_TYPES)[number], [Validators.required]],
    party_id: [''],
    role: ['signatory' as (typeof PARTY_ROLES)[number], [Validators.required]],
    name: ['', [Validators.maxLength(255)]],
    email: ['', [Validators.email, Validators.maxLength(255)]],
    notes: ['', [Validators.maxLength(2000)]],
  });

  // Add Obligation Modal inside Drawer
  protected obligationModalVisible = signal<boolean>(false);
  protected readonly obligationForm = this.fb.group({
    type: ['obligation' as const, [Validators.required]],
    title: ['', [Validators.required, Validators.maxLength(255)]],
    description: ['', [Validators.maxLength(5000)]],
    due_date: ['', [Validators.required]],
    responsible_party: ['own'],
    amount: ['', [decimalPattern(2), requiredWith('currency')]],
    currency: ['', [Validators.minLength(3), Validators.maxLength(3), requiredWith('amount')]],
    remind_days_before: [7, [Validators.min(0), Validators.max(365)]],
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

  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.contractForm.controls.kind.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.syncEndDateRequirement());
    revalidateOnStartChange(this.contractForm, 'start_date', 'end_date', this.destroyRef);
    this.partyForm.controls.party_type.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.syncPartyRequirements());
    this.obligationForm.controls.amount.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.obligationForm.controls.currency.updateValueAndValidity({ emitEvent: false }));
    this.obligationForm.controls.currency.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.obligationForm.controls.amount.updateValueAndValidity({ emitEvent: false }));
  }

  /** API rule: a party of the company (contact, supplier, user) needs its id; an external one needs a name. */
  protected isExternalParty(): boolean {
    return this.partyForm.controls.party_type.value === 'external';
  }

  private syncPartyRequirements(): void {
    const { party_id: partyId, name } = this.partyForm.controls;
    if (this.isExternalParty()) {
      partyId.setValidators([]);
      name.setValidators([Validators.required, Validators.maxLength(255)]);
    } else {
      partyId.setValidators([Validators.required, uuidFormat]);
      name.setValidators([Validators.maxLength(255)]);
    }
    partyId.updateValueAndValidity({ emitEvent: false });
    name.updateValueAndValidity({ emitEvent: false });
  }

  /** The service refuses a renewal that does not move the end date forward. */
  private afterCurrentEnd(control: AbstractControl<string>): ValidationErrors | null {
    const current = this.renewContractTarget()?.end_date;
    return current && control.value && control.value <= current.slice(0, 10) ? { endsBeforeStart: true } : null;
  }

  /** API rule: the end date is required for supplier contracts only. */
  protected isEndDateRequired(): boolean {
    return this.contractForm.controls.kind.value === 'supplier';
  }

  private syncEndDateRequirement(): void {
    const control = this.contractForm.controls.end_date;
    if (this.isEndDateRequired()) {
      control.addValidators(Validators.required);
    } else {
      control.removeValidators(Validators.required);
    }
    control.updateValueAndValidity({ emitEvent: false });
  }

  protected errorTip(form: FormGroup, path: string): string {
    const control = form.get(path);
    if (control?.hasError('serverError')) {
      return serverErrorMessage(form, path) ?? '';
    }
    const key = validationTipKey(control ?? null);
    return key ? this.i18n.translate(key) : '';
  }

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
      contract_value: '0.00',
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
    this.renewForm.reset({ new_end_date: '' });
    // Without a renewal term the API cannot compute the new end: the user must state it.
    this.renewForm.controls.new_end_date.setValidators(
      contract.renewal_term_months ? [(control: AbstractControl<string>) => this.afterCurrentEnd(control)] : [Validators.required, (control: AbstractControl<string>) => this.afterCurrentEnd(control)],
    );
    this.renewForm.controls.new_end_date.updateValueAndValidity();
    this.renewModalVisible.set(true);
  }

  protected submitRenewContract(): void {
    const contract = this.renewContractTarget();
    if (!contract) return;
    if (this.renewForm.invalid) {
      this.renewForm.markAllAsTouched();
      return;
    }

    const payload: RenewContractRequest = { new_end_date: this.renewForm.getRawValue().new_end_date || null };
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
    this.noticeDate.set(this.today);
    this.noticeModalVisible.set(true);
  }

  protected submitNotice(): void {
    const contract = this.noticeContractTarget();
    if (!contract) return;

    this.noticeSubmitting.set(true);
    this.contractApi
      .sendNotice(contract.kind, contract.id, { notice_given_at: this.noticeDate() })
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
      party_type: 'external',
      party_id: '',
      role: 'signatory',
      name: '',
      email: '',
      notes: '',
    });
    this.syncPartyRequirements();
    this.partyModalVisible.set(true);
  }

  protected submitParty(): void {
    const contract = this.selectedContract();
    if (!contract) return;
    if (this.partyForm.invalid) {
      this.partyForm.markAllAsTouched();
      return;
    }

    const raw = this.partyForm.getRawValue();
    const external = raw.party_type === 'external';
    const payload: ContractSavePartyRequest = {
      party_type: raw.party_type,
      party_id: external ? undefined : raw.party_id,
      role: raw.role,
      name: raw.name || undefined,
      email: raw.email || undefined,
      notes: raw.notes || undefined,
    };
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
    const contract = this.selectedContract();
    this.obligationForm.reset({
      type: 'obligation',
      title: '',
      description: '',
      due_date: new Date().toISOString().slice(0, 10),
      responsible_party: 'own',
      amount: '',
      currency: contract?.currency ?? '',
      remind_days_before: 7,
    });
    this.obligationModalVisible.set(true);
  }

  protected submitObligation(): void {
    const contract = this.selectedContract();
    if (!contract) return;
    if (this.obligationForm.invalid) {
      this.obligationForm.markAllAsTouched();
      return;
    }

    const raw = this.obligationForm.getRawValue();
    const payload: ContractSaveObligationRequest = {
      type: raw.type,
      title: raw.title,
      description: raw.description || undefined,
      due_date: raw.due_date,
      responsible_party: raw.responsible_party || undefined,
      amount: raw.amount || undefined,
      currency: raw.currency ? raw.currency.toUpperCase() : undefined,
      remind_days_before: raw.remind_days_before,
    };
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
        note: this.completeNotes() || undefined,
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

    this.contractApi.waiveObligation(ob.id, { note: this.waiveReason() || undefined }).subscribe({
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
