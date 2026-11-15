import { DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  ContactResource,
  CrmApiService,
  LegalCase,
  PRACTICE_TRUST_INPUT_TYPES,
  PracticeApiService,
  PracticeTrustBalance,
  PracticeTrustTransaction,
  PracticeTrustTransactionRequest,
  ProfessionalsApiService,
  TranslateService,
} from '@core';
import { IconActionDirective, ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText, blankToNull, clientName, loadCases, loadClients, todayIso } from './practice-firm.util';

/** Client funds (trust) ledger: balances per client and the append-only list of deposits, withdrawals and transfers. */
@Component({
  selector: 'app-practice-trust',
  styleUrl: './practice-firm.scss',
  imports: [
    DecimalPipe,
    FormsModule,
    ReactiveFormsModule,
    IconActionDirective,
    ModalActionsDirective,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'PRACTICEFIRM.TRUST_TITLE' | translate" [subtitle]="'PRACTICEFIRM.TRUST_SUBTITLE' | translate">
      <button nz-button nzType="primary" (click)="openModal()" appIconAction="create"></button>
    </app-page-header>

    <nz-card class="main-card" [nzTitle]="'PRACTICEFIRM.BALANCES' | translate">
      <nz-table #balanceTable [nzData]="balances()" nzSize="small" [nzShowPagination]="false">
        <thead>
          <tr>
            <th>{{ 'PRACTICEFIRM.CLIENT' | translate }}</th>
            <th class="num">{{ 'PRACTICEFIRM.BALANCE' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of balanceTable.data; track row.client_id) {
            <tr>
              <td>
                <a (click)="clientId.set(row.client_id); load()">{{ row.client_name }}</a>
              </td>
              <td class="num">{{ row.total | number: '1.2-2' }}</td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (balances().length === 0) {
        <nz-empty [nzNotFoundContent]="'PRACTICEFIRM.NO_BALANCES' | translate"></nz-empty>
      }
    </nz-card>

    <div class="toolbar">
      <nz-select style="width: 260px" nzAllowClear nzShowSearch [ngModel]="clientId()" (ngModelChange)="clientId.set($event); load()" [nzPlaceHolder]="'PRACTICEFIRM.CLIENT' | translate">
        @for (client of clients(); track client.id) {
          <nz-option [nzValue]="client.id" [nzLabel]="name(client)"></nz-option>
        }
      </nz-select>
    </div>

    <nz-card class="main-card">
      <nz-table #table [nzData]="rows()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="25">
        <thead>
          <tr>
            <th>{{ 'PRACTICEFIRM.DATE' | translate }}</th>
            <th>{{ 'PRACTICEFIRM.CLIENT' | translate }}</th>
            <th>{{ 'PRACTICEFIRM.MATTER' | translate }}</th>
            <th>{{ 'PRACTICEFIRM.TYPE' | translate }}</th>
            <th>{{ 'PRACTICEFIRM.REFERENCE' | translate }}</th>
            <th class="num">{{ 'PRACTICEFIRM.AMOUNT' | translate }}</th>
            <th class="num">{{ 'PRACTICEFIRM.BALANCE' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <td>{{ row.occurred_on.substring(0, 10) }}</td>
              <td>{{ name(row.client) }}</td>
              <td>{{ row.legal_case?.case_number }}</td>
              <td>
                <nz-tag [nzColor]="row.type === 'deposit' ? 'green' : row.type === 'reversal' ? 'default' : 'orange'">{{ ('PRACTICEFIRM.TRUST_' + row.type.toUpperCase()) | translate }}</nz-tag>
              </td>
              <td>{{ row.reference }}</td>
              <td class="num">{{ row.signed_amount | number: '1.2-2' }}</td>
              <td class="num">{{ row.balance_after | number: '1.2-2' }}</td>
              <td>
                <div class="row-actions">
                  @if (row.type !== 'reversal') {
                    <button nz-button nzType="text" nz-popconfirm [nzPopconfirmTitle]="'PRACTICEFIRM.REVERSE_CONFIRM' | translate" (nzOnConfirm)="reverse(row)">
                      {{ 'PRACTICEFIRM.REVERSE' | translate }}
                    </button>
                  }
                </div>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && rows().length === 0) {
        <nz-empty [nzNotFoundContent]="'PRACTICEFIRM.NO_TRANSACTIONS' | translate"></nz-empty>
      }
    </nz-card>

    <nz-modal [(nzVisible)]="modalVisible" [nzTitle]="'PRACTICEFIRM.NEW_TRANSACTION' | translate" (nzOnCancel)="modalVisible.set(false)" (nzOnOk)="save()" okAction="save" [nzOkDisabled]="form.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="form" nzLayout="vertical">
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'PRACTICEFIRM.TYPE' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="type">
                  @for (value of types; track value) {
                    <nz-option [nzValue]="value" [nzLabel]="('PRACTICEFIRM.TRUST_' + value.toUpperCase()) | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="trust-date">{{ 'PRACTICEFIRM.DATE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="trust-date" type="date" formControlName="occurred_on" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="trust-amount">{{ 'PRACTICEFIRM.AMOUNT' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="trust-amount" type="number" min="0.01" step="0.01" formControlName="amount" /></nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'PRACTICEFIRM.CLIENT' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="client_id" nzShowSearch>
                @for (client of clients(); track client.id) {
                  <nz-option [nzValue]="client.id" [nzLabel]="name(client)"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>{{ 'PRACTICEFIRM.MATTER' | translate }}</nz-form-label>
            <nz-form-control [nzExtra]="'PRACTICEFIRM.MATTER_HINT' | translate">
              <nz-select formControlName="legal_case_id" nzAllowClear nzShowSearch>
                @for (matter of clientCases(); track matter.id) {
                  <nz-option [nzValue]="matter.id" [nzLabel]="matter.case_number + ' - ' + matter.title"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzFor="trust-reference">{{ 'PRACTICEFIRM.REFERENCE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="trust-reference" formControlName="reference" maxlength="100" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="trust-description">{{ 'PRACTICEFIRM.DESCRIPTION' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="trust-description" formControlName="description" maxlength="255" /></nz-form-control>
            </nz-form-item>
          </div>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class PracticeTrustComponent implements OnInit {
  private readonly api = inject(PracticeApiService);
  private readonly crm = inject(CrmApiService);
  private readonly professionals = inject(ProfessionalsApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly types = PRACTICE_TRUST_INPUT_TYPES;
  readonly rows = signal<PracticeTrustTransaction[]>([]);
  readonly balances = signal<PracticeTrustBalance[]>([]);
  readonly clients = signal<ContactResource[]>([]);
  readonly cases = signal<LegalCase[]>([]);
  readonly loading = signal(false);
  readonly clientId = signal<string | null>(null);
  readonly modalVisible = signal(false);

  readonly form = this.fb.group({
    type: ['deposit' as PracticeTrustTransactionRequest['type']],
    client_id: ['', [Validators.required]],
    legal_case_id: this.fb.control<string | null>(null),
    occurred_on: [todayIso(), [Validators.required]],
    amount: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
    reference: [''],
    description: [''],
  });

  ngOnInit(): void {
    loadClients(this.crm).subscribe((clients) => this.clients.set(clients));
    loadCases(this.professionals).subscribe((cases) => this.cases.set(cases));
    this.load();
  }

  name(client: Parameters<typeof clientName>[0]): string {
    return clientName(client);
  }

  /** Matters of the client chosen in the form. */
  clientCases(): LegalCase[] {
    const client = this.form.controls.client_id.value;
    return this.cases().filter((matter) => matter.client_id === client);
  }

  load(): void {
    this.loading.set(true);
    this.api.getTrustBalances().subscribe({ next: (response) => this.balances.set(response.data), error: () => this.balances.set([]) });
    this.api.getTrustLedger({ client_id: this.clientId() ?? undefined, per_page: 100 }).subscribe({
      next: (response) => {
        this.rows.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('PRACTICEFIRM.ACTION_ERROR'));
      },
    });
  }

  openModal(): void {
    this.form.reset({ type: 'deposit', client_id: this.clientId() ?? '', legal_case_id: null, occurred_on: todayIso(), amount: null, reference: '', description: '' });
    this.modalVisible.set(true);
  }

  save(): void {
    const value = this.form.getRawValue();
    const payload: PracticeTrustTransactionRequest = {
      type: value.type,
      client_id: value.client_id,
      legal_case_id: value.legal_case_id,
      occurred_on: value.occurred_on,
      amount: String(value.amount ?? ''),
      reference: blankToNull(value.reference),
      description: blankToNull(value.description),
    };
    this.api.postTrustTransaction(payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('PRACTICEFIRM.TRANSACTION_SAVED'));
        this.modalVisible.set(false);
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('PRACTICEFIRM.ACTION_ERROR')),
    });
  }

  reverse(row: PracticeTrustTransaction): void {
    this.api.reverseTrustTransaction(row.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('PRACTICEFIRM.TRANSACTION_REVERSED'));
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('PRACTICEFIRM.ACTION_ERROR')),
    });
  }
}
