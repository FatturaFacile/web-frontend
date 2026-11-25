import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { GDT_CONTRACT_STATUSES, GDT_JURISDICTIONS, GdtContractPayload } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { ContractFormComponent } from './contract-form.component';
import { contractStatusColor, GdtOutcome, percentText } from './gdo-trade-terms.util';
import { ContractsStore } from './contracts.store';

/** GDO framework contracts: the list with its filters and the creation of a contract, which opens its editor. */
@Component({
  selector: 'app-gdt-contracts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ContractFormComponent,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzEmptyModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    RouterLink,
    TranslatePipe,
  ],
  providers: [ContractsStore],
  styleUrl: './gdo-trade-terms.scss',
  template: `
    <app-page-header [title]="'PAGE_TITLE.GDO_TRADE_TERMS_CONTRACTS' | translate"></app-page-header>

    <div class="toolbar">
      <label class="field" for="gdt-filter-status">
        <span>{{ 'gdoTradeTerms.field.status' | translate }}</span>
        <nz-select
          nzId="gdt-filter-status"
          nzAllowClear
          [nzPlaceHolder]="'gdoTradeTerms.action.all' | translate"
          [ngModel]="store.filters().status ?? null"
          (ngModelChange)="store.setFilters({ status: $event ?? undefined })"
        >
          @for (status of statuses; track status) {
            <nz-option [nzValue]="status" [nzLabel]="'gdoTradeTerms.contractStatus.' + status | translate"></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="gdt-filter-jurisdiction">
        <span>{{ 'gdoTradeTerms.field.jurisdiction' | translate }}</span>
        <nz-select
          nzId="gdt-filter-jurisdiction"
          nzAllowClear
          [nzPlaceHolder]="'gdoTradeTerms.action.all' | translate"
          [ngModel]="store.filters().jurisdiction ?? null"
          (ngModelChange)="store.setFilters({ jurisdiction: $event ?? undefined })"
        >
          @for (jurisdiction of jurisdictions; track jurisdiction) {
            <nz-option [nzValue]="jurisdiction" [nzLabel]="'gdoTradeTerms.jurisdiction.' + jurisdiction | translate"></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="gdt-filter-retailer">
        <span>{{ 'gdoTradeTerms.field.retailer' | translate }}</span>
        <nz-select
          nzId="gdt-filter-retailer"
          nzAllowClear
          nzShowSearch
          [nzPlaceHolder]="'gdoTradeTerms.action.all' | translate"
          [ngModel]="store.filters().contact_id ?? null"
          (ngModelChange)="store.setFilters({ contact_id: $event ?? undefined })"
        >
          @for (customer of store.customers(); track customer.id) {
            <nz-option [nzValue]="customer.id" [nzLabel]="customer.name"></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="gdt-filter-search">
        <span>{{ 'gdoTradeTerms.field.search' | translate }}</span>
        <input
          nz-input
          id="gdt-filter-search"
          maxlength="60"
          [ngModel]="search()"
          (ngModelChange)="search.set($event)"
          (keyup.enter)="store.setFilters({ q: search() || undefined })"
        />
      </label>
      <button nz-button type="button" (click)="store.setFilters({ q: search() || undefined })">
        {{ 'gdoTradeTerms.action.search' | translate }}
      </button>
      <span class="spacer"></span>
      <button nz-button nzType="primary" type="button" (click)="openCreate()">
        {{ 'gdoTradeTerms.action.newContract' | translate }}
      </button>
    </div>

    @if (store.error(); as error) {
      <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="error | translate"></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      <nz-table
        #table
        nzSize="small"
        [nzData]="store.contracts()"
        [nzTotal]="store.total()"
        [nzPageIndex]="store.page()"
        [nzPageSize]="store.pageSize()"
        [nzFrontPagination]="false"
        (nzPageIndexChange)="store.setPage($event)"
      >
        <thead>
          <tr>
            <th scope="col">{{ 'gdoTradeTerms.field.contract' | translate }}</th>
            <th scope="col">{{ 'gdoTradeTerms.field.retailer' | translate }}</th>
            <th scope="col">{{ 'gdoTradeTerms.field.jurisdiction' | translate }}</th>
            <th scope="col">{{ 'gdoTradeTerms.field.period' | translate }}</th>
            <th scope="col" class="num">{{ 'gdoTradeTerms.field.onInvoiceDiscount' | translate }}</th>
            <th scope="col">{{ 'gdoTradeTerms.field.status' | translate }}</th>
            <th scope="col"></th>
          </tr>
        </thead>
        <tbody>
          @for (contract of table.data; track contract.id) {
            <tr>
              <th scope="row">
                <a [routerLink]="['/gdo-trade-terms/contracts', contract.id]">{{ contract.code }}</a>
                <small class="muted">{{ contract.name }}</small>
              </th>
              <td>{{ contract.contact?.name }}</td>
              <td>{{ 'gdoTradeTerms.jurisdiction.' + contract.jurisdiction | translate }}</td>
              <td>{{ contract.starts_on }} – {{ contract.ends_on }}</td>
              <td class="num">{{ pct(contract.effective_on_invoice_discount_percent) }}</td>
              <td>
                <nz-tag [nzColor]="color(contract.status)">{{ 'gdoTradeTerms.contractStatus.' + contract.status | translate }}</nz-tag>
              </td>
              <td>
                <button nz-button nzSize="small" type="button" (click)="open(contract.id)">
                  {{ 'gdoTradeTerms.action.open' | translate }}
                </button>
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="7">
                <nz-empty [nzNotFoundContent]="'gdoTradeTerms.empty.contracts' | translate"></nz-empty>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-spin>

    <nz-modal
      [nzVisible]="creating()"
      nzWidth="860px"
      [nzTitle]="'gdoTradeTerms.action.newContract' | translate"
      [nzFooter]="null"
      (nzOnCancel)="creating.set(false)"
    >
      <ng-container *nzModalContent>
        <app-gdt-contract-form
          [customers]="store.customers()"
          [accounts]="[]"
          [saving]="store.saving()"
          [error]="createError()"
          (submitted)="create($event)"
        ></app-gdt-contract-form>
      </ng-container>
    </nz-modal>
  `,
})
export class ContractsComponent implements OnInit {
  protected readonly store = inject(ContractsStore);
  private readonly router = inject(Router);

  protected readonly statuses = GDT_CONTRACT_STATUSES;
  protected readonly jurisdictions = GDT_JURISDICTIONS;
  protected readonly search = signal('');
  protected readonly creating = signal(false);
  protected readonly createError = signal<GdtOutcome | null>(null);

  ngOnInit(): void {
    void this.store.init();
  }

  protected color = contractStatusColor;
  protected pct = percentText;

  protected open(id: string): void {
    void this.router.navigate(['/gdo-trade-terms/contracts', id]);
  }

  protected openCreate(): void {
    this.createError.set(null);
    this.creating.set(true);
  }

  protected async create(payload: GdtContractPayload): Promise<void> {
    const outcome = await this.store.create(payload);
    if (!outcome.ok) {
      this.createError.set(outcome);
      return;
    }
    this.creating.set(false);
    const created = this.store.created();
    if (created) {
      this.open(created.id);
    }
  }
}
