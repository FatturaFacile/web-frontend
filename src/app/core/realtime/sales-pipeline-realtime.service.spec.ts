import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlatformApiService } from '../api/platform-api.service';
import { SalesPipelineRealtimeService } from './sales-pipeline-realtime.service';

describe('SalesPipelineRealtimeService', () => {
  let platform: { getNotificationRealtime: ReturnType<typeof vi.fn> };
  let service: SalesPipelineRealtimeService;

  beforeEach(() => {
    platform = { getNotificationRealtime: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        SalesPipelineRealtimeService,
        { provide: PlatformApiService, useValue: platform },
      ],
    });
    service = TestBed.inject(SalesPipelineRealtimeService);
  });

  it('stays disconnected, so the board keeps polling, when the backend advertises no WebSocket server', async () => {
    platform.getNotificationRealtime.mockReturnValue(
      of({
        data: {
          enabled: false,
          key: null,
          host: null,
          port: null,
          scheme: null,
          channel: '',
          auth_endpoint: '',
        },
      }),
    );

    await service.start('t1');

    expect(service.connected()).toBe(false);
    expect(service.changes()).toBeNull();
  });

  it('stays disconnected when the configuration cannot be read', async () => {
    platform.getNotificationRealtime.mockReturnValue(throwError(() => new Error('offline')));

    await expect(service.start('t1')).resolves.toBeUndefined();

    expect(service.connected()).toBe(false);
  });

  it('stop is safe when nothing was started', () => {
    expect(() => service.stop()).not.toThrow();
    expect(service.connected()).toBe(false);
  });
});
