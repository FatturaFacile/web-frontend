import { ErrorHandler, inject } from '@angular/core';
import { TelemetryService } from './telemetry.service';

/** Sends every unhandled error to the active span (scrubbed) and keeps Angular's default behaviour of logging it. */
export class TelemetryErrorHandler implements ErrorHandler {
  private readonly telemetry = inject(TelemetryService);

  handleError(error: unknown): void {
    try {
      this.telemetry.recordError(error);
    } catch {
      // Reporting must never raise a second error.
    }
    console.error(error);
  }
}
