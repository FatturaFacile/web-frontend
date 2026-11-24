import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { I18nService } from '@core/i18n';
import { RfqApiService } from '@data-access/procurement/rfq-api.service';
import {
  AwardMode,
  AwardRfqPayload,
  MatrixCell,
  MatrixColumn,
  MatrixRow,
} from '@domain/procurement/rfq.models';
import { RfqStore } from '@features/procurement/rfq/rfq.store';
import { DateFormatPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';

export interface PoAwardPreviewLine {
  rfq_line_id: string;
  supplier_bid_line_id: string;
  description: string;
  quantity: string;
  unit_of_measure: string;
  net_unit_price: string;
  line_total_net: string;
}

export interface PoAwardPreview {
  supplier_id: string;
  supplier_name: string;
  bid_id: string;
  currency_code: string;
  shipping_cost: string;
  net_subtotal: number;
  total_with_shipping: number;
  lines: PoAwardPreviewLine[];
}

@Component({
  selector: 'app-bid-comparison-matrix',
  imports: [
    DecimalPipe,
    FormsModule,
    RouterLink,
    PageHeaderComponent,
    TranslatePipe,
    DateFormatPipe,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzDrawerModule,
    NzEmptyModule,
    NzInputModule,
    NzSpinModule,
    NzTagModule,
  ],
  templateUrl: './bid-comparison-matrix.component.html',
  styleUrl: './bid-comparison-matrix.component.scss',
})
export class BidComparisonMatrixComponent implements OnInit {
  readonly rfqIdInput = input<string | null>(null);

  readonly store = inject(RfqStore);
  private readonly api = inject(RfqApiService);
  private readonly route = inject(ActivatedRoute, { optional: true });
  private readonly i18n = inject(I18nService);
  private readonly message = inject(NzMessageService);

  readonly activeRfqId = signal<string>('');
  readonly selectedLineAwards = signal<Record<string, string>>({});
  readonly awardDrawerOpen = signal<boolean>(false);
  readonly awardNotes = signal<string>('');
  readonly awarding = signal<boolean>(false);

  readonly matrix = this.store.matrix;

  readonly selectedCount = computed(() => Object.keys(this.selectedLineAwards()).length);

  readonly resolvedAwardMode = computed<AwardMode>(() => {
    const m = this.matrix();
    const selections = this.selectedLineAwards();
    if (!m || m.rows.length === 0) {
      return 'split';
    }

    const selectedEntries = Object.entries(selections);
    if (selectedEntries.length !== m.rows.length) {
      return 'split';
    }

    const bidIds = new Set<string>();
    for (const [rowId, bidLineId] of selectedEntries) {
      const row = m.rows.find((r) => r.rfq_line_id === rowId);
      const cell = row?.cells.find((c) => c.supplier_bid_line_id === bidLineId);
      if (!cell || cell.is_no_bid) {
        return 'split';
      }
      bidIds.add(cell.bid_id);
    }

    if (bidIds.size !== 1) {
      return 'split';
    }

    const singleBidId = Array.from(bidIds)[0];
    const column = m.columns.find((col) => col.bid_id === singleBidId);
    return column?.covers_all_lines ? 'full' : 'split';
  });

  readonly singleAwardColumn = computed<MatrixColumn | null>(() => {
    if (this.resolvedAwardMode() !== 'full') {
      return null;
    }
    const m = this.matrix();
    const firstBidLineId = Object.values(this.selectedLineAwards())[0];
    if (!m || !firstBidLineId) {
      return null;
    }
    for (const row of m.rows) {
      const cell = row.cells.find((c) => c.supplier_bid_line_id === firstBidLineId);
      if (cell) {
        return m.columns.find((col) => col.bid_id === cell.bid_id) ?? null;
      }
    }
    return null;
  });

  readonly groupedPoPreviews = computed<PoAwardPreview[]>(() => {
    const m = this.matrix();
    const selections = this.selectedLineAwards();
    if (!m) {
      return [];
    }

    const groups = new Map<string, PoAwardPreview>();

    for (const row of m.rows) {
      const chosenBidLineId = selections[row.rfq_line_id];
      if (!chosenBidLineId) {
        continue;
      }
      const cell = row.cells.find((c) => c.supplier_bid_line_id === chosenBidLineId);
      if (!cell || !cell.supplier_bid_line_id || cell.is_no_bid) {
        continue;
      }
      const col = m.columns.find((c) => c.bid_id === cell.bid_id);
      if (!col) {
        continue;
      }

      const lineTotal = Number(cell.line_total_net ?? 0);
      let group = groups.get(col.supplier_id);
      if (!group) {
        const shipping = Number(col.shipping_cost ?? 0);
        group = {
          supplier_id: col.supplier_id,
          supplier_name: col.supplier_name,
          bid_id: cell.bid_id,
          currency_code: col.currency_code ?? m.currency_code,
          shipping_cost: col.shipping_cost ?? '0.0000',
          net_subtotal: 0,
          total_with_shipping: Number.isFinite(shipping) ? shipping : 0,
          lines: [],
        };
        groups.set(col.supplier_id, group);
      }

      group.net_subtotal += Number.isFinite(lineTotal) ? lineTotal : 0;
      group.total_with_shipping += Number.isFinite(lineTotal) ? lineTotal : 0;
      group.lines.push({
        rfq_line_id: row.rfq_line_id,
        supplier_bid_line_id: cell.supplier_bid_line_id,
        description: row.description,
        quantity: cell.quoted_quantity ?? row.quantity,
        unit_of_measure: row.unit_of_measure,
        net_unit_price: cell.net_unit_price ?? '0',
        line_total_net: cell.line_total_net ?? '0',
      });
    }

    return Array.from(groups.values());
  });

  readonly winnerCount = computed(() => this.groupedPoPreviews().length);

  readonly regretCount = computed(() => {
    const m = this.matrix();
    if (!m) {
      return 0;
    }
    const winners = new Set(this.groupedPoPreviews().map((po) => po.supplier_id));
    return m.invitations.filter(
      (inv) => !winners.has(inv.supplier_id) && inv.status !== 'declined',
    ).length;
  });

  ngOnInit(): void {
    const id = this.rfqIdInput() ?? this.route?.snapshot.paramMap.get('id') ?? '';
    if (id) {
      this.activeRfqId.set(id);
      this.store.loadMatrix(id).subscribe();
    }
  }

  cellForColumn(row: MatrixRow, col: MatrixColumn): MatrixCell | undefined {
    if (!col.bid_id) {
      return undefined;
    }
    return row.cells.find((c) => c.bid_id === col.bid_id);
  }

  isCellSelected(rowId: string, cell: MatrixCell | undefined): boolean {
    if (!cell || !cell.supplier_bid_line_id) {
      return false;
    }
    return this.selectedLineAwards()[rowId] === cell.supplier_bid_line_id;
  }

  selectCell(row: MatrixRow, cell: MatrixCell | undefined): void {
    const m = this.matrix();
    if (!m || !m.can_award || m.is_sealed || !cell || cell.is_no_bid || !cell.supplier_bid_line_id) {
      return;
    }

    this.selectedLineAwards.update((curr) => ({
      ...curr,
      [row.rfq_line_id]: cell.supplier_bid_line_id as string,
    }));
  }

  applyLowestTotalPreset(): void {
    const m = this.matrix();
    const targetBidId = m?.recommendations.lowest_total_cost_bid_id;
    if (!m || !targetBidId) {
      return;
    }

    const next: Record<string, string> = {};
    for (const row of m.rows) {
      const cell = row.cells.find(
        (c) => c.bid_id === targetBidId && !c.is_no_bid && !!c.supplier_bid_line_id,
      );
      if (cell?.supplier_bid_line_id) {
        next[row.rfq_line_id] = cell.supplier_bid_line_id;
      }
    }
    this.selectedLineAwards.set(next);
  }

  applyOptimalSplitPreset(): void {
    const m = this.matrix();
    if (!m) {
      return;
    }
    const next: Record<string, string> = {};
    for (const alloc of m.recommendations.optimal_split_line_awards) {
      next[alloc.rfq_line_id] = alloc.supplier_bid_line_id;
    }
    this.selectedLineAwards.set(next);
  }

  applyLowestPriceSplitPreset(): void {
    const m = this.matrix();
    if (!m) {
      return;
    }
    const next: Record<string, string> = {};
    for (const alloc of m.recommendations.lowest_price_split_line_awards) {
      next[alloc.rfq_line_id] = alloc.supplier_bid_line_id;
    }
    this.selectedLineAwards.set(next);
  }

  openAwardDrawer(): void {
    if (this.selectedCount() === 0) {
      return;
    }
    this.awardDrawerOpen.set(true);
  }

  closeAwardDrawer(): void {
    this.awardDrawerOpen.set(false);
  }

  confirmAward(): void {
    const rfqId = this.activeRfqId() || this.matrix()?.rfq_id;
    if (!rfqId || this.selectedCount() === 0) {
      return;
    }

    const mode = this.resolvedAwardMode();
    const singleCol = this.singleAwardColumn();

    const payload: AwardRfqPayload =
      mode === 'full' && singleCol && singleCol.bid_id
        ? {
            award_mode: 'full',
            supplier_id: singleCol.supplier_id,
            bid_id: singleCol.bid_id,
            notes: this.awardNotes().trim() || null,
          }
        : {
            award_mode: 'split',
            line_awards: Object.entries(this.selectedLineAwards()).map(
              ([rfq_line_id, supplier_bid_line_id]) => ({
                rfq_line_id,
                supplier_bid_line_id,
              }),
            ),
            notes: this.awardNotes().trim() || null,
          };

    this.awarding.set(true);
    this.api.awardRfq(rfqId, payload).subscribe({
      next: (res) => {
        const count = res.data.purchase_orders?.length ?? this.groupedPoPreviews().length;
        this.message.success(this.i18n.translate('RFQ.MATRIX.AWARD_SUCCESS', { count }));
        this.awarding.set(false);
        this.awardDrawerOpen.set(false);
        this.selectedLineAwards.set({});
        this.store.loadMatrix(rfqId).subscribe();
      },
      error: () => {
        this.awarding.set(false);
      },
    });
  }
}
