import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AccountLedgerLine,
  ChartAccountDetail,
  GeneralLedgerApiService,
  I18nService,
  JournalLettering,
  PermissionsService,
} from '@core';
import { IconActionDirective, MoneyPipe, TranslatePipe } from '@shared';
import { currentYearEnd, currentYearStart, rangeEndsBeforeStart } from '../shared/gl-dates';

/** Lettering of ledger lines: select the lines of an account whose debits and credits cancel out and give them a code. */
@Component({
  selector: 'app-gl-lettering',
  styleUrl: './gl-localization.scss',
  imports: [
    FormsModule,
    IconActionDirective,
    MoneyPipe,
    NzButtonModule,
    NzCardModule,
    NzInputModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    TranslatePipe,
  ],
  template: `
    <nz-card class="section" [nzTitle]="'GL.LETTER_TITLE' | translate">
      <p>{{ 'GL.LETTER_HINT' | translate }}</p>
      <div class="filters">
        <nz-select
          class="select-sm"
          nzShowSearch
          [attr.aria-label]="'GL.LETTER_ACCOUNT' | translate"
          [nzPlaceHolder]="'GL.LETTER_ACCOUNT' | translate"
          [(ngModel)]="accountId"
        >
          @for (account of accounts(); track account.id) {
            <nz-option
              [nzValue]="account.id"
              [nzLabel]="(account.account_code ?? '') + ' ' + account.name"
            />
          }
        </nz-select>
        <label for="letter-from">{{ 'GL.FROM' | translate }}</label>
        <input class="date-input" id="letter-from" nz-input type="date" [(ngModel)]="from" />
        <label for="letter-to">{{ 'GL.TO' | translate }}</label>
        <input class="date-input" id="letter-to" nz-input type="date" [(ngModel)]="to" />
        <button
          nz-button
          nzType="primary"
          type="button"
          [disabled]="!accountId || rangeInvalid()"
          [nzLoading]="loading()"
          (click)="load()"
        >
          {{ 'GL.LETTER_LOAD' | translate }}
        </button>
        @if (rangeInvalid()) {
          <span class="ant-form-item-explain-error" role="alert">{{
            'COMMON.VALIDATION.END_AFTER_START' | translate
          }}</span>
        }
      </div>

      @if (loaded()) {
        <nz-table nzSize="small" [nzData]="lines()" [nzShowPagination]="false">
          <thead>
            <tr>
              <th></th>
              <th>{{ 'GL.LETTER_DATE' | translate }}</th>
              <th>{{ 'GL.LETTER_ENTRY' | translate }}</th>
              <th>{{ 'GL.LETTER_DESCRIPTION' | translate }}</th>
              <th class="num">{{ 'GL.LETTER_DEBIT' | translate }}</th>
              <th class="num">{{ 'GL.LETTER_CREDIT' | translate }}</th>
              <th>{{ 'GL.LETTER_CODE' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (line of lines(); track line.line_id) {
              <tr>
                <td>
                  @if (!codeOf(line.line_id) && canWrite) {
                    <input
                      type="checkbox"
                      [attr.aria-label]="'GL.LETTER_SELECT' | translate"
                      [checked]="selected().has(line.line_id)"
                      (change)="toggle(line.line_id)"
                    />
                  }
                </td>
                <td>{{ line.posting_date }}</td>
                <td>{{ line.entry_number }}</td>
                <td>{{ line.description }}</td>
                <td class="num">{{ line.debit | money: currency() }}</td>
                <td class="num">{{ line.credit | money: currency() }}</td>
                <td>
                  @if (codeOf(line.line_id); as code) {
                    <nz-tag nzColor="success">{{ code }}</nz-tag>
                  }
                </td>
              </tr>
            }
          </tbody>
        </nz-table>

        @if (canWrite) {
          <div class="filters">
            <label for="letter-on">{{ 'GL.LETTER_ON' | translate }}</label>
            <input class="date-input" id="letter-on" nz-input type="date" [(ngModel)]="letteredOn" />
            <span>
              {{ 'GL.LETTER_SELECTED' | translate: { count: selected().size } }} -
              {{ 'GL.LETTER_BALANCE' | translate }}: {{ balance() | money: currency() }}
            </span>
            <button
              nz-button
              nzType="primary"
              type="button"
              [disabled]="selected().size < 2 || balance() !== '0.00'"
              [nzLoading]="saving()"
              (click)="letter()"
            >
              {{ 'GL.LETTER_ACTION' | translate }}
            </button>
          </div>
        }
      }
    </nz-card>

    <nz-card class="section" [nzTitle]="'GL.LETTER_LIST' | translate">
      <nz-table nzSize="small" [nzData]="letterings()" [nzShowPagination]="false">
        <thead>
          <tr>
            <th>{{ 'GL.LETTER_CODE' | translate }}</th>
            <th>{{ 'GL.LETTER_ON' | translate }}</th>
            <th class="num">{{ 'GL.LETTER_LINES' | translate }}</th>
            @if (canWrite) {
              <th>{{ 'GL.US_ACTIONS' | translate }}</th>
            }
          </tr>
        </thead>
        <tbody>
          @for (lettering of letterings(); track lettering.lettering_code) {
            <tr>
              <td>{{ lettering.lettering_code }}</td>
              <td>{{ lettering.lettered_on }}</td>
              <td class="num">{{ lettering.line_ids.length }}</td>
              @if (canWrite) {
                <td>
                  <button
                    nz-button
                    nzType="text"
                    nzDanger
                    type="button"
                    appIconAction="delete"
                    nz-popconfirm
                    [nzPopconfirmTitle]="'GL.LETTER_REMOVE_CONFIRM' | translate"
                    (nzOnConfirm)="remove(lettering)"
                  ></button>
                </td>
              }
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>
  `,
})
export class GlLetteringComponent implements OnInit {
  private readonly api = inject(GeneralLedgerApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  protected readonly canWrite = inject(PermissionsService).canWrite('ledger');

  protected readonly accounts = signal<ChartAccountDetail[]>([]);
  protected readonly lines = signal<AccountLedgerLine[]>([]);
  protected readonly letterings = signal<JournalLettering[]>([]);
  protected readonly selected = signal<ReadonlySet<string>>(new Set());
  protected readonly currency = signal('EUR');
  protected readonly loading = signal(false);
  protected readonly loaded = signal(false);
  protected readonly saving = signal(false);

  protected accountId: string | null = null;
  protected from = currentYearStart();
  protected to = currentYearEnd();
  protected letteredOn = new Date().toISOString().slice(0, 10);

  private readonly codeByLine = computed(() => {
    const map = new Map<string, string>();
    for (const lettering of this.letterings()) {
      for (const lineId of lettering.line_ids) {
        map.set(lineId, lettering.lettering_code);
      }
    }

    return map;
  });

  /** Debits minus credits of the selected lines, as a 2-decimal string: lettering needs it to be zero. */
  protected readonly balance = computed(() => {
    const total = this.lines()
      .filter((line) => this.selected().has(line.line_id))
      .reduce((sum, line) => sum + Math.round(Number(line.debit) * 100) - Math.round(Number(line.credit) * 100), 0);

    return (total / 100).toFixed(2);
  });

  ngOnInit(): void {
    this.api.getAccountList({ per_page: 500 }).subscribe({ next: (res) => this.accounts.set(res.data) });
    this.loadLetterings();
  }

  protected rangeInvalid(): boolean {
    return rangeEndsBeforeStart(this.from, this.to);
  }

  protected codeOf(lineId: string): string | undefined {
    return this.codeByLine().get(lineId);
  }

  protected toggle(lineId: string): void {
    const next = new Set(this.selected());
    if (!next.delete(lineId)) {
      next.add(lineId);
    }
    this.selected.set(next);
  }

  protected load(): void {
    if (!this.accountId || this.rangeInvalid()) {
      return;
    }
    this.loading.set(true);
    this.selected.set(new Set());
    this.api
      .getAccountLedger({ account_id: this.accountId, from: this.from, to: this.to, per_page: 500 })
      .subscribe({
        next: (res) => {
          this.loading.set(false);
          this.loaded.set(true);
          this.lines.set(res.data.lines);
          this.currency.set(res.data.currency);
          this.loadLetterings();
        },
        error: () => this.loading.set(false),
      });
  }

  protected letter(): void {
    if (this.selected().size < 2 || this.balance() !== '0.00') {
      return;
    }
    this.saving.set(true);
    this.api.createLettering({ journal_line_ids: [...this.selected()], lettered_on: this.letteredOn || null }).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.message.success(this.i18n.translate('GL.LETTER_DONE', { code: res.data.lettering_code }));
        this.selected.set(new Set());
        this.loadLetterings();
      },
      error: () => this.saving.set(false),
    });
  }

  protected remove(lettering: JournalLettering): void {
    this.api.deleteLettering(lettering.lettering_code).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('GL.LETTER_REMOVED'));
        this.loadLetterings();
      },
    });
  }

  private loadLetterings(): void {
    this.api.getLetterings().subscribe({ next: (res) => this.letterings.set(res.data) });
  }
}
