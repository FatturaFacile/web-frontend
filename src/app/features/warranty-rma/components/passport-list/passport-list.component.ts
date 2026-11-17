import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { EquipmentPassport } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { PassportStore } from '../../state/passport.store';
import { CustomerSelectComponent } from '../shared/customer-select.component';
import { PassportFormDialogComponent } from './passport-form-dialog.component';

/** Equipment passports with serial / customer / jurisdiction / warranty filters. */
@Component({
  selector: 'app-passport-list',
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    NzButtonModule,
    NzCardModule,
    NzInputModule,
    NzSelectModule,
    NzTableModule,
    PageHeaderComponent,
    TranslatePipe,
    CustomerSelectComponent,
    PassportFormDialogComponent,
  ],
  template: `
    <app-page-header
      [title]="'RMA.PASSPORT.LIST_TITLE' | translate"
      [subtitle]="'RMA.PASSPORT.LIST_SUBTITLE' | translate"
    />
    <nz-card>
      <form
        class="rma-toolbar"
        role="search"
        (ngSubmit)="store.setFilters({ serial_number: serial().trim() || null })"
      >
        <label for="pl-serial">{{ 'RMA.FIELDS.SERIAL' | translate }}</label>
        <input
          nz-input
          id="pl-serial"
          name="serial"
          class="pl-filter"
          [ngModel]="serial()"
          (ngModelChange)="serial.set($event)"
        />
        <label for="pl-customer">{{ 'RMA.FIELDS.CUSTOMER' | translate }}</label>
        <app-customer-select
          class="pl-filter"
          inputId="pl-customer"
          name="customer"
          [ngModel]="store.filters().customer_id"
          (ngModelChange)="store.setFilters({ customer_id: $event ?? null })"
          [placeholder]="'COMMON.ALL' | translate"
        />
        <label for="pl-jurisdiction">{{ 'RMA.PASSPORT.JURISDICTION' | translate }}</label>
        <nz-select
          nzId="pl-jurisdiction"
          name="jurisdiction"
          class="pl-filter-small"
          nzAllowClear
          [nzPlaceHolder]="'COMMON.ALL' | translate"
          [ngModel]="store.filters().jurisdiction"
          (ngModelChange)="store.setFilters({ jurisdiction: $event ?? null })"
        >
          <nz-option nzValue="CH" [nzLabel]="'COMMON.SWITZERLAND' | translate" />
          <nz-option nzValue="IT" [nzLabel]="'COMMON.ITALY' | translate" />
        </nz-select>
        <label for="pl-warranty">{{ 'RMA.LOOKUP.WARRANTY' | translate }}</label>
        <nz-select
          nzId="pl-warranty"
          name="warranty"
          class="pl-filter-small"
          nzAllowClear
          [nzPlaceHolder]="'COMMON.ALL' | translate"
          [ngModel]="store.filters().warranty"
          (ngModelChange)="store.setFilters({ warranty: $event ?? null })"
        >
          <nz-option nzValue="in" [nzLabel]="'RMA.LOOKUP.IN_WARRANTY' | translate" />
          <nz-option nzValue="out" [nzLabel]="'RMA.LOOKUP.OUT_OF_WARRANTY' | translate" />
        </nz-select>
        <button nz-button type="submit">
          <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>&nbsp;{{
            'COMMON.SEARCH' | translate
          }}
        </button>
        <button nz-button nzType="primary" type="button" (click)="formOpen.set(true)">
          <i class="fa-solid fa-plus" aria-hidden="true"></i>&nbsp;{{
            'RMA.PASSPORT.NEW' | translate
          }}
        </button>
      </form>

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
        [nzScroll]="{ x: '800px' }"
        nzSize="middle"
      >
        <thead>
          <tr>
            <th scope="col">{{ 'RMA.FIELDS.SERIAL' | translate }}</th>
            <th scope="col">{{ 'RMA.FIELDS.CUSTOMER' | translate }}</th>
            <th scope="col">{{ 'RMA.PASSPORT.JURISDICTION' | translate }}</th>
            <th scope="col">{{ 'RMA.PASSPORT.DELIVERY_DATE' | translate }}</th>
            <th scope="col">{{ 'RMA.LOOKUP.EXPIRY' | translate }}</th>
            <th scope="col">{{ 'RMA.LOOKUP.POLICY' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (p of table.data; track p.id) {
            <tr>
              <td>
                <a [routerLink]="[p.id]">{{ p.serial_number }}</a>
              </td>
              <td>{{ p.customer?.name ?? '-' }}</td>
              <td>
                {{ p.jurisdiction }} &middot;
                {{ 'RMA.CUSTOMER_TYPE.' + p.customer_type.toUpperCase() | translate }}
              </td>
              <td>{{ p.delivery_date | date: 'mediumDate' }}</td>
              <td>{{ p.warranty_expiry_date | date: 'mediumDate' }}</td>
              <td>{{ 'RMA.POLICY.' + p.warranty_policy_type.toUpperCase() | translate }}</td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    <app-passport-form-dialog [(open)]="formOpen" (created)="onCreated($event)" />
  `,
  styles: `
    .pl-filter {
      width: 220px;
    }
    .pl-filter-small {
      width: 160px;
    }
  `,
})
export class PassportListComponent implements OnInit {
  readonly store = inject(PassportStore);
  private readonly router = inject(Router);

  readonly serial = signal('');
  readonly formOpen = signal(false);

  ngOnInit(): void {
    this.store.loadList();
  }

  onCreated(passport: EquipmentPassport): void {
    void this.router.navigate(['/warranty-rma/passports', passport.id]);
  }
}
