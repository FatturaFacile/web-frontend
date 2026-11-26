import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  EodStockReconciliationLine,
  VanVisitEmptiesPayload,
  VanVisitOutcome,
  VanVisitSaleLinePayload,
  VanWarehouse,
} from '@core';
import { VanSellingStore } from './van-selling.store';

/**
 * Mod 233 Operational Cockpit: Van Warehouses, Morning Load & Global DDT,
 * Field Route Execution (GS1-128, Fast Reorder, Credit Unblock, Empties),
 * Offline Delta Sync & Bluetooth ESC/POS/ZPL Print, and End-of-Day Settlement.
 *
 * All UI copy is consumed dynamically from the backend-seeded `/van-selling/config`
 * dictionary with zero additions to frontend i18n files.
 */
@Component({
  selector: 'app-van-selling-cockpit',
  providers: [VanSellingStore],
  styleUrl: './van-selling.scss',
  imports: [
    DecimalPipe,
    FormsModule,
    ReactiveFormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzCheckboxModule,
    NzEmptyModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
  ],
  template: `
    <div class="van-selling-shell">
      <div class="van-header">
        <div>
          <h1>{{ store.label('page_title') }}</h1>
          <p class="van-subtitle">{{ store.label('page_subtitle') }}</p>
        </div>
        <div class="toolbar-row">
          <nz-select
            style="min-width: 240px;"
            [ngModel]="store.selectedVanId()"
            (ngModelChange)="onVanSelected($event)"
          >
            @for (van of store.vans(); track van.id) {
              <nz-option [nzValue]="van.id" [nzLabel]="van.license_plate + ' — ' + van.name"></nz-option>
            }
          </nz-select>
          <button nz-button nzType="primary" (click)="vanModalVisible.set(true)">
            {{ store.label('new_van') }}
          </button>
        </div>
      </div>

      @if (store.error(); as err) {
        <nz-alert nzType="error" [nzMessage]="err" nzShowIcon></nz-alert>
      }

      <nz-spin [nzSpinning]="store.loading()">
        <nz-tabs [nzSelectedIndex]="activeTab()" (nzSelectedIndexChange)="activeTab.set($event)">
          <!-- TAB 1: VANS, COLD-CHAIN & DEDICATED SECTIONALS -->
          <nz-tab [nzTitle]="store.label('tab_vans')">
            @if (store.config()?.regulatory?.['offline_sectional_notice']; as notice) {
              <nz-alert nzType="info" [nzMessage]="notice" nzShowIcon style="margin-bottom: 12px;"></nz-alert>
            }
            <nz-card>
              <nz-table #vansTable [nzData]="store.vans()" nzSize="small">
                <thead>
                  <tr>
                    <th>{{ store.label('van_code') }}</th>
                    <th>{{ store.label('license_plate') }}</th>
                    <th>{{ store.label('van_name') }}</th>
                    <th>{{ store.label('driver_name') }}</th>
                    <th>{{ store.label('cold_chain') }}</th>
                    <th>{{ store.label('invoice_sectional') }}</th>
                    <th>{{ store.label('ddt_sectional') }}</th>
                    <th>{{ store.label('receipt_sectional') }}</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  @for (van of vansTable.data; track van.id) {
                    <tr>
                      <td><strong>{{ van.code }}</strong></td>
                      <td><nz-tag nzColor="blue">{{ van.license_plate }}</nz-tag></td>
                      <td>{{ van.name }}</td>
                      <td>{{ van.driver_name || '—' }}</td>
                      <td>
                        @if (van.has_cold_chain) {
                          <nz-tag [nzColor]="van.temp_alert_active ? 'red' : 'green'">
                            {{ van.current_temp_celsius ?? '—' }} °C
                          </nz-tag>
                        } @else {
                          <span class="muted">—</span>
                        }
                      </td>
                      <td><code>{{ van.invoice_sectional_code }}</code> (#{{ van.invoice_next_number }})</td>
                      <td><code>{{ van.ddt_sectional_code }}</code> (#{{ van.ddt_next_number }})</td>
                      <td><code>{{ van.receipt_sectional_code }}</code> (#{{ van.receipt_next_number }})</td>
                      <td class="toolbar-row" style="margin-bottom: 0;">
                        <button nz-button nzSize="small" (click)="openTemperatureModal(van)">
                          {{ store.label('record_temp') }}
                        </button>
                        <button nz-button nzSize="small" (click)="reserveBatch(van)">
                          {{ store.label('reserve_offline_batch') }}
                        </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </nz-table>

              @if (store.lastReservedBatch(); as batch) {
                <nz-alert
                  style="margin-top: 12px;"
                  nzType="success"
                  [nzMessage]="batch.sectional_code + ': ' + batch.reserved_numbers[0] + ' .. ' + batch.reserved_numbers[batch.reserved_numbers.length - 1]"
                  nzShowIcon
                ></nz-alert>
              }
            </nz-card>
          </nz-tab>

          <!-- TAB 2: MORNING LOAD MANIFEST & GLOBAL DDT -->
          <nz-tab [nzTitle]="store.label('tab_manifests')">
            @if (store.config()?.regulatory?.['it_ddt_notice']; as ddtNotice) {
              <nz-alert nzType="info" [nzMessage]="ddtNotice" nzShowIcon style="margin-bottom: 12px;"></nz-alert>
            }
            <nz-card>
              <div class="toolbar-row">
                <button nz-button (click)="loadSuggestions()" [disabled]="!store.selectedVan()">
                  {{ store.label('load_suggestions') }}
                </button>
                <button
                  nz-button
                  nzType="primary"
                  (click)="createManifestFromSuggestions()"
                  [disabled]="store.suggestions().length === 0 || !store.selectedVan()"
                >
                  {{ store.label('create_manifest') }}
                </button>
              </div>

              @if (store.suggestions().length > 0) {
                <nz-table #sugTable [nzData]="store.suggestions()" nzSize="small" [nzShowPagination]="false">
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Product</th>
                      <th class="num">Avg Weekday</th>
                      <th class="num">Onboard</th>
                      <th class="num">Suggested Load</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (sug of sugTable.data; track sug.product_id) {
                      <tr>
                        <td><code>{{ sug.sku }}</code></td>
                        <td>{{ sug.name }}</td>
                        <td class="num">{{ sug.historical_weekday_avg_qty | number: '1.2-2' }}</td>
                        <td class="num">{{ sug.current_onboard_qty | number: '1.2-2' }}</td>
                        <td class="num"><strong>{{ sug.suggested_load_qty | number: '1.2-2' }} {{ sug.unit_measure }}</strong></td>
                      </tr>
                    }
                  </tbody>
                </nz-table>
              }

              <nz-table #manTable [nzData]="store.manifests()" nzSize="small" style="margin-top: 16px;">
                <thead>
                  <tr>
                    <th>Manifest #</th>
                    <th>{{ store.label('license_plate') }}</th>
                    <th>Date</th>
                    <th>{{ store.label('global_ddt_badge') }}</th>
                    <th>Status</th>
                    <th class="num">Net Value</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  @for (man of manTable.data; track man.id) {
                    <tr>
                      <td><strong>{{ man.manifest_number }}</strong></td>
                      <td>{{ man.van_license_plate || man.van_warehouse_id }}</td>
                      <td>{{ man.load_date }}</td>
                      <td>
                        @if (man.global_ddt_number) {
                          <nz-tag nzColor="green">{{ man.global_ddt_number }} ({{ man.global_ddt_causal }})</nz-tag>
                        } @else {
                          <span class="muted">—</span>
                        }
                      </td>
                      <td><nz-tag>{{ man.status }}</nz-tag></td>
                      <td class="num">{{ man.total_net_value }} {{ man.currency }}</td>
                      <td>
                        @if (man.status === 'planned') {
                          <button nz-button nzSize="small" nzType="primary" (click)="issueGlobalDdt(man.id)">
                            {{ store.label('issue_global_ddt') }}
                          </button>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </nz-table>
            </nz-card>
          </nz-tab>

          <!-- TAB 3: ROUTE EXECUTION, GS1-128, FAST REORDER & CREDIT UNBLOCK -->
          <nz-tab [nzTitle]="store.label('tab_routes')">
            <div class="grid-2">
              <nz-card [nzTitle]="store.label('select_route')">
                <div class="toolbar-row">
                  <nz-select
                    style="width: 100%;"
                    [ngModel]="store.selectedRouteId()"
                    (ngModelChange)="store.selectRoute($event)"
                  >
                    @for (route of store.routePlans(); track route.id) {
                      <nz-option [nzValue]="route.id" [nzLabel]="route.route_code + ' — ' + route.name + ' (' + route.plan_date + ')'"></nz-option>
                    }
                  </nz-select>
                </div>

                @if (store.selectedRoute(); as route) {
                  <nz-table #stopsTable [nzData]="route.stops" nzSize="small" [nzShowPagination]="false">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>{{ store.label('select_customer') }}</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (stop of stopsTable.data; track stop.contact_id) {
                        <tr>
                          <td>{{ stop.sequence }}</td>
                          <td>
                            <strong>{{ stop.customer_name || stop.contact_id }}</strong>
                            @if (stop.address) {
                              <div class="muted">{{ stop.address }}</div>
                            }
                          </td>
                          <td>
                            <button nz-button nzSize="small" (click)="selectStopCustomer(stop.contact_id, stop.sequence)">
                              {{ store.label('select_customer') }}
                            </button>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </nz-table>
                }
              </nz-card>

              <nz-card [nzTitle]="store.label('gs1_barcode_label')">
                <div class="toolbar-row">
                  <input nz-input [(ngModel)]="gs1Input" style="flex: 1;" />
                  <button nz-button nzType="primary" (click)="parseGs1()" [disabled]="!gs1Input.trim()">
                    {{ store.label('parse_gs1') }}
                  </button>
                </div>
                @if (store.lastGs1Parse(); as gs1) {
                  <nz-alert
                    nzType="success"
                    [nzMessage]="(gs1.matched_product_name || gs1.sku_candidate || gs1.format) + ' — ' + (gs1.net_weight_kg ?? 0) + ' kg · Lot: ' + (gs1.lot_number ?? '—')"
                    nzShowIcon
                  ></nz-alert>
                }

                @if (store.customerDossier(); as dossier) {
                  <div style="margin-top: 16px;">
                    @if (dossier.credit.is_blocked) {
                      <nz-alert
                        nzType="error"
                        [nzMessage]="store.label('credit_blocked_alert')"
                        [nzDescription]="'Overdue: ' + dossier.credit.overdue_amount + ' | Exposure: ' + dossier.credit.open_exposure + ' / ' + dossier.credit.credit_limit"
                        nzShowIcon
                      ></nz-alert>
                      @if (dossier.credit.overdue_invoices.length > 0) {
                        <button
                          nz-button
                          nzType="primary"
                          nzDanger
                          style="margin-top: 8px;"
                          (click)="unblockModalVisible.set(true)"
                        >
                          {{ store.label('unblock_credit_btn') }}
                        </button>
                      }
                    } @else {
                      <nz-tag nzColor="green">{{ store.label('credit_ok_badge') }}</nz-tag>
                    }

                    @if (dossier.fast_reorder_last_5.length > 0) {
                      <div style="margin-top: 12px;">
                        <div class="toolbar-row">
                          <strong>{{ store.label('fast_reorder_title') }}</strong>
                          <button nz-button nzSize="small" (click)="applyFastReorder()">
                            {{ store.label('apply_fast_reorder') }}
                          </button>
                        </div>
                      </div>
                    }
                  </div>
                }
              </nz-card>
            </div>

            <nz-card style="margin-top: 16px;">
              <div class="toolbar-row">
                <nz-select [(ngModel)]="visitMode" style="width: 220px;">
                  @for (opt of store.config()?.visit_modes ?? []; track opt.code) {
                    <nz-option [nzValue]="opt.code" [nzLabel]="opt.label"></nz-option>
                  }
                </nz-select>
                <nz-select [(ngModel)]="docType" style="width: 260px;">
                  @for (opt of store.config()?.document_types ?? []; track opt.code) {
                    <nz-option [nzValue]="opt.code" [nzLabel]="opt.label"></nz-option>
                  }
                </nz-select>
                <nz-select [(ngModel)]="paymentMethod" style="width: 180px;">
                  @for (opt of store.config()?.payment_methods ?? []; track opt.code) {
                    <nz-option [nzValue]="opt.code" [nzLabel]="opt.label"></nz-option>
                  }
                </nz-select>
                <nz-input-number [(ngModel)]="collectedAmount" [nzMin]="0" [nzStep]="1"></nz-input-number>
                <button
                  nz-button
                  nzType="primary"
                  (click)="submitVisit(false)"
                  [disabled]="!store.selectedRoute() || !store.selectedCustomerId()"
                >
                  {{ store.label('submit_visit') }}
                </button>
                <button
                  nz-button
                  (click)="submitVisit(true)"
                  [disabled]="!store.selectedRoute() || !store.selectedCustomerId()"
                >
                  {{ store.label('queue_offline') }} ({{ store.offlineQueue().length }})
                </button>
              </div>

              @if (draftLines().length > 0) {
                <nz-table #draftTable [nzData]="draftLines()" nzSize="small" [nzShowPagination]="false">
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th>Lot</th>
                      <th class="num">Qty</th>
                      <th class="num">Unit Price</th>
                      <th class="num">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (line of draftTable.data; track $index) {
                      <tr>
                        <td>{{ line.description || line.product_id }}</td>
                        <td>{{ line.lot_number || '—' }}</td>
                        <td class="num">{{ line.quantity }}</td>
                        <td class="num">{{ line.unit_price ?? 0 | number: '1.2-2' }}</td>
                        <td class="num">{{ (line.quantity * (line.unit_price ?? 0)) | number: '1.2-2' }}</td>
                      </tr>
                    }
                  </tbody>
                </nz-table>
              }
            </nz-card>
          </nz-tab>

          <!-- TAB 4: OFFLINE DELTA SYNC & BLUETOOTH THERMAL PRINT -->
          <nz-tab [nzTitle]="store.label('tab_sync_print')">
            <nz-card>
              <div class="toolbar-row">
                <button
                  nz-button
                  nzType="primary"
                  (click)="runOfflineSync()"
                  [disabled]="!store.selectedVan()"
                >
                  {{ store.label('run_offline_sync') }} ({{ store.offlineQueue().length }})
                </button>
              </div>

              @if (store.lastSyncResult(); as sync) {
                <nz-alert
                  nzType="success"
                  style="margin-bottom: 12px;"
                  [nzMessage]="sync.encryption_algorithm + ' · Processed: ' + sync.processed_count + ' · Conflicts: ' + sync.conflict_count + ' · Version: ' + sync.server_sync_version"
                  nzShowIcon
                ></nz-alert>
              }

              <nz-table #visitsTable [nzData]="store.visits()" nzSize="small">
                <thead>
                  <tr>
                    <th>Document #</th>
                    <th>Customer</th>
                    <th>Mode</th>
                    <th>Status</th>
                    <th>SDI / QR-Bill</th>
                    <th class="num">Gross</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  @for (visit of visitsTable.data; track visit.id) {
                    <tr>
                      <td><code>{{ visit.definitive_document_number || '—' }}</code></td>
                      <td>{{ visit.customer_name || visit.contact_id }}</td>
                      <td><nz-tag>{{ visit.visit_mode }}</nz-tag></td>
                      <td><nz-tag [nzColor]="visit.outcome_status === 'credit_blocked' ? 'red' : 'blue'">{{ visit.outcome_status }}</nz-tag></td>
                      <td>
                        @if (visit.qr_bill_generated) {
                          <nz-tag nzColor="purple">{{ visit.qr_bill_reference }}</nz-tag>
                        } @else {
                          <nz-tag>{{ visit.sdi_transmission_status }}</nz-tag>
                        }
                      </td>
                      <td class="num">{{ visit.total_gross }} {{ visit.currency }}</td>
                      <td>
                        @if (visit.definitive_document_number) {
                          <button nz-button nzSize="small" (click)="openThermalPrint(visit)">
                            {{ store.label('thermal_preview') }}
                          </button>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </nz-table>
            </nz-card>
          </nz-tab>

          <!-- TAB 5: END-OF-DAY SETTLEMENT (QUADRATURA FINE GIRO) -->
          <nz-tab [nzTitle]="store.label('tab_eod')">
            <nz-card>
              <div class="toolbar-row">
                <button nz-button nzType="primary" (click)="previewEod()" [disabled]="!store.selectedVan()">
                  {{ store.label('eod_preview') }}
                </button>
              </div>

              @if (store.settlementPreview(); as prev) {
                <nz-table #eodPrevTable [nzData]="eodLines()" nzSize="small" [nzShowPagination]="false">
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Product</th>
                      <th class="num">Loaded</th>
                      <th class="num">Sold</th>
                      <th class="num">Remaining</th>
                      <th class="num">{{ store.label('keep_onboard') }}</th>
                      <th class="num">{{ store.label('unload_central') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (line of eodPrevTable.data; track $index) {
                      <tr>
                        <td><code>{{ line.sku }}</code></td>
                        <td>{{ line.description }}</td>
                        <td class="num">{{ line.loaded_qty }}</td>
                        <td class="num">{{ line.sold_qty }}</td>
                        <td class="num"><strong>{{ line.remaining_qty }}</strong></td>
                        <td class="num">
                          <nz-input-number
                            [ngModel]="line.keep_onboard_qty"
                            [nzMin]="0"
                            [nzMax]="line.remaining_qty"
                            (ngModelChange)="updateEodSplit($index, $event)"
                          ></nz-input-number>
                        </td>
                        <td class="num">{{ line.unload_central_qty }}</td>
                      </tr>
                    }
                  </tbody>
                </nz-table>

                <div class="grid-3" style="margin-top: 16px;">
                  <div>
                    <label for="van-eod-opening-float">{{ store.label('opening_float') }}</label>
                    <nz-input-number nzId="van-eod-opening-float" id="van-eod-opening-float" [(ngModel)]="openingFloat" [nzMin]="0" style="width: 100%;"></nz-input-number>
                  </div>
                  <div>
                    <label for="van-eod-counted-cash">{{ store.label('counted_cash') }}</label>
                    <nz-input-number nzId="van-eod-counted-cash" id="van-eod-counted-cash" [(ngModel)]="countedCash" [nzMin]="0" style="width: 100%;"></nz-input-number>
                  </div>
                  <div style="display: flex; align-items: flex-end;">
                    <button nz-button nzType="primary" (click)="completeEod()" style="width: 100%;">
                      {{ store.label('eod_complete') }}
                    </button>
                  </div>
                </div>
              }

              <nz-table #eodTable [nzData]="store.settlements()" nzSize="small" style="margin-top: 16px;">
                <thead>
                  <tr>
                    <th>Settlement #</th>
                    <th>{{ store.label('license_plate') }}</th>
                    <th>Date</th>
                    <th>{{ store.label('deposit_slip') }}</th>
                    <th class="num">{{ store.label('keep_onboard') }}</th>
                    <th class="num">{{ store.label('unload_central') }}</th>
                    <th class="num">{{ store.label('total_remittance') }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (settle of eodTable.data; track settle.id) {
                    <tr>
                      <td><strong>{{ settle.settlement_number }}</strong></td>
                      <td>{{ settle.van_license_plate || settle.van_warehouse_id }}</td>
                      <td>{{ settle.settlement_date }}</td>
                      <td><code>{{ settle.deposit_slip_number || '—' }}</code></td>
                      <td class="num">{{ settle.total_keep_onboard_qty }}</td>
                      <td class="num">{{ settle.total_unload_central_qty }}</td>
                      <td class="num"><strong>{{ settle.total_remittance_amount }} {{ settle.currency }}</strong></td>
                    </tr>
                  }
                </tbody>
              </nz-table>
            </nz-card>
          </nz-tab>
        </nz-tabs>
      </nz-spin>

      <!-- NEW VAN MODAL -->
      <nz-modal
        [(nzVisible)]="vanModalVisible"
        [nzTitle]="store.label('new_van')"
        (nzOnCancel)="vanModalVisible.set(false)"
        (nzOnOk)="saveNewVan()"
      >
        <ng-container *nzModalContent>
          <form nz-form [formGroup]="vanForm" nzLayout="vertical">
            <nz-form-item>
              <nz-form-label nzRequired>{{ store.label('van_code') }}</nz-form-label>
              <nz-form-control><input nz-input formControlName="code" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired>{{ store.label('license_plate') }}</nz-form-label>
              <nz-form-control><input nz-input formControlName="license_plate" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired>{{ store.label('van_name') }}</nz-form-label>
              <nz-form-control><input nz-input formControlName="name" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ store.label('driver_name') }}</nz-form-label>
              <nz-form-control><input nz-input formControlName="driver_name" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <label nz-checkbox for="van-new-cold-chain" nzId="van-new-cold-chain" formControlName="has_cold_chain">{{ store.label('cold_chain') }}</label>
            </nz-form-item>
          </form>
        </ng-container>
      </nz-modal>

      <!-- TEMPERATURE MODAL -->
      <nz-modal
        [(nzVisible)]="tempModalVisible"
        [nzTitle]="store.label('record_temp')"
        (nzOnCancel)="tempModalVisible.set(false)"
        (nzOnOk)="saveTemperature()"
      >
        <ng-container *nzModalContent>
          <label for="van-record-temp-input">{{ store.label('current_temp') }}</label>
          <nz-input-number nzId="van-record-temp-input" id="van-record-temp-input" [(ngModel)]="tempInput" style="width: 100%;"></nz-input-number>
        </ng-container>
      </nz-modal>

      <!-- UNBLOCK CREDIT MODAL -->
      <nz-modal
        [(nzVisible)]="unblockModalVisible"
        [nzTitle]="store.label('unblock_credit_btn')"
        (nzOnCancel)="unblockModalVisible.set(false)"
        (nzOnOk)="confirmUnblockCredit()"
      >
        <ng-container *nzModalContent>
          @if (store.customerDossier()?.credit?.overdue_invoices?.[0]; as inv) {
            <p>{{ inv.invoice_number }} — {{ inv.remaining_due }} {{ inv.currency }}</p>
            <nz-select [(ngModel)]="unblockMethod" style="width: 100%; margin-bottom: 12px;">
              @for (opt of store.config()?.payment_methods ?? []; track opt.code) {
                <nz-option [nzValue]="opt.code" [nzLabel]="opt.label"></nz-option>
              }
            </nz-select>
            <nz-input-number [(ngModel)]="unblockAmount" [nzMin]="0.01" style="width: 100%;"></nz-input-number>
          }
        </ng-container>
      </nz-modal>

      <!-- THERMAL PRINT MODAL -->
      <nz-modal
        [(nzVisible)]="printModalVisible"
        [nzTitle]="store.label('thermal_preview')"
        (nzOnCancel)="printModalVisible.set(false)"
        (nzOnOk)="printModalVisible.set(false)"
        [nzWidth]="680"
      >
        <ng-container *nzModalContent>
          @if (store.activePrintJob(); as job) {
            <p>
              <nz-tag nzColor="blue">{{ job.profile }}</nz-tag>
              <nz-tag>{{ job.printer_brand }} ({{ job.paper_width_mm }})</nz-tag>
            </p>
            <pre class="code-block">{{ job.human_preview }}</pre>
            <h4>ZPL II (104mm)</h4>
            <pre class="code-block">{{ job.zpl_commands }}</pre>
          }
        </ng-container>
      </nz-modal>
    </div>
  `,
})
export class VanSellingCockpitComponent implements OnInit {
  protected readonly store = inject(VanSellingStore);
  private readonly message = inject(NzMessageService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);

  readonly activeTab = signal(0);
  readonly vanModalVisible = signal(false);
  readonly tempModalVisible = signal(false);
  readonly unblockModalVisible = signal(false);
  readonly printModalVisible = signal(false);
  readonly draftLines = signal<VanVisitSaleLinePayload[]>([]);
  readonly eodLines = signal<EodStockReconciliationLine[]>([]);

  gs1Input = '(01)08001234567893(3103)002450(10)LOT-CH2611(17)261231';
  visitMode: 'van_selling' | 'field_presale' = 'van_selling';
  docType: 'immediate_invoice' | 'delivery_note_ddt' | 'commercial_receipt_rt' | 'sales_order' =
    'immediate_invoice';
  paymentMethod = 'cash';
  collectedAmount = 0;
  selectedStopSequence = 1;
  tempTargetVanId: string | null = null;
  tempInput = 2.4;
  unblockMethod = 'twint';
  unblockAmount = 0;
  openingFloat = 150;
  countedCash = 150;

  readonly vanForm = this.fb.group({
    code: ['', [Validators.required]],
    license_plate: ['', [Validators.required]],
    name: ['', [Validators.required]],
    driver_name: [''],
    has_cold_chain: [true],
  });

  readonly draftTotal = computed(() =>
    this.draftLines().reduce((acc, l) => acc + l.quantity * (l.unit_price ?? 0), 0),
  );

  ngOnInit(): void {
    const initialTab = this.route.snapshot.data['initialTab'];
    if (typeof initialTab === 'number') {
      this.activeTab.set(initialTab);
    }
    void this.store.loadAll();
  }

  onVanSelected(vanId: string): void {
    this.store.selectVan(vanId);
  }

  async saveNewVan(): Promise<void> {
    if (this.vanForm.invalid) {
      return;
    }
    const raw = this.vanForm.getRawValue();
    await this.store.createVan({
      ...raw,
      min_temp_celsius: raw.has_cold_chain ? 0 : null,
      max_temp_celsius: raw.has_cold_chain ? 4 : null,
      current_temp_celsius: raw.has_cold_chain ? 2.5 : null,
    });
    this.vanModalVisible.set(false);
    this.vanForm.reset({ code: '', license_plate: '', name: '', driver_name: '', has_cold_chain: true });
    this.message.success(this.store.label('new_van'));
  }

  openTemperatureModal(van: VanWarehouse): void {
    this.tempTargetVanId = van.id;
    this.tempInput = van.current_temp_celsius ? Number(van.current_temp_celsius) : 2.5;
    this.tempModalVisible.set(true);
  }

  async saveTemperature(): Promise<void> {
    if (!this.tempTargetVanId) {
      return;
    }
    await this.store.recordTemperature(this.tempTargetVanId, this.tempInput);
    this.tempModalVisible.set(false);
  }

  async reserveBatch(van: VanWarehouse): Promise<void> {
    await this.store.reserveSectionalBatch(van.id, 'immediate_invoice', 25);
  }

  async loadSuggestions(): Promise<void> {
    const van = this.store.selectedVan();
    if (!van) {
      return;
    }
    await this.store.loadReplenishmentSuggestions(van.id);
  }

  async createManifestFromSuggestions(): Promise<void> {
    const van = this.store.selectedVan();
    if (!van || this.store.suggestions().length === 0) {
      return;
    }
    await this.store.createManifest({
      van_warehouse_id: van.id,
      departure_temp_celsius: van.current_temp_celsius ? Number(van.current_temp_celsius) : 2.5,
      lines: this.store.suggestions()
        .filter((s) => s.suggested_load_qty > 0)
        .map((s) => ({
          product_id: s.product_id,
          quantity: s.suggested_load_qty,
          is_variable_weight: s.unit_measure === 'kg',
        })),
    });
  }

  async issueGlobalDdt(manifestId: string): Promise<void> {
    await this.store.issueGlobalDdt(manifestId);
    this.message.success(this.store.label('global_ddt_badge'));
  }

  async selectStopCustomer(contactId: string, sequence: number): Promise<void> {
    this.selectedStopSequence = sequence;
    const dossier = await this.store.loadCustomerDossier(contactId, this.draftTotal());
    const firstOverdue = dossier.credit.overdue_invoices[0];
    if (firstOverdue) {
      this.unblockAmount = firstOverdue.remaining_due;
    }
  }

  async parseGs1(): Promise<void> {
    const parsed = await this.store.parseGs1Barcode(this.gs1Input);
    if (parsed.matched_product_id && parsed.net_weight_kg) {
      this.draftLines.update((lines) => [
        ...lines,
        {
          product_id: parsed.matched_product_id!,
          description: parsed.matched_product_name ?? parsed.sku_candidate ?? 'GS1 Item',
          quantity: parsed.net_weight_kg!,
          unit_price: parsed.unit_price ?? 0,
          lot_number: parsed.lot_number,
          expiry_date: parsed.expiry_date,
          gs1_barcode: parsed.raw_barcode,
          is_variable_weight: true,
        },
      ]);
    }
  }

  applyFastReorder(): void {
    const items = this.store.customerDossier()?.fast_reorder_last_5 ?? [];
    this.draftLines.set(
      items.map((i) => ({
        product_id: i.product_id,
        description: i.description,
        quantity: i.suggested_quantity,
        unit_price: i.last_unit_price,
        tax_rate: i.tax_rate,
      })),
    );
  }

  async confirmUnblockCredit(): Promise<void> {
    const dossier = this.store.customerDossier();
    const inv = dossier?.credit.overdue_invoices[0];
    if (!dossier || !inv) {
      return;
    }
    await this.store.unblockCustomerCredit(dossier.contact.id, {
      invoice_id: inv.invoice_id,
      amount: this.unblockAmount,
      payment_method: this.unblockMethod,
    });
    this.unblockModalVisible.set(false);
  }

  async submitVisit(queueOffline: boolean): Promise<void> {
    const route = this.store.selectedRoute();
    const contactId = this.store.selectedCustomerId();
    if (!route || !contactId) {
      return;
    }
    const empties: VanVisitEmptiesPayload[] = [];
    const payload = {
      field_route_plan_id: route.id,
      van_load_manifest_id: route.van_load_manifest_id,
      contact_id: contactId,
      stop_sequence: this.selectedStopSequence,
      visit_mode: this.visitMode,
      outcome_status:
        this.visitMode === 'field_presale' ? ('presale_order' as const) : ('completed_sale' as const),
      document_type: this.docType,
      sale_lines: this.draftLines(),
      empties_movements: empties,
      collected_amount: this.collectedAmount,
      payment_method: this.paymentMethod,
      client_idempotency_key: `VAN-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      offline_created_at: queueOffline ? new Date().toISOString() : null,
    };

    if (queueOffline) {
      this.store.queueOfflineVisit(payload);
      this.draftLines.set([]);
      return;
    }

    await this.store.submitVisit(payload);
    this.draftLines.set([]);
  }

  async runOfflineSync(): Promise<void> {
    const van = this.store.selectedVan();
    if (!van) {
      return;
    }
    await this.store.runOfflineDeltaSync(van.id);
  }

  async openThermalPrint(visit: VanVisitOutcome): Promise<void> {
    await this.store.fetchThermalPrint(visit.id);
    this.printModalVisible.set(true);
  }

  async previewEod(): Promise<void> {
    const van = this.store.selectedVan();
    if (!van) {
      return;
    }
    const prev = await this.store.previewSettlement(van.id);
    this.eodLines.set(prev.stock_reconciliation_lines.map((l) => ({ ...l })));
    this.countedCash = this.openingFloat + prev.collections_summary.collected_cash_amount;
  }

  updateEodSplit(index: number, keepQty: number): void {
    this.eodLines.update((lines) =>
      lines.map((line, i) => {
        if (i !== index) {
          return line;
        }
        const clamped = Math.max(0, Math.min(line.remaining_qty, Number(keepQty) || 0));
        return {
          ...line,
          keep_onboard_qty: clamped,
          unload_central_qty: Math.max(0, Number((line.remaining_qty - clamped).toFixed(4))),
        };
      }),
    );
  }

  async completeEod(): Promise<void> {
    const van = this.store.selectedVan();
    if (!van) {
      return;
    }
    await this.store.completeSettlement({
      van_warehouse_id: van.id,
      stock_reconciliation_lines: this.eodLines(),
      opening_cash_float: this.openingFloat,
      counted_cash_remittance: this.countedCash,
    });
    this.eodLines.set([]);
  }
}
