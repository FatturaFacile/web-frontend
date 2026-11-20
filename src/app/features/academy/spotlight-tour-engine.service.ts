import { computed, inject, Service, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TourPlacement, TourStep } from './academy.models';

export type TourStatus = 'idle' | 'locating' | 'ready' | 'missing';

export interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const POLL_MS = 100;
const DEFAULT_TIMEOUT_MS = 3000;
const PADDING = 6;

/**
 * Spotlight tour over a CSS selector: the steps come from the API (mission `tour_steps`). For each step it navigates to
 * the step route when needed, waits for the target element to exist, and publishes its rectangle for the overlay.
 */
@Service()
export class SpotlightTourEngineService {
  private readonly router = inject(Router);

  readonly steps = signal<readonly TourStep[]>([]);
  readonly index = signal(0);
  readonly status = signal<TourStatus>('idle');
  readonly rect = signal<SpotlightRect | null>(null);
  readonly timeoutMs = signal(DEFAULT_TIMEOUT_MS);

  readonly active = computed(() => this.status() !== 'idle');
  readonly step = computed<TourStep | null>(() => this.steps()[this.index()] ?? null);
  readonly placement = computed<TourPlacement>(() => this.step()?.placement ?? 'bottom');
  readonly isFirst = computed(() => this.index() === 0);
  readonly isLast = computed(() => this.index() >= this.steps().length - 1);
  readonly progressLabel = computed(() => ({
    current: this.index() + 1,
    total: this.steps().length,
  }));

  private token = 0;
  private readonly onResize = (): void => this.refreshRect();

  /** Starts a tour; an empty list is a no-op. */
  async start(steps: readonly TourStep[]): Promise<void> {
    if (steps.length === 0) {
      return;
    }
    this.steps.set(steps);
    this.listen(true);
    await this.goTo(0);
  }

  next(): Promise<void> {
    if (this.isLast()) {
      this.stop();
      return Promise.resolve();
    }
    return this.goTo(this.index() + 1);
  }

  previous(): Promise<void> {
    return this.isFirst() ? Promise.resolve() : this.goTo(this.index() - 1);
  }

  stop(): void {
    this.token++;
    this.listen(false);
    this.status.set('idle');
    this.rect.set(null);
    this.steps.set([]);
    this.index.set(0);
  }

  /** Recomputes the highlighted rectangle (scroll/resize). */
  refreshRect(): void {
    const step = this.step();
    if (!step || this.status() !== 'ready') return;
    const el = this.find(step.selector);
    this.rect.set(el ? this.measure(el) : null);
  }

  private async goTo(index: number): Promise<void> {
    const token = ++this.token;
    const step = this.steps()[index];
    if (!step) return;
    this.index.set(index);
    this.status.set('locating');
    this.rect.set(null);

    if (step.route && this.currentPath() !== step.route.split(/[?#]/)[0]) {
      await this.router.navigateByUrl(step.route);
      if (token !== this.token) return;
    }

    const el = await this.waitFor(step.selector, token);
    if (token !== this.token) return;
    if (!el) {
      this.status.set('missing');
      return;
    }
    el.scrollIntoView?.({ block: 'center', inline: 'nearest' });
    this.rect.set(this.measure(el));
    this.status.set('ready');
  }

  private currentPath(): string {
    return this.router.url.split(/[?#]/)[0];
  }

  private find(selector: string): Element | null {
    try {
      return document.querySelector(selector);
    } catch {
      return null; // an invalid selector coming from the API must never break the page
    }
  }

  private waitFor(selector: string, token: number): Promise<Element | null> {
    const deadline = Date.now() + this.timeoutMs();
    return new Promise((resolve) => {
      const attempt = (): void => {
        if (token !== this.token) return resolve(null);
        const el = this.find(selector);
        if (el || Date.now() >= deadline) return resolve(el);
        setTimeout(attempt, POLL_MS); // a stale lookup ends by itself on its next tick
      };
      attempt();
    });
  }

  private measure(el: Element): SpotlightRect {
    const r = el.getBoundingClientRect();
    return {
      top: r.top - PADDING,
      left: r.left - PADDING,
      width: r.width + PADDING * 2,
      height: r.height + PADDING * 2,
    };
  }

  private listen(on: boolean): void {
    if (typeof window === 'undefined') return;
    const method = on ? 'addEventListener' : 'removeEventListener';
    window[method]('resize', this.onResize);
    window[method]('scroll', this.onResize, true);
  }
}
