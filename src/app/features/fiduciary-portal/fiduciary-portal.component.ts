import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18nService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { firstValueFrom } from 'rxjs';
import { FiduciaryPortalApiService } from './fiduciary-portal-api.service';
import {
  FiduciaryEntryNote,
  FiduciaryFiscalPeriod,
  FiduciaryJournalEntry,
  FiduciaryTranscodingRow,
  StudioExportFormatCode,
} from './fiduciary-portal.models';
import { FiduciaryPortalStore } from './fiduciary-portal.store';

@Component({
  selector: 'app-fiduciary-portal',
  providers: [FiduciaryPortalStore],
  styleUrl: './fiduciary-portal.component.scss',
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzCheckboxModule,
    NzDescriptionsModule,
    NzDrawerModule,
    NzEmptyModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzSpinModule,
    NzStatisticModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  template: `
    <app-page-header
      [title]="'PAGE_TITLE.FIDUCIARY_PORTAL' | translate"
      [subtitle]="'fiduciaryPortal.subtitle' | translate"
    />

    @if (store.errorMessage(); as errorMsg) {
      <nz-alert nzType="error" nzShowIcon class="mb-3" [nzMessage]="errorMsg" />
    }

    @if (store.hasFiduciaryLockedPeriods()) {
      <nz-alert
        nzType="warning"
        nzShowIcon
        class="mb-3"
        [nzMessage]="'fiduciaryPortal.notice.periodLockedBanner' | translate"
      />
    }

    <nz-card class="mb-4">
      <div class="fiduciary-header-bar">
        <div>
          <label for="fid-client-select" class="d-block mb-1">
            {{ 'fiduciaryPortal.clientSwitcher.label' | translate }}
          </label>
          <nz-select
            id="fid-client-select"
            nzId="fid-client-select"
            style="min-width: 300px"
            [ngModel]="store.activeTenantId()"
            (ngModelChange)="onSwitchClient($event)"
          >
            @for (client of store.clients(); track client.tenant_id) {
              <nz-option
                [nzValue]="client.tenant_id"
                [nzLabel]="client.legal_name + ' (' + client.jurisdiction + ' / ' + client.currency + ')'"
              />
            }
          </nz-select>
        </div>

        @if (store.activeClient(); as active) {
          <div>
            <nz-tag [nzColor]="active.jurisdiction === 'CH' ? 'red' : 'blue'">
              {{ active.jurisdiction }} · {{ active.currency }}
            </nz-tag>
            @if (active.vat_number) {
              <nz-tag>{{ active.vat_number }}</nz-tag>
            }
            @if (active.uid_number) {
              <nz-tag>{{ active.uid_number }}</nz-tag>
            }
          </div>
        }
      </div>

      @if (store.activeClient(); as active) {
        <div class="kpi-grid">
          <nz-card nzSize="small">
            <nz-statistic
              [nzTitle]="'fiduciaryPortal.kpi.verificationProgress' | translate"
              [nzValue]="active.verification_progress_percent"
              nzSuffix="%"
            />
          </nz-card>
          <nz-card nzSize="small">
            <nz-statistic
              [nzTitle]="'fiduciaryPortal.kpi.lockedPeriods' | translate"
              [nzValue]="active.periods_fiduciary_locked"
            />
          </nz-card>
          <nz-card nzSize="small">
            <nz-statistic
              [nzTitle]="'fiduciaryPortal.kpi.openNotes' | translate"
              [nzValue]="active.open_notes_count"
            />
          </nz-card>
          <nz-card nzSize="small">
            <nz-statistic
              [nzTitle]="'fiduciaryPortal.kpi.unmappedAccounts' | translate"
              [nzValue]="active.unmapped_accounts_count"
            />
          </nz-card>
          <nz-card nzSize="small">
            <nz-statistic
              [nzTitle]="'fiduciaryPortal.kpi.exportRuns' | translate"
              [nzValue]="active.export_runs_count"
            />
          </nz-card>
        </div>
      }
    </nz-card>

    <nz-spin [nzSpinning]="store.busy()">
      <nz-card>
        <nz-tabs>
          <!-- TAB 1: Multi-Client Overview -->
          <nz-tab [nzTitle]="'fiduciaryPortal.tab.overview' | translate">
            <nz-table [nzData]="store.clients()" nzSize="small" [nzShowPagination]="false">
              <thead>
                <tr>
                  <th>{{ 'fiduciaryPortal.col.client' | translate }}</th>
                  <th>{{ 'fiduciaryPortal.col.jurisdiction' | translate }}</th>
                  <th>{{ 'fiduciaryPortal.kpi.verificationProgress' | translate }}</th>
                  <th>{{ 'fiduciaryPortal.kpi.lockedPeriods' | translate }}</th>
                  <th>{{ 'fiduciaryPortal.kpi.openNotes' | translate }}</th>
                  <th>{{ 'fiduciaryPortal.kpi.unmappedAccounts' | translate }}</th>
                  <th>{{ 'fiduciaryPortal.col.actions' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (client of store.clients(); track client.tenant_id) {
                  <tr>
                    <td><strong>{{ client.legal_name }}</strong></td>
                    <td>
                      <nz-tag [nzColor]="client.jurisdiction === 'CH' ? 'red' : 'blue'">
                        {{ client.jurisdiction }} ({{ client.currency }})
                      </nz-tag>
                    </td>
                    <td>{{ client.verified_entries_count }} / {{ client.posted_entries_count }} ({{ client.verification_progress_percent }}%)</td>
                    <td>
                      <nz-tag [nzColor]="client.periods_fiduciary_locked > 0 ? 'orange' : 'default'">
                        {{ client.periods_fiduciary_locked }} / {{ client.periods_total }}
                      </nz-tag>
                    </td>
                    <td>{{ client.open_notes_count }}</td>
                    <td>{{ client.unmapped_accounts_count }}</td>
                    <td>
                      <button
                        nz-button
                        nzSize="small"
                        [nzType]="client.tenant_id === store.activeTenantId() ? 'primary' : 'default'"
                        type="button"
                        (click)="onSwitchClient(client.tenant_id)"
                      >
                        {{ 'fiduciaryPortal.clientSwitcher.switchAction' | translate }}
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </nz-table>
          </nz-tab>

          <!-- TAB 2: Prima Nota & Verificato dal Fiduciario -->
          <nz-tab [nzTitle]="'fiduciaryPortal.tab.journals' | translate">
            <div class="filter-toolbar">
              <nz-select
                style="width: 160px"
                nzAllowClear
                [nzPlaceHolder]="'fiduciaryPortal.filter.fiscalYear' | translate"
                [(ngModel)]="journalFilters.fiscal_year_id"
                (ngModelChange)="applyJournalFilters()"
              >
                @for (fy of store.fiscalYears(); track fy.id) {
                  <nz-option [nzValue]="fy.id" [nzLabel]="fy.year_code" />
                }
              </nz-select>

              <nz-select
                style="width: 190px"
                nzAllowClear
                [nzPlaceHolder]="'fiduciaryPortal.filter.period' | translate"
                [(ngModel)]="journalFilters.fiscal_period_id"
                (ngModelChange)="applyJournalFilters()"
              >
                @for (p of store.fiscalPeriods(); track p.id) {
                  <nz-option [nzValue]="p.id" [nzLabel]="p.period_name" />
                }
              </nz-select>

              <nz-select
                style="width: 180px"
                [(ngModel)]="journalFilters.fiduciary_verified"
                (ngModelChange)="applyJournalFilters()"
              >
                <nz-option nzValue="all" [nzLabel]="'fiduciaryPortal.filter.all' | translate" />
                <nz-option nzValue="verified" [nzLabel]="'fiduciaryPortal.badge.verified' | translate" />
                <nz-option nzValue="unverified" [nzLabel]="'fiduciaryPortal.badge.unverified' | translate" />
              </nz-select>

              <input
                nz-input
                style="width: 240px"
                [(ngModel)]="journalFilters.search"
                [placeholder]="'fiduciaryPortal.filter.search' | translate"
                (keyup.enter)="applyJournalFilters()"
              />

              <button nz-button type="button" (click)="applyJournalFilters()">
                {{ 'fiduciaryPortal.action.runLedger' | translate }}
              </button>

              @if (store.selectedEntryIds().length > 0) {
                <button nz-button nzType="primary" type="button" (click)="batchVerify(true)">
                  {{ 'fiduciaryPortal.action.batchVerify' | translate }} ({{ store.selectedEntryIds().length }})
                </button>
                <button nz-button type="button" (click)="batchVerify(false)">
                  {{ 'fiduciaryPortal.action.batchUnverify' | translate }}
                </button>
              }
            </div>

            <nz-table [nzData]="store.journals()" nzSize="small" [nzShowPagination]="false">
              <thead>
                <tr>
                  <th style="width: 40px"></th>
                  <th>{{ 'fiduciaryPortal.col.entryNumber' | translate }}</th>
                  <th>{{ 'fiduciaryPortal.col.postingDate' | translate }}</th>
                  <th>{{ 'fiduciaryPortal.col.period' | translate }}</th>
                  <th>{{ 'fiduciaryPortal.col.description' | translate }}</th>
                  <th>{{ 'fiduciaryPortal.col.amount' | translate }}</th>
                  <th>{{ 'fiduciaryPortal.col.status' | translate }}</th>
                  <th>{{ 'fiduciaryPortal.col.actions' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (entry of store.journals(); track entry.id) {
                  <tr>
                    <td>
                      <label
                        nz-checkbox
                        [attr.for]="'fid-entry-' + entry.id"
                        [nzId]="'fid-entry-' + entry.id"
                        [ngModel]="isSelected(entry.id)"
                        (ngModelChange)="store.toggleEntrySelection(entry.id, $event)"
                      ></label>
                    </td>
                    <td><strong>{{ entry.entry_number }}</strong></td>
                    <td>{{ entry.posting_date }}</td>
                    <td>
                      {{ entry.period_name }}
                      @if (entry.is_period_fiduciary_locked) {
                        <nz-tag nzColor="orange">{{ 'fiduciaryPortal.badge.periodLockedByFiduciary' | translate }}</nz-tag>
                      }
                    </td>
                    <td>{{ entry.description }}</td>
                    <td>{{ entry.total_amount }}</td>
                    <td>
                      @if (entry.fiduciary_verified) {
                        <nz-tag nzColor="cyan">{{ 'fiduciaryPortal.badge.verified' | translate }}</nz-tag>
                      } @else {
                        <nz-tag nzColor="default">{{ 'fiduciaryPortal.badge.unverified' | translate }}</nz-tag>
                      }
                    </td>
                    <td>
                      @if (entry.fiduciary_verified) {
                        <button nz-button nzSize="small" type="button" (click)="verifySingle(entry, false)">
                          {{ 'fiduciaryPortal.action.unverify' | translate }}
                        </button>
                      } @else {
                        <button nz-button nzSize="small" nzType="primary" type="button" (click)="verifySingle(entry, true)">
                          {{ 'fiduciaryPortal.action.verify' | translate }}
                        </button>
                      }
                      <button nz-button nzSize="small" type="button" (click)="openNotesDrawer(entry)">
                        {{ 'fiduciaryPortal.action.openNotes' | translate }} ({{ entry.open_notes_count }})
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </nz-table>
          </nz-tab>

          <!-- TAB 3: General Ledger (Mastrini Contabili) -->
          <nz-tab [nzTitle]="'fiduciaryPortal.tab.ledger' | translate">
            <div class="filter-toolbar">
              <nz-select
                style="width: 300px"
                nzShowSearch
                [nzPlaceHolder]="'fiduciaryPortal.col.sourceAccount' | translate"
                [(ngModel)]="ledgerAccountId"
              >
                @for (row of store.transcodingMatrix()?.rows ?? []; track row.source_account_id) {
                  <nz-option
                    [nzValue]="row.source_account_id"
                    [nzLabel]="row.source_account_code + ' - ' + row.source_account_name + (row.studio_account_code ? ' [' + row.studio_account_code + ']' : '')"
                  />
                }
              </nz-select>
              <input nz-input type="date" style="width: 150px" [(ngModel)]="ledgerFrom" />
              <input nz-input type="date" style="width: 150px" [(ngModel)]="ledgerTo" />
              <button
                nz-button
                nzType="primary"
                type="button"
                [disabled]="!ledgerAccountId"
                (click)="runAccountLedger()"
              >
                {{ 'fiduciaryPortal.action.runLedger' | translate }}
              </button>
            </div>

            @if (store.accountLedger(); as ledger) {
              <nz-descriptions nzBordered nzSize="small" [nzColumn]="3" class="mb-3">
                <nz-descriptions-item [nzTitle]="'fiduciaryPortal.col.sourceAccount' | translate">
                  {{ ledger.account.account_code }} — {{ ledger.account.name }}
                </nz-descriptions-item>
                <nz-descriptions-item [nzTitle]="'fiduciaryPortal.col.studioAccountCode' | translate">
                  {{ ledger.account.studio_account_code || '-' }} {{ ledger.account.studio_account_name || '' }}
                </nz-descriptions-item>
                <nz-descriptions-item [nzTitle]="'fiduciaryPortal.col.amount' | translate">
                  {{ ledger.opening_balance }} → {{ ledger.closing_balance }} {{ ledger.currency }}
                </nz-descriptions-item>
              </nz-descriptions>

              <nz-table [nzData]="ledger.lines" nzSize="small" [nzShowPagination]="false">
                <thead>
                  <tr>
                    <th>{{ 'fiduciaryPortal.col.postingDate' | translate }}</th>
                    <th>{{ 'fiduciaryPortal.col.entryNumber' | translate }}</th>
                    <th>{{ 'fiduciaryPortal.col.description' | translate }}</th>
                    <th>Debit</th>
                    <th>Credit</th>
                    <th>Balance</th>
                    <th>{{ 'fiduciaryPortal.col.status' | translate }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (line of ledger.lines; track line.line_id) {
                    <tr>
                      <td>{{ line.posting_date }}</td>
                      <td>{{ line.entry_number }}</td>
                      <td>{{ line.description }}</td>
                      <td>{{ line.debit }}</td>
                      <td>{{ line.credit }}</td>
                      <td><strong>{{ line.running_balance }}</strong></td>
                      <td>
                        @if (line.fiduciary_verified) {
                          <nz-tag nzColor="cyan">{{ 'fiduciaryPortal.badge.verified' | translate }}</nz-tag>
                        } @else {
                          <nz-tag>{{ 'fiduciaryPortal.badge.unverified' | translate }}</nz-tag>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </nz-table>
            }
          </nz-tab>

          <!-- TAB 4: Custom Chart of Accounts Transcoding Matrix -->
          <nz-tab [nzTitle]="'fiduciaryPortal.tab.transcoding' | translate">
            <div class="filter-toolbar">
              <nz-select
                style="width: 280px"
                [ngModel]="store.selectedStudioSystem()"
                (ngModelChange)="onStudioSystemChange($event)"
              >
                @for (fmt of store.exportFormats(); track fmt.code) {
                  <nz-option [nzValue]="fmt.code" [nzLabel]="fmt.label_key | translate" />
                }
              </nz-select>
              <label nz-checkbox for="fid-transcoding-unmapped" nzId="fid-transcoding-unmapped" [(ngModel)]="transcodingUnmappedOnly" (ngModelChange)="reloadTranscoding()">
                {{ 'fiduciaryPortal.filter.unmappedOnly' | translate }}
              </label>
              <button nz-button type="button" (click)="store.seedDefaultTranscodings()">
                {{ 'fiduciaryPortal.action.seedDefaults' | translate }}
              </button>
            </div>

            @if ((store.transcodingMatrix()?.unmapped_postable_accounts ?? 0) > 0) {
              <nz-alert
                nzType="warning"
                nzShowIcon
                class="mb-3"
                [nzMessage]="'fiduciaryPortal.validation.unmappedWarning' | translate"
              />
            }

            <nz-table [nzData]="store.transcodingMatrix()?.rows ?? []" nzSize="small" [nzShowPagination]="false">
              <thead>
                <tr>
                  <th>{{ 'fiduciaryPortal.col.sourceAccount' | translate }}</th>
                  <th>{{ 'fiduciaryPortal.col.studioAccountCode' | translate }}</th>
                  <th>{{ 'fiduciaryPortal.col.studioAccountName' | translate }}</th>
                  <th>{{ 'fiduciaryPortal.col.studioVatCode' | translate }}</th>
                  <th>{{ 'fiduciaryPortal.col.studioCostCenter' | translate }}</th>
                  <th>{{ 'fiduciaryPortal.col.status' | translate }}</th>
                  <th>{{ 'fiduciaryPortal.col.actions' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (row of store.transcodingMatrix()?.rows ?? []; track row.source_account_id) {
                  <tr>
                    <td>
                      <strong>{{ row.source_account_code }}</strong> — {{ row.source_account_name }}
                    </td>
                    <td>
                      <input
                        nz-input
                        nzSize="small"
                        [ngModel]="draftStudioCode(row)"
                        (ngModelChange)="setDraft(row.source_account_id, 'studio_account_code', $event)"
                      />
                    </td>
                    <td>
                      <input
                        nz-input
                        nzSize="small"
                        [ngModel]="draftStudioName(row)"
                        (ngModelChange)="setDraft(row.source_account_id, 'studio_account_name', $event)"
                      />
                    </td>
                    <td>
                      <input
                        nz-input
                        nzSize="small"
                        [ngModel]="draftVatCode(row)"
                        (ngModelChange)="setDraft(row.source_account_id, 'studio_vat_code', $event)"
                      />
                    </td>
                    <td>
                      <input
                        nz-input
                        nzSize="small"
                        [ngModel]="draftCostCenter(row)"
                        (ngModelChange)="setDraft(row.source_account_id, 'studio_cost_center_code', $event)"
                      />
                    </td>
                    <td>
                      @if (row.is_mapped) {
                        <nz-tag nzColor="green">{{ 'fiduciaryPortal.badge.mapped' | translate }}</nz-tag>
                      } @else {
                        <nz-tag nzColor="orange">{{ 'fiduciaryPortal.badge.unmapped' | translate }}</nz-tag>
                      }
                    </td>
                    <td>
                      <button nz-button nzSize="small" nzType="primary" type="button" (click)="saveTranscodingRow(row)">
                        {{ 'fiduciaryPortal.action.saveRule' | translate }}
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </nz-table>
          </nz-tab>

          <!-- TAB 5: Studio Export Engine -->
          <nz-tab [nzTitle]="'fiduciaryPortal.tab.exports' | translate">
            <div class="format-grid">
              @for (fmt of store.exportFormats(); track fmt.code) {
                <button
                  type="button"
                  class="format-card"
                  [class.selected]="exportForm.format_code === fmt.code"
                  (click)="selectExportFormat(fmt.code)"
                >
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px">
                    <strong>{{ fmt.label_key | translate }}</strong>
                    <nz-tag [nzColor]="fmt.jurisdiction === 'CH' ? 'red' : fmt.jurisdiction === 'IT' ? 'blue' : 'purple'">
                      {{ fmt.jurisdiction }}
                    </nz-tag>
                  </div>
                  <small>{{ fmt.description_key | translate }}</small>
                </button>
              }
            </div>

            <div class="filter-toolbar">
              <input nz-input type="date" style="width: 150px" [(ngModel)]="exportForm.from_date" />
              <input nz-input type="date" style="width: 150px" [(ngModel)]="exportForm.to_date" />
              <label nz-checkbox for="fid-export-verified" nzId="fid-export-verified" [(ngModel)]="exportForm.only_verified">
                {{ 'fiduciaryPortal.filter.onlyVerified' | translate }}
              </label>
              <label nz-checkbox for="fid-export-transcoding" nzId="fid-export-transcoding" [(ngModel)]="exportForm.apply_transcoding">
                {{ 'fiduciaryPortal.filter.applyTranscoding' | translate }}
              </label>
              <button nz-button type="button" (click)="validateCurrentExport()">
                {{ 'fiduciaryPortal.action.validateExport' | translate }}
              </button>
              <button nz-button nzType="primary" type="button" (click)="generateCurrentExport()">
                {{ 'fiduciaryPortal.action.generateExport' | translate }}
              </button>
            </div>

            @if (store.exportValidation(); as diag) {
              <nz-alert
                [nzType]="diag.warnings.length > 0 ? 'warning' : 'success'"
                nzShowIcon
                class="mb-3"
                [nzMessage]="diag.format_code + ' · ' + diag.entries_count + ' entries / ' + diag.lines_count + ' lines · Unmapped: ' + diag.unmapped_accounts_count"
              />
            }

            <nz-table [nzData]="store.exportRuns()" nzSize="small" [nzShowPagination]="false">
              <thead>
                <tr>
                  <th>Format</th>
                  <th>{{ 'fiduciaryPortal.col.period' | translate }}</th>
                  <th>Entries / Lines</th>
                  <th>{{ 'fiduciaryPortal.kpi.unmappedAccounts' | translate }}</th>
                  <th>File</th>
                  <th>{{ 'fiduciaryPortal.col.actions' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (run of store.exportRuns(); track run.id) {
                  <tr>
                    <td><nz-tag>{{ run.format_code }}</nz-tag></td>
                    <td>{{ run.from_date }} → {{ run.to_date }}</td>
                    <td>{{ run.entries_count }} / {{ run.lines_count }}</td>
                    <td>{{ run.unmapped_accounts_count }}</td>
                    <td>{{ run.file_name }}</td>
                    <td>
                      <button nz-button nzSize="small" nzType="primary" type="button" (click)="downloadExportRun(run.id, run.file_name)">
                        {{ 'fiduciaryPortal.action.download' | translate }}
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </nz-table>
          </nz-tab>

          <!-- TAB 6: Period Lock / Fiduciary Freeze -->
          <nz-tab [nzTitle]="'fiduciaryPortal.tab.periods' | translate">
            <nz-table [nzData]="store.fiscalPeriods()" nzSize="small" [nzShowPagination]="false">
              <thead>
                <tr>
                  <th>{{ 'fiduciaryPortal.col.period' | translate }}</th>
                  <th>{{ 'fiduciaryPortal.col.postingDate' | translate }}</th>
                  <th>{{ 'fiduciaryPortal.col.status' | translate }}</th>
                  <th>{{ 'fiduciaryPortal.col.lockReason' | translate }}</th>
                  <th>{{ 'fiduciaryPortal.col.actions' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (period of store.fiscalPeriods(); track period.id) {
                  <tr>
                    <td><strong>{{ period.period_name }}</strong></td>
                    <td>{{ period.start_date }} → {{ period.end_date }}</td>
                    <td>
                      @if (period.is_fiduciary_locked) {
                        <nz-tag nzColor="orange">{{ 'fiduciaryPortal.badge.periodLockedByFiduciary' | translate }}</nz-tag>
                      } @else if (period.status === 'closed') {
                        <nz-tag nzColor="default">{{ 'fiduciaryPortal.badge.periodClosed' | translate }}</nz-tag>
                      } @else {
                        <nz-tag nzColor="green">{{ 'fiduciaryPortal.badge.periodOpen' | translate }}</nz-tag>
                      }
                    </td>
                    <td>{{ period.fiduciary_lock_reason || '-' }}</td>
                    <td>
                      @if (period.is_fiduciary_locked) {
                        <button nz-button nzSize="small" type="button" (click)="openPeriodModal(period, 'unlock')">
                          {{ 'fiduciaryPortal.action.unlockPeriod' | translate }}
                        </button>
                      } @else if (period.status !== 'closed') {
                        <button nz-button nzSize="small" nzDanger type="button" (click)="openPeriodModal(period, 'lock')">
                          {{ 'fiduciaryPortal.action.lockPeriod' | translate }}
                        </button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </nz-table>
          </nz-tab>

          <!-- TAB 7: Anchored Notes Register -->
          <nz-tab [nzTitle]="'fiduciaryPortal.tab.notes' | translate">
            @if (store.notes().length === 0) {
              <nz-empty />
            } @else {
              @for (note of store.notes(); track note.id) {
                <div class="note-thread-item">
                  <div style="display: flex; justify-content: space-between; margin-bottom: 6px">
                    <div>
                      <strong>{{ note.entry_number || note.journal_entry_id }}</strong> ·
                      <span>{{ note.author_name }} ({{ note.author_role }})</span>
                    </div>
                    <div>
                      <nz-tag [nzColor]="note.status === 'open' ? 'orange' : 'green'">
                        {{ (note.status === 'open' ? 'fiduciaryPortal.badge.noteOpen' : 'fiduciaryPortal.badge.noteResolved') | translate }}
                      </nz-tag>
                      @if (note.status === 'open') {
                        <button nz-button nzSize="small" type="button" (click)="store.resolveNote(note.id, true)">
                          {{ 'fiduciaryPortal.action.resolveNote' | translate }}
                        </button>
                      } @else {
                        <button nz-button nzSize="small" type="button" (click)="store.resolveNote(note.id, false)">
                          {{ 'fiduciaryPortal.action.reopenNote' | translate }}
                        </button>
                      }
                    </div>
                  </div>
                  <p>{{ note.body }}</p>
                  @for (reply of note.replies; track reply.id) {
                    <div class="note-reply">
                      <small><strong>{{ reply.author_name }}</strong>: {{ reply.body }}</small>
                    </div>
                  }
                </div>
              }
            }
          </nz-tab>

          <!-- TAB 8: Digital Balance Sheet Dossier & Audit Trail -->
          <nz-tab [nzTitle]="'fiduciaryPortal.tab.dossier' | translate">
            <div class="filter-toolbar">
              <nz-select
                style="width: 180px"
                nzAllowClear
                [nzPlaceHolder]="'fiduciaryPortal.filter.fiscalYear' | translate"
                [(ngModel)]="dossierFiscalYearId"
              >
                @for (fy of store.fiscalYears(); track fy.id) {
                  <nz-option [nzValue]="fy.id" [nzLabel]="fy.year_code" />
                }
              </nz-select>
              <button nz-button type="button" (click)="store.loadDossierPreview(dossierFiscalYearId)">
                {{ 'fiduciaryPortal.action.previewDossier' | translate }}
              </button>
              <button nz-button nzType="primary" type="button" (click)="downloadDossier()">
                {{ 'fiduciaryPortal.action.downloadDossier' | translate }}
              </button>
            </div>

            @if (store.dossierPreview(); as preview) {
              <nz-descriptions nzBordered nzSize="small" [nzColumn]="3" class="mb-4">
                @for (entry of dossierDatasets(preview.datasets); track entry.key) {
                  <nz-descriptions-item [nzTitle]="entry.key">{{ entry.value }}</nz-descriptions-item>
                }
              </nz-descriptions>
            }

            <nz-table [nzData]="store.auditLogs()" nzSize="small" [nzShowPagination]="false">
              <thead>
                <tr>
                  <th>{{ 'fiduciaryPortal.col.postingDate' | translate }}</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Target</th>
                  <th>{{ 'fiduciaryPortal.col.description' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (log of store.auditLogs(); track log.id) {
                  <tr>
                    <td>{{ log.created_at }}</td>
                    <td>{{ log.actor_name || '-' }}</td>
                    <td><nz-tag>{{ log.action }}</nz-tag></td>
                    <td>{{ log.target_reference || '-' }}</td>
                    <td>{{ log.summary }}</td>
                  </tr>
                }
              </tbody>
            </nz-table>
          </nz-tab>
        </nz-tabs>
      </nz-card>
    </nz-spin>

    <!-- Anchored Entry Notes Drawer -->
    <nz-drawer
      [nzVisible]="activeNotesEntry() !== null"
      [nzWidth]="520"
      [nzTitle]="'fiduciaryPortal.notes.drawerTitle' | translate"
      (nzOnClose)="activeNotesEntry.set(null)"
    >
      <ng-container *nzDrawerContent>
        @if (activeNotesEntry(); as entry) {
          <p class="mb-3"><strong>{{ entry.entry_number }}</strong> — {{ entry.description }}</p>

          <div class="mb-3">
            <textarea
              nz-input
              rows="3"
              [(ngModel)]="newNoteBody"
              [placeholder]="'fiduciaryPortal.notes.placeholder' | translate"
            ></textarea>
            <button
              nz-button
              nzType="primary"
              type="button"
              class="mt-3"
              [disabled]="!newNoteBody.trim()"
              (click)="submitEntryNote(entry)"
            >
              {{ 'fiduciaryPortal.action.addNote' | translate }}
            </button>
          </div>

          @for (note of entryNotes(); track note.id) {
            <div class="note-thread-item">
              <div style="display: flex; justify-content: space-between">
                <strong>{{ note.author_name }}</strong>
                <nz-tag [nzColor]="note.status === 'open' ? 'orange' : 'green'">{{ note.status }}</nz-tag>
              </div>
              <p>{{ note.body }}</p>
              @if (note.status === 'open') {
                <button nz-button nzSize="small" type="button" (click)="store.resolveNote(note.id, true)">
                  {{ 'fiduciaryPortal.action.resolveNote' | translate }}
                </button>
              }
            </div>
          }
        }
      </ng-container>
    </nz-drawer>

    <!-- Period Lock / Unlock Reason Modal -->
    <nz-modal
      [nzVisible]="periodModalTarget() !== null"
      [nzTitle]="(periodModalMode() === 'lock' ? 'fiduciaryPortal.modal.lockTitle' : 'fiduciaryPortal.modal.unlockTitle') | translate"
      [nzOkDisabled]="periodModalReason.trim().length < 3"
      (nzOnCancel)="periodModalTarget.set(null)"
      (nzOnOk)="confirmPeriodModal()"
    >
      <ng-container *nzModalContent>
        <label for="fid-period-reason" class="d-block mb-1">
          {{ 'fiduciaryPortal.modal.reasonLabel' | translate }}
        </label>
        <textarea id="fid-period-reason" nz-input rows="3" [(ngModel)]="periodModalReason"></textarea>
      </ng-container>
    </nz-modal>
  `,
})
export class FiduciaryPortalComponent implements OnInit {
  protected readonly store = inject(FiduciaryPortalStore);
  private readonly api = inject(FiduciaryPortalApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly journalFilters: {
    fiscal_year_id: string | null;
    fiscal_period_id: string | null;
    fiduciary_verified: string;
    search: string;
  } = {
    fiscal_year_id: null,
    fiscal_period_id: null,
    fiduciary_verified: 'all',
    search: '',
  };

  protected ledgerAccountId: string | null = null;
  protected ledgerFrom = `${new Date().getFullYear()}-01-01`;
  protected ledgerTo = `${new Date().getFullYear()}-12-31`;

  protected transcodingUnmappedOnly = false;
  private readonly transcodingDrafts = new Map<string, Record<string, string>>();

  protected readonly exportForm: {
    format_code: StudioExportFormatCode;
    from_date: string;
    to_date: string;
    only_verified: boolean;
    apply_transcoding: boolean;
  } = {
    format_code: 'abacus_xml',
    from_date: `${new Date().getFullYear()}-01-01`,
    to_date: `${new Date().getFullYear()}-12-31`,
    only_verified: false,
    apply_transcoding: true,
  };

  protected dossierFiscalYearId: string | null = null;

  protected readonly activeNotesEntry = signal<FiduciaryJournalEntry | null>(null);
  protected newNoteBody = '';
  protected readonly entryNotes = computed<readonly FiduciaryEntryNote[]>(() => {
    const target = this.activeNotesEntry();
    if (!target) return [];
    return this.store.notes().filter((n) => n.journal_entry_id === target.id);
  });

  protected readonly periodModalTarget = signal<FiduciaryFiscalPeriod | null>(null);
  protected readonly periodModalMode = signal<'lock' | 'unlock'>('lock');
  protected periodModalReason = '';

  ngOnInit(): void {
    void this.store.init();
  }

  protected onSwitchClient(tenantId: string): void {
    void this.store.switchClient(tenantId);
  }

  protected applyJournalFilters(): void {
    void this.store.loadJournals(this.journalFilters);
  }

  protected isSelected(entryId: string): boolean {
    return this.store.selectedEntryIds().includes(entryId);
  }

  protected async verifySingle(entry: FiduciaryJournalEntry, verified: boolean): Promise<void> {
    await this.store.verifyEntries([entry.id], verified, null);
    this.message.success(this.i18n.translate('fiduciaryPortal.badge.verified'));
  }

  protected async batchVerify(verified: boolean): Promise<void> {
    await this.store.verifyEntries([...this.store.selectedEntryIds()], verified, null);
    this.message.success(this.i18n.translate('fiduciaryPortal.badge.verified'));
  }

  protected runAccountLedger(): void {
    if (!this.ledgerAccountId) return;
    void this.store.loadAccountLedger(this.ledgerAccountId, this.ledgerFrom, this.ledgerTo);
  }

  protected onStudioSystemChange(system: StudioExportFormatCode): void {
    this.transcodingDrafts.clear();
    void this.store.loadTranscodings(system, '', this.transcodingUnmappedOnly);
  }

  protected reloadTranscoding(): void {
    void this.store.loadTranscodings(this.store.selectedStudioSystem(), '', this.transcodingUnmappedOnly);
  }

  protected draftStudioCode(row: FiduciaryTranscodingRow): string {
    return this.transcodingDrafts.get(row.source_account_id)?.['studio_account_code'] ?? row.studio_account_code ?? '';
  }

  protected draftStudioName(row: FiduciaryTranscodingRow): string {
    return this.transcodingDrafts.get(row.source_account_id)?.['studio_account_name'] ?? row.studio_account_name ?? '';
  }

  protected draftVatCode(row: FiduciaryTranscodingRow): string {
    return this.transcodingDrafts.get(row.source_account_id)?.['studio_vat_code'] ?? row.studio_vat_code ?? '';
  }

  protected draftCostCenter(row: FiduciaryTranscodingRow): string {
    return this.transcodingDrafts.get(row.source_account_id)?.['studio_cost_center_code'] ?? row.studio_cost_center_code ?? '';
  }

  protected setDraft(accountId: string, field: string, value: string): void {
    const current = this.transcodingDrafts.get(accountId) ?? {};
    this.transcodingDrafts.set(accountId, { ...current, [field]: value });
  }

  protected async saveTranscodingRow(row: FiduciaryTranscodingRow): Promise<void> {
    const code = this.draftStudioCode(row).trim();
    if (!code) return;
    await this.store.saveTranscoding({
      source_account_id: row.source_account_id,
      studio_account_code: code,
      studio_account_name: this.draftStudioName(row).trim() || row.source_account_name,
      studio_vat_code: this.draftVatCode(row).trim() || null,
      studio_cost_center_code: this.draftCostCenter(row).trim() || null,
    });
    this.message.success(this.i18n.translate('fiduciaryPortal.action.saveRule'));
  }

  protected selectExportFormat(code: StudioExportFormatCode): void {
    this.exportForm.format_code = code;
  }

  protected validateCurrentExport(): void {
    void this.store.validateExport(this.exportForm);
  }

  protected async generateCurrentExport(): Promise<void> {
    const run = await this.store.generateExport(this.exportForm);
    this.message.success(run.file_name);
  }

  protected async downloadExportRun(runId: string, fileName: string): Promise<void> {
    const blob = await firstValueFrom(this.api.downloadExport(runId));
    this.triggerDownload(blob, fileName);
  }

  protected openPeriodModal(period: FiduciaryFiscalPeriod, mode: 'lock' | 'unlock'): void {
    this.periodModalMode.set(mode);
    this.periodModalReason = '';
    this.periodModalTarget.set(period);
  }

  protected async confirmPeriodModal(): Promise<void> {
    const target = this.periodModalTarget();
    const reason = this.periodModalReason.trim();
    if (!target || reason.length < 3) return;
    if (this.periodModalMode() === 'lock') {
      await this.store.lockPeriod(target.id, reason);
    } else {
      await this.store.unlockPeriod(target.id, reason);
    }
    this.periodModalTarget.set(null);
  }

  protected openNotesDrawer(entry: FiduciaryJournalEntry): void {
    this.newNoteBody = '';
    this.activeNotesEntry.set(entry);
    void this.store.loadNotes();
  }

  protected async submitEntryNote(entry: FiduciaryJournalEntry): Promise<void> {
    const body = this.newNoteBody.trim();
    if (!body) return;
    await this.store.createNote(entry.id, body);
    this.newNoteBody = '';
  }

  protected dossierDatasets(datasets: Readonly<Record<string, number>>): { key: string; value: number }[] {
    return Object.entries(datasets).map(([key, value]) => ({ key, value }));
  }

  protected async downloadDossier(): Promise<void> {
    const blob = await firstValueFrom(
      this.api.downloadDossier(this.dossierFiscalYearId, undefined, undefined, this.store.selectedStudioSystem()),
    );
    this.triggerDownload(blob, 'fascicolo-digitale-bilancio.zip');
  }

  private triggerDownload(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }
}
