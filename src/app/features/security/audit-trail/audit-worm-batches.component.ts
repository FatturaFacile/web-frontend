import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { AuditTrailApiService, AuditWormBatch, PermissionsService, TranslateService } from '@core';
import { TranslatePipe } from '@shared';
import { shortHash } from './audit-presentation';

/** WORM storage and retention: the sealed batches (range, Merkle root, retention lock) and the manual seal. */
@Component({
  selector: 'app-audit-worm-batches',
  styleUrl: './audit-trail.scss',
  imports: [
    DatePipe,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzPopconfirmModule,
    NzTableModule,
    NzTooltipModule,
    TranslatePipe,
  ],
  template: `
    <nz-card class="main-card" [nzTitle]="'AUDIT.WORM.TITLE' | translate">
      <p class="notice">{{ 'AUDIT.WORM.SUBTITLE' | translate }}</p>
      <div class="toolbar">
        @if (canSeal()) {
          <button
            nz-button
            nzType="primary"
            nz-popconfirm
            [nzPopconfirmTitle]="'AUDIT.WORM.SEAL_CONFIRM' | translate"
            [disabled]="sealing()"
            (nzOnConfirm)="seal()"
          >
            {{ 'AUDIT.WORM.SEAL_NOW' | translate }}
          </button>
        }
      </div>
      @if (error()) {
        <nz-alert nzType="error" nzShowIcon [nzMessage]="error()" class="banner"></nz-alert>
      }
      <nz-table
        nzSize="small"
        [nzData]="batches()"
        [nzLoading]="loading()"
        [nzNoResult]="'AUDIT.WORM.EMPTY' | translate"
        [nzScroll]="{ x: '960px' }"
      >
        <thead>
          <tr>
            <th class="num">{{ 'AUDIT.WORM.FROM' | translate }}</th>
            <th class="num">{{ 'AUDIT.WORM.TO' | translate }}</th>
            <th class="num">{{ 'AUDIT.WORM.RECORDS' | translate }}</th>
            <th>{{ 'AUDIT.WORM.MERKLE' | translate }}</th>
            <th>{{ 'AUDIT.WORM.STORAGE' | translate }}</th>
            <th>{{ 'AUDIT.WORM.RETENTION' | translate }}</th>
            <th>{{ 'AUDIT.WORM.SEALED_AT' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (batch of batches(); track batch.id) {
            <tr>
              <td class="num">{{ batch.from_sequence }}</td>
              <td class="num">{{ batch.to_sequence }}</td>
              <td class="num">{{ batch.record_count }}</td>
              <td class="mono" nz-tooltip [nzTooltipTitle]="batch.merkle_root_hash">
                {{ short(batch.merkle_root_hash) }}
              </td>
              <td class="mono">{{ batch.storage_disk }}:{{ batch.storage_path }}</td>
              <td class="ts">{{ batch.retention_until | date: 'yyyy-MM-dd' }}</td>
              <td class="ts">{{ batch.sealed_at | date: 'yyyy-MM-dd HH:mm:ss' }}</td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>
  `,
})
export class AuditWormBatchesComponent implements OnInit {
  private readonly api = inject(AuditTrailApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);
  private readonly permissions = inject(PermissionsService);

  protected readonly short = shortHash;

  readonly batches = signal<AuditWormBatch[]>([]);
  readonly loading = signal(false);
  readonly sealing = signal(false);
  readonly error = signal<string | null>(null);

  readonly canSeal = computed(() => this.permissions.canWrite('audit_trail'));

  ngOnInit(): void {
    this.load();
  }

  seal(): void {
    this.sealing.set(true);
    this.api.sealWormBatches().subscribe({
      next: (response) => {
        this.sealing.set(false);
        this.message.success(
          this.i18n.instant(response.data.length ? 'AUDIT.WORM.SEALED_OK' : 'AUDIT.WORM.NOTHING'),
        );
        this.load();
      },
      error: () => {
        this.sealing.set(false);
        this.message.error(this.i18n.instant('AUDIT.ERROR.ACTION'));
      },
    });
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.wormBatches().subscribe({
      next: (response) => {
        this.batches.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(this.i18n.instant('AUDIT.ERROR.LOAD'));
        this.loading.set(false);
      },
    });
  }
}
