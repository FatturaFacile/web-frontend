import {
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
  untracked,
} from '@angular/core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AuditLogDetail, AuditTrailApiService, TranslateService } from '@core';
import { TranslatePipe } from '@shared';
import { diffAuditValues } from './audit-diff';
import { eventColor, eventLabelKey, formatMicroTimestamp } from './audit-presentation';

/**
 * Forensic detail of one audit record: the before/after field diff (masked fields stay masked) and the cryptographic
 * proof card (sequence, previous and current hash, HMAC, request id, user agent, WORM batch). Opening a record is itself
 * written to the trail by the API.
 */
@Component({
  selector: 'app-audit-detail-drawer',
  styleUrl: './audit-trail.scss',
  imports: [
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzDescriptionsModule,
    NzDrawerModule,
    NzEmptyModule,
    NzSpinModule,
    NzTagModule,
    TranslatePipe,
  ],
  template: `
    <nz-drawer
      [nzVisible]="open()"
      nzPlacement="right"
      nzWidth="760px"
      [nzTitle]="'AUDIT.DETAIL.TITLE' | translate"
      (nzOnClose)="open.set(false)"
    >
      <ng-container *nzDrawerContent>
        <nz-spin [nzSpinning]="loading()">
          @if (error()) {
            <nz-alert nzType="error" nzShowIcon [nzMessage]="error()"></nz-alert>
          }
          @if (detail(); as d) {
            <p class="notice">{{ 'AUDIT.DETAIL.INSPECT_NOTICE' | translate }}</p>

            <nz-descriptions nzBordered nzSize="small" [nzColumn]="1">
              <nz-descriptions-item [nzTitle]="'AUDIT.COL.EVENT' | translate">
                <nz-tag [nzColor]="color(d.event_type)">{{
                  label(d.event_type) | translate
                }}</nz-tag>
              </nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'AUDIT.COL.ENTITY' | translate">
                {{ d.auditable_type }} <span class="mono">{{ d.auditable_id }}</span>
              </nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'AUDIT.COL.ACTOR' | translate">
                {{ d.actor.email ?? d.actor.type }}
                @if (d.actor.role) {
                  <nz-tag>{{ d.actor.role }}</nz-tag>
                }
              </nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'AUDIT.COL.IP' | translate">{{
                d.ip_address ?? '-'
              }}</nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'AUDIT.COL.OCCURRED_AT' | translate">
                <span class="mono">{{ timestamp(d.occurred_at) }} UTC</span>
              </nz-descriptions-item>
            </nz-descriptions>

            <nz-card class="proof" nzSize="small" [nzTitle]="'AUDIT.DETAIL.DIFF' | translate">
              @if (rows().length) {
                <table class="diff" [attr.aria-label]="'AUDIT.DETAIL.TITLE' | translate">
                  <thead>
                    <tr>
                      <th class="kind"></th>
                      <th>{{ 'AUDIT.DETAIL.FIELD' | translate }}</th>
                      <th>{{ 'AUDIT.DETAIL.BEFORE' | translate }}</th>
                      <th>{{ 'AUDIT.DETAIL.AFTER' | translate }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of rows(); track row.field) {
                      <tr [class]="row.kind">
                        <td class="kind">
                          @switch (row.kind) {
                            @case ('added') {
                              <nz-tag nzColor="green">{{
                                'AUDIT.DETAIL.ADDED' | translate
                              }}</nz-tag>
                            }
                            @case ('removed') {
                              <nz-tag nzColor="red">{{
                                'AUDIT.DETAIL.REMOVED' | translate
                              }}</nz-tag>
                            }
                            @case ('modified') {
                              <nz-tag nzColor="orange">{{
                                'AUDIT.DETAIL.MODIFIED' | translate
                              }}</nz-tag>
                            }
                          }
                        </td>
                        <td class="field">{{ row.field }}</td>
                        <td class="before mono">{{ row.before ?? '' }}</td>
                        <td class="after mono">{{ row.after ?? '' }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              } @else {
                <nz-empty [nzNotFoundContent]="'AUDIT.DETAIL.NO_PAYLOAD' | translate"></nz-empty>
              }
            </nz-card>

            <nz-card class="proof" nzSize="small" [nzTitle]="'AUDIT.PROOF.TITLE' | translate">
              <nz-descriptions nzBordered nzSize="small" [nzColumn]="1">
                <nz-descriptions-item [nzTitle]="'AUDIT.PROOF.SEQUENCE' | translate">
                  <strong>{{ d.proof.sequence_number }}</strong>
                </nz-descriptions-item>
                <nz-descriptions-item [nzTitle]="'AUDIT.PROOF.PREVIOUS_HASH' | translate">
                  <div class="proof-row">
                    <span class="mono">{{ d.proof.previous_hash }}</span>
                    <button nz-button nzSize="small" (click)="copy(d.proof.previous_hash)">
                      {{ 'AUDIT.PROOF.COPY' | translate }}
                    </button>
                  </div>
                </nz-descriptions-item>
                <nz-descriptions-item [nzTitle]="'AUDIT.PROOF.CURRENT_HASH' | translate">
                  <div class="proof-row">
                    <span class="mono">{{ d.proof.current_hash }}</span>
                    <button nz-button nzSize="small" (click)="copy(d.proof.current_hash)">
                      {{ 'AUDIT.PROOF.COPY' | translate }}
                    </button>
                  </div>
                </nz-descriptions-item>
                <nz-descriptions-item [nzTitle]="'AUDIT.PROOF.HMAC' | translate">
                  <div class="proof-row">
                    <span class="mono">{{ d.proof.hmac_signature }}</span>
                    <button nz-button nzSize="small" (click)="copy(d.proof.hmac_signature)">
                      {{ 'AUDIT.PROOF.COPY' | translate }}
                    </button>
                  </div>
                </nz-descriptions-item>
                <nz-descriptions-item [nzTitle]="'AUDIT.PROOF.REQUEST_ID' | translate">
                  <div class="proof-row">
                    <span class="mono">{{ d.proof.request_id ?? '-' }}</span>
                    @if (d.proof.request_id) {
                      <button nz-button nzSize="small" (click)="copy(d.proof.request_id)">
                        {{ 'AUDIT.PROOF.COPY' | translate }}
                      </button>
                    }
                  </div>
                </nz-descriptions-item>
                <nz-descriptions-item [nzTitle]="'AUDIT.PROOF.USER_AGENT' | translate">
                  <span class="mono">{{ d.user_agent ?? '-' }}</span>
                </nz-descriptions-item>
                <nz-descriptions-item [nzTitle]="'AUDIT.PROOF.WORM_BATCH' | translate">
                  @if (d.proof.worm_batch; as batch) {
                    <div>
                      #{{ batch.from_sequence }}–#{{ batch.to_sequence }} · {{ batch.record_count }}
                    </div>
                    <div class="mono">{{ batch.merkle_root_hash }}</div>
                    <div class="mono">{{ batch.storage_path }}</div>
                  } @else {
                    <nz-tag nzColor="gold">{{ 'AUDIT.PROOF.NOT_SEALED' | translate }}</nz-tag>
                  }
                </nz-descriptions-item>
              </nz-descriptions>
            </nz-card>
          }
        </nz-spin>
      </ng-container>
    </nz-drawer>
  `,
})
export class AuditDetailDrawerComponent {
  private readonly api = inject(AuditTrailApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  readonly logId = input<string | null>(null);
  readonly open = model(false);

  readonly detail = signal<AuditLogDetail | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly rows = computed(() => {
    const detail = this.detail();
    return detail ? diffAuditValues(detail.old_values, detail.new_values) : [];
  });

  protected readonly color = eventColor;
  protected readonly label = eventLabelKey;
  protected readonly timestamp = formatMicroTimestamp;

  constructor() {
    effect(() => {
      const id = this.logId();
      if (this.open() && id) {
        untracked(() => this.load(id));
      }
    });
  }

  copy(value: string): void {
    void navigator.clipboard
      ?.writeText(value)
      .then(() => this.message.success(this.i18n.instant('AUDIT.PROOF.COPIED')));
  }

  private load(id: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.detail.set(null);
    this.api.get(id).subscribe({
      next: (response) => {
        this.detail.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(this.i18n.instant('AUDIT.ERROR.LOAD'));
        this.loading.set(false);
      },
    });
  }
}
