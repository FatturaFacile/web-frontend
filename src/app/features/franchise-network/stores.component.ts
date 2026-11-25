import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  FRN_SIZE_CLUSTERS,
  FRN_STORE_STATUSES,
  FRN_STORE_TYPES,
  FrnStore,
  FrnStorePayload,
  PermissionsService,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import {
  FRANCHISE_NETWORK_MANAGE_MODULE,
  FrnOutcome,
  storeStatusColor,
} from './franchise-network.util';
import { StoresStore } from './stores.store';

/** Stores of the network: franchisee stores and directly operated stores, with the link code the franchisee redeems. */
@Component({
  selector: 'app-frn-stores',
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzDrawerModule,
    NzEmptyModule,
    NzInputModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    ReactiveFormsModule,
    TranslatePipe,
  ],
  providers: [StoresStore],
  styleUrl: './franchise-network.scss',
  template: `
    <app-page-header [title]="'PAGE_TITLE.FRANCHISE_NETWORK_STORES' | translate"></app-page-header>

    <div class="toolbar">
      <label class="field" for="frn-s-q">
        <span>{{ 'franchiseNetwork.field.search' | translate }}</span>
        <input nz-input id="frn-s-q" [ngModel]="query()" (ngModelChange)="onSearch($event)" />
      </label>
      <span class="spacer"></span>
      @if (canManage) {
        <button nz-button nzType="primary" type="button" (click)="openCreate()">
          {{ 'franchiseNetwork.action.newStore' | translate }}
        </button>
      }
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
        [nzMessage]="failure.errorKey ?? 'franchiseNetwork.error.generic' | translate: failure.params"
        [nzDescription]="failure.detail ?? undefined"
        (nzOnClose)="feedback.set(null)"
      ></nz-alert>
    }
    @if (linkCode(); as code) {
      <nz-alert
        class="feedback"
        nzType="success"
        nzShowIcon
        nzCloseable
        [nzMessage]="'franchiseNetwork.hint.linkCode' | translate"
        [nzDescription]="code"
        (nzOnClose)="linkCode.set(null)"
      ></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      <nz-table #table nzSize="small" [nzData]="store.stores()" [nzShowPagination]="false" [nzScroll]="{ x: '900px' }">
        <thead>
          <tr>
            <th scope="col">{{ 'franchiseNetwork.field.code' | translate }}</th>
            <th scope="col">{{ 'franchiseNetwork.field.name' | translate }}</th>
            <th scope="col">{{ 'franchiseNetwork.field.storeType' | translate }}</th>
            <th scope="col">{{ 'franchiseNetwork.field.status' | translate }}</th>
            <th scope="col">{{ 'franchiseNetwork.field.country' | translate }}</th>
            <th scope="col">{{ 'franchiseNetwork.field.sizeCluster' | translate }}</th>
            <th scope="col">{{ 'franchiseNetwork.field.fiscalId' | translate }}</th>
            <th scope="col">{{ 'franchiseNetwork.field.actions' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <th scope="row">{{ row.code }}</th>
              <td>
                {{ row.name }}
                <small class="muted">{{ row.city }}</small>
              </td>
              <td>
                {{ 'franchiseNetwork.storeType.' + row.store_type | translate }}
                @if (row.store_type === 'franchisee') {
                  <nz-tag [nzColor]="row.linked ? 'green' : 'orange'">{{
                    (row.linked ? 'franchiseNetwork.field.linked' : 'franchiseNetwork.field.notLinked')
                      | translate
                  }}</nz-tag>
                }
              </td>
              <td>
                <nz-tag [nzColor]="statusColor(row.status)">{{
                  'franchiseNetwork.storeStatus.' + row.status | translate
                }}</nz-tag>
              </td>
              <td>{{ row.country }}</td>
              <td>{{ 'franchiseNetwork.sizeCluster.' + row.size_cluster | translate }}</td>
              <td>{{ row.vat_number ?? row.uid_number ?? '—' }}</td>
              <td class="row-actions">
                @if (canManage) {
                  <button nz-button nzSize="small" type="button" (click)="openEdit(row)">
                    {{ 'franchiseNetwork.action.edit' | translate }}
                  </button>
                  @if (row.store_type === 'franchisee' && !row.linked) {
                    <button nz-button nzSize="small" type="button" (click)="issueCode(row)">
                      {{ 'franchiseNetwork.action.issueLinkCode' | translate }}
                    </button>
                  }
                  <button
                    nz-button
                    nzSize="small"
                    nzDanger
                    type="button"
                    nz-popconfirm
                    [nzPopconfirmTitle]="'franchiseNetwork.confirm.deleteStore' | translate"
                    [nzOkText]="'franchiseNetwork.action.confirm' | translate"
                    [nzCancelText]="'franchiseNetwork.action.cancel' | translate"
                    (nzOnConfirm)="remove(row)"
                  >
                    {{ 'franchiseNetwork.action.delete' | translate }}
                  </button>
                }
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="8">
                <nz-empty [nzNotFoundContent]="'franchiseNetwork.empty.stores' | translate"></nz-empty>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-spin>

    <nz-drawer
      [nzVisible]="drawerOpen()"
      [nzWidth]="520"
      [nzTitle]="'franchiseNetwork.section.store' | translate"
      (nzOnClose)="close()"
    >
      <ng-container *nzDrawerContent>
        @if (formError(); as failure) {
          <nz-alert
            class="feedback"
            nzType="error"
            nzShowIcon
            [nzMessage]="failure.errorKey ?? 'franchiseNetwork.error.generic' | translate: failure.params"
            [nzDescription]="failure.detail ?? undefined"
          ></nz-alert>
        }
        <form [formGroup]="form" class="form" (ngSubmit)="submit()">
          <label class="field" for="frn-s-code">
            <span>{{ 'franchiseNetwork.field.code' | translate }}</span>
            <input nz-input id="frn-s-code" formControlName="code" maxlength="30" />
          </label>
          <label class="field" for="frn-s-name">
            <span>{{ 'franchiseNetwork.field.name' | translate }}</span>
            <input nz-input id="frn-s-name" formControlName="name" maxlength="160" />
          </label>
          <label class="field" for="frn-s-type">
            <span>{{ 'franchiseNetwork.field.storeType' | translate }}</span>
            <nz-select nzId="frn-s-type" formControlName="store_type">
              @for (type of types; track type) {
                <nz-option [nzValue]="type" [nzLabel]="'franchiseNetwork.storeType.' + type | translate"></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="frn-s-status">
            <span>{{ 'franchiseNetwork.field.status' | translate }}</span>
            <nz-select nzId="frn-s-status" formControlName="status">
              @for (status of statuses; track status) {
                <nz-option [nzValue]="status" [nzLabel]="'franchiseNetwork.storeStatus.' + status | translate"></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="frn-s-country">
            <span>{{ 'franchiseNetwork.field.country' | translate }}</span>
            <nz-select nzId="frn-s-country" formControlName="country">
              <nz-option nzValue="IT" nzLabel="IT"></nz-option>
              <nz-option nzValue="CH" nzLabel="CH"></nz-option>
            </nz-select>
          </label>
          <label class="field" for="frn-s-cluster">
            <span>{{ 'franchiseNetwork.field.sizeCluster' | translate }}</span>
            <nz-select nzId="frn-s-cluster" formControlName="size_cluster">
              @for (cluster of clusters; track cluster) {
                <nz-option [nzValue]="cluster" [nzLabel]="'franchiseNetwork.sizeCluster.' + cluster | translate"></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="frn-s-city">
            <span>{{ 'franchiseNetwork.field.city' | translate }}</span>
            <input nz-input id="frn-s-city" formControlName="city" maxlength="120" />
          </label>
          <label class="field" for="frn-s-address">
            <span>{{ 'franchiseNetwork.field.address' | translate }}</span>
            <input nz-input id="frn-s-address" formControlName="address" maxlength="255" />
          </label>
          <label class="field" for="frn-s-postal">
            <span>{{ 'franchiseNetwork.field.postalCode' | translate }}</span>
            <input nz-input id="frn-s-postal" formControlName="postal_code" maxlength="12" />
          </label>
          <label class="field" for="frn-s-opened">
            <span>{{ 'franchiseNetwork.field.openedOn' | translate }}</span>
            <input nz-input id="frn-s-opened" type="date" formControlName="opened_on" />
          </label>
          <label class="field" for="frn-s-vat">
            <span>P/IVA</span>
            <input nz-input id="frn-s-vat" formControlName="vat_number" maxlength="30" />
          </label>
          <label class="field" for="frn-s-uid">
            <span>UID/IDI</span>
            <input nz-input id="frn-s-uid" formControlName="uid_number" maxlength="30" />
          </label>
          <div class="actions">
            <button nz-button nzType="primary" type="submit" [nzLoading]="store.saving()" [disabled]="form.invalid">
              {{ 'franchiseNetwork.action.save' | translate }}
            </button>
            <button nz-button type="button" (click)="close()">
              {{ 'franchiseNetwork.action.cancel' | translate }}
            </button>
          </div>
        </form>
      </ng-container>
    </nz-drawer>
  `,
})
export class StoresComponent implements OnInit {
  protected readonly store = inject(StoresStore);
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly canManage = inject(PermissionsService).canWrite(FRANCHISE_NETWORK_MANAGE_MODULE);
  protected readonly types = FRN_STORE_TYPES;
  protected readonly statuses = FRN_STORE_STATUSES;
  protected readonly clusters = FRN_SIZE_CLUSTERS;
  protected readonly statusColor = storeStatusColor;

  protected readonly query = signal('');
  protected readonly drawerOpen = signal(false);
  protected readonly editing = signal<FrnStore | null>(null);
  protected readonly feedback = signal<FrnOutcome | null>(null);
  protected readonly formError = signal<FrnOutcome | null>(null);
  protected readonly linkCode = signal<string | null>(null);

  protected readonly form = this.fb.group({
    code: ['', [Validators.required, Validators.maxLength(30)]],
    name: ['', [Validators.required, Validators.maxLength(160)]],
    store_type: ['franchisee' as FrnStorePayload['store_type'], Validators.required],
    status: ['active' as NonNullable<FrnStorePayload['status']>],
    country: ['IT', Validators.required],
    size_cluster: ['medium' as NonNullable<FrnStorePayload['size_cluster']>],
    city: [''],
    address: [''],
    postal_code: [''],
    opened_on: [''],
    vat_number: [''],
    uid_number: [''],
  });

  ngOnInit(): void {
    void this.store.load();
  }

  protected onSearch(value: string): void {
    this.query.set(value);
    void this.store.load(value || undefined);
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.form.reset({ store_type: 'franchisee', status: 'active', country: 'IT', size_cluster: 'medium' });
    this.formError.set(null);
    this.drawerOpen.set(true);
  }

  protected openEdit(row: FrnStore): void {
    this.editing.set(row);
    this.form.reset({
      code: row.code,
      name: row.name,
      store_type: row.store_type,
      status: row.status,
      country: row.country,
      size_cluster: row.size_cluster,
      city: row.city ?? '',
      address: row.address ?? '',
      postal_code: row.postal_code ?? '',
      opened_on: row.opened_on ?? '',
      vat_number: row.vat_number ?? '',
      uid_number: row.uid_number ?? '',
    });
    this.formError.set(null);
    this.drawerOpen.set(true);
  }

  protected close(): void {
    this.drawerOpen.set(false);
  }

  protected async submit(): Promise<void> {
    const value = this.form.getRawValue();
    const payload: FrnStorePayload = {
      ...value,
      city: value.city || null,
      address: value.address || null,
      postal_code: value.postal_code || null,
      opened_on: value.opened_on || null,
      vat_number: value.vat_number || null,
      uid_number: value.uid_number || null,
    };
    const outcome = await this.store.save(payload, this.editing()?.id);
    if (outcome.ok) {
      this.message.success(this.i18n.instant('franchiseNetwork.notification.saved'));
      this.close();
    } else {
      this.formError.set(outcome);
    }
  }

  protected async remove(row: FrnStore): Promise<void> {
    const outcome = await this.store.remove(row.id);
    this.feedback.set(outcome.ok ? null : outcome);
  }

  protected async issueCode(row: FrnStore): Promise<void> {
    const result = await this.store.issueLinkCode(row.id);
    this.feedback.set(result.outcome.ok ? null : result.outcome);
    this.linkCode.set(result.code);
  }
}
