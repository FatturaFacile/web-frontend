import { DatePipe } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { LoanerStore } from '../../state/loaner.store';
import { isLoanerOverdue, loanerStatusTag } from '../../utils/rma-status';
import { StatusTagComponent } from '../shared/status-tag.component';

/** Loaner register ("prestito d'uso" / "conto riparazione") with overdue flagging. */
@Component({
  selector: 'app-loaner-register',
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    NzButtonModule,
    NzCardModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSwitchModule,
    NzTableModule,
    PageHeaderComponent,
    TranslatePipe,
    StatusTagComponent,
  ],
  template: `
    <app-page-header
      [title]="'RMA.LOANER.TITLE' | translate"
      [subtitle]="'RMA.LOANER.SUBTITLE' | translate"
    />
    <nz-card>
      <div class="rma-toolbar">
        <label for="ln-filter-register">{{ 'RMA.LOANER.REGISTER' | translate }}</label>
        <nz-select
          nzId="ln-filter-register"
          class="ln-filter"
          nzAllowClear
          [nzPlaceHolder]="'COMMON.ALL' | translate"
          [ngModel]="store.filters().register_type"
          (ngModelChange)="store.setFilters({ register_type: $event ?? null })"
        >
          <nz-option nzValue="prestito_uso" [nzLabel]="'RMA.REGISTER.PRESTITO_USO' | translate" />
          <nz-option
            nzValue="conto_riparazione"
            [nzLabel]="'RMA.REGISTER.CONTO_RIPARAZIONE' | translate"
          />
        </nz-select>
        <label for="ln-filter-status">{{ 'COMMON.STATUS' | translate }}</label>
        <nz-select
          nzId="ln-filter-status"
          class="ln-filter"
          nzAllowClear
          [nzPlaceHolder]="'COMMON.ALL' | translate"
          [ngModel]="store.filters().status"
          (ngModelChange)="store.setFilters({ status: $event ?? null })"
        >
          @for (s of statuses; track s) {
            <nz-option [nzValue]="s" [nzLabel]="loanerStatusTag(s).labelKey | translate" />
          }
        </nz-select>
        <span class="ln-switch">
          <nz-switch
            nzId="ln-filter-overdue"
            [ngModel]="store.filters().overdue"
            (ngModelChange)="store.setFilters({ overdue: $event })"
          />
          <label for="ln-filter-overdue">{{ 'RMA.LOANER.ONLY_OVERDUE' | translate }}</label>
        </span>
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
        [nzScroll]="{ x: '900px' }"
        nzSize="middle"
      >
        <thead>
          <tr>
            <th scope="col">{{ 'RMA.LOANER.SERIAL' | translate }}</th>
            <th scope="col">{{ 'RMA.LOANER.REGISTER' | translate }}</th>
            <th scope="col">{{ 'COMMON.STATUS' | translate }}</th>
            <th scope="col">{{ 'RMA.LOANER.ISSUED_AT' | translate }}</th>
            <th scope="col">{{ 'RMA.LOANER.EXPECTED_RETURN' | translate }}</th>
            <th scope="col">{{ 'RMA.LOANER.DAYS_OUTSTANDING' | translate }}</th>
            <th scope="col">{{ 'RMA.FIELDS.RMA_NUMBER' | translate }}</th>
            <th scope="col">{{ 'COMMON.ACTIONS' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (l of table.data; track l.id) {
            <tr [class.ln-overdue-row]="isLoanerOverdue(l)">
              <td>{{ l.loaner_serial_number }}</td>
              <td>{{ 'RMA.REGISTER.' + l.register_type.toUpperCase() | translate }}</td>
              <td>
                <app-rma-status-tag [tag]="loanerStatusTag(l.status)" />
                @if (isLoanerOverdue(l)) {
                  <span class="ln-overdue">
                    <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
                    {{ 'RMA.LOANER.OVERDUE_DAYS' | translate: { days: l.days_outstanding } }}
                  </span>
                }
              </td>
              <td>{{ l.issued_at | date: 'mediumDate' }}</td>
              <td>{{ (l.expected_return_at | date: 'mediumDate') ?? '-' }}</td>
              <td>{{ l.days_outstanding }}</td>
              <td>
                <a routerLink="/warranty-rma/bench" [queryParams]="{ rma: l.rma_order_id }">{{
                  'RMA.PASSPORT.OPEN_RMA' | translate
                }}</a>
              </td>
              <td>
                @if (l.status === 'issued') {
                  <button
                    nz-button
                    nzSize="small"
                    type="button"
                    nz-popconfirm
                    [nzPopconfirmTitle]="'RMA.CONFIRM.LOANER_RETURN' | translate"
                    (nzOnConfirm)="store.returnLoaner(l.id)"
                    [nzLoading]="store.busyId() === l.id"
                  >
                    {{ 'RMA.ACTIONS.LOANER_RETURN' | translate }}
                  </button>
                  <button
                    nz-button
                    nzSize="small"
                    nzDanger
                    type="button"
                    nz-popconfirm
                    [nzPopconfirmTitle]="'RMA.CONFIRM.LOANER_LOST' | translate"
                    (nzOnConfirm)="store.markLost(l.id)"
                    [disabled]="store.busyId() === l.id"
                  >
                    {{ 'RMA.ACTIONS.LOANER_LOST' | translate }}
                  </button>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>
  `,
  styles: `
    .ln-filter {
      width: 200px;
    }
    .ln-switch {
      display: inline-flex;
      gap: 8px;
      align-items: center;
    }
    .ln-overdue {
      display: inline-block;
      margin-left: 4px;
      color: var(--ff-color-danger);
      font-weight: 600;
    }
    .ln-overdue-row td:first-child {
      border-left: 4px solid var(--ff-color-danger);
    }
  `,
})
export class LoanerRegisterComponent implements OnInit {
  readonly store = inject(LoanerStore);
  private readonly route = inject(ActivatedRoute);

  readonly statuses = ['issued', 'returned', 'lost'] as const;
  readonly loanerStatusTag = loanerStatusTag;
  readonly isLoanerOverdue = isLoanerOverdue;

  ngOnInit(): void {
    if (this.route.snapshot.queryParamMap.get('overdue') === '1') {
      this.store.setFilters({ overdue: true });
      return;
    }
    this.store.loadList();
  }
}
