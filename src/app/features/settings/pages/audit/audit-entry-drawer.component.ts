import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AuditEntry, TranslateService } from '@core';
import { TranslatePipe } from '@shared';
import { actionKey, categoryColor, diffRows, isErasedActor } from './audit-ledger.util';

/** One ledger entry in full: who, what, the old/new value of every changed field and the proof (hash chain) of the entry. */
@Component({
  selector: 'app-audit-entry-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    NzDescriptionsModule,
    NzDrawerModule,
    NzEmptyModule,
    NzTableModule,
    NzTagModule,
    TranslatePipe,
  ],
  template: `
    <nz-drawer
      [nzVisible]="entry() !== null"
      [nzWidth]="640"
      [nzTitle]="'settings.audit.detail.title' | translate"
      (nzOnClose)="closed.emit()"
    >
      <ng-container *nzDrawerContent>
        @if (entry(); as e) {
          <nz-descriptions nzBordered nzSize="small" [nzColumn]="1">
            <nz-descriptions-item [nzTitle]="'settings.audit.col.sequence' | translate">
              {{ e.sequence }}
            </nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'settings.audit.col.occurred_at' | translate">
              {{ e.occurred_at | date: 'yyyy-MM-dd HH:mm:ss.SSS' : 'UTC' }} UTC
            </nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'settings.audit.col.action' | translate">
              <nz-tag [nzColor]="categoryColor(e.category)">
                {{ actionLabel(e.action) | translate }}
              </nz-tag>
            </nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'settings.audit.col.actor' | translate">
              {{ actorLabel(e.display_actor) }}
            </nz-descriptions-item>
            @if (e.display_impersonator) {
              <nz-descriptions-item [nzTitle]="'settings.audit.detail.impersonator' | translate">
                {{ actorLabel(e.display_impersonator) }}
              </nz-descriptions-item>
            }
            <nz-descriptions-item [nzTitle]="'settings.audit.col.resource' | translate">
              {{ e.resource_type }} {{ e.resource_id }}
            </nz-descriptions-item>
          </nz-descriptions>

          <h4 class="section-title">{{ 'settings.audit.detail.changes' | translate }}</h4>
          @if (rows().length === 0) {
            <nz-empty [nzNotFoundContent]="'settings.audit.detail.no_changes' | translate" />
          } @else {
            <nz-table #diff [nzData]="rows()" nzSize="small" [nzShowPagination]="false">
              <thead>
                <tr>
                  <th>{{ 'settings.audit.detail.field' | translate }}</th>
                  <th>{{ 'settings.audit.detail.old' | translate }}</th>
                  <th>{{ 'settings.audit.detail.new' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (row of diff.data; track row.field) {
                  <tr>
                    <td class="mono">{{ row.field }}</td>
                    <td class="old">{{ row.old }}</td>
                    <td class="new">{{ row.new }}</td>
                  </tr>
                }
              </tbody>
            </nz-table>
          }

          <h4 class="section-title">{{ 'settings.audit.detail.proof' | translate }}</h4>
          <nz-descriptions nzBordered nzSize="small" [nzColumn]="1">
            <nz-descriptions-item [nzTitle]="'settings.audit.detail.hash' | translate">
              <span class="mono">{{ e.hash }}</span>
            </nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'settings.audit.detail.previous_hash' | translate">
              <span class="mono">{{ e.previous_hash }}</span>
            </nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'settings.audit.detail.key_version' | translate">
              {{ e.key_version ?? '—' }}
            </nz-descriptions-item>
          </nz-descriptions>

          @if (contextRows().length > 0) {
            <h4 class="section-title">{{ 'settings.audit.detail.context' | translate }}</h4>
            <nz-descriptions nzBordered nzSize="small" [nzColumn]="1">
              @for (row of contextRows(); track row.key) {
                <nz-descriptions-item [nzTitle]="row.label | translate">
                  {{ row.value }}
                </nz-descriptions-item>
              }
            </nz-descriptions>
          }
        }
      </ng-container>
    </nz-drawer>
  `,
  styles: `
    .section-title {
      margin: 20px 0 8px;
    }
    .mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      word-break: break-all;
    }
    .old {
      color: var(--ant-error-color, #cf1322);
      word-break: break-word;
    }
    .new {
      color: var(--ant-success-color, #389e0d);
      word-break: break-word;
    }
  `,
})
export class AuditEntryDrawerComponent {
  private readonly i18n = inject(TranslateService);

  readonly entry = input<AuditEntry | null>(null);
  readonly closed = output<void>();

  protected readonly categoryColor = categoryColor;
  protected readonly rows = computed(() => diffRows(this.entry()?.changes));

  /** Context keys with a label of their own; other context values stay out of the drawer (they are in the signed export). */
  protected readonly contextRows = computed(() => {
    const context = this.entry()?.context ?? {};
    const known: Record<string, string> = {
      ip: 'settings.audit.detail.ip',
      user_agent: 'settings.audit.detail.user_agent',
      request_id: 'settings.audit.detail.request_id',
    };
    return Object.entries(known)
      .filter(([key]) => typeof context[key] === 'string' && context[key] !== '')
      .map(([key, label]) => ({ key, label, value: String(context[key]) }));
  });

  protected actionLabel(action: string): string {
    return actionKey(action, (key) => this.i18n.translate(key) !== key);
  }

  protected actorLabel(label: string | null): string {
    if (label === null || label === '') {
      return this.i18n.translate('settings.audit.system_actor');
    }
    return isErasedActor(label) ? this.i18n.translate('settings.audit.erased') : label;
  }
}
