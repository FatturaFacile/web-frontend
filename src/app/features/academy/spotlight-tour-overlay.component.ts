import { Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '@shared';
import { SpotlightTourEngineService } from './spotlight-tour-engine.service';

const POPOVER_W = 320;
const GAP = 12;

/** Renders the spotlight cut-out and the step popover of the tour engine; mounted once in the app shell. */
@Component({
  selector: 'app-spotlight-tour-overlay',
  imports: [TranslatePipe],
  host: { '(document:keydown.escape)': 'tour.stop()' },
  styles: `
    .backdrop {
      position: fixed;
      inset: 0;
      z-index: 2000;
    }
    .spot {
      position: fixed;
      z-index: 2001;
      border-radius: 6px;
      box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.55);
      pointer-events: none;
      transition: all 0.2s ease;
    }
    .dim {
      position: fixed;
      inset: 0;
      z-index: 2001;
      background: rgba(0, 0, 0, 0.55);
      pointer-events: none;
    }
    .pop {
      position: fixed;
      z-index: 2002;
      width: 320px;
      max-width: calc(100vw - 24px);
      padding: 16px;
      background: var(--ff-color-surface, #fff);
      color: var(--ff-color-text, #1f1f1f);
      border-radius: 8px;
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.3);
    }
    .pop footer {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      margin-top: 12px;
    }
    .pop .count {
      margin-right: auto;
      align-self: center;
      font-size: 12px;
    }
  `,
  template: `
    @if (tour.active()) {
      <div class="backdrop" data-testid="tour-backdrop"></div>
      @if (tour.rect(); as r) {
        <div
          class="spot"
          [style.top.px]="r.top"
          [style.left.px]="r.left"
          [style.width.px]="r.width"
          [style.height.px]="r.height"
        ></div>
      } @else {
        <div class="dim"></div>
      }
      @if (tour.step(); as step) {
        <div
          class="pop"
          role="dialog"
          aria-live="polite"
          [attr.aria-label]="'ACADEMY.TOUR_TITLE' | translate"
          [style.top.px]="pos().top"
          [style.left.px]="pos().left"
          data-testid="tour-popover"
        >
          @if (tour.status() === 'locating') {
            <p>{{ 'ACADEMY.TOUR_LOCATING' | translate }}</p>
          } @else {
            <p>{{ step.text }}</p>
            @if (tour.status() === 'missing') {
              <p>
                <em>{{ 'ACADEMY.TOUR_TARGET_MISSING' | translate }}</em>
              </p>
            }
          }
          <footer>
            <span class="count"
              >{{ tour.progressLabel().current }} / {{ tour.progressLabel().total }}</span
            >
            <button type="button" (click)="tour.stop()" data-testid="tour-skip">
              {{ 'ACADEMY.TOUR_SKIP' | translate }}
            </button>
            <button
              type="button"
              [disabled]="tour.isFirst()"
              (click)="tour.previous()"
              data-testid="tour-prev"
            >
              {{ 'ACADEMY.TOUR_PREVIOUS' | translate }}
            </button>
            <button type="button" (click)="tour.next()" data-testid="tour-next">
              {{ (tour.isLast() ? 'ACADEMY.TOUR_FINISH' : 'ACADEMY.TOUR_NEXT') | translate }}
            </button>
          </footer>
        </div>
      }
    }
  `,
})
export class SpotlightTourOverlayComponent {
  protected readonly tour = inject(SpotlightTourEngineService);

  protected readonly pos = computed(() => {
    const r = this.tour.rect();
    const vw = typeof window === 'undefined' ? 1024 : window.innerWidth;
    const vh = typeof window === 'undefined' ? 768 : window.innerHeight;
    const maxTop = vh - 200;
    const maxLeft = vw - POPOVER_W - 12;
    const clamp = (v: number, max: number): number => Math.max(12, Math.min(v, max));
    if (!r || this.tour.placement() === 'center') {
      return { top: clamp(vh / 2 - 80, maxTop), left: clamp(vw / 2 - POPOVER_W / 2, maxLeft) };
    }
    switch (this.tour.placement()) {
      case 'top':
        return { top: clamp(r.top - GAP - 140, maxTop), left: clamp(r.left, maxLeft) };
      case 'left':
        return { top: clamp(r.top, maxTop), left: clamp(r.left - POPOVER_W - GAP, maxLeft) };
      case 'right':
        return { top: clamp(r.top, maxTop), left: clamp(r.left + r.width + GAP, maxLeft) };
      default:
        return { top: clamp(r.top + r.height + GAP, maxTop), left: clamp(r.left, maxLeft) };
    }
  });
}
