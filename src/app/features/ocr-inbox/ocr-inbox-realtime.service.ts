import { DestroyRef, inject, Service, signal } from '@angular/core';
import { environment } from '@env';
import { firstValueFrom } from 'rxjs';
import { PlatformApiService } from '../../core/api/platform-api.service';
import { getXsrfCookie } from '../../core/auth/csrf.utils';
import { NotificationRealtimeConfig } from '../../core/models/platform.model';
import { ReadyEvent } from './ocr-inbox.models';

interface EchoChannel {
  listen(event: string, callback: (payload: ReadyEvent) => void): EchoChannel;
}
interface EchoLike {
  private(channel: string): EchoChannel;
  leave(channel: string): void;
  disconnect(): void;
}

/**
 * Real-time notice that a document of the tenant is ready for review (or failed), received on the private channel
 * `tenant.{id}.ocr-inbox` of the Reverb server the backend advertises. When realtime is not configured or the connection
 * cannot be opened, `connected` stays false and the page falls back to polling.
 */
@Service()
export class OcrInboxRealtimeService {
  private readonly api = inject(PlatformApiService);
  private echo: EchoLike | null = null;
  private channel: string | null = null;
  private starting = false;

  readonly connected = signal(false);
  /** Latest event received; null until the first one. */
  readonly event = signal<ReadyEvent | null>(null);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  async start(): Promise<void> {
    const tenant = window.localStorage.getItem('ff_active_tenant_id');

    if (this.echo !== null || this.starting || tenant === null) {
      return;
    }

    this.starting = true;

    try {
      const config = (await firstValueFrom(this.api.getNotificationRealtime())).data;

      if (!config.enabled || config.key === null || config.host === null) {
        return;
      }

      await this.connect(config, `tenant.${tenant}.ocr-inbox`);
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
      // The session is a cookie, so the channel authorisation is sent with credentials, the CSRF token and the tenant.
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
          const tenant = window.localStorage.getItem('ff_active_tenant_id');

          if (xsrf) {
            headers['X-XSRF-TOKEN'] = xsrf;
          }

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
    echo.private(channel).listen('.document-extraction.ready', (event) => this.event.set(event));
    this.connected.set(true);
  }
}
