import { HttpErrorResponse } from '@angular/common/http';

/** Saves a backend file (CSV) under `filename` via a temporary object URL. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Selectable report years: the current one and the five before it. */
export function reportYears(current: number): number[] {
  return Array.from({ length: 6 }, (_, i) => current - i);
}

/**
 * Whether the component must show its own toast. Non-422 failures are already surfaced by the global
 * error interceptor, so only validation/fiscal 422s are reported here to avoid duplicate toasts.
 */
export function needsOwnToast(err: unknown): boolean {
  return err instanceof HttpErrorResponse && err.status === 422;
}
