import { Component, computed, inject, input } from '@angular/core';
import { I18nService, LeadRating } from '@core';
import { translateOr } from './lead-i18n';

/**
 * Numeric 0-100 score badge. The tint follows the backend rating; the number
 * itself is always shown and announced, so color is decorative only.
 */
@Component({
  selector: 'app-lead-score-badge',
  template: `
    <span
      class="badge"
      role="img"
      [class.cold]="rating() === 'cold'"
      [class.warm]="rating() === 'warm'"
      [class.hot]="rating() === 'hot'"
      [attr.aria-label]="ariaLabel()"
      [title]="ariaLabel()"
      >{{ display() }}</span
    >
  `,
  styles: `
    .badge {
      display: inline-block;
      min-width: 40px;
      padding: 1px 8px;
      border-radius: 12px;
      border: 1px solid #8c8c8c;
      background: #fafafa;
      color: #262626;
      font-weight: 600;
      text-align: center;
      font-variant-numeric: tabular-nums;
    }
    .cold {
      border-color: #1677ff;
      background: #e6f4ff;
      color: #003eb3;
    }
    .warm {
      border-color: #d46b08;
      background: #fff7e6;
      color: #873800;
    }
    .hot {
      border-color: #cf1322;
      background: #fff1f0;
      color: #820014;
    }
  `,
})
export class LeadScoreBadgeComponent {
  private readonly i18n = inject(I18nService);

  readonly score = input<number | null | undefined>(null);
  readonly rating = input<LeadRating | string | null | undefined>(null);

  /** Clamped integer score, or null when the lead was never scored. */
  readonly value = computed<number | null>(() => {
    const s = this.score();
    if (s === null || s === undefined || !Number.isFinite(Number(s))) {
      return null;
    }
    return Math.min(100, Math.max(0, Math.round(Number(s))));
  });

  protected readonly display = computed(() => {
    const v = this.value();
    return v === null ? '-' : String(v);
  });

  protected readonly ariaLabel = computed(() => {
    this.i18n.currentLanguage();
    const v = this.value();
    return v === null
      ? translateOr(this.i18n, 'CRM.LEADS.SCORE_NONE', 'Not scored')
      : translateOr(this.i18n, 'CRM.LEADS.SCORE_ARIA', 'Score {score} out of 100', { score: v });
  });
}
