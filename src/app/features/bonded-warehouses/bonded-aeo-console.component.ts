import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  BW_AEO_STATUSES,
  BW_AUDIT_TYPES,
  BW_DISCREPANCY_STATUSES,
  BwAeoStatus,
  BwAuditType,
  BwDiscrepancyStatus,
  BwPartnerCheck,
  PermissionsService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { BondedAeoStore, BondedLookupStore } from './bonded-warehouses.stores';
import {
  aeoColor,
  BONDED_WAREHOUSES_MODULE,
  BwOutcome,
  discrepancyColor,
  findingKey,
  todayIso,
  toNumber,
} from './bonded-warehouses.util';

interface PartnerRow {
  name: string;
  status: BwAeoStatus;
  sealVerified: boolean;
  findings: string;
}

/**
 * AEO compliance console (AEOC / AEOS): the compliance score and the findings of the last 90 days, the certified authorizations with their next
 * audit, the "run reconciliation" action (WMS physical balances against the customs MRN book, CGU thresholds, usual handling) with the
 * security checks of carriers and suppliers, and the audit log.
 */
@Component({
  selector: 'app-bonded-aeo-console',
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzCheckboxModule,
    NzEmptyModule,
    NzInputModule,
    NzSelectModule,
    NzSpinModule,
    NzStatisticModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  providers: [BondedAeoStore],
  styleUrl: './bonded-warehouses.scss',
  template: `
    <app-page-header
      [title]="'PAGE_TITLE.BONDED_WAREHOUSES_AEO' | translate"
      [subtitle]="'bondedWarehouses.section.aeoSubtitle' | translate"
    ></app-page-header>

    @if (store.error(); as error) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        [nzMessage]="error | translate"
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
    @if (store.result(); as result) {
      <nz-alert
        class="feedback"
        data-test="reconciliation-result"
        [nzType]="result.critical > 0 ? 'error' : result.minor > 0 ? 'warning' : 'success'"
        nzShowIcon
        [nzMessage]="
          'bondedWarehouses.message.reconciliationDone'
            | translate: { critical: result.critical, minor: result.minor, matched: result.matched }
        "
      ></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      @if (store.dashboard(); as dashboard) {
        <div class="kpi-grid">
          <nz-card data-test="aeo-score">
            <nz-statistic
              [nzTitle]="'bondedWarehouses.kpi.aeoScore' | translate"
              [nzValue]="dashboard.score"
              nzSuffix="%"
            ></nz-statistic>
          </nz-card>
          <nz-card>
            <nz-statistic
              [nzTitle]="'bondedWarehouses.kpi.audits90' | translate"
              [nzValue]="dashboard.audits_last_90_days"
            ></nz-statistic>
          </nz-card>
          <nz-card>
            <nz-statistic
              [nzTitle]="'bondedWarehouses.discrepancy.Matched' | translate"
              [nzValue]="dashboard.matched"
            ></nz-statistic>
          </nz-card>
          <nz-card>
            <nz-statistic
              [nzTitle]="'bondedWarehouses.discrepancy.Minor_Variance' | translate"
              [nzValue]="dashboard.minor"
            ></nz-statistic>
          </nz-card>
          <nz-card>
            <nz-statistic
              [nzTitle]="'bondedWarehouses.discrepancy.Critical_Alert_ADM_UDSC' | translate"
              [nzValue]="dashboard.critical"
            ></nz-statistic>
          </nz-card>
        </div>

        <h3 class="section-title">{{ 'bondedWarehouses.section.certified' | translate }}</h3>
        <nz-table
          #certified
          nzSize="small"
          [nzData]="dashboard.certified_authorizations"
          [nzShowPagination]="false"
        >
          <thead>
            <tr>
              <th scope="col">{{ 'bondedWarehouses.column.authorization' | translate }}</th>
              <th scope="col">{{ 'bondedWarehouses.column.aeoStatus' | translate }}</th>
              <th scope="col">{{ 'bondedWarehouses.column.aeoCertificate' | translate }}</th>
              <th scope="col">{{ 'bondedWarehouses.column.nextAudit' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of certified.data; track row.authorization_id) {
              <tr>
                <td>{{ row.authorization_code }}</td>
                <td>
                  <nz-tag [nzColor]="aeo(row.aeo_status)">{{
                    'bondedWarehouses.aeoStatus.' + row.aeo_status | translate
                  }}</nz-tag>
                </td>
                <td>{{ row.aeo_certificate_number }}</td>
                <td>
                  {{ row.aeo_next_audit_date | date: 'shortDate' }}
                  @if (row.audit_overdue) {
                    <nz-tag nzColor="red">{{
                      'bondedWarehouses.tag.auditOverdue' | translate
                    }}</nz-tag>
                  }
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="4">
                  <nz-empty
                    [nzNotFoundContent]="'bondedWarehouses.empty.certified' | translate"
                  ></nz-empty>
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
      }

      @if (canWrite) {
        <h3 class="section-title">{{ 'bondedWarehouses.section.reconciliation' | translate }}</h3>
        <div class="toolbar">
          <label class="field" for="bw-a-run-auth">
            <span>{{ 'bondedWarehouses.field.authorization' | translate }}</span>
            <nz-select nzId="bw-a-run-auth" [(ngModel)]="runAuthorization">
              @for (item of customsAuthorizations(); track item.id) {
                <nz-option [nzValue]="item.id" [nzLabel]="item.authorization_code"></nz-option>
              }
            </nz-select>
          </label>
          <button
            nz-button
            nzType="primary"
            type="button"
            data-test="run-reconciliation"
            [disabled]="runAuthorization() === null"
            (click)="run()"
          >
            {{ 'bondedWarehouses.action.runReconciliation' | translate }}
          </button>
        </div>

        <h4>{{ 'bondedWarehouses.section.partnerChecks' | translate }}</h4>
        @for (partner of partners(); track $index; let index = $index) {
          <div class="toolbar">
            <label class="field" [for]="'bw-a-partner-' + index">
              <span>{{ 'bondedWarehouses.field.partnerName' | translate }}</span>
              <input
                nz-input
                [id]="'bw-a-partner-' + index"
                [ngModel]="partner.name"
                (ngModelChange)="patchPartner(index, { name: $event })"
              />
            </label>
            <label class="field" [for]="'bw-a-pstatus-' + index">
              <span>{{ 'bondedWarehouses.field.partnerAeoStatus' | translate }}</span>
              <nz-select
                [nzId]="'bw-a-pstatus-' + index"
                [ngModel]="partner.status"
                (ngModelChange)="patchPartner(index, { status: $event })"
              >
                @for (item of aeoStatuses; track item) {
                  <nz-option
                    [nzValue]="item"
                    [nzLabel]="'bondedWarehouses.aeoStatus.' + item | translate"
                  ></nz-option>
                }
              </nz-select>
            </label>
            <label
              [for]="'bw-a-pseal-' + index"
              [nzId]="'bw-a-pseal-' + index"
              nz-checkbox
              [ngModel]="partner.sealVerified"
              (ngModelChange)="patchPartner(index, { sealVerified: $event })"
            >
              {{ 'bondedWarehouses.field.sealVerified' | translate }}
            </label>
            <label class="field" [for]="'bw-a-pfind-' + index">
              <span>{{ 'bondedWarehouses.field.findings' | translate }}</span>
              <input
                nz-input
                [id]="'bw-a-pfind-' + index"
                [ngModel]="partner.findings"
                (ngModelChange)="patchPartner(index, { findings: $event })"
              />
            </label>
            <button nz-button nzDanger type="button" (click)="removePartner(index)">
              {{ 'bondedWarehouses.action.removePartner' | translate }}
            </button>
          </div>
        }
        <button nz-button type="button" data-test="add-partner" (click)="addPartner()">
          {{ 'bondedWarehouses.action.addPartner' | translate }}
        </button>
      }

      <h3 class="section-title">{{ 'bondedWarehouses.section.audits' | translate }}</h3>
      <div class="toolbar">
        <label class="field" for="bw-a-auth">
          <span>{{ 'bondedWarehouses.filter.authorization' | translate }}</span>
          <nz-select
            nzId="bw-a-auth"
            nzAllowClear
            [(ngModel)]="authorizationId"
            (ngModelChange)="reload()"
          >
            @for (item of lookup.authorizations(); track item.id) {
              <nz-option [nzValue]="item.id" [nzLabel]="item.authorization_code"></nz-option>
            }
          </nz-select>
        </label>
        <label class="field" for="bw-a-type">
          <span>{{ 'bondedWarehouses.filter.auditType' | translate }}</span>
          <nz-select
            nzId="bw-a-type"
            nzAllowClear
            [(ngModel)]="auditType"
            (ngModelChange)="reload()"
          >
            @for (item of auditTypes; track item) {
              <nz-option
                [nzValue]="item"
                [nzLabel]="'bondedWarehouses.auditType.' + item | translate"
              ></nz-option>
            }
          </nz-select>
        </label>
        <label class="field" for="bw-a-status">
          <span>{{ 'bondedWarehouses.filter.discrepancy' | translate }}</span>
          <nz-select
            nzId="bw-a-status"
            nzAllowClear
            [(ngModel)]="discrepancy"
            (ngModelChange)="reload()"
          >
            @for (item of discrepancies; track item) {
              <nz-option
                [nzValue]="item"
                [nzLabel]="'bondedWarehouses.discrepancy.' + item | translate"
              ></nz-option>
            }
          </nz-select>
        </label>
        <span class="spacer"></span>
        <button nz-button type="button" data-test="export-csv" (click)="exportFile('csv')">
          {{ 'bondedWarehouses.action.exportCsv' | translate }}
        </button>
        <button nz-button type="button" data-test="export-pdf" (click)="exportFile('pdf')">
          {{ 'bondedWarehouses.action.exportPdf' | translate }}
        </button>
      </div>
      <nz-table
        #audits
        nzSize="small"
        [nzFrontPagination]="false"
        [nzData]="store.audits()"
        [nzTotal]="store.meta()?.total ?? 0"
        [nzPageSize]="store.meta()?.per_page ?? 25"
        [nzPageIndex]="store.meta()?.current_page ?? 1"
        [nzScroll]="{ x: '1000px' }"
        (nzPageIndexChange)="page($event)"
      >
        <thead>
          <tr>
            <th scope="col">{{ 'bondedWarehouses.column.date' | translate }}</th>
            <th scope="col">{{ 'bondedWarehouses.column.auditType' | translate }}</th>
            <th scope="col" class="numeric">
              {{ 'bondedWarehouses.column.physical' | translate }}
            </th>
            <th scope="col" class="numeric">
              {{ 'bondedWarehouses.column.ledgerQuantity' | translate }}
            </th>
            <th scope="col" class="numeric">
              {{ 'bondedWarehouses.column.discrepancy' | translate }}
            </th>
            <th scope="col">{{ 'bondedWarehouses.column.result' | translate }}</th>
            <th scope="col">{{ 'bondedWarehouses.column.partner' | translate }}</th>
            <th scope="col">{{ 'bondedWarehouses.column.findings' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of audits.data; track row.id) {
            <tr [attr.data-test]="'audit-' + row.id">
              <td>{{ row.audit_date | date: 'shortDate' }}</td>
              <td>{{ 'bondedWarehouses.auditType.' + row.audit_type | translate }}</td>
              <td class="numeric">{{ num(row.wms_physical_quantity) | number: '1.0-4' }}</td>
              <td class="numeric">{{ num(row.customs_ledger_quantity) | number: '1.0-4' }}</td>
              <td class="numeric">{{ num(row.discrepancy_quantity) | number: '1.0-4' }}</td>
              <td>
                <nz-tag [nzColor]="color(row.discrepancy_status)">{{
                  'bondedWarehouses.discrepancy.' + row.discrepancy_status | translate
                }}</nz-tag>
              </td>
              <td>
                {{ row.partner_or_carrier_name }}
                @if (row.partner_aeo_status) {
                  <nz-tag [nzColor]="aeo(row.partner_aeo_status)">{{
                    'bondedWarehouses.aeoStatus.' + row.partner_aeo_status | translate
                  }}</nz-tag>
                }
              </td>
              <td>
                @if (finding(row.findings); as key) {
                  {{ key | translate }}
                } @else {
                  {{ row.findings }}
                }
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="8">
                <nz-empty
                  [nzNotFoundContent]="'bondedWarehouses.empty.audits' | translate"
                ></nz-empty>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-spin>
  `,
})
export class BondedAeoConsoleComponent implements OnInit {
  protected readonly store = inject(BondedAeoStore);
  protected readonly lookup = inject(BondedLookupStore);
  protected readonly canWrite = inject(PermissionsService).canWrite(BONDED_WAREHOUSES_MODULE);

  protected readonly aeoStatuses = BW_AEO_STATUSES;
  protected readonly auditTypes = BW_AUDIT_TYPES;
  protected readonly discrepancies = BW_DISCREPANCY_STATUSES;

  protected readonly authorizationId = signal<string | null>(null);
  protected auditType: BwAuditType | null = null;
  protected discrepancy: BwDiscrepancyStatus | null = null;
  protected readonly runAuthorization = signal<string | null>(null);
  protected readonly partners = signal<PartnerRow[]>([]);
  protected readonly formError = signal<{ key: string; params: Record<string, string> } | null>(
    null,
  );

  protected readonly customsAuthorizations = computed(() =>
    this.lookup.authorizations().filter((item) => item.regime_type !== 'VatDepot_Art50Bis'),
  );
  protected readonly num = toNumber;
  protected readonly color = discrepancyColor;
  protected readonly aeo = aeoColor;
  protected readonly finding = findingKey;

  ngOnInit(): void {
    void this.lookup.load();
    this.reload();
  }

  protected reload(): void {
    void this.store.load(this.filters(1));
  }

  protected page(index: number): void {
    void this.store.load(this.filters(index));
  }

  protected addPartner(): void {
    this.partners.update((rows) => [
      ...rows,
      { name: '', status: 'AEOC', sealVerified: true, findings: '' },
    ]);
  }

  protected removePartner(index: number): void {
    this.partners.update((rows) => rows.filter((_row, position) => position !== index));
  }

  protected patchPartner(index: number, patch: Partial<PartnerRow>): void {
    this.partners.update((rows) =>
      rows.map((row, position) => (position === index ? { ...row, ...patch } : row)),
    );
  }

  protected async run(): Promise<void> {
    const authorization = this.runAuthorization();
    if (authorization === null) {
      return;
    }
    const checks: BwPartnerCheck[] = this.partners()
      .filter((row) => row.name.trim() !== '')
      .map((row) => ({
        partner_or_carrier_name: row.name.trim(),
        partner_aeo_status: row.status,
        security_seal_verified: row.sealVerified,
        findings: row.findings.trim() === '' ? null : row.findings.trim(),
      }));
    const outcome = await this.store.reconcile({
      authorization_id: authorization,
      audit_date: todayIso(),
      partner_checks: checks,
    });
    this.report(outcome);
    if (outcome.ok) {
      this.partners.set([]);
      this.reload();
    }
  }

  protected async exportFile(format: 'csv' | 'pdf'): Promise<void> {
    const { page: _page, per_page: _perPage, ...filters } = this.filters(1);
    this.report(await this.store.exportFile(format, filters));
  }

  private filters(page: number) {
    return {
      authorization_id: this.authorizationId(),
      audit_type: this.auditType,
      discrepancy_status: this.discrepancy,
      page,
      per_page: 25,
    };
  }

  private report(outcome: BwOutcome): void {
    this.formError.set(
      outcome.ok
        ? null
        : { key: outcome.errorKey ?? 'bondedWarehouses.error.unknown', params: outcome.params },
    );
  }
}
