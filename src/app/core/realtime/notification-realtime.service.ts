import { DestroyRef, inject, Service, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env';
import { PlatformApiService } from '../api/platform-api.service';
import { getXsrfCookie } from '../auth/csrf.utils';
import type { NotificationRealtimeConfig, NotificationsChangedEvent } from '../models/platform.model';

interface EchoChannel {
  listen(event: string, callback: (payload: NotificationsChangedEvent) => void): EchoChannel;
}
interface EchoLike {
  private(channel: string): EchoChannel;
  leave(channel: string): void;
  disconnect(): void;
}

/**
 * Live unread counter of the notification centre. Connects to the Reverb WebSocket server (when the backend
 * advertises one) and publishes every change of the user's notifications through `changes`. When realtime is not
 * configured or the connection cannot be opened, `connected` stays false and callers keep polling.
 */
@Service()
export class NotificationRealtimeService {
  private readonly api = inject(PlatformApiService);
  private echo: EchoLike | null = null;
  private channel: string | null = null;
  private starting = false;

  /** True while the WebSocket is subscribed to the user's channel. */
  readonly connected = signal(false);
  /** Latest event received from the server; null until the first one. */
  readonly changes = signal<NotificationsChangedEvent | null>(null);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  async start(): Promise<void> {
    if (this.echo !== null || this.starting) {
      return;
    }
    this.starting = true;
    try {
      const config = (await firstValueFrom(this.api.getNotificationRealtime())).data;
      if (!config.enabled || config.key === null || config.host === null) {
        return;
      }
      await this.connect(config);
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

  private async connect(config: NotificationRealtimeConfig): Promise<void> {
    const [{ default: Echo }, { default: Pusher }] = await Promise.all([import('laravel-echo'), import('pusher-js')]);
    (window as unknown as { Pusher: unknown }).Pusher = Pusher;

    const tls = config.scheme === 'https';
    const origin = environment.apiBaseUrl.startsWith('http') ? new URL(environment.apiBaseUrl).origin : '';
    const echo = new Echo({
      broadcaster: 'reverb',
      key: config.key ?? undefined,
      wsHost: config.host ?? undefined,
      wsPort: config.port ?? 80,
      wssPort: config.port ?? 443,
      forceTLS: tls,
      enabledTransports: ['ws', 'wss'],
      // The session is a cookie, so the channel authorisation is sent with credentials, the CSRF token and the tenant.
      authorizer: (channel: { name: string }) => ({
        authorize: (socketId: string, callback: (error: Error | null, data: { auth: string; channel_data?: string; shared_secret?: string } | null) => void): void => {
          const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
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
            body: JSON.stringify({ socket_id: socketId, channel_name: channel.name }),
          })
            .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))))
            .then((data: { auth: string; channel_data?: string; shared_secret?: string }) => callback(null, data))
            .catch((error: unknown) => callback(error instanceof Error ? error : new Error('Channel authorisation failed'), null));
        },
      }),
    }) as unknown as EchoLike;

    this.echo = echo;
    this.channel = config.channel;
    echo.private(config.channel).listen('.notifications.changed', (event) => this.changes.set(event));
    this.connected.set(true);
  }
}
