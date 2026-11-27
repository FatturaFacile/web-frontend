import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TelemetryErrorHandler } from './telemetry-error-handler';
import { TelemetryService } from './telemetry.service';

describe('TelemetryErrorHandler', () => {
  const telemetry = { recordError: vi.fn() };
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    telemetry.recordError.mockReset();
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    TestBed.configureTestingModule({
      providers: [
        { provide: TelemetryService, useValue: telemetry },
        { provide: ErrorHandler, useClass: TelemetryErrorHandler },
      ],
    });
  });

  afterEach(() => consoleError.mockRestore());

  it('reports the error to telemetry and still logs it', () => {
    const error = new Error('boom');

    TestBed.inject(ErrorHandler).handleError(error);

    expect(telemetry.recordError).toHaveBeenCalledWith(error);
    expect(consoleError).toHaveBeenCalledWith(error);
  });

  it('never raises a second error when reporting fails', () => {
    telemetry.recordError.mockImplementation(() => {
      throw new Error('exporter down');
    });

    expect(() => TestBed.inject(ErrorHandler).handleError(new Error('boom'))).not.toThrow();
    expect(consoleError).toHaveBeenCalled();
  });
});
