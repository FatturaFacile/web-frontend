import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { VendorClaim } from '@core';
import { CurrencyFormatPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { VendorClaimStore } from '../../state/vendor-claim.store';
import {
  nextVendorClaimStatuses,
  toAmount,
  VENDOR_CLAIM_STATUSES,
  vendorClaimTag,
} from '../../utils/rma-status';
import { StatusTagComponent } from '../shared/status-tag.component';
import { ClaimEditDialogComponent } from './claim-edit-dialog.component';
import { ClaimTransitionDialogComponent } from './claim-transition-dialog.component';

/** Supplier warranty claim-backs created by covered RMA diagnoses. */
@Component({
  selector: 'app-vendor-claims',
  imports: [
    FormsModule,
    RouterLink,
    NzButtonModule,
    NzCardModule,
    NzSelectModule,
    NzTableModule,
    PageHeaderComponent,
    TranslatePipe,
    CurrencyFormatPipe,
    StatusTagComponent,
    ClaimEditDialogComponent,
    ClaimTransitionDialogComponent,
  ],
  template: `
    <app-page-header
      [title]="'RMA.CLAIMS.TITLE' | translate"
      [subtitle]="'RMA.CLAIMS.SUBTITLE' | translate"
    />
    <nz-card>
      <div class="rma-toolbar">
        <label for="vc-status">{{ 'COMMON.STATUS' | translate }}</label>
        <nz-select
          nzId="vc-status"
          class="vc-filter"
          nzAllowClear
          [nzPlaceHolder]="'COMMON.ALL' | translate"
          [ngModel]="store.filters().status"
          (ngModelChange)="store.setFilters({ status: $event ?? null })"
        >
          @for (s of statuses; track s) {
            <nz-option [nzValue]="s" [nzLabel]="vendorClaimTag(s).labelKey | translate" />
          }
        </nz-select>
        @if (store.filters().rma_order_id) {
          <button nz-button type="button" (click)="store.setFilters({ rma_order_id: null })">
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>&nbsp;{{
              'RMA.CLAIMS.CLEAR_RMA_FILTER' | translate
            }}
          </button>
        }
      </div>

      @if (store.error()) {
        <p class="rma-form-error" role="alert">{{ 'RMA.ERRORS.LOAD_FAILED' | translate }}</p>
      }

      <nz-table
        #table
        [nzData]="store.items()"
        [nzLoading]="store.isLoading()"
        [nzFrontPagination]="false"
        [nzTotal]="store.meta()?.total ?? 0"
        [nzPageSize]="store.meta()?.per_page ?? 25"
        [nzPageIndex]="store.page()"
        (nzPageIndexChange)="store.setPage($event)"
        [nzScroll]="{ x: '1000px' }"
        nzSize="middle"
      >
        <thead>
          <tr>
            <th scope="col">{{ 'RMA.FIELDS.RMA_NUMBER' | translate }}</th>
            <th scope="col">{{ 'RMA.CLAIMS.SUPPLIER' | translate }}</th>
            <th scope="col">{{ 'RMA.FIELDS.DEFECTIVE_SERIAL' | translate }}</th>
            <th scope="col">{{ 'COMMON.STATUS' | translate }}</th>
            <th scope="col">{{ 'RMA.CLAIMS.SUPPLIER_RMA' | translate }}</th>
            <th scope="col">{{ 'RMA.CLAIMS.AMOUNT' | translate }}</th>
            <th scope="col">{{ 'RMA.CLAIMS.CREDIT_NOTE' | translate }}</th>
            <th scope="col">{{ 'COMMON.ACTIONS' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (c of table.data; track c.id) {
            <tr>
              <td>
                <a routerLink="/warranty-rma/bench" [queryParams]="{ rma: c.rma_order_id }">{{
                  c.rma_number
                }}</a>
              </td>
              <td>{{ c.supplier?.name ?? c.original_supplier_id }}</td>
              <td>{{ c.defective_part_serial }}</td>
              <td><app-rma-status-tag [tag]="vendorClaimTag(c.status)" /></td>
              <td>{{ c.supplier_rma_reference ?? '-' }}</td>
              <td>{{ toAmount(c.claimed_amount) | appCurrency: c.currency || 'EUR' }}</td>
              <td>{{ c.credit_note_reference ?? '-' }}</td>
              <td>
                <button nz-button nzSize="small" type="button" (click)="edit(c)">
                  {{ 'RMA.CLAIMS.EDIT' | translate }}
                </button>
                @if (nextVendorClaimStatuses(c.status).length) {
                  <button
                    nz-button
                    nzSize="small"
                    nzType="primary"
                    type="button"
                    (click)="transition(c)"
                  >
                    {{ 'RMA.CLAIMS.TRANSITION' | translate }}
                  </button>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    <app-claim-edit-dialog [(open)]="editOpen" [claim]="selected()" />
    <app-claim-transition-dialog [(open)]="transitionOpen" [claim]="selected()" />
  `,
  styles: `
    .vc-filter {
      width: 220px;
    }
  `,
})
export class VendorClaimsComponent implements OnInit {
  readonly store = inject(VendorClaimStore);
  private readonly route = inject(ActivatedRoute);

  readonly statuses = VENDOR_CLAIM_STATUSES;
  readonly selected = signal<VendorClaim | null>(null);
  readonly editOpen = signal(false);
  readonly transitionOpen = signal(false);

  readonly vendorClaimTag = vendorClaimTag;
  readonly nextVendorClaimStatuses = nextVendorClaimStatuses;
  readonly toAmount = toAmount;

  ngOnInit(): void {
    const rma = this.route.snapshot.queryParamMap.get('rma');
    if (rma) {
      this.store.setFilters({ rma_order_id: rma });
      return;
    }
    this.store.loadList();
  }

  edit(claim: VendorClaim): void {
    this.selected.set(claim);
    this.editOpen.set(true);
  }

  transition(claim: VendorClaim): void {
    this.selected.set(claim);
    this.transitionOpen.set(true);
  }
}
