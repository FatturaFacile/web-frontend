import { Component, inject, input, signal } from '@angular/core';
import { TtDomain, TtFilters } from '@core/models/time-travel.model';
import { TimeTravelContextService } from '@core/services/time-travel-context.service';
import { BitemporalCutoffDiffComponent } from './bitemporal-cutoff-diff.component';
import { TimeTravelBarComponent } from './time-travel-bar.component';
import { TimeTravelStateViewComponent } from './time-travel-state-view.component';
import { WhatifValuationReplayComponent } from './whatif-valuation-replay.component';

/**
 * One-line integration of the time-travel mode into a view: the bar, and while the mode is active the point-in-time state, the
 * cut-off diff and (for the warehouse) the what-if replay. The host view hides its live content with
 * `TimeTravelContextService.isActive()`, so leaving the mode returns it to the live state.
 */
@Component({
  selector: 'app-time-travel-panel',
  imports: [BitemporalCutoffDiffComponent, TimeTravelBarComponent, TimeTravelStateViewComponent, WhatifValuationReplayComponent],
  template: `
    <app-time-travel-bar [whatIf]="whatIf()" (whatIfRequested)="replayOpen.set(true)" />
    @if (context.isActive()) {
      <app-time-travel-state-view [domain]="domain()" [filters]="filters()" />
      @if (context.isDiffMode()) {
        <app-bitemporal-cutoff-diff [domain]="domain()" [filters]="filters()" />
      }
      @if (whatIf()) {
        <app-whatif-valuation-replay [(open)]="replayOpen" [filters]="filters()" />
      }
    }
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class TimeTravelPanelComponent {
  protected readonly context = inject(TimeTravelContextService);

  readonly domain = input.required<TtDomain>();
  readonly filters = input<TtFilters>({});
  /** Offers the what-if valuation replay (warehouse views only). */
  readonly whatIf = input(false);

  protected readonly replayOpen = signal(false);
}
