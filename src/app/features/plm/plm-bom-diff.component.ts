import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { catchError, of } from 'rxjs';
import { PlmApiService, PlmBomDiffCostRollupResult, PlmOption, TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';

/**
 * Visual BOM Revision Comparator ("Redline BOM Diff"):
 * Added = green, Removed = red, Quantity/Cost Modified = yellow, with Cost Roll-up (Rev. A vs. Rev. B).
 */
@Component({
  selector: 'app-plm-bom-diff',
  styleUrl: './plm.scss',
  imports: [
    FormsModule,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzSelectModule,
    NzStatisticModule,
    NzTableModule,
    NzTagModule,
  ],
  styles: `
    .diff-added td { background: rgba(82, 196, 26, 0.14); }
    .diff-removed td { background: rgba(255, 77, 79, 0.14); }
    .diff-modified td { background: rgba(250, 173, 20, 0.16); }
  `,
  template: `
    <app-page-header [title]="'PLM.DIFF_TITLE' | translate" [subtitle]="'PLM.DIFF_SUBTITLE' | translate"></app-page-header>

    <div class="toolbar">
      <nz-select style="width: 280px" nzShowSearch [ngModel]="fromBomId()" (ngModelChange)="fromBomId.set($event)" [nzPlaceHolder]="'PLM.DIFF_FROM_BOM' | translate">
        @for (bom of boms(); track bom.id) {
          <nz-option [nzValue]="bom.id" [nzLabel]="bom.label"></nz-option>
        }
      </nz-select>
      <nz-select style="width: 280px" nzShowSearch [ngModel]="toBomId()" (ngModelChange)="toBomId.set($event)" [nzPlaceHolder]="'PLM.DIFF_TO_BOM' | translate">
        @for (bom of boms(); track bom.id) {
          <nz-option [nzValue]="bom.id" [nzLabel]="bom.label"></nz-option>
        }
      </nz-select>
      <button nz-button nzType="primary" type="button" [disabled]="!fromBomId() || !toBomId()" [nzLoading]="loading()" (click)="compare()">
        {{ 'PLM.DIFF_COMPARE' | translate }}
      </button>
    </div>

    @if (diff(); as current) {
      <div class="stats-grid">
        <nz-card><nz-statistic [nzTitle]="'PLM.COST_BEFORE' | translate" [nzValue]="current.cost_rollup.before_total_cost"></nz-statistic></nz-card>
        <nz-card><nz-statistic [nzTitle]="'PLM.COST_AFTER' | translate" [nzValue]="current.cost_rollup.after_total_cost"></nz-statistic></nz-card>
        <nz-card><nz-statistic [nzTitle]="'PLM.COST_DELTA' | translate" [nzValue]="current.cost_rollup.cost_delta + ' (' + current.cost_rollup.cost_delta_percentage + '%)'"></nz-statistic></nz-card>
      </div>

      <nz-card class="main-card">
        <nz-table [nzData]="current.nodes" nzSize="small" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>{{ 'PLM.STATUS' | translate }}</th>
              <th>{{ 'PLM.ITEM' | translate }}</th>
              <th>{{ 'PLM.COST_BEFORE' | translate }}</th>
              <th>{{ 'PLM.COST_AFTER' | translate }}</th>
              <th class="num">{{ 'PLM.COST_DELTA' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (node of current.nodes; track node.key) {
              <tr [class]="'diff-' + node.status">
                <td>
                  <nz-tag [nzColor]="tagColor(node.status)">
                    {{ ('PLM.DIFF_' + node.status.toUpperCase()) | translate }}
                  </nz-tag>
                </td>
                <td>
                  <span [style.padding-left.px]="(node.level - 1) * 18">
                    {{ node.item_code }} — {{ node.item_name }}
                  </span>
                </td>
                <td>{{ node.before_quantity ?? '-' }} ({{ node.before_extended_cost }})</td>
                <td>{{ node.after_quantity ?? '-' }} ({{ node.after_extended_cost }})</td>
                <td class="num">{{ node.cost_delta }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-card>
    } @else {
      <nz-empty [nzNotFoundContent]="'PLM.DIFF_SUBTITLE' | translate"></nz-empty>
    }
  `,
})
export class PlmBomDiffComponent implements OnInit {
  private readonly api = inject(PlmApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly boms = signal<PlmOption[]>([]);
  readonly fromBomId = signal<string | null>(null);
  readonly toBomId = signal<string | null>(null);
  readonly loading = signal(false);
  readonly diff = signal<PlmBomDiffCostRollupResult | null>(null);

  ngOnInit(): void {
    this.api
      .getBomOptions()
      .pipe(catchError(() => of([])))
      .subscribe((boms) => this.boms.set(boms));
  }

  compare(): void {
    const from = this.fromBomId();
    const to = this.toBomId();
    if (!from || !to) {
      return;
    }
    this.loading.set(true);
    this.api.getBomDiffAndCostRollup({ from_bom_id: from, to_bom_id: to }).subscribe({
      next: (res) => {
        this.diff.set(res.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('PLM.ACTION_ERROR'));
      },
    });
  }

  tagColor(status: string): string {
    return status === 'added' ? 'green' : status === 'removed' ? 'red' : status === 'modified' ? 'gold' : 'default';
  }
}
