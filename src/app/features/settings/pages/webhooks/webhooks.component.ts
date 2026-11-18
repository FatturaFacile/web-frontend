import { Component, computed, inject } from '@angular/core';
import { ExtraRecord, I18nService, PermissionsService, WebhookDeliveryParams, WebhookEndpointRequest, WebhooksApiService } from '@core';
import { NzModalService } from 'ng-zorro-antd/modal';
import { tap } from 'rxjs';
import { HubPageComponent } from '../../../resource-hub/hub-page.component';
import { f, HubTab, rows } from '../../../resource-hub/hub.types';

const STATUSES = {
  pending: 'WEBHOOKS.STATUS_PENDING',
  retrying: 'WEBHOOKS.STATUS_RETRYING',
  succeeded: 'WEBHOOKS.STATUS_SUCCEEDED',
  dead: 'WEBHOOKS.STATUS_DEAD',
};

/** Outbound webhooks: endpoints (create, enable, test, rotate the secret), event catalog and delivery log with redelivery. */
@Component({
  selector: 'app-webhooks',
  imports: [HubPageComponent],
  template: `<app-hub-page
    title="WEBHOOKS.TITLE"
    subtitle="WEBHOOKS.SUBTITLE"
    [tabs]="tabs()"
  />`,
})
export class WebhooksComponent {
  private readonly api = inject(WebhooksApiService);
  private readonly modal = inject(NzModalService);
  private readonly permissions = inject(PermissionsService);
  private readonly i18n = inject(I18nService, { optional: true });
  private readonly canWrite = computed(() => this.permissions.canWrite('integrations'));

  protected readonly tabs = computed<HubTab[]>(() => {
    const canWrite = this.canWrite();
    return [
      {
        kind: 'crud',
        title: 'WEBHOOKS.TAB_ENDPOINTS',
        hint: 'WEBHOOKS.SECRET_HINT',
        config: {
          titleKey: 'WEBHOOKS.ENDPOINT_TITLE',
          canWrite,
          list: () => rows(this.api.getEndpoints()),
          create: (p) => this.api.createEndpoint(this.toRequest(p)).pipe(tap((r) => this.showSecret(r.data))),
          update: (id, p) => this.api.updateEndpoint(id, this.toRequest(p)),
          remove: (id) => this.api.deleteEndpoint(id),
          fields: [
            f.text('name', 'COMMON.NAME', { required: true, maxLength: 120 }),
            f.text('url', 'WEBHOOKS.HTTPS_URL', { required: true, pattern: '^https://.+' }),
            f.text('events', 'WEBHOOKS.EVENTS_CSV', { required: true }),
            f.area('description', 'COMMON.DESCRIPTION', { nullable: true, column: false }),
            f.col('is_active', 'COMMON.ACTIVE'),
            f.col('status', 'COMMON.STATUS'),
          ],
          rowActions: [
            { labelKey: 'WEBHOOKS.ENABLE', run: (r) => this.api.enableEndpoint(r.id), visible: (r) => r['is_active'] === false, writeOnly: true },
            { labelKey: 'WEBHOOKS.DISABLE', run: (r) => this.api.disableEndpoint(r.id), visible: (r) => r['is_active'] !== false, writeOnly: true },
            { labelKey: 'WEBHOOKS.SEND_TEST', run: (r) => this.api.testEndpoint(r.id), writeOnly: true },
            {
              labelKey: 'WEBHOOKS.ROTATE_SECRET',
              input: { labelKey: 'WEBHOOKS.OLD_SECRET_TTL_HOURS', kind: 'decimal', optional: true },
              run: (r, v) => this.api.rotateEndpointSecret(r.id, v ? Number(v) : undefined).pipe(tap((res) => this.showSecret(res.data))),
              writeOnly: true,
            },
          ],
        },
      },
      {
        kind: 'report',
        title: 'WEBHOOKS.TAB_DELIVERIES',
        filters: [
          f.id('endpoint_id', 'WEBHOOKS.ENDPOINT_ID', { column: false }),
          f.select('status', 'COMMON.STATUS', STATUSES),
          f.text('event_name', 'WEBHOOKS.EVENT_NAME'),
        ],
        load: (p) => this.api.getDeliveries(p as WebhookDeliveryParams),
      },
      {
        kind: 'form',
        title: 'WEBHOOKS.TAB_REDELIVER',
        hint: 'WEBHOOKS.REDELIVER_HINT',
        canWrite,
        fields: [f.id('id', 'WEBHOOKS.DELIVERY_ID', { required: true })],
        submitLabel: 'WEBHOOKS.REDELIVER_BTN',
        submit: (p) => this.api.redeliver(String(p['id'])),
      },
      { kind: 'report', title: 'WEBHOOKS.TAB_CATALOG', load: () => this.api.getEventCatalog() },
    ];
  });

  private toRequest(p: Record<string, unknown>): WebhookEndpointRequest {
    const events = String(p['events'] ?? '')
      .split(',')
      .map((e) => e.trim())
      .filter((e) => e !== '');
    return { ...(p as unknown as WebhookEndpointRequest), events };
  }

  private showSecret(record: ExtraRecord): void {
    const secret = record['secret'] ?? record['signing_secret'];
    if (typeof secret === 'string') {
      const title = this.i18n ? this.i18n.translate('WEBHOOKS.SIGNING_SECRET_TITLE') : 'WEBHOOKS.SIGNING_SECRET_TITLE';
      const prefix = this.i18n ? this.i18n.translate('WEBHOOKS.SIGNING_SECRET_COPY_NOW') : 'WEBHOOKS.SIGNING_SECRET_COPY_NOW';
      this.modal.info({ nzTitle: title, nzContent: `${prefix}: ${secret}` });
    }
  }
}
