import { DestroyRef, inject, Service, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env';
import { PlatformApiService } from '../api/platform-api.service';
import { getXsrfCookie } from '../auth/csrf.utils';
import type { NotificationRealtimeConfig } from '../models/platform.model';
import type { SalesBoardUpdatedEvent } from '../models/sales-pipeline.model';

interface EchoChannel {
  listen(event: string, callback: (payload: SalesBoardUpdatedEvent) => void): EchoChannel;
}
interface EchoLike {
  private(channel: string): EchoChannel;
  leave(channel: string): void;
  disconnect(): void;
}

/**
 * Live sync of the sales board across users and devices. It subscribes to the private tenant channel of the CRM
 * pipeline on the same Reverb server as the notification centre and publishes every board change through `changes`.
 * When realtime is not configured or the socket cannot be opened, `connected` stays false and the board falls back
 * to periodic refresh.
 */
@Service()
export class SalesPipelineRealtimeService {
  private readonly api = inject(PlatformApiService);
  private echo: EchoLike | null = null;
  private channel: string | null = null;
  private starting = false;

  /** True while the WebSocket is subscribed to the tenant channel. */
  readonly connected = signal(false);
  /** Latest board change received; null until the first one. */
  readonly changes = signal<SalesBoardUpdatedEvent | null>(null);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  async start(tenantId: string): Promise<void> {
    if (this.echo !== null || this.starting) {
      return;
    }
    this.starting = true;
    try {
      const config = (await firstValueFrom(this.api.getNotificationRealtime())).data;
      if (!config.enabled || config.key === null || config.host === null) {
        return;
      }
      await this.connect(config, `tenant.${tenantId}.crm-pipeline`);
    } catch {
      // Realtime is an enhancement: any failure leaves the polling fallback in charge.
      this.connected.set(false);
    } finally {
      this.starting = false;
    }
  }

  stop(): void {
    if (this.echo !== null && this.channel !== null) {
      this.echo.leave(this.channel);
    }
    this.echo?.disconnect();
    this.echo = null;
    this.channel = null;
    this.connected.set(false);
  }

  private async connect(config: NotificationRealtimeConfig, channel: string): Promise<void> {
    const [{ default: Echo }, { default: Pusher }] = await Promise.all([
      import('laravel-echo'),
      import('pusher-js'),
    ]);
    (window as unknown as { Pusher: unknown }).Pusher = Pusher;

    const origin = environment.apiBaseUrl.startsWith('http')
      ? new URL(environment.apiBaseUrl).origin
      : '';
    const echo = new Echo({
      broadcaster: 'reverb',
      key: config.key ?? undefined,
      wsHost: config.host ?? undefined,
      wsPort: config.port ?? 80,
      wssPort: config.port ?? 443,
      forceTLS: config.scheme === 'https',
      enabledTransports: ['ws', 'wss'],
      authorizer: (target: { name: string }) => ({
        authorize: (
          socketId: string,
          callback: (
            error: Error | null,
            data: { auth: string; channel_data?: string; shared_secret?: string } | null,
          ) => void,
        ): void => {
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          };
          const xsrf = getXsrfCookie();
          if (xsrf) {
            headers['X-XSRF-TOKEN'] = xsrf;
          }
          const tenant = window.localStorage.getItem('ff_active_tenant_id');
          if (tenant) {
            headers['X-Tenant-Id'] = tenant;
          }
          fetch(`${origin}${config.auth_endpoint}`, {
            method: 'POST',
            credentials: 'include',
            headers,
            body: JSON.stringify({ socket_id: socketId, channel_name: target.name }),
          })
            .then((response) =>
              response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)),
            )
            .then((data: { auth: string; channel_data?: string; shared_secret?: string }) =>
              callback(null, data),
            )
            .catch((error: unknown) =>
              callback(
                error instanceof Error ? error : new Error('Channel authorisation failed'),
                null,
              ),
            );
        },
      }),
    }) as unknown as EchoLike;

    this.echo = echo;
    this.channel = channel;
    echo
      .private(channel)
      .listen('.crm.opportunity.board-updated', (event) => this.changes.set(event));
    this.connected.set(true);
  }
}
