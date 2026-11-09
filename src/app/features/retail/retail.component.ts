import { DatePipe, UpperCasePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormArray, FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  CommercialDocumentResource,
  CreateLoyaltyCardPayload,
  DailyCorrispettivoResource,
  LoyaltyApiService,
  LoyaltyCard,
  LoyaltyTransaction,
  RecordLoyaltyTransactionPayload,
  RetailApiService,
  StoreCommercialDocumentPayload,
  UpdateLoyaltyCardPayload,
} from '@core';
import { MoneyPipe, PageHeaderComponent } from '@shared';

@Component({
  selector: 'app-retail',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    DatePipe,
    UpperCasePipe,
    MoneyPipe,
    NzCardModule,
    NzTableModule,
    NzTagModule,
    NzButtonModule,
    NzIconModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzDatePickerModule,
    NzTabsModule,
    NzGridModule,
    NzStatisticModule,
    NzModalModule,
    NzFormModule,
    NzDividerModule,
    NzDrawerModule,
    PageHeaderComponent,
  ],
  templateUrl: './retail.component.html',
})
export class RetailComponent implements OnInit {
  private readonly api = inject(RetailApiService);
  private readonly loyaltyApi = inject(LoyaltyApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);

  readonly selectedTab = signal<number>(0);

  // Documents state
  readonly documents = signal<CommercialDocumentResource[]>([]);
  readonly loading = signal(false);
  readonly total = signal(0);
  readonly page = signal(1);

  // Daily Corrispettivi state
  readonly dailyCorrispettivo = signal<DailyCorrispettivoResource | null>(null);
  readonly selectedDate = signal<Date>(new Date());
  readonly loadingDaily = signal(false);

  // Loyalty Cards state
  readonly loyaltyCards = signal<LoyaltyCard[]>([]);
  readonly loadingLoyalty = signal<boolean>(false);
  readonly selectedLoyaltyCard = signal<LoyaltyCard | null>(null);
  readonly loyaltyTransactions = signal<LoyaltyTransaction[]>([]);
  readonly isLoyaltyDrawerVisible = signal<boolean>(false);
  readonly isIssueCardModalVisible = signal<boolean>(false);
  readonly isRecordTxModalVisible = signal<boolean>(false);
  readonly isSubmittingLoyalty = signal<boolean>(false);

  // Computed KPIs
  readonly kpiTotalDocs = computed(() => this.documents().length);
  readonly kpiIssuedDocs = computed(
    () => this.documents().filter((d) => d.status === 'issued').length
  );
  readonly kpiVoidedDocs = computed(
    () => this.documents().filter((d) => d.status === 'voided').length
  );
  readonly kpiActiveCards = computed(
    () => this.loyaltyCards().filter((c) => c.status === 'active').length
  );

  // Modal create document
  readonly isCreateModalVisible = signal(false);
  readonly isSubmitting = signal(false);
  readonly docForm = this.fb.group({
    payment_method: ['electronic', [Validators.required]],
    cashier_name: ['Cassa 1', [Validators.required]],
    lines: this.fb.array([
      this.fb.group({
        description: ['', [Validators.required]],
        quantity: [1, [Validators.required, Validators.min(1)]],
        unit_price: [10, [Validators.required, Validators.min(0.01)]],
        vat_rate: [22, [Validators.required]],
      }),
    ]),
  });

  // Loyalty card forms
  readonly issueCardForm = this.fb.group({
    customer_id: ['', [Validators.required]],
    card_number: [''],
    initial_balance: [0, [Validators.min(0)]],
  });

  readonly recordTxForm = this.fb.group({
    type: ['topup' as 'topup' | 'spend', [Validators.required]],
    amount: [10, [Validators.required, Validators.min(1)]],
    description: [''],
  });

  get linesArray(): FormArray {
    return this.docForm.get('lines') as FormArray;
  }

  ngOnInit(): void {
    this.loadDocuments();
    this.loadDailyCorrispettivi();
    this.loadLoyaltyCards();
  }

  loadDocuments(page = 1): void {
    this.loading.set(true);
    this.page.set(page);
    this.api.getCommercialDocuments({ page, per_page: 15 }).subscribe({
      next: (res) => {
        this.documents.set(res?.data || []);
        this.total.set(res?.meta?.total ?? res?.data?.length ?? 0);
        this.loading.set(false);
      },
      error: () => {
        this.message.error('Impossibile caricare i documenti commerciali');
        this.loading.set(false);
      },
    });
  }

  loadDailyCorrispettivi(): void {
    this.loadingDaily.set(true);
    const dateStr = this.selectedDate().toISOString().split('T')[0];
    this.api.getDailyCorrispettivi(dateStr).subscribe({
      next: (res) => {
        this.dailyCorrispettivo.set(res?.data || null);
        this.loadingDaily.set(false);
      },
      error: () => {
        this.dailyCorrispettivo.set(null);
        this.loadingDaily.set(false);
      },
    });
  }

  loadLoyaltyCards(): void {
    this.loadingLoyalty.set(true);
    this.loyaltyApi.getCards({ page: 1, per_page: 50 }).subscribe({
      next: (res) => {
        this.loyaltyCards.set(res?.data || []);
        this.loadingLoyalty.set(false);
      },
      error: () => {
        this.message.error('Impossibile caricare le carte fedeltà');
        this.loadingLoyalty.set(false);
      },
    });
  }

  openCreateModal(): void {
    while (this.linesArray.length !== 0) {
      this.linesArray.removeAt(0);
    }
    this.addLine();
    this.docForm.reset({
      payment_method: 'electronic',
      cashier_name: 'Cassa 1',
    });
    this.isCreateModalVisible.set(true);
  }

  addLine(): void {
    this.linesArray.push(
      this.fb.group({
        description: ['', [Validators.required]],
        quantity: [1, [Validators.required, Validators.min(1)]],
        unit_price: [10, [Validators.required, Validators.min(0.01)]],
        vat_rate: [22, [Validators.required]],
      })
    );
  }

  removeLine(index: number): void {
    if (this.linesArray.length > 1) {
      this.linesArray.removeAt(index);
    }
  }

  submitDocument(): void {
    if (this.docForm.invalid) {
      this.docForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    const val = this.docForm.getRawValue();
    const rawLines = val.lines as {
      description: string;
      quantity: number;
      unit_price: number;
      vat_rate: number;
    }[];

    const payload: StoreCommercialDocumentPayload = {
      payment_method: val.payment_method,
      cashier_name: val.cashier_name,
      lines: rawLines.map((l) => ({
        description: l.description,
        quantity: Number(l.quantity),
        unit_price: Number(l.unit_price),
        vat_rate: Number(l.vat_rate),
      })),
    };

    this.api.createCommercialDocument(payload).subscribe({
      next: () => {
        this.message.success('Documento commerciale (scontrino) emesso');
        this.isSubmitting.set(false);
        this.isCreateModalVisible.set(false);
        this.loadDocuments(1);
        this.loadDailyCorrispettivi();
      },
      error: () => {
        this.message.error('Errore durante l’emissione del documento commerciale');
        this.isSubmitting.set(false);
      },
    });
  }

  voidDocument(doc: CommercialDocumentResource): void {
    this.modal.confirm({
      nzTitle: `Annullare lo scontrino ${doc.document_number}?`,
      nzContent: 'Verrà trasmesso l’annullo telematico all’Agenzia delle Entrate.',
      nzOkDanger: true,
      nzOkText: 'Annulla Scontrino',
      nzOnOk: () => {
        this.api.voidCommercialDocument(doc.id).subscribe({
          next: () => {
            this.message.success('Documento commerciale annullato');
            this.loadDocuments(this.page());
            this.loadDailyCorrispettivi();
          },
          error: () => this.message.error('Errore durante l’annullamento dello scontrino'),
        });
      },
    });
  }

  // --- Loyalty Cards Methods ---

  openIssueCardModal(): void {
    this.issueCardForm.reset({
      customer_id: '',
      card_number: `LOY-${Math.floor(100000 + Math.random() * 900000)}`,
      initial_balance: 0,
    });
    this.isIssueCardModalVisible.set(true);
  }

  submitIssueCard(): void {
    if (this.issueCardForm.invalid) {
      this.issueCardForm.markAllAsTouched();
      return;
    }

    this.isSubmittingLoyalty.set(true);
    const val = this.issueCardForm.getRawValue();
    const payload: CreateLoyaltyCardPayload = {
      customer_id: val.customer_id,
      card_number: val.card_number || undefined,
      initial_balance: Number(val.initial_balance) || 0,
    };

    this.loyaltyApi.createCard(payload).subscribe({
      next: () => {
        this.message.success('Carta fedeltà emessa con successo');
        this.isSubmittingLoyalty.set(false);
        this.isIssueCardModalVisible.set(false);
        this.loadLoyaltyCards();
      },
      error: () => {
        this.message.error('Errore durante l’emissione della carta fedeltà');
        this.isSubmittingLoyalty.set(false);
      },
    });
  }

  openLoyaltyDrawer(card: LoyaltyCard): void {
    this.selectedLoyaltyCard.set(card);
    this.isLoyaltyDrawerVisible.set(true);
    this.loyaltyApi.getTransactions(card.id).subscribe({
      next: (res) => {
        this.loyaltyTransactions.set(res?.data || []);
      },
      error: () => {
        this.message.error('Impossibile caricare i movimenti della carta');
      },
    });
  }

  closeLoyaltyDrawer(): void {
    this.isLoyaltyDrawerVisible.set(false);
    this.selectedLoyaltyCard.set(null);
    this.loyaltyTransactions.set([]);
  }

  openRecordTxModal(card: LoyaltyCard): void {
    this.selectedLoyaltyCard.set(card);
    this.recordTxForm.reset({
      type: 'topup',
      amount: 10,
      description: '',
    });
    this.isRecordTxModalVisible.set(true);
  }

  submitRecordTx(): void {
    if (this.recordTxForm.invalid || !this.selectedLoyaltyCard()) {
      this.recordTxForm.markAllAsTouched();
      return;
    }

    this.isSubmittingLoyalty.set(true);
    const cardId = this.selectedLoyaltyCard()!.id;
    const val = this.recordTxForm.getRawValue();
    const payload: RecordLoyaltyTransactionPayload = {
      type: val.type,
      amount: Number(val.amount),
      description: val.description || undefined,
    };

    this.loyaltyApi.recordTransaction(cardId, payload).subscribe({
      next: () => {
        this.message.success(
          val.type === 'topup' ? 'Punti/credito accreditati' : 'Punti/credito scalati'
        );
        this.isSubmittingLoyalty.set(false);
        this.isRecordTxModalVisible.set(false);
        this.loadLoyaltyCards();
        if (this.isLoyaltyDrawerVisible()) {
          this.openLoyaltyDrawer(this.selectedLoyaltyCard()!);
        }
      },
      error: () => {
        this.message.error('Errore durante la registrazione della transazione punti');
        this.isSubmittingLoyalty.set(false);
      },
    });
  }

  toggleCardStatus(card: LoyaltyCard): void {
    const newStatus = card.status === 'active' ? 'suspended' : 'active';
    const payload: UpdateLoyaltyCardPayload = { status: newStatus };

    this.loyaltyApi.updateCard(card.id, payload).subscribe({
      next: () => {
        this.message.success(`Stato carta aggiornato a ${newStatus}`);
        this.loadLoyaltyCards();
      },
      error: () => {
        this.message.error('Errore durante l’aggiornamento dello stato');
      },
    });
  }

  deleteLoyaltyCard(card: LoyaltyCard): void {
    this.modal.confirm({
      nzTitle: `Eliminare la carta fedeltà ${card.card_number}?`,
      nzContent: 'L’operazione cancellerà la carta e lo storico dei punti accumulati.',
      nzOkDanger: true,
      nzOkText: 'Elimina',
      nzOnOk: () => {
        this.loyaltyApi.deleteCard(card.id).subscribe({
          next: () => {
            this.message.success('Carta fedeltà eliminata');
            this.loadLoyaltyCards();
          },
          error: () => this.message.error('Errore durante l’eliminazione della carta'),
        });
      },
    });
  }

  getLoyaltyStatusColor(status: string): string {
    switch (status) {
      case 'active':
        return 'success';
      case 'suspended':
        return 'warning';
      case 'expired':
      case 'blocked':
        return 'error';
      default:
        return 'default';
    }
  }
}
