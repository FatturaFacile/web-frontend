import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  resource,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { firstValueFrom } from 'rxjs';
import { AuditExport, AuditLedgerApiService } from '@core';
import { TranslatePipe } from '@shared';
import { failureOf, isoDay, windowIsTooLong } from './audit-ledger.util';

const POLL_MS = 2000;

/**
 * Requests a signed export package (CSV, JSON, PDF summary, manifest) of a date range and follows the job until it is ready:
 * the status is read with a `resource()` that reloads every two seconds while the export is queued or running.
 */
@Component({
  selector: 'app-audit-export-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzDatePickerModule,
    NzModalModule,
    NzTagModule,
    TranslatePipe,
  ],
  template: `
    <nz-modal
      [nzVisible]="open()"
      [nzTitle]="'audit.export.title' | translate"
      [nzFooter]="footer"
      (nzOnCancel)="close()"
    >
      <ng-container *nzModalContent>
        <p>{{ 'audit.export.hint' | translate }}</p>
        <label class="field">
          <span>{{ 'audit.export.range' | translate }}</span>
          <nz-range-picker
            [ngModel]="range()"
            (ngModelChange)="range.set($event)"
            [nzDisabled]="exportId() !== null"
            nzFormat="yyyy-MM-dd"
          />
        </label>

        @if (tooLong()) {
          <nz-alert nzType="warning" nzShowIcon [nzMessage]="'audit.export.error_range' | translate" />
        }
        @if (requestError(); as key) {
          <nz-alert nzType="error" nzShowIcon [nzMessage]="key | translate" />
        }

        @if (current(); as job) {
          <div class="job">
            <nz-tag [nzColor]="job.status === 'failed' ? 'error' : job.status === 'completed' ? 'success' : 'processing'">
              {{ 'audit.export.status.' + job.status | translate }}
            </nz-tag>
            @if (job.status === 'completed') {
              <dl class="facts">
                <dt>{{ 'audit.export.entries' | translate }}</dt>
                <dd>{{ job.entries_count }}</dd>
                <dt>{{ 'audit.export.verification' | translate }}</dt>
                <dd>{{ job.verification_outcome }}</dd>
                <dt>{{ 'audit.export.signature' | translate }}</dt>
                <dd class="mono">{{ job.sha256 }}</dd>
                <dt>{{ 'audit.export.range' | translate }}</dt>
                <dd>{{ job.from | date: 'yyyy-MM-dd' }} → {{ job.to | date: 'yyyy-MM-dd' }}</dd>
              </dl>
            }
            @if (job.status === 'failed') {
              <nz-alert nzType="error" nzShowIcon [nzMessage]="'audit.export.error' | translate" />
            }
          </div>
        }
        @if (pollError()) {
          <nz-alert nzType="error" nzShowIcon [nzMessage]="'audit.export.error' | translate" />
        }
      </ng-container>
      <ng-template #footer>
        <button nz-button (click)="close()">{{ 'audit.export.cancel' | translate }}</button>
        @if (current()?.status === 'completed') {
          <button nz-button nzType="primary" [nzLoading]="downloading()" (click)="download()">
            {{ 'audit.export.download' | translate }}
          </button>
        } @else {
          <button
            nz-button
            nzType="primary"
            [nzLoading]="submitting() || inProgress()"
            [disabled]="!canSubmit()"
            (click)="submit()"
          >
            {{ 'audit.export.submit' | translate }}
          </button>
        }
      </ng-template>
    </nz-modal>
  `,
  styles: `
    .field {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 12px;
    }
    .job {
      margin-top: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .facts {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: 4px 14px;
      margin: 0;
    }
    .facts dd {
      margin: 0;
    }
    .mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      word-break: break-all;
    }
  `,
})
export class AuditExportDialogComponent {
  private readonly api = inject(AuditLedgerApiService);

  readonly open = input(false);
  readonly closed = output<void>();

  protected readonly range = signal<Date[]>([]);
  protected readonly exportId = signal<string | null>(null);
  protected readonly submitting = signal(false);
  protected readonly downloading = signal(false);
  protected readonly requestError = signal<string | null>(null);
  /** Bumped by the poll timer to make the resource reload while the export is not finished. */
  private readonly tick = signal(0);
  /** One key per requested range: a double click or a retry returns the same export instead of queueing another. */
  private idempotencyKey: string | null = null;

  /** The export being followed; reloads on every tick. */
  protected readonly job = resource({
    params: () => {
      const id = this.exportId();
      return id === null ? undefined : { id, tick: this.tick() };
    },
    loader: async ({ params }): Promise<AuditExport> => (await firstValueFrom(this.api.getExport(params.id))).data,
  });

  /** The last known state: the answer of the request itself until the first poll arrives. */
  private readonly created = signal<AuditExport | null>(null);
  protected readonly current = computed<AuditExport | null>(() => {
    if (this.exportId() === null) {
      return null;
    }
    return this.job.hasValue() ? this.job.value() : this.created();
  });

  protected readonly pollError = computed(() => this.exportId() !== null && this.job.error() !== undefined);
  protected readonly inProgress = computed(() => {
    const status = this.current()?.status;
    return status === 'queued' || status === 'running';
  });
  protected readonly tooLong = computed(() => {
    const [from, to] = this.range();
    return windowIsTooLong(from ?? null, to ?? null);
  });
  protected readonly canSubmit = computed(
    () => this.range().length === 2 && !this.tooLong() && !this.submitting() && !this.inProgress(),
  );

  constructor() {
    effect((onCleanup) => {
      if (!this.inProgress()) {
        return;
      }
      const timer = setInterval(() => this.tick.update((n) => n + 1), POLL_MS);
      onCleanup(() => clearInterval(timer));
    });
  }

  protected submit(): void {
    const [from, to] = this.range();
    if (!from || !to || this.tooLong()) {
      return;
    }
    this.idempotencyKey ??= crypto.randomUUID();
    this.submitting.set(true);
    this.requestError.set(null);
    this.api.requestExport({ from: isoDay(from), to: isoDay(to) }, this.idempotencyKey).subscribe({
      next: (response) => {
        this.created.set(response.data);
        this.exportId.set(response.data.id);
        this.submitting.set(false);
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        this.idempotencyKey = null;
        const failure = failureOf(error);
        this.requestError.set(
          failure === 'forbidden'
            ? 'settings.audit.error.forbidden'
            : failure === 'invalid'
              ? 'audit.export.error_range'
              : 'audit.export.error',
        );
      },
    });
  }

  protected download(): void {
    const id = this.exportId();
    if (id === null) {
      return;
    }
    this.downloading.set(true);
    this.api.downloadExport(id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `audit-export-${id}.zip`;
        anchor.click();
        URL.revokeObjectURL(url);
        this.downloading.set(false);
      },
      error: () => {
        this.downloading.set(false);
        this.requestError.set('audit.export.error');
      },
    });
  }

  protected close(): void {
    this.exportId.set(null);
    this.created.set(null);
    this.range.set([]);
    this.requestError.set(null);
    this.idempotencyKey = null;
    this.closed.emit();
  }
}
