import { Component, computed, inject, input } from '@angular/core';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { I18nService, LeadRating } from '@core';
import { humanize, translateOr } from './lead-i18n';

const RATING_COLORS: Record<LeadRating, string> = {
  cold: 'blue',
  warm: 'orange',
  hot: 'red',
};

const RATING_ICONS: Record<LeadRating, string> = {
  cold: 'fa-solid fa-snowflake',
  warm: 'fa-solid fa-sun',
  hot: 'fa-solid fa-fire',
};

/**
 * Cold / Warm / Hot tag. The rating comes verbatim from the backend
 * (thresholds are never recomputed client-side) and the text label is always
 * rendered, so color is never the only signal.
 */
@Component({
  selector: 'app-lead-rating-tag',
  imports: [NzTagModule],
  template: `
    @if (rating(); as r) {
      <nz-tag [nzColor]="color()" [attr.data-rating]="r">
        <i [class]="icon()" aria-hidden="true"></i>
        {{ label() }}
      </nz-tag>
    } @else {
      <span class="none">-</span>
    }
  `,
  styles: `
    i {
      margin-right: 4px;
    }
    .none {
      color: #595959;
    }
  `,
})
export class LeadRatingTagComponent {
  private readonly i18n = inject(I18nService);

  readonly rating = input<LeadRating | string | null | undefined>(null);

  private readonly known = computed<LeadRating | null>(() => {
    const r = this.rating();
    return r === 'cold' || r === 'warm' || r === 'hot' ? r : null;
  });

  protected readonly color = computed(() => {
    const r = this.known();
    return r ? RATING_COLORS[r] : 'default';
  });

  protected readonly icon = computed(() => {
    const r = this.known();
    return r ? RATING_ICONS[r] : 'fa-solid fa-circle-question';
  });

  protected readonly label = computed(() => {
    this.i18n.currentLanguage();
    const r = this.rating();
    if (!r) {
      return '';
    }
    return translateOr(this.i18n, `CRM.LEADS.RATING.${r.toUpperCase()}`, humanize(r));
  });
}
