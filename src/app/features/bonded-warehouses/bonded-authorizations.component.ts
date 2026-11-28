import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  BW_AEO_STATUSES,
  BW_CURRENCIES,
  BW_REGIME_TYPES,
  BW_WAREHOUSE_SUBTYPES,
  BwAuthorization,
  BwAuthorizationPayload,
  BwRegimeType,
  PermissionsService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { BondedAuthorizationStore, BondedLookupStore } from './bonded-warehouses.stores';
import {
  aeoColor,
  BONDED_WAREHOUSES_MODULE,
  BwOutcome,
  toNumber,
  utilizationColor,
  utilizationStatus,
} from './bonded-warehouses.util';

/**
 * Warehouse authorizations of the ADM (Italy / EU) and the UDSC / BAZG (Switzerland): regime, subtype, comprehensive guarantee (CGU) reference and
 * ceiling, AEO certificate and validity. The utilized guarantee is moved by the MRN ledger only, never edited here.
 */
@Component({
  selector: 'app-bonded-authorizations',
  imports: [
    CurrencyPipe,
    DatePipe,
    FormsModule,
    ReactiveFormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCheckboxModule,
    NzDrawerModule,
    NzEmptyModule,
    NzFormModule,
    NzInputModule,
    NzPopconfirmModule,
    NzProgressModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  providers: [BondedAuthorizationStore],
  styleUrl: './bonded-warehouses.scss',
  template: `
    <app-page-header
      [title]="'PAGE_TITLE.BONDED_WAREHOUSES_AUTHORIZATIONS' | translate"
      [subtitle]="'bondedWarehouses.section.authorizationsSubtitle' | translate"
    ></app-page-header>

    @if (store.error(); as error) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        [nzMessage]="error | translate"
      ></nz-alert>
    }
    @if (notice(); as text) {
      <nz-alert
        class="feedback"
        nzType="success"
        nzShowIcon
        nzCloseable
        [nzMessage]="text | translate"
      ></nz-alert>
    }
    @if (formError(); as error) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        [nzMessage]="error.key | translate: error.params"
      ></nz-alert>
    }

    <div class="toolbar">
      <label class="field" for="bw-au-search">
        <span>{{ 'bondedWarehouses.filter.search' | translate }}</span>
        <input nz-input id="bw-au-search" [(ngModel)]="search" (keyup.enter)="reload()" />
      </label>
      <label class="field" for="bw-au-regime">
        <span>{{ 'bondedWarehouses.filter.regime' | translate }}</span>
        <nz-select nzId="bw-au-regime" nzAllowClear [(ngModel)]="regime" (ngModelChange)="reload()">
          @for (item of regimes; track item) {
            <nz-option
              [nzValue]="item"
              [nzLabel]="'bondedWarehouses.regime.' + item | translate"
            ></nz-option>
          }
        </nz-select>
      </label>
      <span class="spacer"></span>
      @if (canWrite) {
        <button
          nz-button
          nzType="primary"
          type="button"
          data-test="new-authorization"
          (click)="openForm(null)"
        >
          {{ 'bondedWarehouses.action.newAuthorization' | translate }}
        </button>
      }
    </div>

    <nz-spin [nzSpinning]="store.loading()">
      <nz-table
        #auth
        nzSize="small"
        [nzData]="store.items()"
        [nzShowPagination]="false"
        [nzScroll]="{ x: '1100px' }"
      >
        <thead>
          <tr>
            <th scope="col">{{ 'bondedWarehouses.column.authorization' | translate }}</th>
            <th scope="col">{{ 'bondedWarehouses.column.regime' | translate }}</th>
            <th scope="col">{{ 'bondedWarehouses.column.office' | translate }}</th>
            <th scope="col">{{ 'bondedWarehouses.column.warehouse' | translate }}</th>
            <th scope="col">{{ 'bondedWarehouses.column.cguGauge' | translate }}</th>
            <th scope="col">{{ 'bondedWarehouses.column.aeoStatus' | translate }}</th>
            <th scope="col">{{ 'bondedWarehouses.column.validity' | translate }}</th>
            <th scope="col">{{ 'bondedWarehouses.column.active' | translate }}</th>
            <th scope="col"></th>
          </tr>
        </thead>
        <tbody>
          @for (row of auth.data; track row.id) {
            <tr [attr.data-test]="'auth-' + row.id">
              <td>{{ row.authorization_code }}</td>
              <td>
                {{ 'bondedWarehouses.regime.' + row.regime_type | translate }}
                <nz-tag>{{
                  'bondedWarehouses.subtype.' + row.warehouse_subtype | translate
                }}</nz-tag>
              </td>
              <td>{{ row.customs_office_code }}</td>
              <td>{{ warehouseName(row.warehouse_id) }}</td>
              <td>
                <nz-progress
                  nzSize="small"
                  [nzPercent]="row.cgu_utilization_percent"
                  [nzStatus]="status(row.cgu_utilization_percent)"
                  [nzStrokeColor]="color(row.cgu_utilization_percent)"
                ></nz-progress>
                <small
                  >{{ num(row.cgu_utilized_amount) | currency: row.currency }} /
                  {{ num(row.cgu_max_ceiling_amount) | currency: row.currency }}</small
                >
              </td>
              <td>
                <nz-tag [nzColor]="aeo(row.aeo_status)">{{
                  'bondedWarehouses.aeoStatus.' + row.aeo_status | translate
                }}</nz-tag>
              </td>
              <td>
                {{ row.valid_from | date: 'shortDate' }} – {{ row.valid_to | date: 'shortDate' }}
              </td>
              <td>
                <nz-tag [nzColor]="row.is_active ? 'green' : 'default'">
                  {{
                    (row.is_active
                      ? 'bondedWarehouses.tag.active'
                      : 'bondedWarehouses.tag.inactive'
                    ) | translate
                  }}
                </nz-tag>
              </td>
              <td>
                @if (canWrite) {
                  <button
                    nz-button
                    nzSize="small"
                    type="button"
                    [attr.data-test]="'edit-' + row.id"
                    (click)="openForm(row)"
                  >
                    {{ 'bondedWarehouses.action.edit' | translate }}
                  </button>
                  <button
                    nz-button
                    nzSize="small"
                    nzDanger
                    type="button"
                    nz-popconfirm
                    [nzPopconfirmTitle]="'bondedWarehouses.action.confirmDelete' | translate"
                    (nzOnConfirm)="remove(row)"
                    [attr.data-test]="'delete-' + row.id"
                  >
                    {{ 'bondedWarehouses.action.delete' | translate }}
                  </button>
                }
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="9">
                <nz-empty
                  [nzNotFoundContent]="'bondedWarehouses.empty.authorizations' | translate"
                ></nz-empty>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-spin>

    <nz-drawer
      [nzVisible]="formOpen()"
      nzPlacement="right"
      [nzWidth]="640"
      [nzTitle]="'bondedWarehouses.section.authorization' | translate"
      (nzOnClose)="formOpen.set(false)"
    >
      <ng-container *nzDrawerContent>
        <form nz-form nzLayout="vertical" [formGroup]="form" (ngSubmit)="submit()">
          <div class="form-grid">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="bw-au-code">{{
                'bondedWarehouses.field.authorizationCode' | translate
              }}</nz-form-label>
              <nz-form-control
                ><input nz-input id="bw-au-code" formControlName="authorization_code"
              /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="bw-au-office">{{
                'bondedWarehouses.field.customsOffice' | translate
              }}</nz-form-label>
              <nz-form-control
                ><input nz-input id="bw-au-office" formControlName="customs_office_code"
              /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="bw-au-warehouse">{{
                'bondedWarehouses.field.warehouse' | translate
              }}</nz-form-label>
              <nz-form-control>
                <nz-select nzId="bw-au-warehouse" formControlName="warehouse_id">
                  @for (item of lookup.warehouses(); track item.id) {
                    <nz-option
                      [nzValue]="item.id"
                      [nzLabel]="item.code + ' — ' + item.name"
                    ></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="bw-au-regime-f">{{
                'bondedWarehouses.field.regime' | translate
              }}</nz-form-label>
              <nz-form-control>
                <nz-select nzId="bw-au-regime-f" formControlName="regime_type">
                  @for (item of regimes; track item) {
                    <nz-option
                      [nzValue]="item"
                      [nzLabel]="'bondedWarehouses.regime.' + item | translate"
                    ></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="bw-au-subtype">{{
                'bondedWarehouses.field.subtype' | translate
              }}</nz-form-label>
              <nz-form-control>
                <nz-select nzId="bw-au-subtype" formControlName="warehouse_subtype">
                  @for (item of subtypes; track item) {
                    <nz-option
                      [nzValue]="item"
                      [nzLabel]="'bondedWarehouses.subtype.' + item | translate"
                    ></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="bw-au-currency">{{
                'bondedWarehouses.field.currency' | translate
              }}</nz-form-label>
              <nz-form-control>
                <nz-select nzId="bw-au-currency" formControlName="currency">
                  @for (item of currencies; track item) {
                    <nz-option [nzValue]="item" [nzLabel]="item"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="bw-au-cgu-ref">{{
                'bondedWarehouses.field.cguReference' | translate
              }}</nz-form-label>
              <nz-form-control
                ><input nz-input id="bw-au-cgu-ref" formControlName="cgu_guarantee_reference"
              /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="bw-au-ceiling">{{
                'bondedWarehouses.field.cguCeiling' | translate
              }}</nz-form-label>
              <nz-form-control
                ><input
                  nz-input
                  id="bw-au-ceiling"
                  type="number"
                  min="0"
                  step="any"
                  formControlName="cgu_max_ceiling_amount"
              /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="bw-au-aeo">{{
                'bondedWarehouses.field.aeoStatus' | translate
              }}</nz-form-label>
              <nz-form-control>
                <nz-select nzId="bw-au-aeo" formControlName="aeo_status">
                  @for (item of aeoStatuses; track item) {
                    <nz-option
                      [nzValue]="item"
                      [nzLabel]="'bondedWarehouses.aeoStatus.' + item | translate"
                    ></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            @if (form.controls.aeo_status.value !== 'None') {
              <nz-form-item>
                <nz-form-label nzRequired nzFor="bw-au-aeo-cert">{{
                  'bondedWarehouses.field.aeoCertificate' | translate
                }}</nz-form-label>
                <nz-form-control
                  ><input nz-input id="bw-au-aeo-cert" formControlName="aeo_certificate_number"
                /></nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label nzFor="bw-au-aeo-next">{{
                  'bondedWarehouses.field.aeoNextAudit' | translate
                }}</nz-form-label>
                <nz-form-control
                  ><input
                    nz-input
                    id="bw-au-aeo-next"
                    type="date"
                    formControlName="aeo_next_audit_date"
                /></nz-form-control>
              </nz-form-item>
            }
            <nz-form-item>
              <nz-form-label nzRequired nzFor="bw-au-from">{{
                'bondedWarehouses.field.validFrom' | translate
              }}</nz-form-label>
              <nz-form-control
                ><input nz-input id="bw-au-from" type="date" formControlName="valid_from"
              /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="bw-au-to">{{
                'bondedWarehouses.field.validTo' | translate
              }}</nz-form-label>
              <nz-form-control
                ><input nz-input id="bw-au-to" type="date" formControlName="valid_to"
              /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="bw-au-active">{{
                'bondedWarehouses.field.active' | translate
              }}</nz-form-label>
              <nz-form-control>
                <label
                  for="bw-au-active"
                  nzId="bw-au-active"
                  nz-checkbox
                  formControlName="is_active"
                  >{{ 'bondedWarehouses.field.active' | translate }}</label
                >
              </nz-form-control>
            </nz-form-item>
          </div>
          <div class="drawer-actions">
            <button
              nz-button
              nzType="primary"
              type="submit"
              data-test="save-authorization"
              [disabled]="form.invalid"
            >
              {{ 'bondedWarehouses.action.save' | translate }}
            </button>
            <button nz-button type="button" (click)="formOpen.set(false)">
              {{ 'bondedWarehouses.action.cancel' | translate }}
            </button>
          </div>
        </form>
      </ng-container>
    </nz-drawer>
  `,
})
export class BondedAuthorizationsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  protected readonly store = inject(BondedAuthorizationStore);
  protected readonly lookup = inject(BondedLookupStore);
  protected readonly canWrite = inject(PermissionsService).canWrite(BONDED_WAREHOUSES_MODULE);

  protected readonly regimes = BW_REGIME_TYPES;
  protected readonly subtypes = BW_WAREHOUSE_SUBTYPES;
  protected readonly aeoStatuses = BW_AEO_STATUSES;
  protected readonly currencies = BW_CURRENCIES;

  protected search = '';
  protected regime: BwRegimeType | null = null;

  protected readonly notice = signal<string | null>(null);
  protected readonly formError = signal<{ key: string; params: Record<string, string> } | null>(
    null,
  );
  protected readonly formOpen = signal(false);
  protected readonly editing = signal<string | null>(null);

  protected readonly num = toNumber;
  protected readonly status = utilizationStatus;
  protected readonly color = utilizationColor;
  protected readonly aeo = aeoColor;

  protected readonly form = this.fb.nonNullable.group({
    warehouse_id: ['', Validators.required],
    authorization_code: ['', [Validators.required, Validators.maxLength(60)]],
    customs_office_code: ['', [Validators.required, Validators.maxLength(30)]],
    regime_type: ['CDU_Private_7100' as BwRegimeType, Validators.required],
    warehouse_subtype: ['Private' as (typeof BW_WAREHOUSE_SUBTYPES)[number], Validators.required],
    cgu_guarantee_reference: [''],
    cgu_max_ceiling_amount: [0, [Validators.required, Validators.min(0)]],
    currency: ['EUR' as (typeof BW_CURRENCIES)[number], Validators.required],
    aeo_certificate_number: [''],
    aeo_status: ['None' as (typeof BW_AEO_STATUSES)[number], Validators.required],
    aeo_next_audit_date: [''],
    valid_from: ['', Validators.required],
    valid_to: [''],
    is_active: [true],
  });

  ngOnInit(): void {
    void this.lookup.load();
    this.reload();
  }

  protected reload(): void {
    void this.store.load({ search: this.search, regime_type: this.regime });
  }

  protected warehouseName(id: string): string {
    return this.lookup.warehouses().find((item) => item.id === id)?.name ?? '';
  }

  protected openForm(row: BwAuthorization | null): void {
    this.formError.set(null);
    this.editing.set(row?.id ?? null);
    this.form.reset({
      warehouse_id: row?.warehouse_id ?? '',
      authorization_code: row?.authorization_code ?? '',
      customs_office_code: row?.customs_office_code ?? '',
      regime_type: row?.regime_type ?? 'CDU_Private_7100',
      warehouse_subtype: row?.warehouse_subtype ?? 'Private',
      cgu_guarantee_reference: row?.cgu_guarantee_reference ?? '',
      cgu_max_ceiling_amount: row ? toNumber(row.cgu_max_ceiling_amount) : 0,
      currency: row?.currency ?? 'EUR',
      aeo_certificate_number: row?.aeo_certificate_number ?? '',
      aeo_status: row?.aeo_status ?? 'None',
      aeo_next_audit_date: row?.aeo_next_audit_date ?? '',
      valid_from: row?.valid_from ?? '',
      valid_to: row?.valid_to ?? '',
      is_active: row?.is_active ?? true,
    });
    this.formOpen.set(true);
  }

  protected async submit(): Promise<void> {
    const value = this.form.getRawValue();
    const certified = value.aeo_status !== 'None';
    const payload: BwAuthorizationPayload = {
      ...value,
      cgu_guarantee_reference:
        value.cgu_guarantee_reference === '' ? null : value.cgu_guarantee_reference,
      aeo_certificate_number:
        certified && value.aeo_certificate_number !== '' ? value.aeo_certificate_number : null,
      aeo_next_audit_date:
        certified && value.aeo_next_audit_date !== '' ? value.aeo_next_audit_date : null,
      valid_to: value.valid_to === '' ? null : value.valid_to,
    };
    const outcome = await this.store.save(payload, this.editing());
    this.report(outcome, 'bondedWarehouses.message.authorizationSaved');
    if (outcome.ok) {
      this.formOpen.set(false);
      void this.lookup.load(true);
      this.reload();
    }
  }

  protected async remove(row: BwAuthorization): Promise<void> {
    const outcome = await this.store.remove(row.id);
    this.report(outcome, 'bondedWarehouses.message.authorizationDeleted');
    if (outcome.ok) {
      void this.lookup.load(true);
      this.reload();
    }
  }

  private report(outcome: BwOutcome, success: string): void {
    this.formError.set(
      outcome.ok
        ? null
        : { key: outcome.errorKey ?? 'bondedWarehouses.error.unknown', params: outcome.params },
    );
    this.notice.set(outcome.ok ? success : null);
  }
}
