import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { RETURNS_COVERAGE_TYPES, ReturnsApiService, ReturnsCoverageType, ReturnsWarranty, ReturnsWarrantyRequest, TranslateService } from '@core';
import { IconActionDirective, ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { ReturnsLookupsService } from './returns-lookups.service';
import { apiErrorText, oneYearAfter, todayIso, warrantyColor } from './returns.util';

type WarrantyView = 'all' | 'expiring30' | 'expiring60' | 'expiring90' | 'expired';

/** Warranty registry: units and batches sold with a warranty, the expiring ones, validity check and voiding. */
@Component({
  selector: 'app-returns-warranties',
  styleUrl: './returns.scss',
  imports: [
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
    NzSelectModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'RETURNS.WARRANTIES_TITLE' | translate" [subtitle]="'RETURNS.WARRANTIES_SUBTITLE' | translate">
      <button nz-button nzType="primary" (click)="openCreate()" appIconAction="create"></button>
    </app-page-header>

    <div class="toolbar">
      <nz-select style="width: 220px" [ngModel]="view()" (ngModelChange)="view.set($event); load()" [attr.aria-label]="'RETURNS.WARRANTY_VIEW' | translate">
        @for (option of views; track option) {
          <nz-option [nzValue]="option" [nzLabel]="('RETURNS.VIEW_' + option.toUpperCase()) | translate"></nz-option>
        }
      </nz-select>
      <input nz-input style="width: 240px" [ngModel]="search()" (ngModelChange)="search.set($event)" (keyup.enter)="load()" [placeholder]="'RETURNS.SEARCH_SERIAL' | translate" />
    </div>

    <nz-card class="main-card">
      <nz-table #table [nzData]="warranties()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="25">
        <thead>
          <tr>
            <th>{{ 'RETURNS.PRODUCT' | translate }}</th>
            <th>{{ 'RETURNS.SERIAL_OR_LOT' | translate }}</th>
            <th>{{ 'RETURNS.CUSTOMER' | translate }}</th>
            <th>{{ 'RETURNS.PERIOD' | translate }}</th>
            <th>{{ 'RETURNS.COVERAGE' | translate }}</th>
            <th>{{ 'RETURNS.STATUS' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <td>{{ row.product_sku }} <span class="muted">{{ row.product_name }}</span></td>
              <td>{{ row.serial_number || row.lot_number }}</td>
              <td>{{ row.customer_name }}</td>
              <td>{{ row.starts_on }} - {{ row.ends_on }}</td>
              <td>{{ ('RETURNS.COVERAGE_' + row.coverage_type.toUpperCase()) | translate }}</td>
              <td>
                <nz-tag [nzColor]="color(row)">
                  {{ (row.validity.valid ? 'RETURNS.WARRANTY_VALID' : 'RETURNS.WARRANTY_' + (row.validity.reason ?? 'void').toUpperCase()) | translate }}
                </nz-tag>
              </td>
              <td>
                <button nz-button nzType="text" (click)="check(row)">{{ 'RETURNS.CHECK_VALIDITY' | translate }}</button>
                @if (row.status === 'active') {
                  <button nz-button nzType="text" (click)="openEdit(row)" appIconAction="edit"></button>
                  <button nz-button nzType="text" nzDanger (click)="openVoid(row)">{{ 'RETURNS.VOID' | translate }}</button>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && warranties().length === 0) {
        <nz-empty [nzNotFoundContent]="'RETURNS.NO_WARRANTIES' | translate"></nz-empty>
      }
    </nz-card>

    <nz-modal appModalActions
      [(nzVisible)]="createVisible"
      [nzTitle]="(editing() ? 'RETURNS.EDIT_WARRANTY' : 'RETURNS.NEW_WARRANTY') | translate"
      (nzOnCancel)="createVisible.set(false)"
      (nzOnOk)="save()"
      okAction="save"
      [nzOkDisabled]="form.invalid"
      nzWidth="640px"
    >
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="form" nzLayout="vertical">
          @if (!editing()) {
            <div class="form-row">
              <nz-form-item>
                <nz-form-label nzRequired>{{ 'RETURNS.PRODUCT' | translate }}</nz-form-label>
                <nz-form-control>
                  <nz-select formControlName="product_id" nzShowSearch nzServerSearch (nzOnSearch)="lookups.searchProducts($event)">
                    @for (product of lookups.products(); track product.id) {
                      <nz-option [nzValue]="product.id" [nzLabel]="product.label"></nz-option>
                    }
                  </nz-select>
                </nz-form-control>
              </nz-form-item>
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
            </div>
            <div class="form-row">
              <nz-form-item>
                <nz-form-label>{{ 'RETURNS.SERIAL_NUMBER' | translate }}</nz-form-label>
                <nz-form-control><input nz-input formControlName="serial_number" maxlength="100" /></nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label>{{ 'RETURNS.LOT_NUMBER' | translate }}</nz-form-label>
                <nz-form-control><input nz-input formControlName="lot_number" maxlength="100" /></nz-form-control>
              </nz-form-item>
            </div>
            <p class="muted">{{ 'RETURNS.SERIAL_OR_LOT_HINT' | translate }}</p>
          }
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'RETURNS.STARTS_ON' | translate }}</nz-form-label>
              <nz-form-control><input nz-input type="date" formControlName="starts_on" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'RETURNS.ENDS_ON' | translate }}</nz-form-label>
              <nz-form-control><input nz-input type="date" formControlName="ends_on" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'RETURNS.COVERAGE' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="coverage_type">
                  @for (type of coverageTypes; track type) {
                    <nz-option [nzValue]="type" [nzLabel]="('RETURNS.COVERAGE_' + type.toUpperCase()) | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-label>{{ 'RETURNS.COVERAGE_TERMS' | translate }}</nz-form-label>
            <nz-form-control><textarea nz-input rows="2" formControlName="coverage_terms"></textarea></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal appModalActions
      [(nzVisible)]="voidVisible"
      [nzTitle]="'RETURNS.VOID_WARRANTY' | translate"
      (nzOnCancel)="voidVisible.set(false)"
      (nzOnOk)="confirmVoid()"
      okAction="confirm"
      [nzOkDisabled]="voidReason().trim() === ''"
    >
      <ng-container *nzModalContent>
        <nz-form-item>
          <nz-form-label nzRequired>{{ 'RETURNS.VOID_REASON' | translate }}</nz-form-label>
          <nz-form-control>
            <textarea nz-input rows="3" [ngModel]="voidReason()" (ngModelChange)="voidReason.set($event)"></textarea>
          </nz-form-control>
        </nz-form-item>
      </ng-container>
    </nz-modal>
  `,
})
export class ReturnsWarrantiesComponent implements OnInit {
  private readonly api = inject(ReturnsApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly lookups = inject(ReturnsLookupsService);

  readonly views: readonly WarrantyView[] = ['all', 'expiring30', 'expiring60', 'expiring90', 'expired'];
  readonly coverageTypes = RETURNS_COVERAGE_TYPES;
  readonly warranties = signal<ReturnsWarranty[]>([]);
  readonly loading = signal(false);
  readonly view = signal<WarrantyView>('all');
  readonly search = signal('');
  readonly createVisible = signal(false);
  readonly editing = signal<ReturnsWarranty | null>(null);
  readonly voidVisible = signal(false);
  readonly voidReason = signal('');
  private voiding: ReturnsWarranty | null = null;

  readonly form = this.fb.group({
    product_id: ['', [Validators.required]],
    contact_id: ['', [Validators.required]],
    serial_number: [''],
    lot_number: [''],
    starts_on: [todayIso(), [Validators.required]],
    ends_on: [oneYearAfter(todayIso()), [Validators.required]],
    coverage_type: ['full' as ReturnsCoverageType, [Validators.required]],
    coverage_terms: [''],
  });

  ngOnInit(): void {
    this.load();
  }

  color(warranty: ReturnsWarranty): string {
    return warrantyColor(warranty);
  }

  load(): void {
    const view = this.view();
    this.loading.set(true);
    this.api
      .getWarranties({
        search: this.search() || undefined,
        expiring: view.startsWith('expiring') ? Number(view.replace('expiring', '')) : undefined,
        expired: view === 'expired' ? true : undefined,
        per_page: 100,
      })
      .subscribe({
        next: (response) => {
          this.warranties.set(response.data);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.message.error(this.translate.instant('RETURNS.ACTION_ERROR'));
        },
      });
  }

  openCreate(): void {
    this.editing.set(null);
    this.form.reset({ product_id: '', contact_id: '', serial_number: '', lot_number: '', starts_on: todayIso(), ends_on: oneYearAfter(todayIso()), coverage_type: 'full', coverage_terms: '' });
    this.form.controls.product_id.enable();
    this.form.controls.contact_id.enable();
    this.lookups.searchProducts();
    this.lookups.searchCustomers();
    this.createVisible.set(true);
  }

  openEdit(warranty: ReturnsWarranty): void {
    this.editing.set(warranty);
    this.form.reset({
      product_id: warranty.product_id,
      contact_id: warranty.contact_id,
      serial_number: warranty.serial_number ?? '',
      lot_number: warranty.lot_number ?? '',
      starts_on: warranty.starts_on,
      ends_on: warranty.ends_on,
      coverage_type: warranty.coverage_type,
      coverage_terms: warranty.coverage_terms ?? '',
    });
    this.form.controls.product_id.disable();
    this.form.controls.contact_id.disable();
    this.createVisible.set(true);
  }

  save(): void {
    const value = this.form.getRawValue();
    const editing = this.editing();

    if (editing !== null) {
      this.api
        .updateWarranty(editing.id, { starts_on: value.starts_on, ends_on: value.ends_on, coverage_type: value.coverage_type, coverage_terms: value.coverage_terms || null })
        .subscribe(this.saved());

      return;
    }

    const payload: ReturnsWarrantyRequest = {
      product_id: value.product_id,
      contact_id: value.contact_id,
      serial_number: value.serial_number || null,
      lot_number: value.lot_number || null,
      starts_on: value.starts_on,
      ends_on: value.ends_on,
      coverage_type: value.coverage_type,
      coverage_terms: value.coverage_terms || null,
    };
    this.api.createWarranty(payload).subscribe(this.saved());
  }

  check(warranty: ReturnsWarranty): void {
    this.api.checkWarrantyValidity(warranty.id).subscribe({
      next: (response) => {
        const validity = response.data;
        if (validity.valid) {
          this.message.success(this.translate.instant('RETURNS.VALIDITY_OK', { days: validity.days_left }));
        } else {
          this.message.warning(this.translate.instant(`RETURNS.WARRANTY_${(validity.reason ?? 'void').toUpperCase()}`));
        }
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('RETURNS.ACTION_ERROR')),
    });
  }

  openVoid(warranty: ReturnsWarranty): void {
    this.voiding = warranty;
    this.voidReason.set('');
    this.voidVisible.set(true);
  }

  confirmVoid(): void {
    if (this.voiding === null) {
      return;
    }

    this.api.voidWarranty(this.voiding.id, this.voidReason()).subscribe({
      next: () => {
        this.message.success(this.translate.instant('RETURNS.WARRANTY_VOIDED'));
        this.voidVisible.set(false);
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('RETURNS.ACTION_ERROR')),
    });
  }

  private saved(): { next: () => void; error: (error: unknown) => void } {
    return {
      next: () => {
        this.message.success(this.translate.instant('RETURNS.WARRANTY_SAVED'));
        this.createVisible.set(false);
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('RETURNS.ACTION_ERROR')),
    };
  }
}
