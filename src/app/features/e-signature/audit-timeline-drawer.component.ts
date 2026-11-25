import { DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTimelineModule } from 'ng-zorro-antd/timeline';
import { EsigAuditEntry } from '@core';
import { TranslatePipe } from '@shared';
import { SignatureCenterStore } from './signature-center.store';

/**
 * The audit trail of an envelope as a timeline: who did what, when, from which address, with the hash of the document
 * and the entry. The chain check says whether any entry was changed, removed or inserted afterwards.
 */
@Component({
  selector: 'app-audit-timeline-drawer',
  imports: [
    DatePipe,
    NzDrawerModule,
    NzEmptyModule,
    NzSpinModule,
    NzTagModule,
    NzTimelineModule,
    TranslatePipe,
  ],
  template: `
    <nz-drawer
      [nzVisible]="store.audit().envelope !== null"
      [nzWidth]="520"
      [nzTitle]="'signatures.audit.title' | translate"
      (nzOnClose)="store.closeAudit()"
    >
      <ng-container *nzDrawerContent>
        @if (store.audit().envelope; as envelope) {
          <p class="subject">{{ envelope.title }}</p>
          @if (store.audit().chainValid !== null) {
            <nz-tag [nzColor]="store.audit().chainValid ? 'green' : 'red'" class="chain">
              {{
                (store.audit().chainValid
                  ? 'signatures.audit.chainValid'
                  : 'signatures.audit.chainBroken'
                ) | translate
              }}
            </nz-tag>
          }
        }
        <nz-spin [nzSpinning]="store.audit().loading">
          @if (!store.audit().loading && store.audit().entries.length === 0) {
            <nz-empty [nzNotFoundContent]="'signatures.audit.empty' | translate"></nz-empty>
          }
          <nz-timeline>
            @for (entry of store.audit().entries; track entry.id) {
              <nz-timeline-item [nzColor]="color(entry)">
                <strong>{{ 'signatures.audit.' + entry.event | translate }}</strong>
                <div class="meta">
                  {{ entry.occurred_at | date: 'dd.MM.yyyy HH:mm:ss' : 'UTC' }} UTC
                  @if (actorName(entry); as name) {
                    · {{ name }}
                  } @else {
                    · {{ 'signatures.audit.actor.' + entry.actor_type | translate }}
                  }
                </div>
                @if (entry.ip_address) {
                  <div class="meta">
                    {{ 'signatures.audit.ip' | translate }}: {{ entry.ip_address }}
                  </div>
                }
                @if (entry.user_agent) {
                  <div class="meta ua">{{ entry.user_agent }}</div>
                }
                @if (reasonOf(entry); as reason) {
                  <div class="meta">{{ 'signatures.audit.reason' | translate }}: {{ reason }}</div>
                }
                @if (entry.document_sha256) {
                  <code class="hash" [title]="entry.document_sha256">
                    {{ 'signatures.audit.documentHash' | translate }}:
                    {{ entry.document_sha256.slice(0, 16) }}…
                  </code>
                }
                @if (entry.receipt) {
                  <div class="meta">
                    {{ 'signatures.audit.receipt' | translate }}: {{ entry.receipt }}
                  </div>
                }
                @if (entry.has_timestamp_token) {
                  <nz-tag nzColor="geekblue">{{ 'signatures.audit.timestamp' | translate }}</nz-tag>
                }
                <code class="hash chainhash" [title]="entry.entry_hash">
                  #{{ entry.sequence }} · {{ entry.entry_hash.slice(0, 12) }}
                </code>
              </nz-timeline-item>
            }
          </nz-timeline>
        </nz-spin>
      </ng-container>
    </nz-drawer>
  `,
  styles: `
    .subject {
      font-weight: 600;
      margin-bottom: 8px;
    }

    .chain {
      margin-bottom: 16px;
    }

    .meta {
      color: var(--ant-color-text-secondary, #6b7280);
      font-size: 12px;
    }

    .ua {
      word-break: break-all;
    }

    .hash {
      display: block;
      font-size: 11px;
      margin-top: 2px;
    }

    .chainhash {
      color: var(--ant-color-text-tertiary, #9ca3af);
    }
  `,
})
export class AuditTimelineDrawerComponent {
  protected readonly store = inject(SignatureCenterStore);

  protected readonly color = (entry: EsigAuditEntry): string => {
    switch (entry.event) {
      case 'recipient_signed':
      case 'envelope_completed':
      case 'identity_verified':
        return 'green';
      case 'recipient_declined':
      case 'envelope_declined':
      case 'envelope_expired':
      case 'envelope_cancelled':
      case 'challenge_failed':
        return 'red';
      case 'reminder_sent':
      case 'timestamp_unavailable':
        return 'orange';
      default:
        return 'blue';
    }
  };

  protected readonly actorName = (entry: EsigAuditEntry): string | null => {
    const name = entry.metadata?.['recipient_name'];
    return typeof name === 'string' && name !== '' ? name : null;
  };

  protected readonly reasonOf = (entry: EsigAuditEntry): string | null => {
    const reason = entry.metadata?.['reason'];
    return typeof reason === 'string' && reason !== '' ? reason : null;
  };

  /** Number of entries, for the specs. */
  readonly count = computed(() => this.store.audit().entries.length);
}
