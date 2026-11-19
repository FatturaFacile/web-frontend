import { DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  ControllingApiService,
  LEDGER_NATURES,
  AnalyticalLedgerEntry,
  LedgerNature,
  TranslateService,
} from '@core';
import { TranslatePipe } from '@shared';

function isoDate(value: Date | null): string | undefined {
  return value ? value.toISOString().slice(0, 10) : undefined;
}

function errorText(error: unknown): string | null {
  const body = (error as { error?: { message?: unknown; errors?: Record<string, unknown> } })
    ?.error;
  const first = Object.values(body?.errors ?? {})[0];
  if (Array.isArray(first) && typeof first[0] === 'string') return first[0];
  return typeof body?.message === 'string' ? body.message : null;
}

/** Analytical journal: filterable list of ledger entries and manual analytical adjustments. */
@Component({
  selector: 'app-controlling-ledger',
  styleUrl: './controlling.scss',
  imports: [
    DecimalPipe,
    FormsModule,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzDatePickerModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <nz-card [nzTitle]="'CONTROLLING.LEDGER_NEW' | translate" class="main-card">
      <div class="toolbar">
        <nz-date-picker
          [(ngModel)]="postingDate"
          [attr.aria-label]="'CONTROLLING.LEDGER_POSTING_DATE' | translate"
        />
        <nz-select
          style="width: 200px"
          [(ngModel)]="nature"
          [attr.aria-label]="'CONTROLLING.LEDGER_NATURE' | translate"
        >
          @for (n of natures; track n) {
            <nz-option
              [nzValue]="n"
              [nzLabel]="'CONTROLLING.NATURE.' + n.toUpperCase() | translate"
            />
          }
        </nz-select>
        <nz-input-number
          [(ngModel)]="amount"
          [nzStep]="100"
          [attr.aria-label]="'CONTROLLING.AMOUNT' | translate"
        />
        <input
          nz-input
          style="width: 160px"
          [(ngModel)]="accountCode"
          [placeholder]="'CONTROLLING.LEDGER_ACCOUNT' | translate"
        />
        <input
          nz-input
          style="width: 260px"
          [(ngModel)]="description"
          [placeholder]="'CONTROLLING.LEDGER_DESCRIPTION' | translate"
        />
        <button
          nz-button
          nzType="primary"
          [disabled]="!canSave()"
          [nzLoading]="saving()"
          (click)="save()"
        >
          {{ 'CONTROLLING.LEDGER_ADD' | translate }}
        </button>
      </div>
    </nz-card>

    <nz-card [nzTitle]="'CONTROLLING.LEDGER_TITLE' | translate" class="main-card">
      <div class="toolbar">
        <nz-range-picker [(ngModel)]="range" (ngModelChange)="reload()" />
        <nz-select
          style="width: 200px"
          nzAllowClear
          [(ngModel)]="natureFilter"
          (ngModelChange)="reload()"
          [nzPlaceHolder]="'CONTROLLING.LEDGER_NATURE' | translate"
        >
          @for (n of natures; track n) {
            <nz-option
              [nzValue]="n"
              [nzLabel]="'CONTROLLING.NATURE.' + n.toUpperCase() | translate"
            />
          }
        </nz-select>
      </div>
      <nz-table
        nzSize="small"
        nzFrontPagination="false"
        [nzData]="entries()"
        [nzLoading]="loading()"
        [nzTotal]="total()"
        [nzPageSize]="25"
        [nzPageIndex]="page()"
        (nzPageIndexChange)="goTo($event)"
      >
        <thead>
          <tr>
            <th>{{ 'CONTROLLING.LEDGER_POSTING_DATE' | translate }}</th>
            <th>{{ 'CONTROLLING.LEDGER_NATURE' | translate }}</th>
            <th>{{ 'CONTROLLING.LEDGER_ACCOUNT' | translate }}</th>
            <th>{{ 'CONTROLLING.LEDGER_SOURCE' | translate }}</th>
            <th>{{ 'CONTROLLING.LEDGER_DESCRIPTION' | translate }}</th>
            <th class="num">{{ 'CONTROLLING.AMOUNT' | translate }}</th>
            <th>{{ 'CONTROLLING.STATUS' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (entry of entries(); track entry.id) {
            <tr>
              <td>{{ entry.posting_date }}</td>
              <td>{{ 'CONTROLLING.NATURE.' + entry.nature_type.toUpperCase() | translate }}</td>
              <td>{{ entry.account_code ?? '-' }}</td>
              <td>
                {{ 'CONTROLLING.LEDGER_SOURCES.' + entry.source_type.toUpperCase() | translate }}
              </td>
              <td>{{ entry.description ?? '-' }}</td>
              <td class="num">{{ entry.amount | number: '1.2-2' }}</td>
              <td>
                <nz-tag [nzColor]="entry.is_allocated ? 'green' : 'default'">{{
                  (entry.is_allocated ? 'CONTROLLING.LEDGER_ALLOCATED' : 'CONTROLLING.LEDGER_OPEN')
                    | translate
                }}</nz-tag>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>
  `,
})
export class ControllingLedgerComponent implements OnInit {
  private readonly api = inject(ControllingApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  protected readonly natures = LEDGER_NATURES;
  protected readonly entries = signal<AnalyticalLedgerEntry[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly total = signal(0);
  protected readonly page = signal(1);

  protected range: Date[] = [];
  protected natureFilter: LedgerNature | null = null;

  protected postingDate: Date | null = new Date();
  protected nature: LedgerNature = 'opex';
  protected amount: number | null = null;
  protected accountCode = '';
  protected description = '';

  ngOnInit(): void {
    this.load();
  }

  protected canSave(): boolean {
    return !!this.postingDate && this.amount !== null && !this.saving();
  }

  protected reload(): void {
    this.page.set(1);
    this.load();
  }

  protected goTo(page: number): void {
    this.page.set(page);
    this.load();
  }

  protected save(): void {
    if (!this.postingDate || this.amount === null) return;
    this.saving.set(true);
    this.api
      .createLedgerEntry({
        posting_date: isoDate(this.postingDate) ?? '',
        nature_type: this.nature,
        amount: this.amount,
        account_code: this.accountCode || null,
        description: this.description || null,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.amount = null;
          this.description = '';
          this.message.success(this.translate.instant('CONTROLLING.LEDGER_SAVED'));
          this.reload();
        },
        error: (error) => {
          this.saving.set(false);
          this.message.error(
            errorText(error) ?? this.translate.instant('CONTROLLING.ACTION_FAILED'),
          );
        },
      });
  }

  private load(): void {
    this.loading.set(true);
    this.api
      .getLedgerEntries({
        date_from: isoDate(this.range[0] ?? null),
        date_to: isoDate(this.range[1] ?? null),
        nature_type: this.natureFilter ?? undefined,
        page: this.page(),
      })
      .subscribe({
        next: (response) => {
          this.entries.set(response.data);
          this.total.set(response.meta?.total ?? response.data.length);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }
}
