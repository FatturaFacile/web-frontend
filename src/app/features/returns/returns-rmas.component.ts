import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { RMA_STATUSES, ReturnsApiService, ReturnsRma, ReturnsRmaLineRequest, ReturnsRmaRequest, ReturnsSource, RmaStatus, TranslateService } from '@core';
import { IconActionDirective, ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { ReturnsLookupsService } from './returns-lookups.service';
import { apiErrorText, RMA_STATUS_COLORS, todayIso } from './returns.util';

/** Customer returns: the list with its filters and the request of a new return against an invoice or an order. */
@Component({
  selector: 'app-returns-rmas',
  styleUrl: './returns.scss',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    IconActionDirective,
    ModalActionsDirective,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzCheckboxModule,
    NzEmptyModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'RETURNS.RMAS_TITLE' | translate" [subtitle]="'RETURNS.RMAS_SUBTITLE' | translate">
      <button nz-button nzType="primary" (click)="openModal()" appIconAction="create"></button>
    </app-page-header>

    <div class="toolbar">
      <nz-select style="width: 200px" nzAllowClear [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event); load()" [nzPlaceHolder]="'RETURNS.STATUS' | translate">
        @for (status of statuses; track status) {
          <nz-option [nzValue]="status" [nzLabel]="('RETURNS.STATUS_' + status.toUpperCase()) | translate"></nz-option>
        }
      </nz-select>
      <input nz-input style="width: 220px" [ngModel]="search()" (ngModelChange)="search.set($event)" (keyup.enter)="load()" [placeholder]="'RETURNS.SEARCH_RMA' | translate" />
    </div>

    <nz-card class="main-card">
      <nz-table #table [nzData]="rmas()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="25">
        <thead>
          <tr>
            <th>{{ 'RETURNS.RMA_NUMBER' | translate }}</th>
            <th>{{ 'RETURNS.CUSTOMER' | translate }}</th>
            <th>{{ 'RETURNS.REASON' | translate }}</th>
            <th>{{ 'RETURNS.REQUESTED_ON' | translate }}</th>
            <th>{{ 'RETURNS.STATUS' | translate }}</th>
            <th class="num">{{ 'RETURNS.REFUND_AMOUNT' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <td><a [routerLink]="['/returns/rmas', row.id]">{{ row.rma_number }}</a></td>
              <td>{{ row.customer_name }}</td>
              <td>{{ row.reason_code }}</td>
              <td>{{ row.requested_on }}</td>
              <td><nz-tag [nzColor]="statusColor(row.status)">{{ ('RETURNS.STATUS_' + row.status.toUpperCase()) | translate }}</nz-tag></td>
              <td class="num">{{ row.refund_amount ?? '-' }}</td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && rmas().length === 0) {
        <nz-empty [nzNotFoundContent]="'RETURNS.NO_RMAS' | translate"></nz-empty>
      }
    </nz-card>

    <nz-modal
      [(nzVisible)]="modalVisible"
      [nzTitle]="'RETURNS.NEW_RMA' | translate"
      (nzOnCancel)="modalVisible.set(false)"
      (nzOnOk)="save()"
      okAction="save"
      [nzOkDisabled]="form.invalid || !hasLines()"
      nzWidth="760px"
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
              <nz-form-label nzRequired>{{ 'RETURNS.SOURCE_DOCUMENT' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="source_id" [nzPlaceHolder]="'RETURNS.SOURCE_HINT' | translate">
                  @for (source of sources(); track source.id) {
                    <nz-option [nzValue]="source.id" [nzLabel]="sourceLabel(source)"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'RETURNS.REASON' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="reason_code">
                  @for (reason of lookups.reasons(); track reason.code) {
                    <nz-option [nzValue]="reason.code" [nzLabel]="reason.label"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'RETURNS.REQUESTED_ON' | translate }}</nz-form-label>
              <nz-form-control><input nz-input type="date" formControlName="requested_on" /></nz-form-control>
            </nz-form-item>
          </div>

          @if (selectedSource(); as source) {
            @if (!source.within_window) {
              <nz-form-item>
                <nz-form-control>
                  <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
                  <label nz-checkbox formControlName="override_window">{{ 'RETURNS.OVERRIDE_WINDOW' | translate }}</label>
                  <div class="muted">{{ 'RETURNS.OVERRIDE_WINDOW_HINT' | translate }}</div>
                </nz-form-control>
              </nz-form-item>
            }
            <h4>{{ 'RETURNS.LINES' | translate }}</h4>
            @for (line of source.lines; track line.source_item_id) {
              <div class="line-row">
                <div>
                  <strong>{{ line.description }}</strong>
                  <div class="muted">{{ 'RETURNS.AVAILABLE' | translate }}: {{ line.quantity_available }} / {{ line.quantity_sold }}</div>
                </div>
                <input
                  #quantity
                  nz-input
                  type="number"
                  min="0"
                  step="any"
                  [max]="line.quantity_available"
                  [attr.aria-label]="line.description"
                  [value]="quantities()[line.source_item_id] ?? ''"
                  (input)="setQuantity(line.source_item_id, quantity.value)"
                  [disabled]="line.quantity_available === '0.0000'"
                />
              </div>
            } @empty {
              <nz-empty [nzNotFoundContent]="'RETURNS.NO_SOURCE_LINES' | translate"></nz-empty>
            }
          }

          <nz-form-item>
            <nz-form-label>{{ 'RETURNS.NOTES' | translate }}</nz-form-label>
            <nz-form-control><textarea nz-input rows="2" formControlName="notes"></textarea></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class ReturnsRmasComponent implements OnInit {
  private readonly api = inject(ReturnsApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly lookups = inject(ReturnsLookupsService);

  readonly statuses = RMA_STATUSES;
  readonly rmas = signal<ReturnsRma[]>([]);
  readonly loading = signal(false);
  readonly statusFilter = signal<RmaStatus | null>(null);
  readonly search = signal('');
  readonly modalVisible = signal(false);
  readonly sources = signal<ReturnsSource[]>([]);
  /** Quantity typed per source line, by the id of the source line. */
  readonly quantities = signal<Record<string, string>>({});
  private readonly sourceId = signal('');

  readonly form = this.fb.group({
    contact_id: ['', [Validators.required]],
    source_id: ['', [Validators.required]],
    reason_code: ['', [Validators.required]],
    requested_on: [todayIso(), [Validators.required]],
    override_window: [false],
    notes: [''],
  });

  readonly selectedSource = computed(() => this.sources().find((source) => source.id === this.sourceId()) ?? null);
  readonly hasLines = computed(() => this.requestedLines().length > 0);

  constructor() {
    this.form.controls.contact_id.valueChanges.subscribe((contactId) => this.loadSources(contactId));
    this.form.controls.source_id.valueChanges.subscribe((sourceId) => {
      this.sourceId.set(sourceId);
      this.quantities.set({});
    });
  }

  ngOnInit(): void {
    this.load();
  }

  statusColor(status: RmaStatus): string {
    return RMA_STATUS_COLORS[status];
  }

  sourceLabel(source: ReturnsSource): string {
    return `${this.translate.instant(`RETURNS.SOURCE_TYPE_${source.type.toUpperCase()}`)} ${source.number} (${source.date})`;
  }

  setQuantity(sourceItemId: string, value: string): void {
    this.quantities.update((quantities) => ({ ...quantities, [sourceItemId]: value }));
  }

  load(): void {
    this.loading.set(true);
    this.api.getRmas({ status: this.statusFilter() ?? undefined, search: this.search() || undefined, per_page: 100 }).subscribe({
      next: (response) => {
        this.rmas.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('RETURNS.ACTION_ERROR'));
      },
    });
  }

  openModal(): void {
    this.form.reset({ contact_id: '', source_id: '', reason_code: '', requested_on: todayIso(), override_window: false, notes: '' });
    this.sources.set([]);
    this.quantities.set({});
    this.lookups.searchCustomers();
    this.lookups.loadReasons();
    this.modalVisible.set(true);
  }

  save(): void {
    const source = this.selectedSource();
    if (source === null) {
      return;
    }

    const value = this.form.getRawValue();
    const payload: ReturnsRmaRequest = {
      contact_id: value.contact_id,
      invoice_id: source.type === 'invoice' ? source.id : null,
      sales_order_id: source.type === 'sales_order' ? source.id : null,
      reason_code: value.reason_code,
      requested_on: value.requested_on,
      override_window: value.override_window,
      notes: value.notes || null,
      lines: this.requestedLines(),
    };

    this.api.createRma(payload).subscribe({
      next: (response) => {
        this.message.success(this.translate.instant('RETURNS.RMA_SAVED'));
        this.modalVisible.set(false);
        void this.router.navigate(['/returns/rmas', response.data.id]);
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('RETURNS.ACTION_ERROR')),
    });
  }

  /** The lines of the source the user gave a quantity, in the field names of the API. */
  private requestedLines(): ReturnsRmaLineRequest[] {
    const source = this.selectedSource();
    if (source === null) {
      return [];
    }

    const lines: ReturnsRmaLineRequest[] = [];
    for (const line of source.lines) {
      const quantity = Number(this.quantities()[line.source_item_id] ?? 0);
      if (quantity > 0) {
        lines.push(source.type === 'invoice' ? { invoice_item_id: line.source_item_id, quantity } : { sales_order_item_id: line.source_item_id, quantity });
      }
    }

    return lines;
  }

  private loadSources(contactId: string): void {
    this.sources.set([]);
    this.form.controls.source_id.setValue('');
    if (!contactId) {
      return;
    }

    this.api.getSources(contactId).subscribe({
      next: (response) => this.sources.set(response.data),
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('RETURNS.ACTION_ERROR')),
    });
  }
}
