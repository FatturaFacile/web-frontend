import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { TranslateService } from '@core';
import { TranslatePipe } from '@shared';
import { downloadBlob } from '../../shared/utils/download-blob';
import {
  DOCUMENT_CATEGORIES,
  ItemVerification,
  PreservationItem,
} from './digital-preservation.models';
import { DigitalPreservationStore } from './digital-preservation.store';
import { toIsoDate } from './digital-preservation.utils';
import { HashCellComponent } from './hash-cell.component';

/** Rapid exhibition search (Esibizione a Norma): find a preserved document, verify its hash live, download its PdD. */
@Component({
  selector: 'app-preservation-exhibition',
  styleUrl: './digital-preservation.scss',
  imports: [
    FormsModule,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzDatePickerModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    HashCellComponent,
  ],
  template: `
    <form
      class="filters"
      role="search"
      (submit)="$event.preventDefault(); search()"
      data-testid="exhibition-form"
    >
      <input
        nz-input
        style="width: 160px"
        name="document_number"
        [placeholder]="'PRESERVATION.DOCUMENT_NUMBER' | translate"
        [attr.aria-label]="'PRESERVATION.DOCUMENT_NUMBER' | translate"
        [ngModel]="store.itemFilters().document_number"
        (ngModelChange)="store.setItemFilters({ document_number: $event })"
      />
      <input
        nz-input
        style="width: 200px"
        name="counterparty"
        [placeholder]="'PRESERVATION.COUNTERPARTY' | translate"
        [attr.aria-label]="'PRESERVATION.COUNTERPARTY' | translate"
        [ngModel]="store.itemFilters().counterparty"
        (ngModelChange)="store.setItemFilters({ counterparty: $event })"
      />
      <input
        nz-input
        style="width: 160px"
        name="tax_id"
        [placeholder]="'PRESERVATION.TAX_ID' | translate"
        [attr.aria-label]="'PRESERVATION.TAX_ID' | translate"
        [ngModel]="store.itemFilters().tax_id"
        (ngModelChange)="store.setItemFilters({ tax_id: $event })"
      />
      <input
        nz-input
        style="width: 260px"
        name="sha256"
        [placeholder]="'SHA-256'"
        aria-label="SHA-256"
        [ngModel]="store.itemFilters().sha256"
        (ngModelChange)="store.setItemFilters({ sha256: $event })"
      />
      <nz-range-picker
        name="range"
        [ngModel]="range()"
        (ngModelChange)="setRange($event)"
      ></nz-range-picker>
      <nz-select
        style="width: 200px"
        name="category"
        nzAllowClear
        [nzPlaceHolder]="'PRESERVATION.DOCUMENT_CATEGORY' | translate"
        [ngModel]="store.itemFilters().document_category || null"
        (ngModelChange)="store.setItemFilters({ document_category: $event ?? '' })"
        [attr.aria-label]="'PRESERVATION.DOCUMENT_CATEGORY' | translate"
      >
        @for (c of categories; track c) {
          <nz-option
            [nzValue]="c"
            [nzLabel]="'PRESERVATION.CATEGORY_' + c.toUpperCase() | translate"
          ></nz-option>
        }
      </nz-select>
      <button nz-button nzType="primary" type="submit" data-testid="exhibition-search">
        {{ 'PRESERVATION.SEARCH_ACTION' | translate }}
      </button>
      <button nz-button type="button" (click)="reset()">
        {{ 'PRESERVATION.RESET' | translate }}
      </button>
    </form>

    <nz-table
      #table
      nzSize="middle"
      [nzData]="store.items()"
      [nzFrontPagination]="false"
      [nzLoading]="store.loading()"
      [nzTotal]="store.itemMeta().total"
      [nzPageSize]="store.itemMeta().per_page"
      [nzPageIndex]="store.itemMeta().current_page"
      (nzPageIndexChange)="page($event)"
      data-testid="exhibition-results"
    >
      <thead>
        <tr>
          <th>{{ 'PRESERVATION.DOCUMENT_NUMBER' | translate }}</th>
          <th>{{ 'PRESERVATION.DATE' | translate }}</th>
          <th>{{ 'PRESERVATION.COUNTERPARTY' | translate }}</th>
          <th>{{ 'PRESERVATION.BATCH_NUMBER' | translate }}</th>
          <th>{{ 'PRESERVATION.FORMAT' | translate }}</th>
          <th>SHA-256</th>
          <th>{{ 'PRESERVATION.ACTIONS' | translate }}</th>
        </tr>
      </thead>
      <tbody>
        @for (i of table.data; track i.id) {
          <tr>
            <td>{{ i.document_number ?? i.document_uuid }}</td>
            <td>{{ i.document_date ?? '—' }}</td>
            <td>
              {{ i.counterparty_name ?? '—' }}
              @if (i.counterparty_tax_id) {
                <div class="muted">{{ i.counterparty_tax_id }}</div>
              }
            </td>
            <td>{{ i.batch_number }}</td>
            <td>
              @if (i.pdfa_conformance_level; as level) {
                <nz-tag [nzColor]="i.is_pdfa_compliant ? 'green' : 'orange'">{{ level }}</nz-tag>
              }
            </td>
            <td><app-hash-cell [hash]="i.sha256_hash"></app-hash-cell></td>
            <td>
              <button
                nz-button
                nzSize="small"
                type="button"
                data-testid="verify-item"
                (click)="verify(i)"
              >
                {{ 'PRESERVATION.VERIFY' | translate }}
              </button>
              <button
                nz-button
                nzSize="small"
                nzType="primary"
                type="button"
                data-testid="download-pdd"
                (click)="download(i)"
              >
                {{ 'PRESERVATION.DOWNLOAD_PDD' | translate }}
              </button>
            </td>
          </tr>
        }
      </tbody>
    </nz-table>
    @if (searched() && store.items().length === 0 && !store.loading()) {
      <p class="muted" data-testid="exhibition-empty">
        {{ 'PRESERVATION.NO_RESULTS' | translate }}
      </p>
    }

    <nz-modal
      [nzVisible]="verifying() !== null"
      [nzTitle]="'PRESERVATION.VERIFY_HASH' | translate"
      [nzFooter]="null"
      (nzOnCancel)="closeVerification()"
    >
      <ng-container *nzModalContent>
        @if (verifying(); as v) {
          @if (v.result; as r) {
            <nz-alert
              data-testid="hash-verification"
              [nzType]="r.ok ? 'success' : 'error'"
              nzShowIcon
              [nzMessage]="
                (r.ok ? 'PRESERVATION.HASH_MATCH' : 'PRESERVATION.HASH_MISMATCH') | translate
              "
            ></nz-alert>
            <p class="muted">
              {{ 'PRESERVATION.EXPECTED' | translate }}: <code>{{ r.expected }}</code>
            </p>
            <p class="muted">
              {{ 'PRESERVATION.ACTUAL' | translate }}: <code>{{ r.actual }}</code>
            </p>
          } @else {
            <p>{{ 'PRESERVATION.VERIFYING' | translate }}</p>
          }
        }
      </ng-container>
    </nz-modal>
  `,
})
export class PreservationExhibitionComponent {
  protected readonly store = inject(DigitalPreservationStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly categories = DOCUMENT_CATEGORIES;
  protected readonly range = signal<Date[]>([]);
  protected readonly searched = signal(false);
  protected readonly verifying = signal<{
    item: PreservationItem;
    result: ItemVerification | null;
  } | null>(null);

  protected setRange(range: Date[] | null): void {
    this.range.set(range ?? []);
    this.store.setItemFilters(
      range && range.length === 2
        ? { date_from: toIsoDate(range[0]), date_to: toIsoDate(range[1]) }
        : { date_from: '', date_to: '' },
    );
  }

  protected search(): void {
    this.searched.set(true);
    this.store.searchItems().subscribe();
  }

  protected page(index: number): void {
    this.store.itemFilters.update((f) => ({ ...f, page: index }));
    this.store.searchItems().subscribe();
  }

  protected reset(): void {
    this.range.set([]);
    this.searched.set(false);
    this.store.resetItemFilters();
  }

  protected verify(item: PreservationItem): void {
    this.verifying.set({ item, result: null });
    this.store.verifyItem(item.id).subscribe({
      next: (res) => this.verifying.set({ item, result: res.data }),
      error: () => {
        this.verifying.set(null);
        this.message.error(this.i18n.instant('PRESERVATION.VERIFY_ERROR'));
      },
    });
  }

  protected closeVerification(): void {
    this.verifying.set(null);
  }

  protected download(item: PreservationItem): void {
    this.store.exportItemPdd(item.id).subscribe({
      next: (blob) => downloadBlob(blob, `PdD_${item.document_number ?? item.document_uuid}.zip`),
      error: () => this.message.error(this.i18n.instant('PRESERVATION.EXPORT_FAILED')),
    });
  }
}
