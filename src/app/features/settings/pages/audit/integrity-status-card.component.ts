import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { AuditIntegrity, AuditLedgerApiService } from '@core';
import { TranslatePipe } from '@shared';
import { failureOf, integrityColor } from './audit-ledger.util';

const POLL_MS = 3000;

/**
 * Integrity of the audit chain: the result of the last verification (valid, broken at a sequence, missing range), the tail of
 * the chain and the last checkpoint. A broken chain is shown as a prominent alert; "verify now" queues a run and follows it.
 */
@Component({
  selector: 'app-audit-integrity-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    NzAlertModule,
    NzBadgeModule,
    NzButtonModule,
    NzCardModule,
    NzSkeletonModule,
    TranslatePipe,
  ],
  template: `
    <nz-card [nzTitle]="'audit.integrity.title' | translate">
      @if (loading()) {
        <nz-skeleton [nzActive]="true" />
      } @else if (failed()) {
        <nz-alert nzType="error" nzShowIcon [nzMessage]="'audit.integrity.error' | translate" />
      } @else if (integrity(); as state) {
        @if (state.status === 'broken_at') {
          <nz-alert
            class="broken"
            nzType="error"
            nzShowIcon
            [nzMessage]="'audit.integrity.broken_title' | translate"
            [nzDescription]="('audit.integrity.broken_body' | translate) + ' (#' + state.last_run?.broken_at_sequence + ')'"
          />
        } @else if (state.status === 'missing_range') {
          <nz-alert
            class="broken"
            nzType="error"
            nzShowIcon
            [nzMessage]="'audit.integrity.broken_title' | translate"
            [nzDescription]="('audit.integrity.missing_body' | translate) + ' (#' + state.last_run?.missing_range?.from + ' – #' + state.last_run?.missing_range?.to + ')'"
          />
        }

        <div class="status-row">
          <nz-badge
            [nzStatus]="badgeStatus()"
            [nzText]="'audit.integrity.status.' + state.status | translate"
          />
          <button
            nz-button
            nzType="primary"
            [nzLoading]="verifying() || state.status === 'running'"
            [disabled]="verifying() || state.status === 'running'"
            (click)="verify()"
          >
            {{
              (verifying() || state.status === 'running'
                ? 'audit.integrity.verifying'
                : 'audit.integrity.verify_now'
              ) | translate
            }}
          </button>
        </div>

        @if (notice(); as text) {
          <nz-alert class="notice" nzType="info" nzShowIcon [nzMessage]="text | translate" />
        }

        <dl class="facts">
          @if (state.last_run; as run) {
            <dt>{{ 'audit.integrity.last_run' | translate }}</dt>
            <dd>
              {{ run.finished_at | date: 'yyyy-MM-dd HH:mm' }}
              @if (run.verified_entries !== null) {
                · {{ 'audit.integrity.verified_entries' | translate }}: {{ run.verified_entries }}
              }
            </dd>
          } @else {
            <dt>{{ 'audit.integrity.last_run' | translate }}</dt>
            <dd>{{ 'audit.integrity.never' | translate }}</dd>
          }
          @if (state.tail; as tail) {
            <dt>{{ 'audit.integrity.tail' | translate }}</dt>
            <dd class="mono">#{{ tail.sequence }} · {{ tail.hash }}</dd>
          }
          @if (state.last_checkpoint; as checkpoint) {
            <dt>{{ 'audit.integrity.checkpoint' | translate }}</dt>
            <dd>
              #{{ checkpoint.sequence }} ·
              @if (checkpoint.anchored_at) {
                {{ 'audit.integrity.anchored' | translate }}
              } @else {
                {{ 'audit.integrity.not_anchored' | translate }}
              }
            </dd>
          }
        </dl>
      }
    </nz-card>
  `,
  styles: `
    .broken,
    .notice {
      margin-bottom: 12px;
    }
    .status-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .facts {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: 6px 16px;
      margin: 16px 0 0;
    }
    .facts dt {
      font-weight: 500;
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
export class IntegrityStatusCardComponent implements OnInit {
  private readonly api = inject(AuditLedgerApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly integrity = signal<AuditIntegrity | null>(null);
  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly verifying = signal(false);
  /** Translation key of the last notice (queued, already running). */
  readonly notice = signal<string | null>(null);

  protected readonly badgeStatus = computed(() => {
    const color = integrityColor(this.integrity()?.status ?? 'never_verified');
    return color as 'success' | 'processing' | 'default' | 'error';
  });

  private timer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => this.stopPolling());
    this.refresh(true);
  }

  verify(): void {
    this.verifying.set(true);
    this.notice.set(null);
    this.api.verify().subscribe({
      next: () => {
        this.notice.set('audit.integrity.queued');
        this.verifying.set(false);
        this.refresh(false);
        this.startPolling();
      },
      error: (error: unknown) => {
        this.verifying.set(false);
        if (error instanceof HttpErrorResponse && error.status === 409) {
          this.notice.set('audit.integrity.already_running');
          this.refresh(false);
          this.startPolling();
          return;
        }
        this.notice.set(
          failureOf(error) === 'forbidden' ? 'settings.audit.error.forbidden' : 'audit.integrity.error',
        );
      },
    });
  }

  private refresh(initial: boolean): void {
    this.api.integrity().subscribe({
      next: (response) => {
        this.integrity.set(response.data);
        this.failed.set(false);
        this.loading.set(false);
        if (response.data.status !== 'running') {
          this.stopPolling();
        }
      },
      error: () => {
        if (initial) {
          this.failed.set(true);
        }
        this.loading.set(false);
        this.stopPolling();
      },
    });
  }

  private startPolling(): void {
    if (this.timer !== null) {
      return;
    }
    this.timer = setInterval(() => this.refresh(false), POLL_MS);
  }

  private stopPolling(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
