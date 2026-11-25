import { Component, computed, input } from '@angular/core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { FrnBenchmark, FrnBenchmarkRow } from '@core';
import { TranslatePipe } from '@shared';
import { benchmarkBars, positionColor } from './franchise-network.util';

/**
 * Anonymous benchmark of a store: for every KPI the store's own value against the median of its size cluster, the network average
 * and the top-quartile threshold. Only these aggregates exist in the data: no value of another store ever reaches the screen. A
 * cluster with too few stores is hidden by the API and the network aggregate stands in.
 */
@Component({
  selector: 'app-frn-benchmark-panel',
  imports: [NzAlertModule, NzEmptyModule, NzTagModule, TranslatePipe],
  styleUrl: './franchise-network.scss',
  template: `
    @if (benchmark(); as data) {
      @if (data.cluster_hidden) {
        <nz-alert class="feedback" nzType="info" nzShowIcon [nzMessage]="'franchiseNetwork.hint.clusterHidden' | translate"></nz-alert>
      }
      @for (row of rows(); track row.row.code) {
        <section class="bench-row" [attr.aria-label]="row.row.label">
          <h4>
            {{ row.row.label }}
            @if (row.row.position; as position) {
              <nz-tag [nzColor]="color(position)">{{ 'franchiseNetwork.position.' + position | translate }}</nz-tag>
            }
          </h4>
          <small class="muted">{{ row.row.description }}</small>
          <div class="bench-bar">
            <span>{{ 'franchiseNetwork.benchmark.own' | translate }}</span>
            <span class="track"><span class="fill own" [style.width.%]="row.bars.own ?? 0"></span></span>
            <strong class="num">{{ format(row.row.own, row.row) }}</strong>
          </div>
          @if (row.row.cluster; as cluster) {
            <div class="bench-bar">
              <span>{{ 'franchiseNetwork.benchmark.clusterMedian' | translate }}</span>
              <span class="track"><span class="fill median" [style.width.%]="row.bars.median ?? 0"></span></span>
              <span class="num">{{ format(cluster.median, row.row) }}</span>
            </div>
          }
          @if (row.row.network; as network) {
            <div class="bench-bar">
              <span>{{ 'franchiseNetwork.benchmark.networkAverage' | translate }}</span>
              <span class="track"><span class="fill average" [style.width.%]="row.bars.average ?? 0"></span></span>
              <span class="num">{{ format(network.average, row.row) }}</span>
            </div>
            <div class="bench-bar">
              <span>{{ 'franchiseNetwork.benchmark.topQuartile' | translate }}</span>
              <span class="track"><span class="fill top" [style.width.%]="row.bars.top ?? 0"></span></span>
              <span class="num">{{ format(row.row.cluster?.p75 ?? network.p75, row.row) }}</span>
            </div>
            <small class="muted">{{ 'franchiseNetwork.benchmark.sample' | translate: { count: network.sample_size } }}</small>
          }
        </section>
      } @empty {
        <nz-empty [nzNotFoundContent]="'franchiseNetwork.empty.benchmark' | translate"></nz-empty>
      }
    }
  `,
})
export class BenchmarkPanelComponent {
  readonly benchmark = input<FrnBenchmark | null>(null);

  protected readonly color = positionColor;

  protected readonly rows = computed(() =>
    (this.benchmark()?.rows ?? []).map((row) => ({
      row,
      bars: benchmarkBars(row.own, row.cluster, row.network),
    })),
  );

  protected format(value: string | null, row: FrnBenchmarkRow): string {
    if (value === null) {
      return '—';
    }
    return row.unit === 'percent' ? `${value}%` : value;
  }
}
