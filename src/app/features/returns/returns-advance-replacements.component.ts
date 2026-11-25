import { Component, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AdvanceReplacement,
  AdvanceReplacementUnitType,
  ReturnsApiService,
  TranslateService,
} from '@core';
import { ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { ReturnsLookupsService } from './returns-lookups.service';
import { apiErrorText } from './returns.util';

/** Advance Replacement (Cross-Shipping) workbench with SLA tracking & overdue penalty billing. */
@Component({
  selector: 'app-returns-advance-replacements',
  styleUrl: './returns.scss',
  imports: [
    ReactiveFormsModule,
    ModalActionsDirective,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'RETURNS_RL.XSHP_TITLE' | translate" [subtitle]="'RETURNS_RL.XSHP_SUBTITLE' | translate">
      <button nz-button (click)="scanOverdue()">{{ 'RETURNS_RL.SCAN_OVERDUE' | translate }}</button>
      <button nz-button nzType="primary" (click)="openCreate()">{{ 'RETURNS_RL.NEW_XSHP' | translate }}</button>
    </app-page-header>

    <nz-card class="main-card">
      <nz-table #table [nzData]="items()" [nzLoading]="loading()" nzSize="small">
        <thead>
          <tr>
            <th>{{ 'RETURNS.RMA_NUMBER' | translate }}</th>
            <th>{{ 'RETURNS.CUSTOMER' | translate }}</th>
            <th>{{ 'RETURNS.PRODUCT' | translate }}</th>
            <th>{{ 'RETURNS_RL.UNIT_TYPE' | translate }}</th>
            <th>{{ 'RETURNS_RL.RETURN_DUE_ON' | translate }}</th>
            <th>{{ 'RETURNS.STATUS' | translate }}</th>
            <th class="num">{{ 'RETURNS_RL.PENALTY_AMOUNT' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <td>{{ row.replacement_number }}</td>
              <td>{{ row.customer_name }}</td>
              <td>{{ row.replacement_product_name }}</td>
              <td>{{ ('RETURNS_RL.UNIT_' + row.replacement_unit_type.toUpperCase()) | translate }}</td>
              <td>
                {{ row.return_due_on }}
                @if (row.is_overdue) {
                  <nz-tag nzColor="red">OVERDUE</nz-tag>
                }
              </td>
              <td>
                <nz-tag [nzColor]="statusColor(row.status)">
                  {{ ('RETURNS_RL.XSHP_STATUS_' + row.status.toUpperCase()) | translate }}
                </nz-tag>
              </td>
              <td class="num">{{ row.penalty_amount }} {{ row.currency }}</td>
              <td>
                @if (row.status === 'pending_defective_return') {
                  <button nz-button nzSize="small" (click)="receiveDefective(row)">
                    {{ 'RETURNS_RL.RECEIVE_DEFECTIVE' | translate }}
                  </button>
                  <button nz-button nzSize="small" nzDanger (click)="billOverdue(row)" style="margin-left: 4px;">
                    {{ 'RETURNS_RL.BILL_OVERDUE' | translate }}
                  </button>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && items().length === 0) {
        <nz-empty [nzNotFoundContent]="'RETURNS.NO_DATA' | translate"></nz-empty>
      }
    </nz-card>

    <nz-modal appModalActions
      [(nzVisible)]="modalVisible"
      [nzTitle]="'RETURNS_RL.NEW_XSHP' | translate"
      (nzOnCancel)="modalVisible.set(false)"
      (nzOnOk)="save()"
      okAction="save"
      [nzOkDisabled]="form.invalid"
      nzWidth="680px"
    >
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="form" nzLayout="vertical">
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'RETURNS.CUSTOMER' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="contact_id" nzShowSearch nzServerSearch (nzOnSearch)="lookups.searchCustomers($event)">
                  @for (customer of lookups.customers(); track customer.id) {
                    <nz-option [nzValue]="customer.id" [nzLabel]="customer.label"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>

            <nz-form-item>
              <nz-form-label nzRequired>{{ 'RETURNS.PRODUCT' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="faulty_product_id" nzShowSearch nzServerSearch (nzOnSearch)="lookups.searchProducts($event)">
                  @for (product of lookups.products(); track product.id) {
                    <nz-option [nzValue]="product.id" [nzLabel]="product.label"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          </div>

          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'RETURNS_RL.UNIT_TYPE' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="replacement_unit_type">
                  @for (t of unitTypes; track t) {
                    <nz-option [nzValue]="t" [nzLabel]="('RETURNS_RL.UNIT_' + t.toUpperCase()) | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>

            <nz-form-item>
              <nz-form-label nzRequired>{{ 'RETURNS_RL.SLA_DAYS' | translate }}</nz-form-label>
              <nz-form-control><input nz-input type="number" min="1" formControlName="sla_days" /></nz-form-control>
            </nz-form-item>

            <nz-form-item>
              <nz-form-label>{{ 'RETURNS_RL.PENALTY_AMOUNT' | translate }}</nz-form-label>
              <nz-form-control><input nz-input type="number" min="0" step="any" formControlName="penalty_amount" /></nz-form-control>
            </nz-form-item>
          </div>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class ReturnsAdvanceReplacementsComponent implements OnInit {
  private readonly api = inject(ReturnsApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly lookups = inject(ReturnsLookupsService);

  readonly unitTypes: readonly AdvanceReplacementUnitType[] = ['new', 'refurbished'];
  readonly items = signal<AdvanceReplacement[]>([]);
  readonly loading = signal(false);
  readonly modalVisible = signal(false);

  readonly form = this.fb.group({
    contact_id: ['', [Validators.required]],
    faulty_product_id: ['', [Validators.required]],
    replacement_unit_type: ['new' as AdvanceReplacementUnitType, [Validators.required]],
    sla_days: [15, [Validators.required, Validators.min(1)]],
    penalty_amount: [''],
  });

  ngOnInit(): void {
    this.load();
  }

  statusColor(status: string): string {
    switch (status) {
      case 'defective_received':
        return 'green';
      case 'overdue_billed':
        return 'red';
      case 'cancelled':
        return 'default';
      default:
        return 'orange';
    }
  }

  load(): void {
    this.loading.set(true);
    this.api.getAdvanceReplacements({ per_page: 50 }).subscribe({
      next: (res) => {
        this.items.set(res.data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openCreate(): void {
    this.lookups.searchCustomers();
    this.lookups.searchProducts();
    this.form.reset({ contact_id: '', faulty_product_id: '', replacement_unit_type: 'new', sla_days: 15, penalty_amount: '' });
    this.modalVisible.set(true);
  }

  save(): void {
    const val = this.form.getRawValue();
    this.api.createAdvanceReplacement({
      contact_id: val.contact_id,
      faulty_product_id: val.faulty_product_id,
      replacement_unit_type: val.replacement_unit_type,
      sla_days: Number(val.sla_days),
      penalty_amount: val.penalty_amount !== '' ? Number(val.penalty_amount) : null,
    }).subscribe({
      next: (res) => {
        this.items.update((list) => [res.data, ...list]);
        this.modalVisible.set(false);
        this.message.success(this.translate.instant('RETURNS.RMA_SAVED'));
      },
      error: (err: unknown) => this.message.error(apiErrorText(err) ?? this.translate.instant('RETURNS.ACTION_ERROR')),
    });
  }

  receiveDefective(item: AdvanceReplacement): void {
    this.api.receiveDefectiveReplacement(item.id).subscribe({
      next: (res) => {
        this.items.update((list) => list.map((x) => (x.id === item.id ? res.data : x)));
        this.message.success(this.translate.instant('RETURNS.RMA_RECEIVED'));
      },
      error: (err: unknown) => this.message.error(apiErrorText(err) ?? this.translate.instant('RETURNS.ACTION_ERROR')),
    });
  }

  billOverdue(item: AdvanceReplacement): void {
    this.api.billOverdueReplacement(item.id, true).subscribe({
      next: (res) => {
        this.items.update((list) => list.map((x) => (x.id === item.id ? res.data : x)));
        this.message.success(this.translate.instant('RETURNS.RMA_RESOLVED'));
      },
      error: (err: unknown) => this.message.error(apiErrorText(err) ?? this.translate.instant('RETURNS.ACTION_ERROR')),
    });
  }

  scanOverdue(): void {
    this.api.scanOverdueReplacements().subscribe({
      next: () => this.load(),
      error: (err: unknown) => this.message.error(apiErrorText(err) ?? this.translate.instant('RETURNS.ACTION_ERROR')),
    });
  }
}
