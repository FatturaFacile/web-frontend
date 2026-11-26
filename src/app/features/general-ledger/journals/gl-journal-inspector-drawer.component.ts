import { Component, computed, inject, input, output } from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AuthStore, GlJournalEntry, ledgerBookOfType } from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';
import { GlLookupStore } from '../shared/gl-lookup.store';

/** Read-only inspector of a journal entry: header, approval trail, lines with Dare / Avere totals and the one-click storno. */
@Component({
  selector: 'app-gl-journal-inspector-drawer',
  imports: [
    NzButtonModule,
    NzDescriptionsModule,
    NzDrawerModule,
    NzPopconfirmModule,
    NzTagModule,
    MoneyPipe,
    TranslatePipe,
  ],
  template: `
    <nz-drawer
      [nzVisible]="entry() !== null"
      [nzWidth]="720"
      [nzTitle]="'GL.INSPECTOR_TITLE' | translate"
      (nzOnClose)="closed.emit()"
    >
      <ng-container *nzDrawerContent>
        @if (entry(); as e) {
          <nz-descriptions nzBordered nzSize="small" [nzColumn]="{ xs: 1, md: 2 }">
            <nz-descriptions-item [nzTitle]="'GL.COL_ENTRY' | translate">{{
              e.entry_number
            }}</nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'GL.STATUS' | translate">
              <nz-tag>{{ 'GL.JOURNAL_STATUS_' + e.status.toUpperCase() | translate }}</nz-tag>
              @if (e.fiduciary_verified) {
                <nz-tag nzColor="cyan">{{ 'fiduciaryPortal.badge.verified' | translate }}</nz-tag>
              }
            </nz-descriptions-item>
            @if (e.fiduciary_verification_note) {
              <nz-descriptions-item [nzTitle]="'fiduciaryPortal.badge.verified' | translate" [nzSpan]="2">{{
                e.fiduciary_verification_note
              }}</nz-descriptions-item>
            }
            <nz-descriptions-item [nzTitle]="'GL.COL_DATE' | translate">{{
              e.posting_date
            }}</nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'GL.PN_BOOK' | translate">{{
              'GL.PN_BOOK_' + book() | translate
            }}</nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'GL.COL_DESCRIPTION' | translate" [nzSpan]="2">{{
              e.description
            }}</nz-descriptions-item>
            @if (e.rejection_reason) {
              <nz-descriptions-item [nzTitle]="'GL.REJECTION_REASON' | translate" [nzSpan]="2">{{
                e.rejection_reason
              }}</nz-descriptions-item>
            }
            @if (e.auto_reverse_on) {
              <nz-descriptions-item [nzTitle]="'GL.COL_AUTO_REVERSE' | translate" [nzSpan]="2">{{
                e.auto_reverse_on
              }}</nz-descriptions-item>
            }
          </nz-descriptions>

          <table class="inspector-lines">
            <caption class="sr-only">
              {{
                'GL.PN_LINES' | translate
              }}
            </caption>
            <thead>
              <tr>
                <th scope="col">{{ 'GL.COL_ACCOUNT' | translate }}</th>
                <th scope="col">{{ 'GL.COL_DESCRIPTION' | translate }}</th>
                <th scope="col" class="num">{{ 'GL.COL_DEBIT' | translate }}</th>
                <th scope="col" class="num">{{ 'GL.COL_CREDIT' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (line of e.lines ?? []; track line.id) {
                <tr>
                  <td>{{ lookups.accountLabel(line.account_id) }}</td>
                  <td>{{ line.description }}</td>
                  <td class="num">
                    {{ line.functional_debit ?? line.debit_amount | money: currency() }}
                  </td>
                  <td class="num">
                    {{ line.functional_credit ?? line.credit_amount | money: currency() }}
                  </td>
                </tr>
              }
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" colspan="2">{{ 'GL.COL_TOTAL' | translate }}</th>
                <td class="num">{{ totals().debit | money: currency() }}</td>
                <td class="num">{{ totals().credit | money: currency() }}</td>
              </tr>
            </tfoot>
          </table>

          @if (canStorno()) {
            <button
              nz-button
              nzDanger
              type="button"
              data-testid="inspector-storno"
              nz-popconfirm
              [nzPopconfirmTitle]="'GL.CONFIRM_REVERSE' | translate"
              (nzOnConfirm)="storno.emit(e)"
            >
              {{ 'GL.ACTION_REVERSE' | translate }}
            </button>
          }
        }
      </ng-container>
    </nz-drawer>
  `,
  styles: `
    .inspector-lines {
      width: 100%;
      margin: 16px 0;
      border-collapse: collapse;
    }
    .inspector-lines th,
    .inspector-lines td {
      padding: 4px 6px;
      text-align: left;
    }
    .inspector-lines .num {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
    }
  `,
})
export class GlJournalInspectorDrawerComponent {
  readonly entry = input<GlJournalEntry | null>(null);
  readonly canWrite = input(false);
  readonly closed = output<void>();
  readonly storno = output<GlJournalEntry>();

  protected readonly lookups = inject(GlLookupStore);
  protected readonly currency = inject(AuthStore).activeCurrency;

  protected readonly book = computed(() =>
    ledgerBookOfType(this.entry()?.ledger_type ?? 'statutory'),
  );
  protected readonly canStorno = computed(
    () => this.canWrite() && this.entry()?.status === 'posted',
  );
  protected readonly totals = computed(() => {
    const lines = this.entry()?.lines ?? [];
    const sum = (pick: (line: (typeof lines)[number]) => number | string | null) =>
      lines.reduce((total, line) => total + Number(pick(line) ?? 0), 0);
    return {
      debit: sum((line) => line.functional_debit ?? line.debit_amount),
      credit: sum((line) => line.functional_credit ?? line.credit_amount),
    };
  });
}
