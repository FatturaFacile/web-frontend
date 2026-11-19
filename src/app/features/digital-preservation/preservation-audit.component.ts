import { DatePipe } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { TranslatePipe } from '@shared';
import { downloadBlob } from '../../shared/utils/download-blob';
import { DigitalPreservationStore } from './digital-preservation.store';
import { auditLogsToCsv } from './digital-preservation.utils';
import { HashCellComponent } from './hash-cell.component';

export const AUDIT_ACTIONS: readonly string[] = [
  'ingested',
  'pdfa_converted',
  'pdv_generated',
  'sealed',
  'timestamped',
  'dispatched',
  'rdv_received',
  'pdd_exported',
  'integrity_verified',
  'integrity_alert',
  'deletion_blocked',
];

/** Read-only, append-only audit trail with the hash-chain verdict and a CSV export. */
@Component({
  selector: 'app-preservation-audit',
  styleUrl: './digital-preservation.scss',
  imports: [
    DatePipe,
    FormsModule,
    TranslatePipe,
    NzButtonModule,
    NzInputModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    HashCellComponent,
  ],
  template: `
    <div class="filters" role="search">
      <nz-select
        style="width: 220px"
        nzAllowClear
        [nzPlaceHolder]="'PRESERVATION.ACTION' | translate"
        [ngModel]="store.auditFilters().action || null"
        (ngModelChange)="filter({ action: $event ?? '' })"
        [attr.aria-label]="'PRESERVATION.ACTION' | translate"
      >
        @for (a of actions; track a) {
          <nz-option
            [nzValue]="a"
            [nzLabel]="'PRESERVATION.ACTION_' + a.toUpperCase() | translate"
          ></nz-option>
        }
      </nz-select>
      <nz-tag
        data-testid="audit-chain-badge"
        [nzColor]="store.auditMeta().chain_valid === false ? 'red' : 'green'"
      >
        {{
          (store.auditMeta().chain_valid === false
            ? 'PRESERVATION.AUDIT_CHAIN_BROKEN'
            : 'PRESERVATION.AUDIT_CHAIN_VALID'
          ) | translate
        }}
      </nz-tag>
      <button
        nz-button
        type="button"
        data-testid="export-audit"
        [disabled]="store.auditLogs().length === 0"
        (click)="exportCsv()"
      >
        {{ 'PRESERVATION.EXPORT_AUDIT' | translate }}
      </button>
    </div>

    <nz-table
      #table
      nzSize="small"
      [nzData]="store.auditLogs()"
      [nzFrontPagination]="false"
      [nzLoading]="store.loading()"
      [nzTotal]="store.auditMeta().total"
      [nzPageSize]="store.auditMeta().per_page"
      [nzPageIndex]="store.auditMeta().current_page"
      (nzPageIndexChange)="page($event)"
      data-testid="audit-table"
    >
      <thead>
        <tr>
          <th>#</th>
          <th>{{ 'PRESERVATION.DATE' | translate }}</th>
          <th>{{ 'PRESERVATION.ACTION' | translate }}</th>
          <th>{{ 'PRESERVATION.ACTOR' | translate }}</th>
          <th>IP</th>
          <th>{{ 'PRESERVATION.ENTRY_HASH' | translate }}</th>
        </tr>
      </thead>
      <tbody>
        @for (l of table.data; track l.id) {
          <tr>
            <td>{{ l.sequence }}</td>
            <td>{{ l.created_at | date: 'medium' }}</td>
            <td>{{ 'PRESERVATION.ACTION_' + l.action.toUpperCase() | translate }}</td>
            <td>{{ l.actor_id ?? '—' }}</td>
            <td>{{ l.ip_address ?? '—' }}</td>
            <td><app-hash-cell [hash]="l.entry_sha256"></app-hash-cell></td>
          </tr>
        }
      </tbody>
    </nz-table>
  `,
})
export class PreservationAuditComponent implements OnInit {
  protected readonly store = inject(DigitalPreservationStore);
  protected readonly actions = AUDIT_ACTIONS;

  ngOnInit(): void {
    this.store.loadAuditLogs().subscribe();
  }

  protected filter(patch: Parameters<DigitalPreservationStore['setAuditFilters']>[0]): void {
    this.store.setAuditFilters(patch);
    this.store.loadAuditLogs().subscribe();
  }

  protected page(index: number): void {
    this.store.auditFilters.update((f) => ({ ...f, page: index }));
    this.store.loadAuditLogs().subscribe();
  }

  protected exportCsv(): void {
    downloadBlob(
      new Blob([auditLogsToCsv(this.store.auditLogs())], { type: 'text/csv;charset=utf-8' }),
      'preservation-audit-log.csv',
    );
  }
}
