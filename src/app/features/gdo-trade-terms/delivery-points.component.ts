import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { GDT_DELIVERY_POINT_TYPES, GdtDeliveryPoint, GdtDeliveryPointType } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { DeliveryPointsStore } from './delivery-points.store';
import { GdtOutcome } from './gdo-trade-terms.util';

/** Stores, Ce.Di. (distribution centres) and head offices of the retailers: what a scale or promotion can be limited to. */
@Component({
  selector: 'app-gdt-delivery-points',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCheckboxModule,
    NzEmptyModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    ReactiveFormsModule,
    TranslatePipe,
  ],
  providers: [DeliveryPointsStore],
  styleUrl: './gdo-trade-terms.scss',
  template: `
    <app-page-header [title]="'PAGE_TITLE.GDO_TRADE_TERMS_DELIVERY_POINTS' | translate"></app-page-header>

    <div class="toolbar">
      <label class="field" for="gdt-dp-retailer">
        <span>{{ 'gdoTradeTerms.field.retailer' | translate }}</span>
        <nz-select
          nzId="gdt-dp-retailer"
          nzAllowClear
          nzShowSearch
          [nzPlaceHolder]="'gdoTradeTerms.action.all' | translate"
          [ngModel]="store.contactId()"
          (ngModelChange)="store.setFilters({ contactId: $event ?? null })"
        >
          @for (customer of store.customers(); track customer.id) {
            <nz-option [nzValue]="customer.id" [nzLabel]="customer.name"></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="gdt-dp-search">
        <span>{{ 'gdoTradeTerms.field.search' | translate }}</span>
        <input
          nz-input
          id="gdt-dp-search"
          maxlength="60"
          [ngModel]="search()"
          (ngModelChange)="search.set($event)"
          (keyup.enter)="store.setFilters({ search: search() })"
        />
      </label>
      <button nz-button type="button" (click)="store.setFilters({ search: search() })">{{ 'gdoTradeTerms.action.search' | translate }}</button>
      <span class="spacer"></span>
      <button nz-button nzType="primary" type="button" (click)="openForm(null)">{{ 'gdoTradeTerms.action.newDeliveryPoint' | translate }}</button>
    </div>

    @if (store.error(); as error) {
      <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="error | translate"></nz-alert>
    }
    @if (feedback(); as failure) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        nzCloseable
        [nzMessage]="(failure.errorKey ?? 'gdoTradeTerms.error.generic') | translate: failure.params"
        [nzDescription]="failure.detail ?? undefined"
        (nzOnClose)="feedback.set(null)"
      ></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      <nz-table #table nzSize="small" [nzData]="store.points()" [nzShowPagination]="false">
        <thead>
          <tr>
            <th scope="col">{{ 'gdoTradeTerms.field.code' | translate }}</th>
            <th scope="col">{{ 'gdoTradeTerms.field.name' | translate }}</th>
            <th scope="col">{{ 'gdoTradeTerms.field.retailer' | translate }}</th>
            <th scope="col">{{ 'gdoTradeTerms.field.pointType' | translate }}</th>
            <th scope="col">{{ 'gdoTradeTerms.field.city' | translate }}</th>
            <th scope="col">{{ 'gdoTradeTerms.field.active' | translate }}</th>
            <th scope="col"></th>
          </tr>
        </thead>
        <tbody>
          @for (point of table.data; track point.id) {
            <tr>
              <th scope="row">{{ point.code }}</th>
              <td>{{ point.name }}</td>
              <td>{{ store.customerName()(point.contact_id) }}</td>
              <td>{{ 'gdoTradeTerms.deliveryPointType.' + point.point_type | translate }}</td>
              <td>{{ point.postal_code }} {{ point.city }}</td>
              <td>
                <nz-tag [nzColor]="point.is_active ? 'green' : 'default'">
                  {{ (point.is_active ? 'gdoTradeTerms.field.active' : 'gdoTradeTerms.field.inactive') | translate }}
                </nz-tag>
              </td>
              <td>
                <button nz-button nzSize="small" type="button" (click)="openForm(point)">{{ 'gdoTradeTerms.action.edit' | translate }}</button>
                <button
                  nz-button
                  nzSize="small"
                  nzDanger
                  type="button"
                  nz-popconfirm
                  [nzPopconfirmTitle]="'gdoTradeTerms.confirm.deleteDeliveryPoint' | translate"
                  [nzOkText]="'gdoTradeTerms.action.delete' | translate"
                  [nzCancelText]="'gdoTradeTerms.action.cancel' | translate"
                  (nzOnConfirm)="remove(point)"
                >
                  {{ 'gdoTradeTerms.action.delete' | translate }}
                </button>
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="7"><nz-empty [nzNotFoundContent]="'gdoTradeTerms.empty.deliveryPoints' | translate"></nz-empty></td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-spin>

    <nz-modal
      [nzVisible]="editing()"
      [nzTitle]="'gdoTradeTerms.action.newDeliveryPoint' | translate"
      [nzOkText]="'gdoTradeTerms.action.save' | translate"
      [nzCancelText]="'gdoTradeTerms.action.cancel' | translate"
      [nzOkLoading]="store.saving()"
      [nzOkDisabled]="form.invalid"
      (nzOnOk)="save()"
      (nzOnCancel)="editing.set(false)"
    >
      <ng-container *nzModalContent>
        <form [formGroup]="form" class="form">
          @if (formError(); as failure) {
            <nz-alert
              nzType="error"
              nzShowIcon
              [nzMessage]="(failure.errorKey ?? 'gdoTradeTerms.error.generic') | translate: failure.params"
              [nzDescription]="failure.detail ?? undefined"
            ></nz-alert>
          }
          <label for="gdt-dp-contact">{{ 'gdoTradeTerms.field.retailer' | translate }}</label>
          <nz-select nzId="gdt-dp-contact" nzShowSearch formControlName="contact_id">
            @for (customer of store.customers(); track customer.id) {
              <nz-option [nzValue]="customer.id" [nzLabel]="customer.name"></nz-option>
            }
          </nz-select>
          <label for="gdt-dp-code">{{ 'gdoTradeTerms.field.code' | translate }}</label>
          <input nz-input id="gdt-dp-code" maxlength="40" formControlName="code" />
          <label for="gdt-dp-name">{{ 'gdoTradeTerms.field.name' | translate }}</label>
          <input nz-input id="gdt-dp-name" maxlength="160" formControlName="name" />
          <label for="gdt-dp-type">{{ 'gdoTradeTerms.field.pointType' | translate }}</label>
          <nz-select nzId="gdt-dp-type" formControlName="point_type">
            @for (type of types; track type) {
              <nz-option [nzValue]="type" [nzLabel]="'gdoTradeTerms.deliveryPointType.' + type | translate"></nz-option>
            }
          </nz-select>
          <label for="gdt-dp-city">{{ 'gdoTradeTerms.field.city' | translate }}</label>
          <input nz-input id="gdt-dp-city" maxlength="120" formControlName="city" />
          <label for="gdt-dp-postal">{{ 'gdoTradeTerms.field.postalCode' | translate }}</label>
          <input nz-input id="gdt-dp-postal" maxlength="20" formControlName="postal_code" />
          <label for="gdt-dp-country">{{ 'gdoTradeTerms.field.country' | translate }}</label>
          <input nz-input id="gdt-dp-country" maxlength="2" formControlName="country" />
          <label nz-checkbox for="gdt-dp-active" nzId="gdt-dp-active" formControlName="is_active">{{ 'gdoTradeTerms.field.active' | translate }}</label>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class DeliveryPointsComponent implements OnInit {
  protected readonly store = inject(DeliveryPointsStore);
  private readonly fb = inject(FormBuilder);

  protected readonly types = GDT_DELIVERY_POINT_TYPES;
  protected readonly search = signal('');
  protected readonly editing = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly formError = signal<GdtOutcome | null>(null);
  protected readonly feedback = signal<GdtOutcome | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    contact_id: ['', Validators.required],
    code: ['', [Validators.required, Validators.maxLength(40)]],
    name: ['', [Validators.required, Validators.maxLength(160)]],
    point_type: ['store' as GdtDeliveryPointType, Validators.required],
    city: [''],
    postal_code: [''],
    country: ['IT', [Validators.required, Validators.minLength(2), Validators.maxLength(2)]],
    is_active: [true],
  });

  ngOnInit(): void {
    void this.store.init();
  }

  protected openForm(point: GdtDeliveryPoint | null): void {
    this.formError.set(null);
    this.editingId.set(point?.id ?? null);
    this.form.reset({
      contact_id: point?.contact_id ?? this.store.contactId() ?? '',
      code: point?.code ?? '',
      name: point?.name ?? '',
      point_type: point?.point_type ?? 'store',
      city: point?.city ?? '',
      postal_code: point?.postal_code ?? '',
      country: point?.country ?? 'IT',
      is_active: point?.is_active ?? true,
    });
    this.editing.set(true);
  }

  protected async save(): Promise<void> {
    if (this.form.invalid) {
      return;
    }
    const value = this.form.getRawValue();
    const outcome = await this.store.save(this.editingId(), {
      contact_id: value.contact_id,
      code: value.code,
      name: value.name,
      point_type: value.point_type,
      city: value.city || null,
      postal_code: value.postal_code || null,
      country: value.country.toUpperCase(),
      is_active: value.is_active,
    });
    this.formError.set(outcome.ok ? null : outcome);
    if (outcome.ok) {
      this.editing.set(false);
    }
  }

  protected async remove(point: GdtDeliveryPoint): Promise<void> {
    const outcome = await this.store.remove(point.id);
    this.feedback.set(outcome.ok ? null : outcome);
  }
}
