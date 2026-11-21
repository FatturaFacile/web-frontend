import { DecimalPipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ManufacturingApiService, MfgBomResource, TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { catchError, debounceTime, of, Subject, switchMap } from 'rxjs';
import { BomDesignerStore, BomEditableField } from './bom-designer.store';
import { BomTreeNode, round4, toNumber } from './bom.utils';

/**
 * BOM tree designer: the multi-level explosion of a BOM as an expandable table with inline editing of quantity, scrap and
 * fixed waste, a live cost rollup, phantom badges, sequence reordering and the EUR.1 preferential-origin panel. Edits are
 * saved as an engineering change; the active BOM is never changed in place.
 */
@Component({
  selector: 'app-bom-designer',
  providers: [BomDesignerStore],
  imports: [
    DecimalPipe,
    FormsModule,
    PageHeaderComponent,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzStatisticModule,
    NzTableModule,
    NzTagModule,
  ],
  styles: `
    .toolbar { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-bottom: 16px }
    .toolbar nz-select { min-width: 280px }
    .stats { display: flex; flex-wrap: wrap; gap: 32px; margin-bottom: 16px }
    .name-cell { display: flex; align-items: center; gap: 6px }
    .toggle { width: 24px; height: 24px; border: 0; background: transparent; cursor: pointer; color: inherit }
    .toggle-spacer { display: inline-block; width: 24px }
    .num { text-align: right; font-variant-numeric: tabular-nums }
    .edit-input { width: 96px; text-align: right }
    .save-bar { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-top: 16px }
    .save-bar input { max-width: 420px }
    .origin { margin-top: 24px }
    .origin-form { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-bottom: 12px }
  `,
  template: `
    <app-page-header
      [title]="'MFG_BOM.DESIGNER_TITLE' | translate"
      [subtitle]="'MFG_BOM.DESIGNER_SUBTITLE' | translate"
    ></app-page-header>

    <div class="toolbar">
      <nz-select
        nzShowSearch
        nzServerSearch
        [nzPlaceHolder]="'MFG_BOM.SELECT_BOM' | translate"
        [attr.aria-label]="'MFG_BOM.SELECT_BOM' | translate"
        [ngModel]="selectedBomId()"
        (ngModelChange)="selectedBomId.set($event)"
        (nzOnSearch)="bomSearch$.next($event)"
        data-testid="bom-select"
      >
        @for (bom of boms(); track bom.id) {
          <nz-option
            [nzValue]="bom.id"
            [nzLabel]="bom.bom_number + ' · ' + bom.name + ' (' + bom.revision + ')'"
          ></nz-option>
        }
      </nz-select>
      <nz-input-number
        [nzMin]="0.0001"
        [nzStep]="1"
        [ngModel]="store.quantity()"
        (ngModelChange)="store.quantity.set($event ?? 1)"
        [attr.aria-label]="'MFG_BOM.QUANTITY' | translate"
      ></nz-input-number>
      <button nz-button nzType="primary" type="button" data-testid="load" [disabled]="!selectedBomId() || store.loading()" (click)="load()">
        {{ 'MFG_BOM.LOAD' | translate }}
      </button>
      <button nz-button type="button" [disabled]="!store.explosion()" (click)="store.expandAll()">
        {{ 'MFG_BOM.EXPAND_ALL' | translate }}
      </button>
      <button nz-button type="button" [disabled]="!store.explosion()" (click)="store.collapseAll()">
        {{ 'MFG_BOM.COLLAPSE_ALL' | translate }}
      </button>
    </div>

    @if (store.explosion(); as explosion) {
      <div class="stats" data-testid="stats">
        <nz-statistic
          [nzTitle]="'MFG_BOM.TOTAL_COST' | translate"
          [nzValue]="(store.totalCost() | number: '1.2-4') ?? ''"
        ></nz-statistic>
        <nz-statistic
          [nzTitle]="'MFG_BOM.LEAD_TIME_DAYS' | translate"
          [nzValue]="explosion.total_lead_time_days"
        ></nz-statistic>
        <nz-statistic [nzTitle]="'MFG_BOM.COMPONENTS' | translate" [nzValue]="explosion.lines.length"></nz-statistic>
      </div>

      <nz-table
        #table
        nzSize="small"
        [nzData]="store.rows()"
        [nzFrontPagination]="false"
        [nzShowPagination]="false"
        [nzLoading]="store.loading()"
      >
        <thead>
          <tr>
            <th scope="col">{{ 'MFG_BOM.COL_SEQUENCE' | translate }}</th>
            <th scope="col">{{ 'MFG_BOM.COL_COMPONENT' | translate }}</th>
            <th scope="col" class="num">{{ 'MFG_BOM.COL_QUANTITY_PER' | translate }}</th>
            <th scope="col" class="num">{{ 'MFG_BOM.COL_SCRAP' | translate }}</th>
            <th scope="col" class="num">{{ 'MFG_BOM.COL_FIXED_WASTE' | translate }}</th>
            <th scope="col" class="num">{{ 'MFG_BOM.COL_EFFECTIVE' | translate }}</th>
            <th scope="col" class="num">{{ 'MFG_BOM.COL_UNIT_COST' | translate }}</th>
            <th scope="col" class="num">{{ 'MFG_BOM.COL_COST' | translate }}</th>
            <th scope="col" class="num">{{ 'MFG_BOM.COL_LEAD_TIME' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (node of table.data; track node.key; let i = $index) {
            <tr [attr.data-testid]="'row-' + node.line.item_code">
              <td>
                @if (store.isEditable(node)) {
                  <button
                    nz-button
                    nzSize="small"
                    type="button"
                    [attr.aria-label]="'MFG_BOM.MOVE_UP' | translate"
                    [disabled]="isFirstRoot(node)"
                    (click)="store.move(node, -1)"
                  >&uarr;</button>
                  <button
                    nz-button
                    nzSize="small"
                    type="button"
                    [attr.aria-label]="'MFG_BOM.MOVE_DOWN' | translate"
                    [disabled]="isLastRoot(node)"
                    (click)="store.move(node, 1)"
                  >&darr;</button>
                }
              </td>
              <td>
                <span class="name-cell" [style.padding-left.px]="(node.line.level - baseLevel()) * 20">
                  @if (node.children.length > 0) {
                    <button
                      type="button"
                      class="toggle"
                      [attr.aria-expanded]="store.expanded().has(node.key)"
                      [attr.aria-label]="'MFG_BOM.TOGGLE' | translate"
                      (click)="store.toggle(node.key)"
                    >{{ store.expanded().has(node.key) ? '▾' : '▸' }}</button>
                  } @else {
                    <span class="toggle-spacer"></span>
                  }
                  <strong>{{ node.line.item_code }}</strong>
                  @if (node.line.item_name) {
                    <span>{{ node.line.item_name }}</span>
                  }
                  @if (node.line.is_phantom) {
                    <nz-tag nzColor="purple" data-testid="phantom-badge">{{ 'MFG_BOM.PHANTOM' | translate }}</nz-tag>
                  }
                  @if (node.line.via_phantom) {
                    <nz-tag>{{ 'MFG_BOM.VIA_PHANTOM' | translate }}</nz-tag>
                  }
                </span>
              </td>
              @if (store.isEditable(node)) {
                <td class="num">
                  <input
                    nz-input
                    class="edit-input"
                    inputmode="decimal"
                    [attr.aria-label]="'MFG_BOM.COL_QUANTITY_PER' | translate"
                    [value]="quantityPer(node)"
                    (change)="onEdit(node, 'quantity_per', $any($event.target).value)"
                  />
                </td>
                <td class="num">
                  <input
                    nz-input
                    class="edit-input"
                    inputmode="decimal"
                    [attr.aria-label]="'MFG_BOM.COL_SCRAP' | translate"
                    [value]="scrap(node)"
                    (change)="onEdit(node, 'scrap_percentage', $any($event.target).value)"
                  />
                </td>
                <td class="num">
                  <input
                    nz-input
                    class="edit-input"
                    inputmode="decimal"
                    [attr.aria-label]="'MFG_BOM.COL_FIXED_WASTE' | translate"
                    [value]="fixedWaste(node)"
                    (change)="onEdit(node, 'fixed_scrap_quantity', $any($event.target).value)"
                  />
                </td>
              } @else {
                <td class="num">{{ node.line.net_quantity | number: '1.0-4' }}</td>
                <td class="num">{{ node.line.variable_waste_quantity | number: '1.0-4' }}</td>
                <td class="num">{{ node.line.fixed_waste_quantity | number: '1.0-4' }}</td>
              }
              <td class="num">{{ store.effectiveOf(node) | number: '1.0-4' }}</td>
              <td class="num">{{ node.line.unit_cost ? (node.line.unit_cost | number: '1.2-4') : '' }}</td>
              <td class="num">{{ store.costOf(node) | number: '1.2-4' }}</td>
              <td class="num">{{ node.line.lead_time_offset_days ?? '' }}</td>
            </tr>
          }
        </tbody>
      </nz-table>

      <div class="save-bar">
        <input
          nz-input
          [placeholder]="'MFG_BOM.ECO_REASON' | translate"
          [attr.aria-label]="'MFG_BOM.ECO_REASON' | translate"
          [(ngModel)]="reason"
          [disabled]="!store.hasPending()"
          data-testid="reason"
        />
        <button
          nz-button
          nzType="primary"
          type="button"
          data-testid="save-revision"
          [disabled]="!store.hasPending() || !reason().trim() || store.saving()"
          [nzLoading]="store.saving()"
          (click)="save()"
        >
          {{ 'MFG_BOM.SAVE_AS_ECO' | translate }}
        </button>
        <button nz-button type="button" [disabled]="!store.hasPending()" (click)="store.discardEdits()">
          {{ 'MFG_BOM.DISCARD' | translate }}
        </button>
        @if (store.hasPending()) {
          <nz-tag nzColor="gold">{{ 'MFG_BOM.PENDING_CHANGES' | translate }}</nz-tag>
        }
      </div>

      <nz-card class="origin" [nzTitle]="'MFG_BOM.EUR1_TITLE' | translate" data-testid="origin-panel">
        <div class="origin-form">
          <label for="origin-threshold">{{ 'MFG_BOM.EUR1_THRESHOLD' | translate }}</label>
          <nz-input-number
            nzId="origin-threshold"
            [nzMin]="0"
            [nzMax]="100"
            [(ngModel)]="threshold"
          ></nz-input-number>
          <button nz-button type="button" data-testid="check-origin" [nzLoading]="store.originLoading()" (click)="checkOrigin()">
            {{ 'MFG_BOM.EUR1_CHECK' | translate }}
          </button>
        </div>
        @if (store.origin(); as origin) {
          <nz-alert
            data-testid="origin-result"
            [nzType]="origin.qualifies ? 'success' : 'warning'"
            nzShowIcon
            [nzMessage]="(origin.qualifies ? 'MFG_BOM.EUR1_QUALIFIES' : 'MFG_BOM.EUR1_NOT_QUALIFIED') | translate"
            [nzDescription]="originDetail()"
          ></nz-alert>
        }
      </nz-card>
    } @else if (!store.loading()) {
      <nz-alert nzType="info" nzShowIcon [nzMessage]="'MFG_BOM.PICK_A_BOM' | translate"></nz-alert>
    }
  `,
})
export class BomDesignerComponent implements OnInit {
  protected readonly store = inject(BomDesignerStore);
  private readonly api = inject(ManufacturingApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly boms = signal<MfgBomResource[]>([]);
  protected readonly selectedBomId = signal<string | null>(null);
  protected readonly bomSearch$ = new Subject<string>();
  protected readonly reason = signal('');
  protected readonly threshold = signal<number | null>(null);
  protected readonly baseLevel = computed(() =>
    Math.min(...(this.store.explosion()?.lines.map((line) => line.level) ?? [0])),
  );
  protected readonly originDetail = computed(() => {
    const origin = this.store.origin();
    if (!origin) {
      return '';
    }
    const parts = [
      origin.non_originating_percentage !== undefined
        ? `${this.i18n.instant('MFG_BOM.EUR1_NON_ORIGINATING')}: ${origin.non_originating_percentage}%`
        : '',
      origin.threshold_percentage !== undefined
        ? `${this.i18n.instant('MFG_BOM.EUR1_THRESHOLD')}: ${origin.threshold_percentage}%`
        : '',
      origin.origin_criterion ?? '',
    ];

    return parts.filter((part) => part !== '').join(' · ');
  });

  constructor() {
    this.bomSearch$
      .pipe(
        debounceTime(250),
        switchMap((search) =>
          this.api.getBoms({ search, per_page: 20 }).pipe(catchError(() => of({ data: [] as MfgBomResource[] }))),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((res) => this.boms.set(res.data));
    this.bomSearch$.next('');
  }

  ngOnInit(): void {
    const bomId = this.route.snapshot.queryParamMap.get('bom');
    if (bomId) {
      this.selectedBomId.set(bomId);
      this.load();
    }
  }

  protected load(): void {
    const id = this.selectedBomId();
    if (!id) {
      return;
    }
    this.store
      .load(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: () => this.message.error(this.i18n.instant('MFG_BOM.LOAD_ERROR')) });
  }

  protected save(): void {
    this.store
      .saveRevision(this.reason().trim())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.reason.set('');
          this.message.success(this.i18n.instant('MFG_BOM.ECO_OPENED'));
        },
        error: () => this.message.error(this.i18n.instant('MFG_BOM.SAVE_ERROR')),
      });
  }

  protected checkOrigin(): void {
    this.store
      .loadOrigin(this.threshold() ?? undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: () => this.message.error(this.i18n.instant('MFG_BOM.EUR1_ERROR')) });
  }

  protected onEdit(node: BomTreeNode, field: BomEditableField, value: string): void {
    this.store.edit(node, field, value);
  }

  protected quantityPer(node: BomTreeNode): string {
    const pending = this.store.pending().get(node.key)?.edit.quantity_per;
    if (pending !== undefined) {
      return pending;
    }
    const quantity = this.store.quantity();

    return String(round4(toNumber(node.line.net_quantity) / (quantity > 0 ? quantity : 1)));
  }

  protected scrap(node: BomTreeNode): string {
    return String(round4(this.store.valuesOf(node).scrap_percentage));
  }

  protected fixedWaste(node: BomTreeNode): string {
    return String(round4(this.store.valuesOf(node).fixed_waste_quantity));
  }

  protected isFirstRoot(node: BomTreeNode): boolean {
    return this.roots()[0]?.key === node.key;
  }

  protected isLastRoot(node: BomTreeNode): boolean {
    const roots = this.roots();

    return roots[roots.length - 1]?.key === node.key;
  }

  private roots(): BomTreeNode[] {
    return this.store.rows().filter((row) => row.line.level === this.baseLevel());
  }
}
