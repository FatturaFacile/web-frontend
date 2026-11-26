import { Component, computed, inject, input } from '@angular/core';
import { I18nService } from '@core';
import { TranslatePipe } from '@shared';
import { sparklinePath, TrendPoint } from './currency-fx.util';

const WIDTH = 480;
const HEIGHT = 96;

/** Inline SVG line of the rate of one pair over time (no chart library). */
@Component({
  selector: 'app-fx-rate-trend',
  imports: [TranslatePipe],
  styles: `
    :host {
      display: block;
      margin-bottom: 16px;
    }
    svg {
      width: 100%;
      max-width: 480px;
      height: 96px;
    }
    polyline {
      fill: none;
      stroke: #1677ff;
      stroke-width: 2;
      stroke-linejoin: round;
    }
    .caption {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      font-size: 12px;
      color: rgba(0, 0, 0, 0.65);
    }
  `,
  template: `
    @if (points().length > 1) {
      <strong>{{ 'FINANCE.CURRENCIES.TREND.TITLE' | translate: { pair: pair() } }}</strong>
      <svg
        role="img"
        [attr.viewBox]="'0 0 ' + width + ' ' + height"
        [attr.aria-label]="label()"
        preserveAspectRatio="none"
      >
        <polyline [attr.points]="path()"></polyline>
      </svg>
      <div class="caption">
        <span>{{ first().date }}: {{ first().rate }}</span>
        <span>{{ last().date }}: {{ last().rate }}</span>
      </div>
    } @else {
      <span class="caption">{{ 'FINANCE.CURRENCIES.TREND.NOT_ENOUGH_DATA' | translate }}</span>
    }
  `,
})
export class RateTrendComponent {
  private readonly i18n = inject(I18nService);

  readonly points = input<readonly TrendPoint[]>([]);
  readonly pair = input('');

  protected readonly width = WIDTH;
  protected readonly height = HEIGHT;

  protected readonly path = computed(() => sparklinePath(this.points(), WIDTH, HEIGHT));
  protected readonly first = computed(() => this.points()[0] ?? { date: '', rate: '' });
  protected readonly last = computed(
    () => this.points()[this.points().length - 1] ?? { date: '', rate: '' },
  );
  protected readonly label = computed(() =>
    this.i18n.translate('FINANCE.CURRENCIES.TREND.ARIA', {
      pair: this.pair(),
      from: this.first().date,
      to: this.last().date,
    }),
  );
}
