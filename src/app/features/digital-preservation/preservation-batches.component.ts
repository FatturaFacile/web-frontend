import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTimelineModule } from 'ng-zorro-antd/timeline';
import { NzStepsModule } from 'ng-zorro-antd/steps';
import { TranslateService } from '@core';
import { TranslatePipe } from '@shared';
import { downloadBlob } from '../../shared/utils/download-blob';
import { CreateBatchModalComponent } from './create-batch-modal.component';
import {
  BATCH_STATUSES,
  BatchStatus,
  BatchVerification,
  DOCUMENT_CATEGORIES,
  JURISDICTIONS,
  PreservationBatch,
} from './digital-preservation.models';
import { DigitalPreservationStore } from './digital-preservation.store';
import {
  apiMessage,
  highlightXml,
  lifecycleIndex,
  LIFECYCLE_STEPS,
  statusColor,
} from './digital-preservation.utils';
import { HashCellComponent } from './hash-cell.component';
import { VerificationResultComponent } from './verification-result.component';

/** PdV/PdA batches: filterable table and a detail drawer (lifecycle, PdV.xml viewer, items, PdD export). */
@Component({
  selector: 'app-preservation-batches',
  styleUrl: './digital-preservation.scss',
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    TranslatePipe,
    NzButtonModule,
    NzDrawerModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzStepsModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    NzTimelineModule,
    CreateBatchModalComponent,
    HashCellComponent,
    VerificationResultComponent,
  ],
  template: `
    <div class="filters" role="search">
      <nz-select
        style="width: 160px"
        nzAllowClear
        [nzPlaceHolder]="'PRESERVATION.STATUS' | translate"
        [ngModel]="store.batchFilters().status || null"
        (ngModelChange)="filter({ status: $event ?? '' })"
        [attr.aria-label]="'PRESERVATION.STATUS' | translate"
      >
        @for (s of statuses; track s) {
          <nz-option
            [nzValue]="s"
            [nzLabel]="'PRESERVATION.STATUS_' + s.toUpperCase() | translate"
          ></nz-option>
        }
      </nz-select>
      <nz-select
        style="width: 200px"
        nzAllowClear
        [nzPlaceHolder]="'PRESERVATION.DOCUMENT_CATEGORY' | translate"
        [ngModel]="store.batchFilters().document_category || null"
        (ngModelChange)="filter({ document_category: $event ?? '' })"
        [attr.aria-label]="'PRESERVATION.DOCUMENT_CATEGORY' | translate"
      >
        @for (c of categories; track c) {
          <nz-option
            [nzValue]="c"
            [nzLabel]="'PRESERVATION.CATEGORY_' + c.toUpperCase() | translate"
          ></nz-option>
        }
      </nz-select>
      <nz-select
        style="width: 170px"
        nzAllowClear
        [nzPlaceHolder]="'PRESERVATION.JURISDICTION' | translate"
        [ngModel]="store.batchFilters().jurisdiction || null"
        (ngModelChange)="filter({ jurisdiction: $event ?? '' })"
        [attr.aria-label]="'PRESERVATION.JURISDICTION' | translate"
      >
        @for (j of jurisdictions; track j) {
          <nz-option
            [nzValue]="j"
            [nzLabel]="'PRESERVATION.JURISDICTION_' + j | translate"
          ></nz-option>
        }
      </nz-select>
      <input
        nz-input
        style="width: 200px"
        [placeholder]="'PRESERVATION.SEARCH' | translate"
        [attr.aria-label]="'PRESERVATION.SEARCH' | translate"
        [ngModel]="store.batchFilters().search"
        (ngModelChange)="filter({ search: $event })"
      />
      <button
        nz-button
        nzType="primary"
        type="button"
        data-testid="new-batch"
        (click)="newBatch.set(true)"
      >
        {{ 'PRESERVATION.RUN_BATCH' | translate }}
      </button>
    </div>

    <nz-table
      #table
      nzSize="middle"
      [nzData]="store.batches()"
      [nzFrontPagination]="false"
      [nzLoading]="store.loading()"
      [nzTotal]="store.batchMeta().total"
      [nzPageSize]="store.batchMeta().per_page"
      [nzPageIndex]="store.batchMeta().current_page"
      (nzPageIndexChange)="page($event)"
      data-testid="batches-table"
    >
      <thead>
        <tr>
          <th>{{ 'PRESERVATION.BATCH_NUMBER' | translate }}</th>
          <th>{{ 'PRESERVATION.JURISDICTION' | translate }}</th>
          <th>{{ 'PRESERVATION.DOCUMENT_CATEGORY' | translate }}</th>
          <th>{{ 'PRESERVATION.PERIOD' | translate }}</th>
          <th>{{ 'PRESERVATION.DOCUMENTS' | translate }}</th>
          <th>SHA-256</th>
          <th>{{ 'PRESERVATION.STATUS' | translate }}</th>
          <th>{{ 'PRESERVATION.RETENTION_UNTIL' | translate }}</th>
        </tr>
      </thead>
      <tbody>
        @for (b of table.data; track b.id) {
          <tr>
            <td>
              <a href="javascript:void(0)" (click)="open(b)" data-testid="open-batch">{{
                b.batch_number
              }}</a>
            </td>
            <td>
              <nz-tag>{{ 'PRESERVATION.JURISDICTION_TAG_' + b.jurisdiction | translate }}</nz-tag>
            </td>
            <td>{{ 'PRESERVATION.CATEGORY_' + b.document_category.toUpperCase() | translate }}</td>
            <td>{{ b.period_from }} → {{ b.period_to }}</td>
            <td>{{ b.item_count | number }}</td>
            <td><app-hash-cell [hash]="b.pdv_sha256"></app-hash-cell></td>
            <td>
              <nz-tag [nzColor]="color(b.status)">{{
                'PRESERVATION.STATUS_' + b.status.toUpperCase() | translate
              }}</nz-tag>
            </td>
            <td>{{ b.retention_until ?? '—' }}</td>
          </tr>
        }
      </tbody>
    </nz-table>

    <app-create-batch-modal
      [(visible)]="newBatch"
      (created)="onCreated($event)"
    ></app-create-batch-modal>

    <nz-drawer
      [nzVisible]="store.selectedBatch() !== null"
      [nzWidth]="860"
      [nzTitle]="store.selectedBatch()?.batch_number ?? ''"
      (nzOnClose)="store.closeBatch()"
    >
      <ng-container *nzDrawerContent>
        @if (store.selectedBatch(); as b) {
          <nz-steps
            nzSize="small"
            [nzCurrent]="stepIndex()"
            [nzStatus]="b.status === 'failed' ? 'error' : 'process'"
            data-testid="batch-steps"
          >
            @for (s of steps; track s) {
              <nz-step [nzTitle]="'PRESERVATION.STATUS_' + s.toUpperCase() | translate"></nz-step>
            }
          </nz-steps>

          <div class="toolbar">
            @if (b.status === 'draft') {
              <button
                nz-button
                nzType="primary"
                type="button"
                data-testid="seal-batch"
                [nzLoading]="store.busy()"
                (click)="seal(b.id)"
              >
                {{ 'PRESERVATION.SEAL' | translate }}
              </button>
            }
            @if (b.status === 'sealed' || b.status === 'timestamped') {
              <button
                nz-button
                nzType="primary"
                type="button"
                data-testid="dispatch-batch"
                [nzLoading]="store.busy()"
                (click)="dispatch(b.id)"
              >
                {{ 'PRESERVATION.DISPATCH' | translate }}
              </button>
            }
            @if (b.status !== 'draft') {
              <button
                nz-button
                type="button"
                data-testid="verify-batch"
                [nzLoading]="store.busy()"
                (click)="verify(b.id)"
              >
                {{ 'PRESERVATION.VERIFY' | translate }}
              </button>
              <button
                nz-button
                type="button"
                data-testid="export-pdd"
                (click)="exportPdd(b.id, b.batch_number)"
              >
                {{ 'PRESERVATION.EXPORT_PDD' | translate }}
              </button>
            }
          </div>

          <nz-tabs>
            <nz-tab [nzTitle]="'PRESERVATION.TAB_LIFECYCLE' | translate">
              <nz-timeline>
                <nz-timeline-item nzColor="green">
                  {{ 'PRESERVATION.EVENT_CREATED' | translate }} ·
                  {{ b.created_at | date: 'medium' }}
                </nz-timeline-item>
                @if (b.sealed_at) {
                  <nz-timeline-item nzColor="cyan">
                    {{ 'PRESERVATION.EVENT_SEALED' | translate }} ·
                    {{ b.sealed_at | date: 'medium' }}
                  </nz-timeline-item>
                }
                @if (b.timestamp; as t) {
                  <nz-timeline-item nzColor="blue" data-testid="timestamp-details">
                    {{ 'PRESERVATION.EVENT_TIMESTAMPED' | translate }} ·
                    {{ t.gen_time | date: 'medium' }}
                    <div class="muted">
                      {{ 'PRESERVATION.TSA_PROVIDER' | translate }}: {{ t.provider }} ·
                      {{
                        (t.qualified ? 'PRESERVATION.QUALIFIED' : 'PRESERVATION.NOT_QUALIFIED')
                          | translate
                      }}
                    </div>
                  </nz-timeline-item>
                }
                @if (b.dispatched_at) {
                  <nz-timeline-item nzColor="blue">
                    {{ 'PRESERVATION.EVENT_DISPATCHED' | translate }} ·
                    {{ b.dispatched_at | date: 'medium' }}
                    @if (b.external_conservator_id) {
                      <div class="muted">{{ b.external_conservator_id }}</div>
                    }
                  </nz-timeline-item>
                }
                <nz-timeline-item [nzColor]="b.has_rdv ? 'green' : 'gray'">
                  {{
                    (b.has_rdv ? 'PRESERVATION.RDV_RECEIVED' : 'PRESERVATION.RDV_PENDING')
                      | translate
                  }}
                </nz-timeline-item>
              </nz-timeline>
              <div class="hash-row">
                <strong>PdV</strong> <app-hash-cell [hash]="b.pdv_sha256"></app-hash-cell>
              </div>
              <div class="hash-row">
                <strong>PdA</strong> <app-hash-cell [hash]="b.pda_sha256"></app-hash-cell>
              </div>
              <div class="hash-row">
                <strong>Merkle</strong>
                <app-hash-cell [hash]="b.merkle_root_sha256"></app-hash-cell>
              </div>
              <div class="hash-row">
                <strong>{{ 'PRESERVATION.PREVIOUS_BATCH' | translate }}</strong>
                <app-hash-cell [hash]="b.previous_batch_sha256"></app-hash-cell>
              </div>
            </nz-tab>
            <nz-tab [nzTitle]="'PRESERVATION.TAB_PDV' | translate">
              @if (b.pdv_xml) {
                <div class="toolbar">
                  <button
                    nz-button
                    type="button"
                    data-testid="download-xml"
                    (click)="downloadXml(b.pdv_xml, b.batch_number)"
                  >
                    {{ 'PRESERVATION.DOWNLOAD_XML' | translate }}
                  </button>
                </div>
                <pre class="xml-viewer" data-testid="xml-viewer" [innerHTML]="xmlHtml()"></pre>
              } @else {
                <p class="muted">{{ 'PRESERVATION.PDV_NOT_GENERATED' | translate }}</p>
              }
            </nz-tab>
            <nz-tab [nzTitle]="'PRESERVATION.TAB_ITEMS' | translate">
              <nz-table
                nzSize="small"
                [nzData]="b.items"
                [nzPageSize]="10"
                data-testid="batch-items"
              >
                <thead>
                  <tr>
                    <th>{{ 'PRESERVATION.DOCUMENT_NUMBER' | translate }}</th>
                    <th>{{ 'PRESERVATION.FILE' | translate }}</th>
                    <th>{{ 'PRESERVATION.FORMAT' | translate }}</th>
                    <th>SHA-256</th>
                  </tr>
                </thead>
                <tbody>
                  @for (i of b.items; track i.id) {
                    <tr>
                      <td>{{ i.document_number ?? i.document_uuid }}</td>
                      <td>{{ i.original_filename }}</td>
                      <td>
                        @if (i.pdfa_conformance_level; as level) {
                          <nz-tag [nzColor]="i.is_pdfa_compliant ? 'green' : 'orange'">{{
                            level
                          }}</nz-tag>
                        } @else {
                          <nz-tag>{{ 'PRESERVATION.NO_CONFORMANCE' | translate }}</nz-tag>
                        }
                      </td>
                      <td><app-hash-cell [hash]="i.sha256_hash"></app-hash-cell></td>
                    </tr>
                  }
                </tbody>
              </nz-table>
            </nz-tab>
          </nz-tabs>
        }
      </ng-container>
    </nz-drawer>

    <nz-modal
      [nzVisible]="verification() !== null"
      [nzTitle]="'PRESERVATION.VERIFY' | translate"
      [nzFooter]="null"
      (nzOnCancel)="verification.set(null)"
    >
      <ng-container *nzModalContent>
        @if (verification(); as v) {
          <app-verification-result [result]="v"></app-verification-result>
        }
      </ng-container>
    </nz-modal>
  `,
})
export class PreservationBatchesComponent implements OnInit {
  protected readonly store = inject(DigitalPreservationStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly statuses = BATCH_STATUSES;
  protected readonly categories = DOCUMENT_CATEGORIES;
  protected readonly jurisdictions = JURISDICTIONS;
  protected readonly steps = LIFECYCLE_STEPS;
  protected readonly newBatch = signal(false);
  protected readonly verification = signal<BatchVerification | null>(null);

  protected readonly stepIndex = computed(() => {
    const status = this.store.selectedBatch()?.status;
    return status ? Math.max(lifecycleIndex(status), 0) : 0;
  });
  protected readonly xmlHtml = computed(() =>
    highlightXml(this.store.selectedBatch()?.pdv_xml ?? ''),
  );

  ngOnInit(): void {
    this.store.loadBatches().subscribe();
  }

  protected color(status: BatchStatus): string {
    return statusColor(status);
  }

  protected filter(patch: Parameters<DigitalPreservationStore['setBatchFilters']>[0]): void {
    this.store.setBatchFilters(patch);
    this.store.loadBatches().subscribe();
  }

  protected page(index: number): void {
    this.store.batchFilters.update((f) => ({ ...f, page: index }));
    this.store.loadBatches().subscribe();
  }

  protected open(batch: PreservationBatch): void {
    this.store.openBatch(batch.id).subscribe();
  }

  protected onCreated(id: string): void {
    this.store.loadBatches().subscribe(() => this.store.openBatch(id).subscribe());
  }

  protected seal(id: string): void {
    this.store.seal(id).subscribe({
      next: () => {
        this.message.success(this.i18n.instant('PRESERVATION.SEALED_OK'));
        this.store.openBatch(id).subscribe();
      },
      error: (err: unknown) =>
        this.message.error(apiMessage(err, this.i18n.instant('PRESERVATION.SEAL_FAILED'))),
    });
  }

  protected dispatch(id: string): void {
    this.store.dispatch(id).subscribe({
      next: () => {
        this.message.success(this.i18n.instant('PRESERVATION.DISPATCHED_OK'));
        this.store.openBatch(id).subscribe();
      },
      error: (err: unknown) =>
        this.message.error(apiMessage(err, this.i18n.instant('PRESERVATION.DISPATCH_FAILED'))),
    });
  }

  protected verify(id: string): void {
    this.store.verifyBatch(id).subscribe({
      next: (res) => this.verification.set(res.data),
      error: () => this.message.error(this.i18n.instant('PRESERVATION.VERIFY_ERROR')),
    });
  }

  protected exportPdd(id: string, number: string): void {
    this.store.exportBatchPdd(id).subscribe({
      next: (blob) => downloadBlob(blob, `PdD_${number}.zip`),
      error: () => this.message.error(this.i18n.instant('PRESERVATION.EXPORT_FAILED')),
    });
  }

  protected downloadXml(xml: string, number: string): void {
    downloadBlob(new Blob([xml], { type: 'application/xml' }), `PdV_${number}.xml`);
  }
}
