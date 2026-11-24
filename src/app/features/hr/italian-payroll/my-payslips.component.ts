import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { I18nService, ItalianPayrollApiService, MyPayslip, PayslipDocumentKind } from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { reportHttpError, saveBlob } from '../shared/hr-http.util';
import { availableDocuments, groupPayslipsByYear, payslipFilename } from './my-payslips.util';

interface OpenDocument {
  distributionId: string;
  kind: PayslipDocumentKind;
  filename: string;
  blob: Blob;
  blobUrl: string;
  safeUrl: SafeResourceUrl;
}

/**
 * The payslip vault of the logged-in employee: the months grouped by year and, per month, the cedolino and the CU.
 * A document is fetched decrypted on every opening (the server logs each access, L. 4/1953) and shown in the page;
 * the blob and its object URL live only while the preview is open and are revoked on close and on destroy.
 */
@Component({
  selector: 'app-my-payslips',
  imports: [
    DatePipe,
    MoneyPipe,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzSkeletonModule,
    NzTagModule,
    TranslatePipe,
  ],
  template: `
    <nz-alert
      nzType="info"
      nzShowIcon
      [nzMessage]="'itPayroll.mine.audit' | translate"
      data-testid="mine-audit"
    />

    @if (loading()) {
      <nz-skeleton class="gap" [nzActive]="true" data-testid="mine-loading" />
    } @else if (failed()) {
      <nz-alert
        class="gap"
        nzType="error"
        nzShowIcon
        [nzMessage]="'itPayroll.mine.loadFailed' | translate"
        data-testid="mine-error"
      />
      <button nz-button class="gap" type="button" (click)="load()">
        {{ 'itPayroll.mine.retry' | translate }}
      </button>
    } @else if (groups().length === 0) {
      <nz-empty
        class="gap"
        [nzNotFoundContent]="'itPayroll.mine.empty' | translate"
        data-testid="mine-empty"
      />
    } @else {
      @for (group of groups(); track group.year) {
        <nz-card class="gap" [nzTitle]="'' + group.year" data-testid="mine-year">
          <ul class="rows">
            @for (row of group.payslips; track row.distribution_id) {
              <li class="row" data-testid="mine-row">
                <strong class="period"> {{ pad(row.month) }}/{{ row.year }} </strong>
                <span class="net">
                  @if (row.net_amount !== null) {
                    {{ 'itPayroll.mine.net' | translate }}: {{ row.net_amount | money: 'EUR' }}
                  }
                </span>
                @if (row.first_viewed_at) {
                  <nz-tag nzColor="success" data-testid="mine-viewed">
                    {{
                      'itPayroll.mine.viewedOn'
                        | translate: { date: (row.first_viewed_at | date: 'dd/MM/yyyy HH:mm') ?? '' }
                    }}
                  </nz-tag>
                } @else {
                  <nz-tag nzColor="processing">{{ 'itPayroll.mine.new' | translate }}</nz-tag>
                }
                <span class="actions">
                  @for (kind of documents(row); track kind) {
                    <button
                      nz-button
                      nzSize="small"
                      type="button"
                      [attr.data-testid]="'mine-open-' + kind"
                      [disabled]="opening() !== null"
                      [nzLoading]="opening() === row.distribution_id + kind"
                      (click)="open(row, kind)"
                    >
                      {{
                        kind === 'cu'
                          ? ('itPayroll.mine.cu' | translate)
                          : ('itPayroll.mine.cedolino' | translate)
                      }}
                    </button>
                  }
                </span>
              </li>
            }
          </ul>
        </nz-card>
      }
    }

    @if (current(); as doc) {
      <nz-card
        class="gap"
        [nzTitle]="'itPayroll.mine.preview' | translate"
        data-testid="mine-preview"
      >
        <iframe
          class="viewer"
          sandbox=""
          referrerpolicy="no-referrer"
          [src]="doc.safeUrl"
          [title]="doc.filename"
        ></iframe>
        <div class="gap">
          <button
            nz-button
            nzType="primary"
            type="button"
            data-testid="mine-download"
            (click)="download()"
          >
            {{ 'itPayroll.mine.download' | translate }}
          </button>
          <button nz-button type="button" data-testid="mine-close" (click)="close()">
            {{ 'itPayroll.mine.close' | translate }}
          </button>
        </div>
      </nz-card>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .gap {
      display: block;
      margin-top: 16px;
    }
    .rows {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
      padding: 8px 0;
    }
    .period {
      min-width: 72px;
    }
    .net {
      min-width: 160px;
    }
    .actions {
      display: flex;
      gap: 8px;
      margin-left: auto;
    }
    .viewer {
      width: 100%;
      height: 70vh;
      border: 1px solid var(--ant-color-border, #d9d9d9);
    }
  `,
})
export class MyPayslipsComponent {
  private readonly api = inject(ItalianPayrollApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly payslips = signal<MyPayslip[]>([]);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  /** `distributionId + kind` of the request in flight. */
  protected readonly opening = signal<string | null>(null);
  protected readonly current = signal<OpenDocument | null>(null);
  protected readonly groups = computed(() => groupPayslipsByYear(this.payslips()));

  constructor() {
    this.destroyRef.onDestroy(() => this.close());
    this.load();
  }

  protected pad(month: number): string {
    return String(month).padStart(2, '0');
  }

  protected documents(row: MyPayslip): PayslipDocumentKind[] {
    return availableDocuments(row);
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.api
      .getMyPayslips()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.payslips.set(res.data);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.failed.set(true);
          reportHttpError(err, this.message, this.i18n);
        },
      });
  }

  open(row: MyPayslip, kind: PayslipDocumentKind): void {
    if (this.opening() !== null) {
      return;
    }

    this.close();
    this.opening.set(row.distribution_id + kind);
    this.api
      .openMyPayslip(row.distribution_id, kind)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          const blobUrl = URL.createObjectURL(blob);

          this.opening.set(null);
          this.current.set({
            distributionId: row.distribution_id,
            kind,
            filename: payslipFilename(row, kind),
            blob,
            blobUrl,
            safeUrl: this.sanitizer.bypassSecurityTrustResourceUrl(blobUrl),
          });
          // The server just stamped the first opening; mirror it without a reload.
          this.payslips.update((list) =>
            list.map((item) =>
              item.distribution_id === row.distribution_id && item.first_viewed_at === null
                ? { ...item, first_viewed_at: new Date().toISOString() }
                : item,
            ),
          );
        },
        error: (err: unknown) => {
          this.opening.set(null);
          reportHttpError(err, this.message, this.i18n);
        },
      });
  }

  download(): void {
    const doc = this.current();

    if (doc) {
      saveBlob(doc.blob, doc.filename);
    }
  }

  /** Drops the blob and revokes its URL: nothing of the decrypted document stays in the page. */
  close(): void {
    const doc = this.current();

    if (doc) {
      URL.revokeObjectURL(doc.blobUrl);
      this.current.set(null);
    }
  }
}
