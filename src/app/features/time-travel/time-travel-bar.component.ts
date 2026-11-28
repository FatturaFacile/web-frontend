import { Component, computed, effect, inject, Injector, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { firstValueFrom } from 'rxjs';
import { TimeTravelApiService } from '@core/api/time-travel-api.service';
import { I18nService } from '@core/i18n/i18n.service';
import { TtIntegrityReport } from '@core/models/time-travel.model';
import { TIME_TRAVEL_QUERY_KEYS, TimeTravelContextService } from '@core/services/time-travel-context.service';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import {
  formatDateTime,
  presetCoordinates,
  TIME_TRAVEL_PRESETS,
  TimeTravelPreset,
  toDateOnly,
} from './time-travel.util';

type IntegrityState = 'idle' | 'checking' | 'verified' | 'broken' | 'unavailable';

/**
 * Global time-travel bar (Mod 354): the two dates of the bi-temporal coordinate (competenza / valid at, known at), the audit presets,
 * the cut-off diff shortcut and, while the mode is on, the amber audit banner with the reset and the Merkle integrity pill.
 * Cross-cutting: the trial balance, the account ledger, the aging and the inventory views all embed it.
 */
@Component({
  selector: 'app-time-travel-bar',
  imports: [FormsModule, NzButtonModule, NzDatePickerModule, NzTagModule, TranslatePipe],
  template: `
    <section class="tt-bar" [attr.aria-label]="'TIME_TRAVEL.BAR.TITLE' | translate" data-testid="tt-bar">
      @if (!context.isActive()) {
        <button nz-button type="button" data-testid="tt-activate" (click)="activate()">
          {{ 'TIME_TRAVEL.BAR.ACTIVATE' | translate }}
        </button>
      } @else {
        <div class="tt-banner" role="status" data-testid="tt-banner">
          <span class="tt-banner-text">{{ bannerText() }}</span>
          <span class="tt-banner-actions">
            <nz-tag [nzColor]="pill().color" data-testid="tt-integrity-pill" [attr.title]="pillTitle()">
              {{ pill().key | translate }}
            </nz-tag>
            <button nz-button nzSize="small" type="button" data-testid="tt-reset" (click)="reset()">
              {{ 'TIME_TRAVEL.BAR.RESET' | translate }}
            </button>
          </span>
        </div>
        @if (complianceText(); as text) {
          <p class="tt-compliance" data-testid="tt-compliance">{{ text }}</p>
        }
        <div class="tt-controls">
          <div class="tt-field">
            <label for="tt-valid-at">{{ 'TIME_TRAVEL.BAR.VALID_AT' | translate }}</label>
            <nz-date-picker
              nzId="tt-valid-at"
              nzShowTime
              nzFormat="yyyy-MM-dd HH:mm"
              [ngModel]="context.validAt()"
              [nzPlaceHolder]="'TIME_TRAVEL.BAR.VALID_AT_HINT' | translate"
              (ngModelChange)="onValidAt($event)"
            />
          </div>
          <div class="tt-field">
            <label for="tt-known-at">{{ 'TIME_TRAVEL.BAR.KNOWN_AT' | translate }}</label>
            <nz-date-picker
              nzId="tt-known-at"
              nzShowTime
              nzFormat="yyyy-MM-dd HH:mm"
              [ngModel]="context.knownAt()"
              [nzPlaceHolder]="'TIME_TRAVEL.BAR.KNOWN_AT_HINT' | translate"
              (ngModelChange)="onKnownAt($event)"
            />
          </div>
          @if (context.isDiffMode()) {
            <div class="tt-field">
              <label for="tt-compare-known-at">{{ 'TIME_TRAVEL.BAR.COMPARE_KNOWN_AT' | translate }}</label>
              <nz-date-picker
                nzId="tt-compare-known-at"
                nzShowTime
                nzFormat="yyyy-MM-dd HH:mm"
                [ngModel]="context.comparisonKnownAt()"
                (ngModelChange)="onComparison($event)"
              />
            </div>
          }
        </div>
        <div class="tt-presets" role="group" [attr.aria-label]="'TIME_TRAVEL.BAR.PRESETS' | translate">
          @for (preset of presets; track preset) {
            <button nz-button nzSize="small" type="button" [attr.data-testid]="'tt-preset-' + preset" (click)="applyPreset(preset)">
              {{ 'TIME_TRAVEL.PRESET.' + preset | translate }}
            </button>
          }
          @if (context.isDiffMode()) {
            <button nz-button nzType="primary" nzSize="small" type="button" data-testid="tt-diff-off" (click)="context.disableDiff()">
              {{ 'TIME_TRAVEL.BAR.HIDE_DIFF' | translate }}
            </button>
          } @else {
            <button nz-button nzType="primary" nzSize="small" type="button" data-testid="tt-diff-on" (click)="context.enableDiff()">
              {{ 'TIME_TRAVEL.BAR.SHOW_DIFF' | translate }}
            </button>
          }
          @if (whatIf()) {
            <button nz-button nzSize="small" type="button" data-testid="tt-whatif" (click)="whatIfRequested.emit()">
              {{ 'TIME_TRAVEL.BAR.WHAT_IF' | translate }}
            </button>
          }
        </div>
        @if (context.isDiffMode() && !context.diffRangeValid()) {
          <p class="tt-error" role="alert" data-testid="tt-range-error">{{ 'TIME_TRAVEL.ERROR.RANGE' | translate }}</p>
        }
      }
    </section>
  `,
  styles: `
    .tt-bar {
      margin-bottom: 16px;
    }
    .tt-banner {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 8px 16px;
      margin-bottom: 12px;
      border: 1px solid #ffc53d;
      border-radius: 6px;
      background: #fffbe6;
      color: #613400;
      font-weight: 500;
    }
    .tt-banner-actions {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .tt-controls,
    .tt-presets {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 12px;
      margin-bottom: 8px;
    }
    .tt-field {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .tt-error {
      color: var(--ant-color-error, #cf1322);
    }
  `,
})
export class TimeTravelBarComponent {
  protected readonly context = inject(TimeTravelContextService);
  /** Resolved on first use: a view that never enters the mode never needs the HTTP client of the API. */
  private readonly injector = inject(Injector);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** Shows the shortcut that opens the what-if valuation replay (warehouse views). */
  readonly whatIf = input(false);
  readonly whatIfRequested = output<void>();

  protected readonly presets: readonly TimeTravelPreset[] = TIME_TRAVEL_PRESETS;
  protected readonly integrity = signal<IntegrityState>('idle');
  protected readonly report = signal<TtIntegrityReport | null>(null);

  protected readonly pill = computed<{ key: string; color: string }>(() => {
    switch (this.integrity()) {
      case 'verified':
        return { key: 'TIME_TRAVEL.INTEGRITY.VERIFIED', color: 'green' };
      case 'broken':
        return { key: 'TIME_TRAVEL.INTEGRITY.BROKEN', color: 'red' };
      case 'unavailable':
        return { key: 'TIME_TRAVEL.INTEGRITY.UNAVAILABLE', color: 'default' };
      default:
        return { key: 'TIME_TRAVEL.INTEGRITY.CHECKING', color: 'processing' };
    }
  });

  protected readonly pillTitle = computed(() => this.report()?.merkle_root ?? null);

  /** GeBüV / Olico (Art. 957a CO) and Art. 2214 c.c. message of the outcome of the integrity check. */
  protected readonly complianceText = computed<string | null>(() => {
    const report = this.report();
    if (report === null) {
      return null;
    }
    if (report.verified) {
      return this.i18n.translate('TIME_TRAVEL.INTEGRITY.COMPLIANCE_OK', { events: report.events_checked });
    }
    return this.i18n.translate('TIME_TRAVEL.INTEGRITY.COMPLIANCE_BROKEN', {
      sequence: report.broken_at?.sequence_number ?? 0,
      event: report.broken_at?.event_id ?? '',
    });
  });

  protected readonly bannerText = computed(() => {
    const locale = this.i18n.dictionaryLocale();
    const params = {
      validAt: formatDateTime(this.context.validAt(), locale),
      knownAt: formatDateTime(this.context.knownAt(), locale),
    };
    if (this.context.isDiffMode()) {
      return this.i18n.translate('TIME_TRAVEL.BANNER.MESSAGE_DIFF', {
        ...params,
        comparisonKnownAt: formatDateTime(this.context.comparisonKnownAt(), locale),
      });
    }
    return this.i18n.translate('TIME_TRAVEL.BANNER.MESSAGE', params);
  });

  constructor() {
    // The coordinate may arrive in a shared link.
    this.context.restoreFromQueryParams(this.route.snapshot.queryParamMap);

    effect(() => {
      const validAt = this.context.validAt();
      if (this.context.isActive() && validAt) {
        void this.verifyIntegrity(validAt);
      } else {
        this.integrity.set('idle');
        this.report.set(null);
      }
    });

    effect(() => {
      const params = this.context.toQueryParams();
      const active = this.context.isActive();
      // While the mode is off and the URL carries no coordinate there is nothing to clear: no navigation at all.
      if (!active && !this.urlCarriesCoordinate()) {
        return;
      }
      void this.router.navigate([], { queryParams: params, queryParamsHandling: 'merge', replaceUrl: true });
    });
  }

  private urlCarriesCoordinate(): boolean {
    const query = this.router.parseUrl(this.router.url).queryParams;
    return Object.values(TIME_TRAVEL_QUERY_KEYS).some((key) => key in query);
  }

  protected activate(): void {
    this.context.activate();
  }

  protected reset(): void {
    this.context.reset();
  }

  protected onValidAt(value: Date | null): void {
    this.context.setValidAt(value);
  }

  protected onKnownAt(value: Date | null): void {
    this.context.setKnownAt(value);
  }

  protected onComparison(value: Date | null): void {
    this.context.setComparisonKnownAt(value);
  }

  protected applyPreset(preset: TimeTravelPreset): void {
    const coordinates = presetCoordinates(preset);
    this.context.activate(coordinates.validAt, coordinates.knownAt);
    this.context.setValidAt(coordinates.validAt);
    this.context.setKnownAt(coordinates.knownAt);
    if (coordinates.comparisonKnownAt) {
      this.context.enableDiff(coordinates.comparisonKnownAt);
    } else {
      this.context.disableDiff();
    }
  }

  /** Re-computes the hash chain of the fiscal year up to the valid-at date: the pill says whether the books were tampered with. */
  private async verifyIntegrity(validAt: Date): Promise<void> {
    this.integrity.set('checking');
    const from = new Date(validAt.getFullYear(), 0, 1);
    try {
      const response = await firstValueFrom(this.injector.get(TimeTravelApiService).auditIntegrity(toDateOnly(from), toDateOnly(validAt)));
      this.report.set(response.data);
      this.integrity.set(response.data.verified ? 'verified' : 'broken');
    } catch {
      this.report.set(null);
      this.integrity.set('unavailable');
    }
  }
}
