import { Service, signal } from '@angular/core';
import type { Tone } from '../badge/badge.component';

export interface Toast {
  readonly id: number;
  readonly tone: Tone;
  /** The message (already translated). */
  readonly message: string;
}

export interface ToastOptions {
  readonly tone?: Tone;
  /** Milliseconds before the toast closes itself. Errors stay until dismissed (WCAG 2.2.1). */
  readonly duration?: number;
}

const DEFAULT_DURATION = 8000;

/** Short feedback after an action. `ToastHostComponent` renders it in live regions that screen readers announce. */
@Service()
export class ToastService {
  private readonly items = signal<readonly Toast[]>([]);
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();
  private readonly durations = new Map<number, number>();
  private nextId = 0;

  readonly toasts = this.items.asReadonly();

  show(message: string, options: ToastOptions = {}): number {
    const tone = options.tone ?? 'info';
    const id = ++this.nextId;
    this.items.update((list) => [...list, { id, tone, message }]);
    const duration = options.duration ?? (tone === 'danger' ? 0 : DEFAULT_DURATION);
    if (duration > 0) {
      this.durations.set(id, duration);
      this.start(id);
    }
    return id;
  }

  success(message: string): number {
    return this.show(message, { tone: 'success' });
  }

  error(message: string): number {
    return this.show(message, { tone: 'danger' });
  }

  dismiss(id: number): void {
    this.pause(id);
    this.durations.delete(id);
    this.items.update((list) => list.filter((toast) => toast.id !== id));
  }

  /** Stops the countdown while the pointer or the keyboard focus is on the toast (WCAG 2.2.1). */
  pause(id: number): void {
    const timer = this.timers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
  }

  resume(id: number): void {
    if (this.durations.has(id)) {
      this.start(id);
    }
  }

  private start(id: number): void {
    this.pause(id);
    this.timers.set(
      id,
      setTimeout(() => this.dismiss(id), this.durations.get(id)),
    );
  }
}
