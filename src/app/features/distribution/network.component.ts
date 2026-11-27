import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  DST_BILLING_FREQUENCIES,
  DST_SETTLEMENT_TRIGGERS,
  DST_TRANSPORT_MODES,
  DST_WAREHOUSE_ROLES,
  DstLane,
  DstLanePayload,
  DstNetworkWarehouse,
  DstProfilePayload,
  PermissionsService,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import {
  DISTRIBUTION_MODULE,
  DstOutcome,
  nullable,
  numberOrNull,
  toNumber,
} from './distribution.util';
import { NetworkStore } from './network.store';

/** Network topology: the role and terms (consignment, 3PL) of each warehouse and the distribution lanes between them. */
@Component({
  selector: 'app-dst-network',
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzDrawerModule,
    NzEmptyModule,
    NzInputModule,
    NzInputNumberModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSpinModule,
    NzSwitchModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    PageHeaderComponent,
    ReactiveFormsModule,
    TranslatePipe,
  ],
  providers: [NetworkStore],
  styleUrl: './distribution.scss',
  template: `
    <app-page-header [title]="'PAGE_TITLE.DISTRIBUTION_NETWORK' | translate"></app-page-header>

    @if (store.error(); as error) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        [nzMessage]="error | translate"
      ></nz-alert>
    }
    @if (feedback(); as failure) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        nzCloseable
        [nzMessage]="failure.errorKey ?? 'distribution.error.generic' | translate: failure.params"
        [nzDescription]="failure.detail ?? null"
        (nzOnClose)="feedback.set(null)"
      ></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      <nz-tabs>
        <nz-tab [nzTitle]="'distribution.section.warehouses' | translate">
          <nz-table
            #wTable
            nzSize="small"
            [nzData]="store.warehouses()"
            [nzShowPagination]="false"
            [nzScroll]="{ x: '900px' }"
          >
            <thead>
              <tr>
                <th scope="col">{{ 'distribution.field.code' | translate }}</th>
                <th scope="col">{{ 'distribution.field.name' | translate }}</th>
                <th scope="col">{{ 'distribution.field.role' | translate }}</th>
                <th scope="col">{{ 'distribution.field.parentWarehouse' | translate }}</th>
                <th scope="col">{{ 'distribution.field.flags' | translate }}</th>
                <th scope="col">{{ 'distribution.field.actions' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (row of wTable.data; track row.id) {
                <tr>
                  <th scope="row">{{ row.code }}</th>
                  <td>{{ row.name }}</td>
                  <td>
                    @if (row.profile; as profile) {
                      {{ 'distribution.warehouseRole.' + profile.role | translate }}
                    } @else {
                      <nz-tag>{{ 'distribution.field.noProfile' | translate }}</nz-tag>
                    }
                  </td>
                  <td>{{ parentOf(row) }}</td>
                  <td>
                    <span class="tags">
                      @if (row.profile?.is_blocked) {
                        <nz-tag nzColor="red">{{
                          'distribution.field.blocked' | translate
                        }}</nz-tag>
                      }
                      @if (row.profile?.is_counting) {
                        <nz-tag nzColor="orange">{{
                          'distribution.field.counting' | translate
                        }}</nz-tag>
                      }
                      @if (!row.is_active) {
                        <nz-tag>{{ 'distribution.field.inactive' | translate }}</nz-tag>
                      }
                    </span>
                  </td>
                  <td class="row-actions">
                    @if (canManage) {
                      <button nz-button nzSize="small" type="button" (click)="openProfile(row)">
                        {{ 'distribution.action.editProfile' | translate }}
                      </button>
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6">
                    <nz-empty
                      [nzNotFoundContent]="'distribution.empty.warehouses' | translate"
                    ></nz-empty>
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-tab>

        <nz-tab [nzTitle]="'distribution.section.lanes' | translate">
          <div class="toolbar">
            <span class="spacer"></span>
            @if (canManage) {
              <button nz-button nzType="primary" type="button" (click)="openLane(null)">
                {{ 'distribution.action.newLane' | translate }}
              </button>
            }
          </div>
          <nz-table
            #lTable
            nzSize="small"
            [nzData]="store.lanes()"
            [nzShowPagination]="false"
            [nzScroll]="{ x: '800px' }"
          >
            <thead>
              <tr>
                <th scope="col">{{ 'distribution.field.source' | translate }}</th>
                <th scope="col">{{ 'distribution.field.destination' | translate }}</th>
                <th scope="col" class="num">{{ 'distribution.field.leadTimeDays' | translate }}</th>
                <th scope="col">{{ 'distribution.field.transportMode' | translate }}</th>
                <th scope="col" class="num">{{ 'distribution.field.costPerUnit' | translate }}</th>
                <th scope="col">{{ 'distribution.field.status' | translate }}</th>
                <th scope="col">{{ 'distribution.field.actions' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (lane of lTable.data; track lane.id) {
                <tr>
                  <th scope="row">
                    {{ lane.source_warehouse?.code }} {{ lane.source_warehouse?.name }}
                  </th>
                  <td>
                    {{ lane.destination_warehouse?.code }} {{ lane.destination_warehouse?.name }}
                  </td>
                  <td class="num">{{ lane.lead_time_days }}d {{ lane.lead_time_hours }}h</td>
                  <td>{{ 'distribution.transportMode.' + lane.transport_mode | translate }}</td>
                  <td class="num">{{ lane.cost_per_unit ?? '—' }}</td>
                  <td>
                    <nz-tag [nzColor]="lane.is_active ? 'green' : 'default'">{{
                      (lane.is_active ? 'distribution.field.active' : 'distribution.field.inactive')
                        | translate
                    }}</nz-tag>
                  </td>
                  <td class="row-actions">
                    @if (canManage) {
                      <button nz-button nzSize="small" type="button" (click)="openLane(lane)">
                        {{ 'distribution.action.edit' | translate }}
                      </button>
                      <button
                        nz-button
                        nzSize="small"
                        nzDanger
                        type="button"
                        nz-popconfirm
                        [nzPopconfirmTitle]="'distribution.confirm.deleteLane' | translate"
                        [nzOkText]="'distribution.action.confirm' | translate"
                        [nzCancelText]="'distribution.action.cancel' | translate"
                        (nzOnConfirm)="removeLane(lane)"
                      >
                        {{ 'distribution.action.delete' | translate }}
                      </button>
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7">
                    <nz-empty
                      [nzNotFoundContent]="'distribution.empty.lanes' | translate"
                    ></nz-empty>
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-tab>
      </nz-tabs>
    </nz-spin>

    <nz-drawer
      [nzVisible]="profileOpen()"
      [nzWidth]="520"
      [nzTitle]="'distribution.section.profile' | translate"
      (nzOnClose)="profileOpen.set(false)"
    >
      <ng-container *nzDrawerContent>
        @if (profileError(); as failure) {
          <nz-alert
            class="feedback"
            nzType="error"
            nzShowIcon
            [nzMessage]="
              failure.errorKey ?? 'distribution.error.generic' | translate: failure.params
            "
            [nzDescription]="failure.detail ?? null"
          ></nz-alert>
        }
        <form [formGroup]="profileForm" class="form" (ngSubmit)="submitProfile()">
          <label class="field" for="dst-p-role">
            <span>{{ 'distribution.field.role' | translate }}</span>
            <nz-select nzId="dst-p-role" formControlName="role">
              @for (role of roles; track role) {
                <nz-option
                  [nzValue]="role"
                  [nzLabel]="'distribution.warehouseRole.' + role | translate"
                ></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="dst-p-parent">
            <span>{{ 'distribution.field.parentWarehouse' | translate }}</span>
            <nz-select nzId="dst-p-parent" formControlName="parent_warehouse_id" nzAllowClear>
              @for (warehouse of otherWarehouses(); track warehouse.id) {
                <nz-option
                  [nzValue]="warehouse.id"
                  [nzLabel]="warehouse.code + ' ' + warehouse.name"
                ></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="dst-p-transit">
            <span>{{ 'distribution.field.defaultTransit' | translate }}</span>
            <nz-select
              nzId="dst-p-transit"
              formControlName="default_transit_warehouse_id"
              nzAllowClear
            >
              @for (warehouse of transitWarehouses(); track warehouse.id) {
                <nz-option
                  [nzValue]="warehouse.id"
                  [nzLabel]="warehouse.code + ' ' + warehouse.name"
                ></nz-option>
              }
            </nz-select>
          </label>
          @if (isThirdParty()) {
            <label class="field" for="dst-p-partner">
              <span>{{ 'distribution.field.partner' | translate }}</span>
              <input
                nz-input
                id="dst-p-partner"
                formControlName="third_party_partner_id"
                maxlength="64"
              />
            </label>
            <label class="field" for="dst-p-ref">
              <span>{{ 'distribution.field.externalReference' | translate }}</span>
              <input nz-input id="dst-p-ref" formControlName="external_reference" maxlength="120" />
            </label>
            <label class="field" for="dst-p-trigger">
              <span>{{ 'distribution.field.settlementTrigger' | translate }}</span>
              <nz-select nzId="dst-p-trigger" formControlName="settlement_trigger" nzAllowClear>
                @for (trigger of triggers; track trigger) {
                  <nz-option
                    [nzValue]="trigger"
                    [nzLabel]="'distribution.settlementTrigger.' + trigger | translate"
                  ></nz-option>
                }
              </nz-select>
            </label>
            <label class="field" for="dst-p-billing">
              <span>{{ 'distribution.field.billingFrequency' | translate }}</span>
              <nz-select nzId="dst-p-billing" formControlName="billing_frequency" nzAllowClear>
                @for (frequency of frequencies; track frequency) {
                  <nz-option
                    [nzValue]="frequency"
                    [nzLabel]="'distribution.billingFrequency.' + frequency | translate"
                  ></nz-option>
                }
              </nz-select>
            </label>
            <label class="field" for="dst-p-days">
              <span>{{ 'distribution.field.maxConsignmentDays' | translate }}</span>
              <nz-input-number
                nzId="dst-p-days"
                formControlName="max_consignment_days"
                [nzMin]="1"
                [nzStep]="1"
              ></nz-input-number>
            </label>
            <label class="field">
              <span>{{ 'distribution.field.insured' | translate }}</span>
              <nz-switch formControlName="is_insured"></nz-switch>
            </label>
            <label class="field">
              <span>{{ 'distribution.field.countsInValuation' | translate }}</span>
              <nz-switch formControlName="counts_in_valuation"></nz-switch>
            </label>
          }
          <label class="field">
            <span>{{ 'distribution.field.includeInFreeStock' | translate }}</span>
            <nz-switch formControlName="include_in_free_stock"></nz-switch>
          </label>
          <label class="field">
            <span>{{ 'distribution.field.blocked' | translate }}</span>
            <nz-switch formControlName="is_blocked"></nz-switch>
          </label>
          <label class="field">
            <span>{{ 'distribution.field.counting' | translate }}</span>
            <nz-switch formControlName="is_counting"></nz-switch>
          </label>
          <label class="field" for="dst-p-notes">
            <span>{{ 'distribution.field.notes' | translate }}</span>
            <textarea
              nz-input
              id="dst-p-notes"
              rows="3"
              formControlName="notes"
              maxlength="1000"
            ></textarea>
          </label>
          <div class="actions">
            <button
              nz-button
              nzType="primary"
              type="submit"
              [nzLoading]="store.saving()"
              [disabled]="profileForm.invalid"
            >
              {{ 'distribution.action.save' | translate }}
            </button>
            <button nz-button type="button" (click)="profileOpen.set(false)">
              {{ 'distribution.action.cancel' | translate }}
            </button>
          </div>
        </form>
      </ng-container>
    </nz-drawer>

    <nz-drawer
      [nzVisible]="laneOpen()"
      [nzWidth]="480"
      [nzTitle]="'distribution.section.lane' | translate"
      (nzOnClose)="laneOpen.set(false)"
    >
      <ng-container *nzDrawerContent>
        @if (laneError(); as failure) {
          <nz-alert
            class="feedback"
            nzType="error"
            nzShowIcon
            [nzMessage]="
              failure.errorKey ?? 'distribution.error.generic' | translate: failure.params
            "
            [nzDescription]="failure.detail ?? null"
          ></nz-alert>
        }
        <form [formGroup]="laneForm" class="form" (ngSubmit)="submitLane()">
          <label class="field" for="dst-l-source">
            <span>{{ 'distribution.field.source' | translate }}</span>
            <nz-select nzId="dst-l-source" formControlName="source_warehouse_id" nzShowSearch>
              @for (warehouse of store.warehouses(); track warehouse.id) {
                <nz-option
                  [nzValue]="warehouse.id"
                  [nzLabel]="warehouse.code + ' ' + warehouse.name"
                ></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="dst-l-destination">
            <span>{{ 'distribution.field.destination' | translate }}</span>
            <nz-select
              nzId="dst-l-destination"
              formControlName="destination_warehouse_id"
              nzShowSearch
            >
              @for (warehouse of store.warehouses(); track warehouse.id) {
                <nz-option
                  [nzValue]="warehouse.id"
                  [nzLabel]="warehouse.code + ' ' + warehouse.name"
                ></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="dst-l-days">
            <span>{{ 'distribution.field.leadTimeDays' | translate }}</span>
            <nz-input-number
              nzId="dst-l-days"
              formControlName="lead_time_days"
              [nzMin]="0"
              [nzStep]="1"
            ></nz-input-number>
          </label>
          <label class="field" for="dst-l-hours">
            <span>{{ 'distribution.field.leadTimeHours' | translate }}</span>
            <nz-input-number
              nzId="dst-l-hours"
              formControlName="lead_time_hours"
              [nzMin]="0"
              [nzMax]="23"
              [nzStep]="1"
            ></nz-input-number>
          </label>
          <label class="field" for="dst-l-mode">
            <span>{{ 'distribution.field.transportMode' | translate }}</span>
            <nz-select nzId="dst-l-mode" formControlName="transport_mode">
              @for (mode of modes; track mode) {
                <nz-option
                  [nzValue]="mode"
                  [nzLabel]="'distribution.transportMode.' + mode | translate"
                ></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="dst-l-cost">
            <span>{{ 'distribution.field.costPerUnit' | translate }}</span>
            <nz-input-number
              nzId="dst-l-cost"
              formControlName="cost_per_unit"
              [nzMin]="0"
              [nzStep]="0.01"
            ></nz-input-number>
          </label>
          <label class="field">
            <span>{{ 'distribution.field.active' | translate }}</span>
            <nz-switch formControlName="is_active"></nz-switch>
          </label>
          <div class="actions">
            <button
              nz-button
              nzType="primary"
              type="submit"
              [nzLoading]="store.saving()"
              [disabled]="laneForm.invalid"
            >
              {{ 'distribution.action.save' | translate }}
            </button>
            <button nz-button type="button" (click)="laneOpen.set(false)">
              {{ 'distribution.action.cancel' | translate }}
            </button>
          </div>
        </form>
      </ng-container>
    </nz-drawer>
  `,
})
export class NetworkComponent implements OnInit {
  protected readonly store = inject(NetworkStore);
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly canManage = inject(PermissionsService).canWrite(DISTRIBUTION_MODULE);
  protected readonly roles = DST_WAREHOUSE_ROLES;
  protected readonly triggers = DST_SETTLEMENT_TRIGGERS;
  protected readonly frequencies = DST_BILLING_FREQUENCIES;
  protected readonly modes = DST_TRANSPORT_MODES;

  protected readonly feedback = signal<DstOutcome | null>(null);
  protected readonly profileOpen = signal(false);
  protected readonly profileError = signal<DstOutcome | null>(null);
  protected readonly editingWarehouse = signal<DstNetworkWarehouse | null>(null);
  protected readonly laneOpen = signal(false);
  protected readonly laneError = signal<DstOutcome | null>(null);
  protected readonly editingLane = signal<DstLane | null>(null);

  protected readonly otherWarehouses = computed(() =>
    this.store.warehouses().filter((warehouse) => warehouse.id !== this.editingWarehouse()?.id),
  );
  protected readonly transitWarehouses = computed(() =>
    this.store.warehouses().filter((warehouse) => warehouse.profile?.role === 'transit'),
  );

  protected readonly profileForm = this.fb.group({
    role: ['internal' as DstProfilePayload['role'], Validators.required],
    parent_warehouse_id: [null as string | null],
    default_transit_warehouse_id: [null as string | null],
    third_party_partner_id: [''],
    external_reference: [''],
    settlement_trigger: [null as DstProfilePayload['settlement_trigger'] | null],
    billing_frequency: [null as DstProfilePayload['billing_frequency'] | null],
    max_consignment_days: [null as number | null],
    is_insured: [false],
    counts_in_valuation: [true],
    include_in_free_stock: [true],
    is_blocked: [false],
    is_counting: [false],
    notes: [''],
  });

  protected readonly laneForm = this.fb.group({
    source_warehouse_id: ['', Validators.required],
    destination_warehouse_id: ['', Validators.required],
    lead_time_days: [1, [Validators.required, Validators.min(0)]],
    lead_time_hours: [0],
    transport_mode: ['road' as DstLanePayload['transport_mode'], Validators.required],
    cost_per_unit: [null as number | null],
    is_active: [true],
  });

  ngOnInit(): void {
    void this.store.load();
  }

  protected parentOf(row: DstNetworkWarehouse): string {
    const parentId = row.profile?.parent_warehouse_id;
    const parent = this.store.warehouses().find((warehouse) => warehouse.id === parentId);
    return parent ? `${parent.code} ${parent.name}` : '—';
  }

  protected isThirdParty(): boolean {
    const role = this.profileForm.controls.role.value;
    return role === 'third_party_3pl' || role === 'consignment_out' || role === 'consignment_in';
  }

  protected openProfile(row: DstNetworkWarehouse): void {
    this.editingWarehouse.set(row);
    const profile = row.profile;
    this.profileForm.reset({
      role: profile?.role ?? 'internal',
      parent_warehouse_id: profile?.parent_warehouse_id ?? null,
      default_transit_warehouse_id: profile?.default_transit_warehouse_id ?? null,
      third_party_partner_id: profile?.third_party_partner_id ?? '',
      external_reference: profile?.external_reference ?? '',
      settlement_trigger: profile?.settlement_trigger ?? null,
      billing_frequency: profile?.billing_frequency ?? null,
      max_consignment_days: profile?.max_consignment_days ?? null,
      is_insured: profile?.is_insured ?? false,
      counts_in_valuation: profile?.counts_in_valuation ?? true,
      include_in_free_stock: profile?.include_in_free_stock ?? true,
      is_blocked: profile?.is_blocked ?? false,
      is_counting: profile?.is_counting ?? false,
      notes: profile?.notes ?? '',
    });
    this.profileError.set(null);
    this.profileOpen.set(true);
  }

  protected async submitProfile(): Promise<void> {
    const warehouse = this.editingWarehouse();
    if (!warehouse) {
      return;
    }
    const value = this.profileForm.getRawValue();
    const payload: DstProfilePayload = {
      ...value,
      third_party_partner_id: nullable(value.third_party_partner_id),
      external_reference: nullable(value.external_reference),
      max_consignment_days: numberOrNull(value.max_consignment_days),
      notes: nullable(value.notes),
    };
    const outcome = await this.store.saveProfile(warehouse.id, payload);
    if (outcome.ok) {
      this.message.success(this.i18n.instant('distribution.notification.saved'));
      this.profileOpen.set(false);
    } else {
      this.profileError.set(outcome);
    }
  }

  protected openLane(lane: DstLane | null): void {
    this.editingLane.set(lane);
    this.laneForm.reset({
      source_warehouse_id: lane?.source_warehouse_id ?? '',
      destination_warehouse_id: lane?.destination_warehouse_id ?? '',
      lead_time_days: lane?.lead_time_days ?? 1,
      lead_time_hours: lane?.lead_time_hours ?? 0,
      transport_mode: lane?.transport_mode ?? 'road',
      cost_per_unit:
        lane?.cost_per_unit === null || lane === null ? null : toNumber(lane?.cost_per_unit),
      is_active: lane?.is_active ?? true,
    });
    this.laneError.set(null);
    this.laneOpen.set(true);
  }

  protected async submitLane(): Promise<void> {
    const value = this.laneForm.getRawValue();
    const outcome = await this.store.saveLane({ ...value }, this.editingLane()?.id);
    if (outcome.ok) {
      this.message.success(this.i18n.instant('distribution.notification.saved'));
      this.laneOpen.set(false);
    } else {
      this.laneError.set(outcome);
    }
  }

  protected async removeLane(lane: DstLane): Promise<void> {
    const outcome = await this.store.removeLane(lane.id);
    this.feedback.set(outcome.ok ? null : outcome);
  }
}
