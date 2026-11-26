import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTimelineModule } from 'ng-zorro-antd/timeline';
import { AuditHistoryItem, AuditLedgerApiService, TranslateService } from '@core';
import { TranslatePipe } from '@shared';
import { actionKey, categoryColor, failureOf, isErasedActor, AuditFailure } from './audit-ledger.util';

/**
 * The history of one record from the probative audit ledger, as a timeline:
 * `<app-record-history-tab resourceType="Invoice" [resourceId]="invoice.id" />`. The API decides who may see it (read access to
 * the module of the record), so the tab shows a message on a 403 instead of checking the permission itself.
 */
@Component({
  selector: 'app-record-history-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    NzAlertModule,
    NzButtonModule,
    NzEmptyModule,
    NzSkeletonModule,
    NzTagModule,
    NzTimelineModule,
    TranslatePipe,
  ],
  template: `
    <section [attr.aria-label]="'audit.history.title' | translate">
      <h4>{{ 'audit.history.title' | translate }}</h4>
      @if (loading()) {
        <nz-skeleton [nzActive]="true" />
      } @else if (failure(); as why) {
        <nz-alert
          nzType="error"
          nzShowIcon
          [nzMessage]="(why === 'forbidden' ? 'audit.history.forbidden' : 'audit.history.error') | translate"
        />
        @if (why !== 'forbidden') {
          <button nz-button nzSize="small" (click)="reload()">
            {{ 'audit.history.retry' | translate }}
          </button>
        }
      } @else if (items().length === 0) {
        <nz-empty [nzNotFoundContent]="'audit.history.empty' | translate" />
      } @else {
        <nz-timeline>
          @for (item of items(); track item.id) {
            <nz-timeline-item [nzColor]="color(item.category)">
              <div class="line">
                <nz-tag [nzColor]="color(item.category)">{{ label(item.action) | translate }}</nz-tag>
                <span>{{ 'audit.history.by' | translate: { actor: actor(item.display_actor) } }}</span>
                @if (item.channel) {
                  <span class="muted">{{ 'audit.history.via' | translate: { channel: item.channel } }}</span>
                }
              </div>
              @if (item.display_impersonator) {
                <div class="muted">
                  {{
                    'audit.history.impersonated_by'
                      | translate: { actor: actor(item.display_impersonator) }
                  }}
                </div>
              }
              <div class="muted mono">{{ item.occurred_at | date: 'yyyy-MM-dd HH:mm:ss' : 'UTC' }} UTC</div>
              @if (item.changed_fields.length > 0) {
                <div class="fields">
                  <span class="muted">{{ 'audit.history.fields' | translate }}:</span>
                  @for (field of item.changed_fields; track field) {
                    <nz-tag>{{ field }}</nz-tag>
                  }
                </div>
              }
            </nz-timeline-item>
          }
        </nz-timeline>
      }
    </section>
  `,
  styles: `
    .line {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    .muted {
      color: var(--ant-text-color-secondary, #8c8c8c);
    }
    .mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .fields {
      margin-top: 4px;
    }
  `,
})
export class RecordHistoryTabComponent {
  private readonly api = inject(AuditLedgerApiService);
  private readonly i18n = inject(TranslateService);

  /** The audited class of the record: Invoice, Contact, Payment, User. */
  readonly resourceType = input.required<string>();
  readonly resourceId = input.required<string | null | undefined>();

  protected readonly items = signal<AuditHistoryItem[]>([]);
  protected readonly loading = signal(false);
  protected readonly failure = signal<AuditFailure | null>(null);
  private readonly attempt = signal(0);

  protected readonly color = categoryColor;

  constructor() {
    effect(() => {
      const type = this.resourceType();
      const id = this.resourceId();
      this.attempt();
      if (id) {
        untracked(() => this.load(type, id));
      }
    });
  }

  protected reload(): void {
    this.attempt.update((n) => n + 1);
  }

  protected label(action: string): string {
    return actionKey(action, (key) => this.i18n.translate(key) !== key);
  }

  protected actor(label: string | null): string {
    if (label === null || label === '') {
      return this.i18n.translate('settings.audit.system_actor');
    }
    return isErasedActor(label) ? this.i18n.translate('settings.audit.erased') : label;
  }

  private load(type: string, id: string): void {
    this.loading.set(true);
    this.failure.set(null);
    this.api.history(type, id).subscribe({
      next: (response) => {
        this.items.set(response.data);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.items.set([]);
        this.failure.set(failureOf(error));
        this.loading.set(false);
      },
    });
  }
}
