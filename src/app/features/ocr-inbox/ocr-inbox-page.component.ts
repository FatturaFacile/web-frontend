import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, effect, inject, OnInit, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { interval } from 'rxjs';
import { DocumentBoundingBoxViewerComponent } from './document-bounding-box-viewer.component';
import { ExtractionReviewFormComponent } from './extraction-review-form.component';
import { InboxStatus } from './ocr-inbox.models';
import { OcrInboxRealtimeService } from './ocr-inbox-realtime.service';
import { OcrInboxStore } from './ocr-inbox.store';
import { confidenceBand } from './ocr-inbox.utils';

const POLL_MS = 30_000;
const STATUSES: InboxStatus[] = ['ready_for_review', 'queued', 'processing', 'failed'];

/**
 * AI Inbox and document review workbench: the queue with its counters on the left and, for the selected document, the
 * side-by-side workbench: source document with bounding boxes next to the extraction form. New documents appear live
 * through the Reverb channel of the tenant, or by polling when realtime is not available.
 */
@Component({
  selector: 'app-ocr-inbox-page',
  styleUrl: './ocr-inbox.scss',
  imports: [
    DatePipe,
    DecimalPipe,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzSpinModule,
    NzStatisticModule,
    NzTagModule,
    DocumentBoundingBoxViewerComponent,
    ExtractionReviewFormComponent,
  ],
  template: `
    <app-page-header
      [title]="'OCR_INBOX.TITLE' | translate"
      [subtitle]="'OCR_INBOX.SUBTITLE' | translate"
    ></app-page-header>

    <div class="counter-row" data-testid="counters">
      @for (status of statuses; track status) {
        <button
          type="button"
          class="queue-item"
          [class.selected]="store.statusFilter() === status"
          [attr.data-testid]="'counter-' + status"
          [attr.aria-pressed]="store.statusFilter() === status"
          (click)="filter(status)"
        >
          <nz-statistic
            [nzTitle]="statusKey(status) | translate"
            [nzValue]="store.counters()[status]"
          ></nz-statistic>
        </button>
      }
    </div>

    <div class="queue-layout">
      <nz-card [nzTitle]="'OCR_INBOX.QUEUE' | translate" nzSize="small">
        <div class="queue-toolbar">
          <button
            nz-button
            nzSize="small"
            type="button"
            data-testid="refresh"
            [nzLoading]="store.loading()"
            (click)="reload()"
          >
            {{ 'OCR_INBOX.REFRESH' | translate }}
          </button>
          @if (realtime.connected()) {
            <i class="fa-solid fa-signal" aria-hidden="true"></i>
          }
        </div>
        <nz-spin [nzSpinning]="store.loading()">
          @for (item of store.items(); track item.id) {
            <button
              type="button"
              class="queue-item"
              [class.selected]="store.selectedId() === item.id"
              [attr.data-testid]="'item-' + item.id"
              (click)="open(item.id)"
            >
              <strong>{{ item.document_title ?? item.id }}</strong>
              <div class="muted">
                {{ 'OCR_INBOX.CATEGORY_' + item.document_category.toUpperCase() | translate }}
                @if (item.vendor_name) {
                  · {{ item.vendor_name }}
                }
              </div>
              <div>
                <nz-tag
                  [nzColor]="
                    item.status === 'failed'
                      ? 'red'
                      : item.status === 'ready_for_review'
                        ? 'blue'
                        : 'default'
                  "
                  >{{ statusKey(item.status) | translate }}</nz-tag
                >
                @if (item.status === 'ready_for_review') {
                  <span class="pill" [attr.data-band]="band(item.overall_confidence_score)"
                    >{{ item.overall_confidence_score | number: '1.0-0' }}%</span
                  >
                }
                <span class="muted">{{
                  'OCR_INBOX.CHANNEL_' + item.source_channel.toUpperCase() | translate
                }}</span>
                @if (item.created_at) {
                  <span class="muted">{{ item.created_at | date: 'short' }}</span>
                }
              </div>
              @if (item.failure_reason) {
                <div class="muted" role="note">{{ item.failure_reason }}</div>
              }
            </button>
          } @empty {
            <nz-empty [nzNotFoundContent]="'OCR_INBOX.EMPTY_QUEUE' | translate"></nz-empty>
          }
        </nz-spin>
      </nz-card>

      <div>
        @if (store.workbench(); as workbench) {
          <nz-spin [nzSpinning]="store.loadingWorkbench()">
            <div class="workbench" data-testid="workbench">
              <app-document-bounding-box-viewer
                [source]="workbench.source"
                [boxes]="store.boxes()"
                [confidence]="store.confidence()"
                [activeKey]="store.activeFieldKey()"
                [focusTick]="store.focusTick()"
                (boxSelected)="store.focusField($event)"
                (regionSelected)="assign($event.box)"
              ></app-document-bounding-box-viewer>
              <app-extraction-review-form [workbench]="workbench"></app-extraction-review-form>
            </div>
          </nz-spin>
        } @else {
          <nz-empty
            data-testid="no-selection"
            [nzNotFoundContent]="'OCR_INBOX.SELECT_DOCUMENT' | translate"
          ></nz-empty>
        }
      </div>
    </div>
  `,
})
export class OcrInboxPageComponent implements OnInit {
  protected readonly store = inject(OcrInboxStore);
  protected readonly realtime = inject(OcrInboxRealtimeService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly statuses = STATUSES;

  constructor() {
    // A document announced by the server refreshes the queue (and the workbench when it is the open one).
    effect(() => {
      const event = this.realtime.event();

      if (event !== null) {
        untracked(() => {
          this.message.info(this.i18n.instant('OCR_INBOX.LIVE_UPDATE'));
          this.store.onServerEvent(event.job_id).subscribe({ error: () => undefined });
        });
      }
    });

    // Without realtime the queue is polled while the page is open.
    interval(POLL_MS)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        if (!this.realtime.connected()) {
          this.store.loadQueue().subscribe({ error: () => undefined });
        }
      });
  }

  ngOnInit(): void {
    this.reload();
    void this.realtime.start();

    const job = this.route.snapshot.queryParamMap.get('job');

    if (job !== null) {
      this.select(job);
    }
  }

  protected statusKey(status: string): string {
    return `OCR_INBOX.STATUS_${status.toUpperCase()}`;
  }

  protected band(score: number): string {
    return confidenceBand(score);
  }

  protected reload(): void {
    this.store
      .loadQueue()
      .subscribe({ error: () => this.message.error(this.i18n.instant('OCR_INBOX.LOAD_ERROR')) });
  }

  protected filter(status: InboxStatus): void {
    this.store.setStatusFilter(this.store.statusFilter() === status ? null : status);
    this.reload();
  }

  protected open(jobId: string): void {
    this.select(jobId);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { job: jobId },
      queryParamsHandling: 'merge',
    });
  }

  protected assign(box: Parameters<OcrInboxStore['assignRegion']>[1]): void {
    const key = this.store.activeFieldKey();

    if (key !== null) {
      this.store.assignRegion(key, box);
    }
  }

  private select(jobId: string): void {
    this.store.select(jobId).subscribe({
      error: () => this.message.error(this.i18n.instant('OCR_INBOX.WORKBENCH_ERROR')),
    });
  }
}
